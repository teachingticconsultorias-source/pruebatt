-- ============================================================================
-- NOTA (014) · EL MODO `nitia` SE LLAMA AHORA `estandar`
--
-- Esta migración ya se ejecutó en producción y NO se reescribe: es el registro
-- de lo que se aplicó. El valor `nitia` que aparece aquí abajo lo renombra la
-- migración 014, que es la vigente. Un entorno limpio que corra 012→014 acaba
-- exactamente igual que producción.
-- ============================================================================
-- ============================================================================
-- 012 · PERSONALIZAR EXPORT · marca del colegio y plantilla propia
--
-- QUÉ HABILITA
-- ------------
-- Tres modos de exportación por docente:
--
--     nitia      → la maqueta de siempre (lib/docx/). Es el valor por defecto.
--     colegio    → la misma maqueta con el logo y los colores del colegio.
--     plantilla  → el .docx del propio colegio, relleno por marcadores.
--
-- NUMERACIÓN
-- ----------
-- Se llama 012 aunque la 013 ya esté aplicada. No es un error: tocan objetos
-- distintos —la 013 es un CHECK sobre `materiales_docente`, esta crea una tabla
-- y un bucket nuevos— así que el orden entre ambas da igual y un despliegue
-- limpio que las corra 012→013 funciona exactamente igual.
--
-- EL GATE ES DE VERDAD, NO SOLO DE INTERFAZ
-- -----------------------------------------
-- Aquí está el cambio respecto al plan que revisaste. La «opción A» tal como
-- la planteé —gate en el cliente + RLS por carpeta— dejaba un agujero: la
-- política por carpeta comprueba QUIÉN eres, no QUÉ PLAN tienes, así que un
-- docente Free podía subir su plantilla llamando al API de Storage a mano.
--
-- Se cierra con `public.puede_plantilla_propia()`, que lee la capacidad del
-- plan vigente y se usa DENTRO de la política de subida. Un Free no puede
-- insertar el objeto, punto. Y la capacidad se lee de `plans.features`, no se
-- escribe 'pro' a fuego: cambiar quién puede es cambiar el plan, no migrar.
--
-- LO QUE NO HACE
-- --------------
-- No borra filas, no toca `docentes`, ni pagos, ni créditos, ni las funciones
-- de IA. Crea una tabla, una función, un bucket y sus políticas.
--
-- PRE (opcional, para saber de dónde partes):
--   select to_regclass('public.export_branding')                        as tabla,
--          exists(select 1 from storage.buckets where id='export-templates') as bucket;
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. COMPROBACIÓN PREVIA
--
--    Sin `plans.features` no hay dónde declarar la capacidad, y el gate se
--    quedaría abierto sin que nadie se diera cuenta. Mejor abortar.
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'plans'
                   and column_name = 'features') then
    raise exception 'ABORTA: public.plans no tiene la columna features (falta la 002).';
  end if;
  if to_regprocedure('sciverse_private.effective_plan(uuid)') is null then
    raise exception 'ABORTA: no existe sciverse_private.effective_plan (falta la 002).';
  end if;
end $$;


-- ----------------------------------------------------------------------------
-- 1. LA CAPACIDAD, EN EL SITIO DONDE YA VIVEN LAS DEMÁS
--
--    `features` se FUSIONA con `||`, no se reemplaza: lo que hubiera sembrado
--    la 009 se conserva intacto.
-- ----------------------------------------------------------------------------
update public.plans
   set features = coalesce(features, '{}'::jsonb) || jsonb_build_object('docx_custom_template', false)
 where code = 'free';

update public.plans
   set features = coalesce(features, '{}'::jsonb) || jsonb_build_object('docx_custom_template', true)
 where code <> 'free';


-- ----------------------------------------------------------------------------
-- 2. ¿PUEDE ESTE DOCENTE SUBIR SU PLANTILLA?
--
--    `security definer` porque `effective_plan` está revocada para
--    `authenticated` desde la 002 y una política RLS se ejecuta con el rol de
--    quien llama. `stable` porque no escribe. `search_path` vacío, como el
--    resto de funciones del proyecto.
--
--    Devuelve false ante cualquier duda: sin sesión, sin plan resuelto o sin
--    la capacidad declarada. Un gate que falla abierto no es un gate.
-- ----------------------------------------------------------------------------
create or replace function public.puede_plantilla_propia()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select (ep.features ->> 'docx_custom_template')::boolean
       from sciverse_private.effective_plan(auth.uid()) ep
      limit 1),
    false);
$$;

revoke all on function public.puede_plantilla_propia() from public, anon;
grant execute on function public.puede_plantilla_propia() to authenticated, service_role;

comment on function public.puede_plantilla_propia() is
  'Gate de la plantilla .docx propia. Lo usa la política de subida del bucket export-templates y también puede consultarlo la interfaz. La verdad está en plans.features -> docx_custom_template.';


-- ----------------------------------------------------------------------------
-- 3. LA CONFIGURACIÓN DE CADA DOCENTE
--
--    Una fila por docente, creada la primera vez que guarda algo. No se
--    siembra para todos: quien no la tenga exporta en modo `nitia`, que es
--    justamente el valor por defecto.
--
--    `on delete cascade` porque esto es preferencia pura: si el docente
--    desaparece, no hay nada que conservar. Ojo: el cascade NO borra los
--    ficheros del bucket, que viven en otro esquema (ver la nota del final).
-- ----------------------------------------------------------------------------
create table if not exists public.export_branding (
  user_id          uuid primary key references auth.users(id) on delete cascade,

  modo             text not null default 'nitia'
                   check (modo in ('nitia', 'colegio', 'plantilla')),

  -- Modo simple: logo + posición + colores sobre la maqueta de Nitia.
  logo_path        text,
  logo_bytes       integer check (logo_bytes is null or logo_bytes <= 1048576),
  logo_posicion    text not null default 'izquierda'
                   check (logo_posicion in ('izquierda', 'centro', 'derecha')),
  -- Hex de seis dígitos SIN almohadilla, como el resto del sistema visual.
  color_primario   text check (color_primario is null or color_primario ~ '^[0-9A-Fa-f]{6}$'),
  color_acento     text check (color_acento   is null or color_acento   ~ '^[0-9A-Fa-f]{6}$'),

  -- Modo avanzado: el .docx del colegio.
  plantilla_path   text,
  plantilla_nombre text check (plantilla_nombre is null or length(plantilla_nombre) <= 200),
  plantilla_bytes  integer check (plantilla_bytes is null or plantilla_bytes <= 5242880),
  -- Marcadores {{...}} detectados al subirla, para poder decirle a la docente
  -- cuáles faltan sin tener que volver a abrir el fichero.
  plantilla_marcadores text[],
  plantilla_subida_en  timestamptz,

  creado_en        timestamptz not null default now(),
  actualizado_en   timestamptz not null default now()
);

comment on table public.export_branding is
  'Personalización de las exportaciones Word por docente. Sin fila = modo nitia. El fichero .docx y el logo viven en el bucket export-templates; aquí sólo su ruta.';

-- `actualizado_en` no puede depender de que el cliente se acuerde.
create or replace function public.tocar_export_branding()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.actualizado_en := now();
  return new;
end $$;

drop trigger if exists export_branding_actualizado on public.export_branding;
create trigger export_branding_actualizado
  before update on public.export_branding
  for each row execute function public.tocar_export_branding();


-- ----------------------------------------------------------------------------
-- 4. RLS · cada docente ve y escribe SU fila, y nada más
-- ----------------------------------------------------------------------------
alter table public.export_branding enable row level security;

drop policy if exists "Mi configuración de export · leer"     on public.export_branding;
drop policy if exists "Mi configuración de export · crear"    on public.export_branding;
drop policy if exists "Mi configuración de export · cambiar"  on public.export_branding;
drop policy if exists "Mi configuración de export · borrar"   on public.export_branding;

create policy "Mi configuración de export · leer"
  on public.export_branding for select to authenticated
  using (user_id = auth.uid());

create policy "Mi configuración de export · crear"
  on public.export_branding for insert to authenticated
  with check (user_id = auth.uid());

create policy "Mi configuración de export · cambiar"
  on public.export_branding for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Mi configuración de export · borrar"
  on public.export_branding for delete to authenticated
  using (user_id = auth.uid());


-- ----------------------------------------------------------------------------
-- 5. EL BUCKET
--
--    Privado. Un logo y una plantilla no son públicos y no hace falta que lo
--    sean: la aplicación los lee con una URL firmada de corta vida.
--
--    Va dentro de un bloque con captura de excepción, igual que el bucket de
--    la 008: en algunos proyectos el rol del editor SQL no puede tocar el
--    esquema `storage`. Si ocurre, el resto de la migración se aplica igual y
--    el aviso dice exactamente qué crear a mano.
--
--    5 MB es el tope del bucket porque manda el fichero más grande —la
--    plantilla—. El logo se limita a 1 MB en la tabla y en el navegador.
-- ----------------------------------------------------------------------------
do $$
begin
  begin
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('export-templates', 'export-templates', false, 5242880,
            array['application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                  'image/png', 'image/jpeg', 'image/webp'])
    on conflict (id) do update
      set public             = false,
          file_size_limit    = 5242880,
          allowed_mime_types = array['application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                                     'image/png', 'image/jpeg', 'image/webp'];
  exception when others then
    raise warning '[sciverse] No se pudo crear el bucket export-templates (%). Créalo a mano: Storage → New bucket → export-templates, privado, 5 MB, MIME: docx, image/png, image/jpeg, image/webp.', sqlerrm;
  end;

  -- --------------------------------------------------------------------------
  -- Políticas del bucket. La carpeta ES el dueño: `{user_id}/plantilla.docx`.
  --
  -- La de INSERT es la que cierra el gate de Pro. Las demás sólo comprueban
  -- propiedad: si un docente deja de ser Pro, conserva y puede borrar lo que
  -- ya subió —no se le secuestra su fichero—, pero no puede subir otro. Quien
  -- decide si se USA es el exportador, que consulta la capacidad.
  -- --------------------------------------------------------------------------
  begin
    drop policy if exists "Mi marca de export · leer"    on storage.objects;
    drop policy if exists "Mi marca de export · subir"   on storage.objects;
    drop policy if exists "Mi marca de export · cambiar" on storage.objects;
    drop policy if exists "Mi marca de export · borrar"  on storage.objects;

    create policy "Mi marca de export · leer"
      on storage.objects for select to authenticated
      using (bucket_id = 'export-templates'
             and (storage.foldername(name))[1] = auth.uid()::text);

    create policy "Mi marca de export · subir"
      on storage.objects for insert to authenticated
      with check (bucket_id = 'export-templates'
                  and (storage.foldername(name))[1] = auth.uid()::text
                  -- El logo es del modo simple y NO exige plan; la plantilla sí.
                  and (name not like '%.docx' or public.puede_plantilla_propia()));

    create policy "Mi marca de export · cambiar"
      on storage.objects for update to authenticated
      using (bucket_id = 'export-templates'
             and (storage.foldername(name))[1] = auth.uid()::text)
      with check (bucket_id = 'export-templates'
                  and (storage.foldername(name))[1] = auth.uid()::text
                  and (name not like '%.docx' or public.puede_plantilla_propia()));

    create policy "Mi marca de export · borrar"
      on storage.objects for delete to authenticated
      using (bucket_id = 'export-templates'
             and (storage.foldername(name))[1] = auth.uid()::text);
  exception when others then
    raise warning '[sciverse] No se pudieron crear las políticas de export-templates (%). Créalas desde Storage → export-templates → Policies, restringidas a (storage.foldername(name))[1] = auth.uid()::text.', sqlerrm;
  end;
end;
$$;


-- ============================================================================
-- OPCIONAL · RETIRAR LA CAPACIDAD MUERTA
--
-- `docx_remove_watermark` se sembró en la 009 y nunca se llegó a usar: el
-- exportador no pinta ninguna marca de agua y `permiteQuitarMarca()` no se
-- llama desde ningún endpoint. Este bloque la quita de `plans.features`.
--
-- Va COMENTADO a propósito: es la única sentencia de la migración que altera
-- datos existentes, y borrar una clave de configuración en producción merece
-- una decisión aparte. El código deja de leerla igualmente; la clave huérfana
-- es inerte mientras siga ahí.
--
--   update public.plans
--      set features = features - 'docx_remove_watermark'
--    where features ? 'docx_remove_watermark';
-- ============================================================================


-- ============================================================================
-- POST · verificación de solo lectura. Las cinco deben devolver true.
--
--   select
--     to_regclass('public.export_branding') is not null                      as tabla,
--     (select relrowsecurity from pg_class
--       where oid = 'public.export_branding'::regclass)                      as rls_activa,
--     (select count(*) = 4 from pg_policies
--       where schemaname='public' and tablename='export_branding')           as politicas_tabla,
--     exists(select 1 from storage.buckets
--             where id='export-templates' and public = false)                as bucket_privado,
--     (select count(*) = 4 from pg_policies
--       where schemaname='storage' and tablename='objects'
--         and policyname like 'Mi marca de export%')                         as politicas_bucket;
--
-- Y el gate, con la sesión de una docente Free y una Pro:
--   select public.puede_plantilla_propia();   -- false en Free, true en Pro
-- ============================================================================

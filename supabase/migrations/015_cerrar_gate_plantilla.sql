-- ============================================================================
-- 015 · LA PLANTILLA PROPIA ES EXCLUSIVA DE PRO, POR TODAS LAS VÍAS
--
-- EL AGUJERO QUE CIERRA
-- ---------------------
-- La 012 comprobaba el plan SÓLO cuando el nombre del fichero acababa en
-- `.docx`:
--
--     and (name not like '%.docx' or public.puede_plantilla_propia())
--
-- Un docente Free que subiera `<uid>/plantilla.doc`, `<uid>/p.bin` o cualquier
-- otro nombre pasaba sin que se mirara su plan. Y las políticas de
-- `public.export_branding` sólo comprobaban `user_id = auth.uid()`, sin gate
-- ninguno, así que ese mismo docente podía escribir `modo = 'plantilla'`
-- apuntando a ese fichero. `almacen.js` lo descargaba sin volver a mirar.
--
-- El filtro por extensión era la idea equivocada: la extensión la elige quien
-- sube. Se invierte la regla.
--
-- LA REGLA NUEVA, EN UNA FRASE
-- ----------------------------
-- Todo lo que entre en `export-templates` exige plan Pro, EXCEPTO el logo, que
-- tiene una ruta conocida y fija: `<uid>/logo.png|jpg|jpeg|webp`. El logo es
-- del modo «colegio», que no cuesta plan.
--
-- Se filtra por la ruta COMPLETA, no por la extensión suelta: `logo.png` vale,
-- `logo.png.docx` no, `otracosa.png` tampoco. La app sólo escribe esas rutas
-- (ver RUTA_LOGO y RUTA_PLANTILLA en lib/export/almacen.js), así que la
-- política no rompe nada que el producto haga hoy.
--
-- QUÉ NO SE TOCA, Y POR QUÉ
-- -------------------------
-- LEER y BORRAR siguen exigiendo sólo propiedad. Un docente que dejó de ser
-- Pro conserva su plantilla y puede borrarla; lo que no puede es subir otra.
-- Quitarle el acceso a su propio fichero sería castigarle por caducar.
--
-- ES REPETIBLE
-- ------------
-- Las políticas se borran antes de crearse y el `update` de saneamiento no
-- encuentra filas la segunda vez.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0 · COMPROBACIÓN PREVIA
--
--     Sin el gate no hay nada que aplicar, y las políticas quedarían citando
--     una función inexistente. Mejor abortar que dejarlo a medias.
-- ----------------------------------------------------------------------------
do $$
begin
  if to_regprocedure('public.puede_plantilla_propia()') is null then
    raise exception 'ABORTA: no existe public.puede_plantilla_propia() (falta la 012).';
  end if;
  if to_regclass('public.export_branding') is null then
    raise exception 'ABORTA: no existe public.export_branding (falta la 012).';
  end if;
end $$;


-- ----------------------------------------------------------------------------
-- 1 · ¿ES LA RUTA DEL LOGO?
--
--     La única excepción permitida, aislada en una función para que las tres
--     políticas digan lo mismo y no se desincronicen al retocarlas.
--
--     `stable` y no `immutable` porque depende de auth.uid(). Sin
--     `security definer`: no consulta nada privilegiado.
-- ----------------------------------------------------------------------------
create or replace function public.es_ruta_de_logo(ruta text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select ruta ~ ('^' || auth.uid()::text || '/logo\.(png|jpg|jpeg|webp)$');
$$;

revoke all on function public.es_ruta_de_logo(text) from public, anon;
grant execute on function public.es_ruta_de_logo(text) to authenticated, service_role;

comment on function public.es_ruta_de_logo(text) is
  'Única ruta del bucket export-templates que no exige plan Pro: el logo del modo colegio, con nombre fijo <uid>/logo.<ext>.';


-- ----------------------------------------------------------------------------
-- 2 · POLÍTICAS DEL BUCKET · la regla invertida
-- ----------------------------------------------------------------------------
do $$
begin
  drop policy if exists "Mi marca de export · subir"   on storage.objects;
  drop policy if exists "Mi marca de export · cambiar" on storage.objects;

  -- SUBIR: tuyo, y o es el logo o tienes plan.
  create policy "Mi marca de export · subir"
    on storage.objects for insert to authenticated
    with check (bucket_id = 'export-templates'
                and (storage.foldername(name))[1] = auth.uid()::text
                and (public.es_ruta_de_logo(name) or public.puede_plantilla_propia()));

  -- CAMBIAR: lo mismo, y además en el `using` — sin él, un Free podría
  -- RENOMBRAR su logo a `plantilla.docx` y acabar con una plantilla activa
  -- sin haber subido nada nuevo.
  create policy "Mi marca de export · cambiar"
    on storage.objects for update to authenticated
    using (bucket_id = 'export-templates'
           and (storage.foldername(name))[1] = auth.uid()::text
           and (public.es_ruta_de_logo(name) or public.puede_plantilla_propia()))
    with check (bucket_id = 'export-templates'
                and (storage.foldername(name))[1] = auth.uid()::text
                and (public.es_ruta_de_logo(name) or public.puede_plantilla_propia()));
exception when others then
  raise warning '[sciverse] No se pudieron recrear las políticas de export-templates (%). Revísalas a mano en Storage → export-templates → Policies.', sqlerrm;
end $$;


-- ----------------------------------------------------------------------------
-- 3 · GATE DE PLAN SOBRE LA TABLA
--
--     `modo = 'plantilla'` exige plan. `estandar` y `colegio` siguen libres:
--     el logo y los colores no cuestan nada.
--
--     Va en las políticas y NO en un CHECK de columna porque un CHECK no
--     puede llamar a auth.uid(): se evaluaría también al restaurar un backup,
--     sin sesión, y reventaría.
-- ----------------------------------------------------------------------------
drop policy if exists "Mi configuración de export · crear"   on public.export_branding;
drop policy if exists "Mi configuración de export · cambiar" on public.export_branding;

create policy "Mi configuración de export · crear"
  on public.export_branding for insert to authenticated
  with check (user_id = auth.uid()
              and (modo <> 'plantilla' or public.puede_plantilla_propia()));

create policy "Mi configuración de export · cambiar"
  on public.export_branding for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid()
              and (modo <> 'plantilla' or public.puede_plantilla_propia()));


-- ----------------------------------------------------------------------------
-- 4 · SANEAR LO QUE YA PUDIERA ESTAR MAL
--
--     Si alguien aprovechó el agujero antes de este arreglo, su fila queda
--     apuntando a una plantilla que ya no puede mantener. Se baja a `colegio`,
--     que es la caída natural, y se cuenta cuántas se tocaron.
--
--     No se borra su fichero: eso es suyo y lo decide el equipo, no una
--     migración.
-- ----------------------------------------------------------------------------
do $$
declare
  saneadas integer;
begin
  update public.export_branding b
     set modo = 'colegio'
   where b.modo = 'plantilla'
     and coalesce((select (ep.features ->> 'docx_custom_template')::boolean
                     from sciverse_private.effective_plan(b.user_id) ep
                    limit 1), false) is not true;
  get diagnostics saneadas = row_count;
  raise notice '[sciverse] filas con plantilla activa sin plan, bajadas a colegio: %', saneadas;
end $$;


comment on table public.export_branding is
  'Personalización de las exportaciones Word por docente. Sin fila = modo estandar. modo=plantilla exige plan con docx_custom_template, comprobado en las políticas de INSERT y UPDATE. El .docx y el logo viven en el bucket export-templates; aquí sólo su ruta.';

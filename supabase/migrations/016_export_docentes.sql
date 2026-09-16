-- ============================================================================
-- 016 · EXPORTAR LA LISTA DE DOCENTES, CON HUELLA
--
-- QUÉ AÑADE
-- ---------
-- `public.admin_export_docentes(...)`: el mismo listado que ya alimenta el
-- panel, pero SIN paginar y con los filtros que el export necesita. Y cada
-- llamada deja constancia en `sciverse_private.admin_audit_log`.
--
-- Y `admin_list_docentes` —el listado de la pantalla— pasa a aceptar LOS
-- MISMOS FILTROS, porque el requisito es «lo que ve en pantalla es lo que
-- baja». Sin eso serían dos verdades distintas sobre lo mismo.
--
-- POR QUÉ SON DOS FUNCIONES Y NO UNA
-- ----------------------------------
-- El listado pagina con un tope de 100 filas, a propósito, para que el
-- navegador no reciba la tabla entera al abrir el panel; y se consulta decenas
-- de veces por sesión, así que no escribe auditoría. El export no pagina y sí
-- la escribe. Son dos usos distintos.
--
-- POR QUÉ ESTA SÍ ESCRIBE EN LA AUDITORÍA
-- ---------------------------------------
-- El listado paginado se consulta decenas de veces por sesión y anotarlo sería
-- ruido. Un export es otra cosa: se lleva nombres, correos y teléfonos fuera
-- del sistema. Si esa lista aparece algún día donde no debe, hay que poder
-- saber quién la sacó, cuándo, con qué filtros y cuántas filas.
--
-- Por eso la función es VOLATILE y no `stable`: escribe.
--
-- EL TELÉFONO NO SALE PARA `support`
-- ----------------------------------
-- El recorte por rol ya existe en el servidor (`scopeForRole` en
-- `api/_lib/admin.js`) y aquí se refuerza en la base: si el rol es `support`,
-- la columna `celular` viaja en null. Dos capas, porque es el dato más
-- sensible de la tabla y no debe depender de que el llamante se acuerde.
--
-- LO QUE NO TRAE, Y POR QUÉ
-- -------------------------
-- No hay `region` ni `grado`: `public.docentes` no tiene esas columnas. La
-- región es un campo del formulario de cada generación, no un atributo del
-- docente, y derivarla de la última generación daría un dato que parece
-- fiable y no lo es. Ver docs/pendientes.md.
--
-- ES REPETIBLE
-- ------------
-- `create or replace` y ningún cambio de datos. Correrla dos veces no hace
-- nada distinto.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0 · PRECONDICIONES
--
--     Sin ellas la función quedaría citando cosas que no existen, y el fallo
--     aparecería el día que alguien pulse Exportar.
-- ----------------------------------------------------------------------------
do $$
begin
  if to_regprocedure('sciverse_private.require_admin_role(uuid,text)') is null then
    raise exception 'ABORTA: falta sciverse_private.require_admin_role (migración 006).';
  end if;
  if to_regclass('sciverse_private.admin_audit_log') is null then
    raise exception 'ABORTA: falta sciverse_private.admin_audit_log (migración 005).';
  end if;
  if to_regclass('sciverse_private.ai_generations') is null then
    raise exception 'ABORTA: falta sciverse_private.ai_generations (migración 003).';
  end if;
  if to_regprocedure('sciverse_private.effective_plan(uuid)') is null then
    raise exception 'ABORTA: falta sciverse_private.effective_plan (migración 002).';
  end if;
end $$;


-- ----------------------------------------------------------------------------
-- 1 · LA FUNCIÓN
--
--     Devuelve `{ generado_en, filas, items: [...] }`. Los filtros son todos
--     opcionales: null significa «no filtrar por esto».
-- ----------------------------------------------------------------------------
create or replace function public.admin_export_docentes(
  p_actor        uuid,
  p_search       text    default null,
  p_plan         text    default null,   -- 'free' | 'pro' | código real del plan
  p_desde        date    default null,   -- fecha de registro, inclusive
  p_hasta        date    default null,   -- fecha de registro, inclusive
  p_nivel        text    default null,   -- 'primaria' | 'secundaria'
  p_confirmado   boolean default null,   -- correo confirmado
  p_activo       boolean default null
)
returns jsonb
language plpgsql
volatile                                 -- escribe en la auditoría
security definer
set search_path = ''
as $$
declare
  v_role  text;
  v_term  text := nullif(btrim(coalesce(p_search, '')), '');
  v_rows  jsonb;
  v_total integer;
begin
  -- Lanza ADMIN_REQUIRED si no es admin. `support` basta para exportar: es el
  -- mismo dato que ya ve en pantalla, y sin el teléfono.
  v_role := sciverse_private.require_admin_role(p_actor, 'support');

  select coalesce(jsonb_agg(fila order by fila->>'created_at' desc), '[]'::jsonb)
    into v_rows
  from (
    select jsonb_build_object(
             'user_id',          d.user_id,
             'nombres',          d.nombres,
             'apellidos',        d.apellidos,
             'ie',               d.ie,
             'nivel',            d.nivel,
             -- El recorte por rol, también en la base. Ver la cabecera.
             'celular',          case when v_role = 'support' then null else d.celular end,
             'activo',           d.activo,
             'created_at',       d.created_at,
             'email',            u.email,
             'email_confirmado', (u.email_confirmed_at is not null),
             'ultimo_acceso',    u.last_sign_in_at,
             'plan',             p.plan_code,
             'plan_nombre',      p.plan_name,
             'plan_desde',       p.starts_at,
             'plan_hasta',       p.ends_at,
             'limite_semanal',   p.ai_weekly_limit,
             -- Generaciones NO devueltas: el libro, no el contador semanal.
             'generaciones_total',  coalesce(g.total, 0),
             'ultima_generacion',   g.ultima
           ) as fila
      from public.docentes d
      left join auth.users u on u.id = d.user_id
      left join lateral sciverse_private.effective_plan(d.user_id) p on true
      left join lateral (
        select count(*)::integer as total, max(x.consumed_at) as ultima
          from sciverse_private.ai_generations x
         where x.user_id = d.user_id and x.refunded_at is null
      ) g on true
     where (v_term is null
            or d.nombres   ilike '%' || v_term || '%'
            or d.apellidos ilike '%' || v_term || '%'
            or d.ie        ilike '%' || v_term || '%'
            or d.celular   ilike '%' || v_term || '%'
            or u.email     ilike '%' || v_term || '%')
       and (p_plan is null
            or p.plan_code = p_plan
            -- 'free' agrupa a quien no tiene plan de pago vigente.
            or (p_plan = 'free' and coalesce(p.plan_code, 'free') in ('free', 'gratuito')))
       and (p_desde is null or (d.created_at at time zone 'America/Lima')::date >= p_desde)
       and (p_hasta is null or (d.created_at at time zone 'America/Lima')::date <= p_hasta)
       and (p_nivel is null or lower(d.nivel) = lower(p_nivel))
       and (p_confirmado is null or (u.email_confirmed_at is not null) = p_confirmado)
       and (p_activo is null or d.activo = p_activo)
  ) s;

  v_total := jsonb_array_length(v_rows);

  -- LA HUELLA. Se escribe SIEMPRE, aunque el export salga vacío: saber que
  -- alguien lo intentó también es información.
  insert into sciverse_private.admin_audit_log
    (admin_user_id, admin_role, action, entity_type, metadata)
  values
    (p_actor, v_role, 'ADMIN_EXPORTED_DOCENTES', 'docente',
     jsonb_build_object(
       'filas', v_total,
       'incluye_celular', (v_role <> 'support'),
       'filtros', jsonb_strip_nulls(jsonb_build_object(
         'search',     v_term,
         'plan',       p_plan,
         'desde',      p_desde,
         'hasta',      p_hasta,
         'nivel',      p_nivel,
         'confirmado', p_confirmado,
         'activo',     p_activo
       ))
     ));

  return jsonb_build_object(
    'generado_en', timezone('America/Lima', now()),
    'filas',       v_total,
    'rol',         v_role,
    'items',       v_rows
  );
end;
$$;

-- Nadie la llama desde el navegador: el endpoint la invoca con la clave de
-- servicio DESPUÉS de haber comprobado el rol con el token del usuario.
revoke all on function public.admin_export_docentes(uuid, text, text, date, date, text, boolean, boolean)
  from public, anon, authenticated;
grant execute on function public.admin_export_docentes(uuid, text, text, date, date, text, boolean, boolean)
  to service_role;

comment on function public.admin_export_docentes(uuid, text, text, date, date, text, boolean, boolean) is
  'Listado completo de docentes para exportar, con filtros y sin tope de página. Exige rol admin (mínimo support), oculta el celular a support y deja huella en admin_audit_log con la acción ADMIN_EXPORTED_DOCENTES.';


-- ----------------------------------------------------------------------------
-- 2 · EL LISTADO DE LA PANTALLA ACEPTA LOS MISMOS FILTROS
--
--     El requisito es «lo que ve en pantalla es lo que baja». Sin esto, la
--     tabla mostraría todo y el fichero vendría filtrado: dos verdades
--     distintas sobre lo mismo.
--
--     Se AÑADEN parámetros opcionales, todos con `default null` = no filtrar.
--     El endpoint actual llama con `p_search`, `p_page` y `p_page_size` por
--     NOMBRE, así que sigue funcionando igual sin tocarlo.
--
--     Hay que BORRAR la versión vieja antes de crear: cambiar la firma con
--     `create or replace` dejaría las dos funciones vivas y PostgREST no
--     sabría a cuál llamar. Misma disciplina que en la 015 con las políticas,
--     por el mismo motivo: lo viejo no se va solo.
--
--     La 005 NO se reescribe —es el registro de lo que se ejecutó—. El
--     inspector 008 sí se actualizó: es una herramienta, y con la firma vieja
--     daría un falso fallo.
--
--     La búsqueda cubre ahora también el celular, que era un hueco del panel.
-- ----------------------------------------------------------------------------
drop function if exists public.admin_list_docentes(text, integer, integer);

create or replace function public.admin_list_docentes(
  p_search      text    default null,
  p_page        integer default 1,
  p_page_size   integer default 25,
  p_plan        text    default null,
  p_desde       date    default null,
  p_hasta       date    default null,
  p_nivel       text    default null,
  p_confirmado  boolean default null,
  p_activo      boolean default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $LISTADO$
declare
  v_week   date := (date_trunc('week', timezone('America/Lima', now())))::date;
  v_size   integer := least(greatest(coalesce(p_page_size, 25), 1), 100);
  v_page   integer := greatest(coalesce(p_page, 1), 1);
  v_offset integer := (v_page - 1) * v_size;
  v_term   text := nullif(btrim(coalesce(p_search, '')), '');
  v_total  bigint;
  v_rows   jsonb;
begin
  select count(*) into v_total
    from public.docentes d
    left join auth.users u on u.id = d.user_id
    cross join lateral sciverse_private.effective_plan(d.user_id) p
   where (v_term is null
          or d.nombres   ilike '%' || v_term || '%'
          or d.apellidos ilike '%' || v_term || '%'
          or d.ie        ilike '%' || v_term || '%'
          or d.celular   ilike '%' || v_term || '%'
          or u.email     ilike '%' || v_term || '%')
     and (p_plan is null
          or p.plan_code = p_plan
          or (p_plan = 'free' and coalesce(p.plan_code, 'free') in ('free', 'gratuito')))
     and (p_desde is null or (d.created_at at time zone 'America/Lima')::date >= p_desde)
     and (p_hasta is null or (d.created_at at time zone 'America/Lima')::date <= p_hasta)
     and (p_nivel is null or lower(d.nivel) = lower(p_nivel))
     and (p_confirmado is null or (u.email_confirmed_at is not null) = p_confirmado)
     and (p_activo is null or d.activo = p_activo);

  select coalesce(jsonb_agg(fila order by fila->>'created_at' desc), '[]'::jsonb)
    into v_rows
  from (
    select jsonb_build_object(
             'user_id',            d.user_id,
             'nombres',            d.nombres,
             'apellidos',          d.apellidos,
             'ie',                 d.ie,
             'nivel',              d.nivel,
             'activo',             d.activo,
             'created_at',         d.created_at,
             'email',              u.email,
             'email_confirmado',   (u.email_confirmed_at is not null),
             'ultimo_acceso',      u.last_sign_in_at,
             'plan',               p.plan_code,
             'plan_nombre',        p.plan_name,
             'plan_desde',         p.starts_at,
             'plan_hasta',         p.ends_at,
             'limite_semanal',     p.ai_weekly_limit,
             'usadas_semana',      coalesce(c.used, 0),
             'disponibles_semana', greatest(p.ai_weekly_limit - coalesce(c.used, 0), 0)
           ) as fila
      from public.docentes d
      left join auth.users u on u.id = d.user_id
      cross join lateral sciverse_private.effective_plan(d.user_id) p
      left join sciverse_private.ai_usage_counters c
             on c.user_id = d.user_id and c.period_start = v_week
     where (v_term is null
            or d.nombres   ilike '%' || v_term || '%'
            or d.apellidos ilike '%' || v_term || '%'
            or d.ie        ilike '%' || v_term || '%'
            or d.celular   ilike '%' || v_term || '%'
            or u.email     ilike '%' || v_term || '%')
       and (p_plan is null
            or p.plan_code = p_plan
            or (p_plan = 'free' and coalesce(p.plan_code, 'free') in ('free', 'gratuito')))
       and (p_desde is null or (d.created_at at time zone 'America/Lima')::date >= p_desde)
       and (p_hasta is null or (d.created_at at time zone 'America/Lima')::date <= p_hasta)
       and (p_nivel is null or lower(d.nivel) = lower(p_nivel))
       and (p_confirmado is null or (u.email_confirmed_at is not null) = p_confirmado)
       and (p_activo is null or d.activo = p_activo)
     order by d.created_at desc
     limit v_size offset v_offset
  ) s;

  return jsonb_build_object(
    'items',      v_rows,
    'total',      v_total,
    'page',       v_page,
    'page_size',  v_size,
    'pages',      greatest(ceil(v_total::numeric / v_size)::integer, 1)
  );
end;
$LISTADO$;

revoke all on function public.admin_list_docentes(text, integer, integer, text, date, date, text, boolean, boolean)
  from public, anon, authenticated;
grant execute on function public.admin_list_docentes(text, integer, integer, text, date, date, text, boolean, boolean)
  to service_role;

comment on function public.admin_list_docentes(text, integer, integer, text, date, date, text, boolean, boolean) is
  'Listado paginado del panel. Desde la 016 acepta los mismos filtros que el export y su busqueda cubre tambien el celular. Sigue con tope de 100 por pagina.';


-- ----------------------------------------------------------------------------
-- 3 · NO DAR POR BUENO LO QUE NO SE COMPROBÓ
--
--     Sin `exception when others` envolviendo nada: si algo de arriba falla,
--     la migración ya habrá abortado. Esto sólo confirma que lo que quedó en
--     el catálogo es lo que se quería, y aborta si no.
--
--     Lo que más importa: que `authenticated` NO pueda ejecutarla. Si pudiera,
--     cualquier docente con sesión se descargaría la lista entera llamando al
--     RPC a mano, que es exactamente el agujero que esto evita.
-- ----------------------------------------------------------------------------
do $$
declare
  v_oid       oid;
  v_seguridad boolean;
  v_volatil   char;
begin
  v_oid := to_regprocedure('public.admin_export_docentes(uuid,text,text,date,date,text,boolean,boolean)');
  if v_oid is null then
    raise exception 'ABORTA: admin_export_docentes no quedó creada.';
  end if;

  select p.prosecdef, p.provolatile into v_seguridad, v_volatil
    from pg_proc p where p.oid = v_oid;

  if not v_seguridad then
    raise exception 'ABORTA: admin_export_docentes no es security definer.';
  end if;
  if v_volatil <> 'v' then
    raise exception 'ABORTA: admin_export_docentes no es volatile y no podría escribir la auditoría.';
  end if;
  if has_function_privilege('authenticated', v_oid, 'execute') then
    raise exception 'ABORTA: authenticated puede ejecutar admin_export_docentes. Cualquier docente se llevaría la lista.';
  end if;
  if has_function_privilege('anon', v_oid, 'execute') then
    raise exception 'ABORTA: anon puede ejecutar admin_export_docentes.';
  end if;
  if not has_function_privilege('service_role', v_oid, 'execute') then
    raise exception 'ABORTA: service_role NO puede ejecutarla; el panel no funcionaría.';
  end if;

  raise notice '[sciverse] admin_export_docentes verificada: security definer, volatile, sólo service_role.';
end $$;


-- ----------------------------------------------------------------------------
-- 4 · Y QUE NO HAYAN QUEDADO DOS `admin_list_docentes`
--
--     Si el `drop` de arriba no hubiera encontrado la firma vieja, viviría al
--     lado de la nueva y PostgREST no sabría a cuál llamar: el panel
--     empezaría a fallar con un error de ambigüedad difícil de leer.
-- ----------------------------------------------------------------------------
do $VERIF$
declare
  v_cuantas integer;
  v_args    text;
begin
  select count(*) into v_cuantas
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'admin_list_docentes';

  if v_cuantas <> 1 then
    raise exception 'ABORTA: hay % versiones de admin_list_docentes. Debe quedar una.', v_cuantas;
  end if;

  select pg_get_function_identity_arguments(p.oid) into v_args
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'admin_list_docentes';

  if v_args not like '%boolean%' then
    raise exception 'ABORTA: admin_list_docentes quedo con la firma vieja (%). Los filtros no llegarian.', v_args;
  end if;

  if has_function_privilege('authenticated',
       'public.admin_list_docentes(text,integer,integer,text,date,date,text,boolean,boolean)', 'execute') then
    raise exception 'ABORTA: authenticated puede ejecutar admin_list_docentes.';
  end if;

  raise notice '[sciverse] admin_list_docentes: una sola version, con filtros, sin acceso para authenticated.';
end $VERIF$;


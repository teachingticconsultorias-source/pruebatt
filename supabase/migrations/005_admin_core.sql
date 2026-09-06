-- ============================================================================
-- 005_admin_core.sql   ·   IDENTIDAD ADMINISTRATIVA + AUDITORÍA + LECTURA
--
--                    ⚠️  DISEÑADA · NO EJECUTADA  ⚠️
--
-- DEPENDE DE 002_commercial_core.sql y 003_secure_ai_credits.sql.
--
-- ALCANCE — sólo esto:
--     · sciverse_private.admin_users        quién administra y con qué rol
--     · sciverse_private.admin_audit_log    qué hizo cada quien (sólo añadir)
--     · public.current_admin()              ¿soy admin? ¿con qué rol?
--     · public.admin_summary()              resumen del panel
--     · public.admin_list_docentes(...)     listado paginado y buscable
--     · public.admin_docente_detail(...)    ficha de un docente
--
-- SOLO LECTURA en cuanto a datos de docentes. Este bloque no cambia planes,
-- no suspende, no verifica pagos. La infraestructura de auditoría queda
-- lista para el bloque siguiente.
--
-- NO toca 002, 003 ni 004. NO retira ADMIN_SECRET: `api/list-docentes.js`
-- sigue funcionando hasta que el panel nuevo esté validado.
--
-- ----------------------------------------------------------------------------
-- POR QUÉ LAS FUNCIONES DE LECTURA VIVEN EN `public`
-- ----------------------------------------------------------------------------
-- Hacen falta tres cosas que ningún rol de cliente tiene:
--   1. leer `auth.users` — `service_role` NO tiene grant sobre esa tabla;
--      sólo `postgres` lo tiene, así que la función debe ser SECURITY DEFINER
--      y pertenecer a `postgres`.
--   2. leer `sciverse_private.*` — sin grants para nadie salvo el propietario.
--   3. ser invocables por HTTP desde las funciones serverless.
--
-- PostgREST sólo expone `public`, de modo que una función en
-- `sciverse_private` no sería alcanzable. Por eso viven en `public` pero con
-- EXECUTE concedido ÚNICAMENTE a `service_role`: el navegador nunca tiene esa
-- clave, así que no puede llamarlas aunque conozca el nombre.
--
-- La única excepción es `current_admin()`, que sí se concede a `authenticated`
-- porque cada quien tiene derecho a saber si es administrador.
--
-- GARANTÍAS
--     · No borra datos.   · No recrea tablas.   · No desactiva RLS.
--     · Idempotente y transaccional.
-- ============================================================================

begin;


-- ============================================================================
-- 0. PRECONDICIONES
-- ============================================================================
do $$
begin
  if to_regnamespace('sciverse_private') is null then
    raise exception 'ABORTA: falta 002_commercial_core.sql (no existe sciverse_private)';
  end if;
  if to_regclass('public.subscriptions') is null then
    raise exception 'ABORTA: falta 002_commercial_core.sql (no existe subscriptions)';
  end if;
  if to_regclass('sciverse_private.ai_usage_counters') is null then
    raise exception 'ABORTA: falta 003_secure_ai_credits.sql';
  end if;
end;
$$;


-- ============================================================================
-- 1. QUIÉN ADMINISTRA
--
--    Los administradores son usuarios normales de Auth. Lo que los distingue
--    es tener fila aquí. Ventajas: una sola autenticación, nombre real en
--    cada línea de auditoría, y revocar a alguien es `is_active = false`.
--
--    No se guarda el correo: se resuelve desde `auth.users` cuando hace falta.
--    Duplicarlo sería otra copia que mantener sincronizada.
-- ============================================================================
create table if not exists sciverse_private.admin_users (
  user_id    uuid        primary key references auth.users(id) on delete cascade,
  role       text        not null,
  is_active  boolean     not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid        references auth.users(id) on delete set null,
  notes      text,

  constraint admin_users_role_valid check (role in ('superadmin', 'admin', 'support'))
);

create index if not exists admin_users_active_idx
  on sciverse_private.admin_users (is_active, role);

revoke all on sciverse_private.admin_users from public;
revoke all on sciverse_private.admin_users from anon, authenticated;
alter table sciverse_private.admin_users enable row level security;

comment on table sciverse_private.admin_users is
  'Quién puede administrar SciVerse. Vive fuera de public para que PostgREST no lo exponga.';


-- ============================================================================
-- 2. AUDITORÍA — SÓLO SE AÑADE
--
--    `admin_role` se guarda como INSTANTÁNEA: si mañana alguien deja de ser
--    administrador, el registro debe seguir diciendo con qué rol actuó.
--
--    Nunca guarda contraseñas, tokens, secretos ni prompts.
-- ============================================================================
create table if not exists sciverse_private.admin_audit_log (
  id             bigint generated always as identity primary key,
  admin_user_id  uuid        references auth.users(id) on delete set null,
  admin_role     text,
  action         text        not null,
  target_user_id uuid        references auth.users(id) on delete set null,
  entity_type    text,
  entity_id      uuid,
  before_data    jsonb,
  after_data     jsonb,
  metadata       jsonb       not null default '{}'::jsonb,
  created_at     timestamptz not null default now()
);

create index if not exists admin_audit_log_recent_idx
  on sciverse_private.admin_audit_log (created_at desc);
create index if not exists admin_audit_log_target_idx
  on sciverse_private.admin_audit_log (target_user_id, created_at desc);
create index if not exists admin_audit_log_actor_idx
  on sciverse_private.admin_audit_log (admin_user_id, created_at desc);

revoke all on sciverse_private.admin_audit_log from public;
revoke all on sciverse_private.admin_audit_log from anon, authenticated;
alter table sciverse_private.admin_audit_log enable row level security;

-- Un historial que se puede editar no es un historial.
create or replace function sciverse_private.audit_log_is_append_only()
returns trigger
language plpgsql
as $$
begin
  raise exception 'La auditoría administrativa no se puede modificar ni borrar';
end;
$$;

drop trigger if exists admin_audit_log_no_update on sciverse_private.admin_audit_log;
create trigger admin_audit_log_no_update
  before update or delete on sciverse_private.admin_audit_log
  for each row execute function sciverse_private.audit_log_is_append_only();

comment on table sciverse_private.admin_audit_log is
  'Acciones administrativas. Sólo INSERT: un trigger rechaza UPDATE y DELETE.';


-- ============================================================================
-- 3. ¿SOY ADMINISTRADOR?
--    Única función de este fichero que puede llamar el navegador.
--    Sólo dice si quien pregunta lo es y con qué rol; nunca lista a los demás.
-- ============================================================================
create or replace function public.current_admin()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_role text;
begin
  if v_uid is null then
    return jsonb_build_object('is_admin', false, 'role', null);
  end if;

  select a.role into v_role
    from sciverse_private.admin_users a
   where a.user_id = v_uid and a.is_active;

  return jsonb_build_object('is_admin', v_role is not null, 'role', v_role);
end;
$$;


-- ============================================================================
-- 4. DATOS DE AUTH, ACOTADOS
--    Devuelve SÓLO lo que el panel necesita. Nada de hashes, tokens,
--    metadata de proveedor ni columnas de recuperación.
-- ============================================================================
create or replace function sciverse_private.auth_user_info(p_users uuid[])
returns table (
  user_id            uuid,
  email              text,
  email_confirmed_at timestamptz,
  last_sign_in_at    timestamptz,
  created_at         timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select u.id, u.email::text, u.email_confirmed_at, u.last_sign_in_at, u.created_at
    from auth.users u
   where u.id = any(p_users);
$$;


-- ============================================================================
-- 5. RESUMEN DEL PANEL
-- ============================================================================
create or replace function public.admin_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_week date := (date_trunc('week', timezone('America/Lima', now())))::date;
begin
  return jsonb_build_object(
    'docentes_total',      (select count(*) from public.docentes),
    'docentes_activos',    (select count(*) from public.docentes where activo),
    'docentes_inactivos',  (select count(*) from public.docentes where not activo),
    'email_confirmados',   (select count(*) from auth.users u
                             join public.docentes d on d.user_id = u.id
                            where u.email_confirmed_at is not null),
    'email_pendientes',    (select count(*) from auth.users u
                             join public.docentes d on d.user_id = u.id
                            where u.email_confirmed_at is null),
    'nuevos_semana',       (select count(*) from public.docentes
                            where created_at >= v_week),
    'por_plan',            coalesce((
                             select jsonb_object_agg(plan_code, n)
                               from (select s.plan_code, count(*) as n
                                       from public.subscriptions s
                                      where s.status = 'active'
                                      group by s.plan_code) x), '{}'::jsonb),
    'generaciones_semana', (select count(*) from sciverse_private.ai_generations
                            where period_start = v_week and refunded_at is null),
    'generaciones_devueltas_semana',
                           (select count(*) from sciverse_private.ai_generations
                            where period_start = v_week and refunded_at is not null),
    'materiales_total',    (select count(*) from public.materiales_docente),
    'materiales_semana',   (select count(*) from public.materiales_docente
                            where created_at >= v_week),
    'con_limite_agotado',  (select count(*)
                              from sciverse_private.ai_usage_counters c
                              cross join lateral sciverse_private.effective_plan(c.user_id) p
                             where c.period_start = v_week
                               and c.used >= p.ai_weekly_limit),
    'semana_actual',       v_week
  );
end;
$$;


-- ============================================================================
-- 6. LISTADO PAGINADO
--    La búsqueda va parametrizada, nunca concatenada.
--    `p_page_size` se acota aquí además de en el backend.
-- ============================================================================
create or replace function public.admin_list_docentes(
  p_search    text default null,
  p_page      integer default 1,
  p_page_size integer default 25
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
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
   where v_term is null
      or d.nombres   ilike '%' || v_term || '%'
      or d.apellidos ilike '%' || v_term || '%'
      or d.ie        ilike '%' || v_term || '%'
      or u.email     ilike '%' || v_term || '%';

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
     where v_term is null
        or d.nombres   ilike '%' || v_term || '%'
        or d.apellidos ilike '%' || v_term || '%'
        or d.ie        ilike '%' || v_term || '%'
        or u.email     ilike '%' || v_term || '%'
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
$$;


-- ============================================================================
-- 7. FICHA DE UN DOCENTE
-- ============================================================================
create or replace function public.admin_docente_detail(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_week date := (date_trunc('week', timezone('America/Lima', now())))::date;
  v_doc  public.docentes%rowtype;
  v_plan record;
  v_used integer;
  v_auth record;
begin
  if p_user_id is null then
    return jsonb_build_object('error', 'NOT_FOUND');
  end if;

  select * into v_doc from public.docentes where user_id = p_user_id;
  if not found then
    return jsonb_build_object('error', 'NOT_FOUND');
  end if;

  select * into v_plan from sciverse_private.effective_plan(p_user_id);

  select coalesce(c.used, 0) into v_used
    from sciverse_private.ai_usage_counters c
   where c.user_id = p_user_id and c.period_start = v_week;
  v_used := coalesce(v_used, 0);

  select u.email::text as email, u.email_confirmed_at, u.last_sign_in_at
    into v_auth
    from auth.users u where u.id = p_user_id;

  return jsonb_build_object(
    'perfil', jsonb_build_object(
      'user_id',    v_doc.user_id,
      'nombres',    v_doc.nombres,
      'apellidos',  v_doc.apellidos,
      'ie',         v_doc.ie,
      'nivel',      v_doc.nivel,
      'celular',    v_doc.celular,
      'created_at', v_doc.created_at
    ),
    'cuenta', jsonb_build_object(
      'email',            v_auth.email,
      'email_confirmado', (v_auth.email_confirmed_at is not null),
      'ultimo_acceso',    v_auth.last_sign_in_at,
      'activo',           v_doc.activo
    ),
    'plan', jsonb_build_object(
      'code',           v_plan.plan_code,
      'nombre',         v_plan.plan_name,
      'desde',          v_plan.starts_at,
      'hasta',          v_plan.ends_at,
      'por_fallback',   v_plan.is_fallback,
      'limite_semanal', v_plan.ai_weekly_limit,
      'usadas',         v_used,
      'disponibles',    greatest(v_plan.ai_weekly_limit - v_used, 0)
    ),
    'historial_planes', coalesce((
      select jsonb_agg(jsonb_build_object(
               'plan', s.plan_code, 'estado', s.status, 'origen', s.source,
               'desde', s.starts_at, 'hasta', s.ends_at)
             order by s.starts_at desc)
        from public.subscriptions s where s.user_id = p_user_id), '[]'::jsonb),
    'generaciones', jsonb_build_object(
      'total',        (select count(*) from sciverse_private.ai_generations
                        where user_id = p_user_id),
      'devueltas',    (select count(*) from sciverse_private.ai_generations
                        where user_id = p_user_id and refunded_at is not null),
      'recientes',    coalesce((
        select jsonb_agg(jsonb_build_object(
                 'fecha', g.consumed_at, 'devuelta', (g.refunded_at is not null))
               order by g.consumed_at desc)
          from (select * from sciverse_private.ai_generations
                 where user_id = p_user_id
                 order by consumed_at desc limit 10) g), '[]'::jsonb)
    ),
    'materiales', jsonb_build_object(
      'total',     (select count(*) from public.materiales_docente
                     where user_id = p_user_id),
      'por_tipo',  coalesce((
        select jsonb_object_agg(tipo, n)
          from (select tipo, count(*) as n from public.materiales_docente
                 where user_id = p_user_id group by tipo) t), '{}'::jsonb),
      'recientes', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'titulo', m.titulo, 'tipo', m.tipo, 'area', m.area,
                 'grado', m.grado, 'fecha', m.created_at)
               order by m.created_at desc)
          from (select * from public.materiales_docente
                 where user_id = p_user_id
                 order by created_at desc limit 10) m), '[]'::jsonb)
    )
  );
end;
$$;


-- ============================================================================
-- 8. PERMISOS
--    Se revoca de PUBLIC, anon Y authenticated antes de conceder: los
--    privilegios por defecto del proyecto ya concedieron a los dos últimos al
--    crear cada función.
-- ============================================================================
revoke all on function public.current_admin()                              from public, anon, authenticated;
revoke all on function public.admin_summary()                              from public, anon, authenticated;
revoke all on function public.admin_list_docentes(text, integer, integer)  from public, anon, authenticated;
revoke all on function public.admin_docente_detail(uuid)                   from public, anon, authenticated;
revoke all on function sciverse_private.auth_user_info(uuid[])             from public, anon, authenticated;

-- Cada quien puede saber si es administrador.
grant execute on function public.current_admin() to authenticated, service_role;

-- Los datos, sólo para el backend. El navegador nunca tiene service_role.
grant execute on function public.admin_summary()                             to service_role;
grant execute on function public.admin_list_docentes(text, integer, integer) to service_role;
grant execute on function public.admin_docente_detail(uuid)                  to service_role;
grant execute on function sciverse_private.auth_user_info(uuid[])            to service_role;

-- USAGE sobre el esquema privado para poder invocar sus funciones. Las TABLAS
-- siguen sin grants: las funciones son SECURITY DEFINER y no lo necesitan.
grant usage on schema sciverse_private to service_role;


commit;


-- ============================================================================
-- BOOTSTRAP DEL PRIMER SUPERADMIN  ·  ejecutar aparte, a mano
-- ============================================================================
--
-- 1) Crea la cuenta por el registro normal de SciVerse, o desde
--    Supabase → Authentication → Users → Add user.
--
-- 2) Averigua su UUID (no hace falta enseñárselo a nadie):
--
--      select id from auth.users where email = 'correo-del-admin@ejemplo.com';
--
-- 3) Conviértela en superadmin sustituyendo el UUID:
--
--      insert into sciverse_private.admin_users (user_id, role, notes)
--      values ('00000000-0000-0000-0000-000000000000', 'superadmin',
--              'Bootstrap inicial')
--      on conflict (user_id) do update
--        set role = 'superadmin', is_active = true, updated_at = now();
--
-- 4) Comprueba, ya con esa sesión abierta en la aplicación:
--
--      select public.current_admin();      -- {"is_admin": true, "role": "superadmin"}
--
-- CONVIENE tener SIEMPRE al menos dos superadmins: si se pierde el acceso a
-- la única cuenta, recuperarlo exige volver aquí con el SQL Editor.
--
--
-- ============================================================================
-- PLAN DE ROLLBACK
-- ============================================================================
--
--   begin;
--   drop function if exists public.admin_docente_detail(uuid);
--   drop function if exists public.admin_list_docentes(text, integer, integer);
--   drop function if exists public.admin_summary();
--   drop function if exists public.current_admin();
--   drop function if exists sciverse_private.auth_user_info(uuid[]);
--   drop trigger  if exists admin_audit_log_no_update on sciverse_private.admin_audit_log;
--   drop function if exists sciverse_private.audit_log_is_append_only();
--   drop table    if exists sciverse_private.admin_audit_log;   -- PIERDE LA AUDITORÍA
--   drop table    if exists sciverse_private.admin_users;
--   revoke usage on schema sciverse_private from service_role;
--   commit;
--
-- `api/list-docentes.js` y ADMIN_SECRET siguen funcionando, así que revertir
-- no deja el proyecto sin panel de administración.
-- ============================================================================

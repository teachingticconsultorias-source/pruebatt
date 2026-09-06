-- ============================================================================
-- 002_commercial_core.sql   ·   PLANES + SUSCRIPCIONES + PLAN EFECTIVO
--
--                    ⚠️  DISEÑADA · NO EJECUTADA  ⚠️
--
-- Núcleo mínimo definitivo para que los créditos nazcan sobre la arquitectura
-- aprobada (docs/audit/27) en vez de sobre columnas en `docentes` que habría
-- que mover a los dos días.
--
-- ALCANCE — sólo esto:
--     · public.plans                catálogo
--     · public.subscriptions        qué plan tiene cada docente
--     · plan Free sembrado
--     · resolución del plan efectivo (una sola fuente)
--     · suscripción Free automática al crearse el perfil
--
-- NO incluye: pagos, panel admin, auditoría, analítica, UI, correos,
-- material types, sync de perfil, ni los créditos (van en 003).
--
-- NO toca `crear_perfil_docente()`, que funciona en producción.
-- NO toca `docentes.plan` todavía: se lee para sembrar y se deja en su sitio.
--
-- ----------------------------------------------------------------------------
-- ANTES DE EJECUTAR
-- ----------------------------------------------------------------------------
-- Ejecutar el censo de planes del inspector:
--     supabase/inspect/002_production_state_consolidated.sql  →  «14 CENSO ·
--     docentes · distribucion de plan»
-- El paso 0 aborta si aparece algún valor de `plan` que este fichero no sabe
-- traducir, para no degradar a nadie que ya esté pagando.
--
-- GARANTÍAS
--     · No borra datos ni columnas.   · No recrea tablas.
--     · No desactiva RLS.             · No toca políticas existentes.
--     · Idempotente y transaccional.
-- ============================================================================

begin;


-- ============================================================================
-- 0. PRECONDICIONES
-- ============================================================================
do $$
declare
  v_desconocidos text;
begin
  if to_regclass('public.docentes') is null then
    raise exception 'ABORTA: no existe public.docentes';
  end if;

  -- Cualquier plan que no sepamos traducir se para aquí. Degradar en silencio
  -- a alguien que paga sería peor que no ejecutar nada.
  select string_agg(distinct plan, ', ')
    into v_desconocidos
    from public.docentes
   where plan is not null
     and lower(plan) not in ('gratuito', 'free');

  if v_desconocidos is not null then
    raise exception
      'ABORTA: hay planes sin equivalencia (%). Añádelos al catálogo del paso 2 y a la traducción del paso 5 antes de continuar.',
      v_desconocidos;
  end if;
end;
$$;


-- ============================================================================
-- 1. ESQUEMA PRIVADO
--    PostgREST sólo expone `public`. Además, los ALTER DEFAULT PRIVILEGES del
--    proyecto conceden ALL a `anon` sobre cada tabla nueva de `public`, y no
--    alcanzan a los esquemas nuevos. Lo que no deba ver el navegador vive aquí.
-- ============================================================================
create schema if not exists sciverse_private;
revoke all on schema sciverse_private from public;
revoke all on schema sciverse_private from anon, authenticated;


-- ============================================================================
-- 2. CATÁLOGO DE PLANES
--
--    Columna vs `features`: si el backend lo hace cumplir, filtra u ordena por
--    ello, es COLUMNA. `ai_weekly_limit` es columna precisamente para que el
--    límite que aplica el servidor NO dependa de texto mostrado al usuario.
--    `features` queda para interruptores que crecerán sin migración.
-- ============================================================================
create table if not exists public.plans (
  code                  text        primary key,
  name                  text        not null,
  description           text,
  ai_weekly_limit       integer     not null,
  price_cents           integer     not null default 0,
  currency              char(3)     not null default 'PEN',
  billing_period_months integer,
  features              jsonb       not null default '{}'::jsonb,
  is_active             boolean     not null default true,
  sort_order            integer     not null default 0,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint plans_code_format          check (code ~ '^[a-z][a-z0-9_]{1,30}$'),
  constraint plans_ai_weekly_limit_min  check (ai_weekly_limit >= 0),
  constraint plans_price_min            check (price_cents >= 0),
  constraint plans_period_positive      check (billing_period_months is null
                                               or billing_period_months > 0)
);

create index if not exists plans_visible_idx
  on public.plans (is_active, sort_order);

comment on table  public.plans is
  'Catálogo de planes. Fuente única del límite de IA que aplica el backend.';
comment on column public.plans.ai_weekly_limit is
  'Límite semanal aplicado por consume_ai_credit. NO es texto de interfaz.';
comment on column public.plans.features is
  'Interruptores de beneficio. Nada que el backend deba hacer cumplir por sí solo.';

-- Sólo el plan gratuito. Los nombres comerciales de los de pago se decidirán
-- en el bloque de pagos; sembrarlos ahora sería inventarlos.
insert into public.plans (code, name, description, ai_weekly_limit,
                          price_cents, billing_period_months, sort_order)
values ('free', 'Gratuito',
        'Acceso a las herramientas esenciales con 5 creaciones por semana.',
        5, 0, null, 0)
on conflict (code) do nothing;


-- ============================================================================
-- 3. SUSCRIPCIONES
--
--    Historial completo: cada cambio de plan es una fila nueva y la vigente es
--    la que tiene status='active'. No se guarda nada que pueda calcularse.
-- ============================================================================
create table if not exists public.subscriptions (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users(id) on delete cascade,
  plan_code     text        not null references public.plans(code)
                            on update cascade on delete restrict,
  status        text        not null default 'active',
  source        text        not null,
  starts_at     timestamptz not null default now(),
  ends_at       timestamptz,
  cancelled_at  timestamptz,
  cancel_reason text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint subscriptions_status_valid check (
    status in ('active', 'expired', 'cancelled', 'suspended')),
  constraint subscriptions_source_valid check (
    source in ('free_default', 'admin_manual', 'manual_payment', 'future_gateway')),
  constraint subscriptions_window_valid check (
    ends_at is null or ends_at > starts_at),
  constraint subscriptions_cancelled_coherent check (
    (status = 'cancelled') = (cancelled_at is not null))
);

-- LA pieza clave: la BASE impide dos suscripciones activas por docente.
-- No depende de la aplicación ni de que dos administradores no coincidan.
create unique index if not exists subscriptions_one_active_per_user
  on public.subscriptions (user_id)
  where status = 'active';

create index if not exists subscriptions_user_history_idx
  on public.subscriptions (user_id, starts_at desc);

create index if not exists subscriptions_expiry_idx
  on public.subscriptions (status, ends_at)
  where status = 'active' and ends_at is not null;

comment on table public.subscriptions is
  'Una fila por asignación de plan. Sólo una activa por docente (índice parcial).';
comment on column public.subscriptions.ends_at is
  'NULL = sin vencimiento (caso del plan gratuito).';


-- ============================================================================
-- 4. RESOLUCIÓN DEL PLAN EFECTIVO — fuente única
--
--    Evaluación PEREZOSA: el vencimiento se calcula al leer. No hay pg_cron en
--    este proyecto, y aunque lo hubiera, un job deja una ventana en la que un
--    plan vencido sigue dando acceso. Aquí esa ventana no existe.
--
--    Si no hay suscripción válida, cae a `free` de forma segura: nunca
--    devuelve NULL y nunca deja a nadie sin límite definido.
-- ============================================================================
create or replace function sciverse_private.effective_plan(p_user uuid)
returns table (
  plan_code       text,
  plan_name       text,
  ai_weekly_limit integer,
  features        jsonb,
  subscription_id uuid,
  status          text,
  starts_at       timestamptz,
  ends_at         timestamptz,
  is_fallback     boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_sub public.subscriptions%rowtype;
  v_pl  public.plans%rowtype;
begin
  if p_user is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select * into v_sub
    from public.subscriptions s
   where s.user_id = p_user
     and s.status = 'active'
     and s.starts_at <= now()
     and (s.ends_at is null or s.ends_at > now())
   order by s.starts_at desc
   limit 1;

  if found then
    select * into v_pl from public.plans where code = v_sub.plan_code;
    if not found or not v_pl.is_active then
      -- El plan salió del catálogo o se desactivó: no se deja al docente sin
      -- límite, se le trata como gratuito y se sigue.
      v_sub := null;
    end if;
  end if;

  if v_sub.id is null then
    select * into v_pl from public.plans where code = 'free';
    if not found then
      -- Error de operación, no de usuario: que se vea.
      raise exception 'PLAN_CATALOG_MISSING: falta el plan free en public.plans';
    end if;

    return query select
      v_pl.code, v_pl.name, v_pl.ai_weekly_limit, v_pl.features,
      null::uuid, 'active'::text, null::timestamptz, null::timestamptz, true;
    return;
  end if;

  return query select
    v_pl.code, v_pl.name, v_pl.ai_weekly_limit, v_pl.features,
    v_sub.id, v_sub.status, v_sub.starts_at, v_sub.ends_at, false;
end;
$$;

comment on function sciverse_private.effective_plan(uuid) is
  'Fuente única del plan vigente. Evaluación perezosa: no depende de cron.';


-- Lectura para el propio docente. Es lo que consumirá la interfaz.
create or replace function public.get_my_plan()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_p   record;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select * into v_p from sciverse_private.effective_plan(v_uid);

  return jsonb_build_object(
    'plan',        v_p.plan_code,
    'plan_name',   v_p.plan_name,
    'limit',       v_p.ai_weekly_limit,
    'features',    v_p.features,
    'starts_at',   v_p.starts_at,
    'ends_at',     v_p.ends_at,
    'is_fallback', v_p.is_fallback
  );
end;
$$;


-- ============================================================================
-- 5. SIEMBRA PARA LOS DOCENTES QUE YA EXISTEN
--    Todos al plan gratuito. El paso 0 ya garantizó que nadie tiene otro.
-- ============================================================================
insert into public.subscriptions (user_id, plan_code, status, source, starts_at)
select d.user_id,
       'free',
       'active',
       'free_default',
       coalesce(d.created_at, now())
  from public.docentes d
 where d.user_id is not null
   and not exists (
     select 1 from public.subscriptions s
      where s.user_id = d.user_id and s.status = 'active'
   );


-- ============================================================================
-- 6. SUSCRIPCIÓN AUTOMÁTICA AL CREARSE EL PERFIL
--
--    Trigger sobre `public.docentes`, NO sobre `auth.users` ni dentro de
--    `crear_perfil_docente()`:
--
--      · No toca la función que ya funciona en producción, como se pidió.
--      · Colgar de `docentes` garantiza que el perfil ya existe; un trigger
--        sobre auth.users dependería del orden alfabético entre triggers.
--      · Si algo falla aquí, NO tumba el registro: el bloque EXCEPTION lo
--        convierte en aviso. La docente entra igual, y `effective_plan` la
--        resuelve como gratuita hasta que se materialice la fila.
--
--    Es decir: el trigger es el camino normal y el fallback del resolutor es
--    la garantía. Ninguno de los dos, por sí solo, cubre todos los casos.
-- ============================================================================
create or replace function sciverse_private.crear_suscripcion_free()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.user_id is null then
    return new;
  end if;

  begin
    insert into public.subscriptions (user_id, plan_code, status, source)
    values (new.user_id, 'free', 'active', 'free_default')
    on conflict do nothing;
  exception when others then
    -- Nunca romper el registro por esto.
    raise warning '[sciverse] no se pudo crear la suscripción free de %: %',
      new.user_id, sqlerrm;
  end;

  return new;
end;
$$;

drop trigger if exists al_crear_perfil_suscripcion on public.docentes;
create trigger al_crear_perfil_suscripcion
  after insert on public.docentes
  for each row execute function sciverse_private.crear_suscripcion_free();


-- ============================================================================
-- 7. RLS Y PERMISOS
--    Obligatorio revocar de `anon` Y `authenticated` antes de conceder: los
--    privilegios por defecto ya les han dado ALL al crear las tablas, y
--    revocar de PUBLIC (pseudo-rol) no quita esas concesiones explícitas.
-- ============================================================================

-- ---- plans: catálogo de lectura pública ------------------------------------
alter table public.plans enable row level security;

revoke all on public.plans from public;
revoke all on public.plans from anon, authenticated;
grant select on public.plans to anon, authenticated;

drop policy if exists "Catalogo de planes visible" on public.plans;
create policy "Catalogo de planes visible"
  on public.plans for select
  to anon, authenticated
  using (is_active);

-- ---- subscriptions: cada quien ve la suya, nadie escribe -------------------
alter table public.subscriptions enable row level security;

revoke all on public.subscriptions from public;
revoke all on public.subscriptions from anon, authenticated;
grant select on public.subscriptions to authenticated;

drop policy if exists "Docente lee sus suscripciones" on public.subscriptions;
create policy "Docente lee sus suscripciones"
  on public.subscriptions for select
  to authenticated
  using (auth.uid() = user_id);

-- Sin políticas de INSERT/UPDATE/DELETE a propósito: cambiar de plan es
-- competencia del backend, nunca del navegador.

-- ---- funciones -------------------------------------------------------------
revoke all on function sciverse_private.effective_plan(uuid) from public, anon, authenticated;
revoke all on function public.get_my_plan()                  from public, anon, authenticated;

grant execute on function public.get_my_plan() to authenticated, service_role;
-- effective_plan queda sólo para service_role y para las funciones SECURITY
-- DEFINER que la llaman; el navegador pasa por get_my_plan().
grant execute on function sciverse_private.effective_plan(uuid) to service_role;


commit;


-- ============================================================================
-- VERIFICACIÓN POSTERIOR · solo lectura
-- ============================================================================
--
-- -- 1. Catálogo sembrado
-- select code, name, ai_weekly_limit, is_active from public.plans order by sort_order;
--
-- -- 2. Toda docente con user_id tiene exactamente una suscripción activa
-- select (select count(*) from public.docentes where user_id is not null) as docentes,
--        (select count(*) from public.subscriptions where status = 'active') as activas,
--        (select count(*) from public.docentes d where d.user_id is not null
--            and not exists (select 1 from public.subscriptions s
--                             where s.user_id = d.user_id and s.status='active')) as sin_plan;
-- -- Esperado: docentes = activas, sin_plan = 0
--
-- -- 3. El índice parcial existe
-- select indexname, indexdef from pg_indexes
--  where schemaname='public' and tablename='subscriptions';
--
-- -- 4. Permisos: anon no debe poder escribir nada
-- select table_name, grantee, string_agg(privilege_type, ', ' order by privilege_type)
--   from information_schema.role_table_grants
--  where table_schema='public' and table_name in ('plans','subscriptions')
--    and grantee in ('anon','authenticated')
--  group by table_name, grantee;
-- -- Esperado: sólo SELECT. anon no debe aparecer en subscriptions.
--
--
-- ============================================================================
-- PLAN DE ROLLBACK
-- ============================================================================
--
--   begin;
--   drop trigger  if exists al_crear_perfil_suscripcion on public.docentes;
--   drop function if exists sciverse_private.crear_suscripcion_free();
--   drop function if exists public.get_my_plan();
--   drop function if exists sciverse_private.effective_plan(uuid);
--   drop table    if exists public.subscriptions;   -- PIERDE EL HISTORIAL
--   drop table    if exists public.plans;
--   commit;
--
-- `docentes.plan` nunca se tocó, así que el estado anterior se recupera
-- entero. Si 003 ya está aplicada, revertirla ANTES que esta: sus funciones
-- dependen de effective_plan().
-- ============================================================================

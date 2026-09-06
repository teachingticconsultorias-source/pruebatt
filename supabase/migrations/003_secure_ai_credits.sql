-- ============================================================================
-- 003_secure_ai_credits.sql   ·   CRÉDITOS DE IA SOBRE EL NÚCLEO COMERCIAL
--
--                    ⚠️  DISEÑADA · NO EJECUTADA  ⚠️
--
-- DEPENDE DE 002_commercial_core.sql. Aplicar en ese orden.
--
-- Sustituye a la versión anterior de esta migración, que guardaba el límite y
-- el contador como columnas de `public.docentes`. Ver «QUÉ CAMBIÓ» abajo.
--
-- ----------------------------------------------------------------------------
-- QUÉ PROBLEMA RESUELVE
-- ----------------------------------------------------------------------------
-- La generación con IA está caída en producción: los cinco endpoints llaman a
-- `consume_ai_credit` antes de tocar Gemini y esa función no existe, así que
-- PostgREST devuelve 404 y la generación nunca llega a ejecutarse.
--
-- ----------------------------------------------------------------------------
-- QUÉ CAMBIÓ RESPECTO A LA 002 ANTERIOR
-- ----------------------------------------------------------------------------
--   1. `public.docentes` NO recibe ninguna columna. Antes se le añadían
--      ai_weekly_limit, ai_week_used y ai_week_start.
--   2. El LÍMITE ya no se guarda por docente: se resuelve con
--      sciverse_private.effective_plan() → public.plans.ai_weekly_limit.
--      Cambiar el límite de un plan lo cambia para todos sin tocar una sola
--      fila de docente.
--   3. El CONTADOR vive en sciverse_private.ai_usage_counters, no en
--      `docentes`. El cliente no puede ni verlo.
--   4. El libro pasa a llamarse `ai_generations` (antes
--      `ai_credit_consumptions`): es el nombre definitivo, porque el bloque de
--      medición le añadirá modelo, tokens y duración sin renombrar nada.
--   5. `get_ai_credit_status()` deja de escribir. Antes reiniciaba la semana en
--      cada lectura; el indicador de créditos se consulta a menudo y no debe
--      provocar escrituras ni contención. Ahora una semana caducada se lee
--      como 0 usadas y el reinicio real ocurre en el siguiente consumo.
--   6. Se conserva sin cambios: FOR UPDATE, ventana de 30 min, vale de un solo
--      uso, mismo usuario, sin negativos, idempotencia, y la restricción por
--      columnas de `docentes`.
--
-- ----------------------------------------------------------------------------
-- DEPENDENCIA DE CÓDIGO — LEER ANTES DE APLICAR
-- ----------------------------------------------------------------------------
-- `refund_ai_credit` exige argumento. Aplicar esto sin desplegar el cambio de
-- código deja la generación FUNCIONANDO pero sin devolver el crédito cuando
-- Gemini falla. Estado degradado, no roto. Desplegar ambos en la misma
-- ventana. NO se crea una versión sin argumentos: existir sería reabrir el
-- agujero que esta migración cierra.
--
-- GARANTÍAS
--     · No borra datos ni columnas.   · No recrea tablas.
--     · No desactiva RLS.             · Idempotente y transaccional.
-- ============================================================================

begin;


-- ============================================================================
-- 0. PRECONDICIONES
-- ============================================================================
do $$
begin
  if to_regprocedure('sciverse_private.effective_plan(uuid)') is null then
    raise exception 'ABORTA: falta 002_commercial_core.sql (no existe effective_plan)';
  end if;

  if not exists (select 1 from public.plans where code = 'free') then
    raise exception 'ABORTA: el catálogo no tiene el plan free';
  end if;

  if to_regprocedure('public.refund_ai_credit()') is not null then
    raise exception
      'ABORTA: ya existe refund_ai_credit() sin argumentos. Revisar a mano antes de continuar.';
  end if;
end;
$$;


-- ============================================================================
-- 1. CONTADOR SEMANAL
--
--    Una fila por docente. Existe por dos motivos concretos:
--      · es el objeto sobre el que se toma el bloqueo que serializa consumos;
--      · evita contar filas del libro en cada generación.
--    La verdad histórica sigue siendo `ai_generations`; esto es el atajo, y
--    ambos se pueden reconciliar (consulta al final del fichero).
-- ============================================================================
create table if not exists sciverse_private.ai_usage_counters (
  user_id      uuid        primary key references auth.users(id) on delete cascade,
  period_start date        not null,
  used         integer     not null default 0,
  updated_at   timestamptz not null default now(),

  constraint ai_usage_counters_used_min check (used >= 0)
);

revoke all on sciverse_private.ai_usage_counters from public;
revoke all on sciverse_private.ai_usage_counters from anon, authenticated;
alter table sciverse_private.ai_usage_counters enable row level security;

comment on table sciverse_private.ai_usage_counters is
  'Contador semanal de IA. Objeto de bloqueo del consumo. Verdad histórica: ai_generations.';


-- ============================================================================
-- 2. LIBRO DE GENERACIONES
--    El `id` es a la vez identificador de la generación y vale de reembolso.
--    `refunded_at` lo convierte en un vale de un solo uso.
--    El bloque de medición añadirá aquí modelo, tokens, duración y estado.
-- ============================================================================
create table if not exists sciverse_private.ai_generations (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users(id) on delete cascade,
  period_start  date        not null,
  consumed_at   timestamptz not null default now(),
  refunded_at   timestamptz,
  refund_reason text
);

create index if not exists ai_generations_user_idx
  on sciverse_private.ai_generations (user_id, consumed_at desc);

-- Para la reconciliación contador ↔ libro.
create index if not exists ai_generations_period_idx
  on sciverse_private.ai_generations (user_id, period_start)
  where refunded_at is null;

revoke all on sciverse_private.ai_generations from public;
revoke all on sciverse_private.ai_generations from anon, authenticated;
alter table sciverse_private.ai_generations enable row level security;

comment on table sciverse_private.ai_generations is
  'Una fila por crédito consumido. El id es el vale de reembolso, de un solo uso.';


-- ============================================================================
-- 3. ESTADO DE CRÉDITOS — sin efectos secundarios
--
--    STABLE y sin escrituras: el indicador de la interfaz lo consulta a
--    menudo y no debe generar contención. Una semana caducada se lee como
--    0 usadas; el reinicio real lo hace el consumo.
-- ============================================================================
create or replace function public.get_ai_credit_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  v_week   date := (date_trunc('week', timezone('America/Lima', now())))::date;
  v_plan   record;
  v_used   integer;
  v_activo boolean;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select d.activo into v_activo
    from public.docentes d where d.user_id = v_uid;
  if not found then
    raise exception 'PROFILE_NOT_FOUND';
  end if;

  select * into v_plan from sciverse_private.effective_plan(v_uid);

  -- Si el contador es de otra semana, cuenta como 0 sin escribir nada.
  select case when c.period_start = v_week then c.used else 0 end
    into v_used
    from sciverse_private.ai_usage_counters c
   where c.user_id = v_uid;

  v_used := coalesce(v_used, 0);

  return jsonb_build_object(
    'plan',       v_plan.plan_code,
    'plan_name',  v_plan.plan_name,
    'limit',      v_plan.ai_weekly_limit,
    'used',       v_used,
    'remaining',  greatest(v_plan.ai_weekly_limit - v_used, 0),
    'week_start', v_week,
    'next_reset', v_week + 7,
    'active',     v_activo
  );
end;
$$;


-- ============================================================================
-- 4. CONSUMO
--
--    SIN ARGUMENTOS a propósito: el código vigente la invoca con body "{}".
--    Añadir un parámetro cambiaría la resolución de PostgREST y el objetivo
--    es que la generación vuelva hoy.
--
--    Concurrencia: el INSERT ... ON CONFLICT DO UPDATE crea la fila si no
--    existe y, en ambos casos, la deja BLOQUEADA. Resuelve de un golpe la
--    carrera del primer consumo y la de dos pestañas a la vez.
-- ============================================================================
create or replace function public.consume_ai_credit()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_week    date := (date_trunc('week', timezone('America/Lima', now())))::date;
  v_plan    record;
  v_counter sciverse_private.ai_usage_counters%rowtype;
  v_activo  boolean;
  v_gen     uuid;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select d.activo into v_activo
    from public.docentes d where d.user_id = v_uid;
  if not found then
    raise exception 'PROFILE_NOT_FOUND';
  end if;
  if not v_activo then
    raise exception 'ACCOUNT_INACTIVE';
  end if;

  select * into v_plan from sciverse_private.effective_plan(v_uid);

  -- Crea y bloquea en una sola sentencia. Desde aquí, serie para este docente.
  insert into sciverse_private.ai_usage_counters (user_id, period_start, used)
  values (v_uid, v_week, 0)
  on conflict (user_id) do update set updated_at = now()
  returning * into v_counter;

  -- Semana nueva: reinicio.
  if v_counter.period_start <> v_week then
    update sciverse_private.ai_usage_counters
       set period_start = v_week, used = 0, updated_at = now()
     where user_id = v_uid
    returning * into v_counter;
  end if;

  if v_counter.used >= v_plan.ai_weekly_limit then
    return jsonb_build_object(
      'ok',         false,
      'reason',     'WEEKLY_LIMIT_REACHED',
      'plan',       v_plan.plan_code,
      'limit',      v_plan.ai_weekly_limit,
      'used',       v_counter.used,
      'remaining',  0,
      'week_start', v_week,
      'next_reset', v_week + 7
    );
  end if;

  update sciverse_private.ai_usage_counters
     set used = used + 1, updated_at = now()
   where user_id = v_uid
  returning * into v_counter;

  insert into sciverse_private.ai_generations (user_id, period_start)
  values (v_uid, v_week)
  returning id into v_gen;

  return jsonb_build_object(
    'ok',             true,
    'consumption_id', v_gen,
    'plan',           v_plan.plan_code,
    'limit',          v_plan.ai_weekly_limit,
    'used',           v_counter.used,
    'remaining',      greatest(v_plan.ai_weekly_limit - v_counter.used, 0),
    'week_start',     v_week,
    'next_reset',     v_week + 7
  );
end;
$$;


-- ============================================================================
-- 5. REEMBOLSO CONTRA VALE
--
--    Cinco condiciones, todas obligatorias:
--      1. hay sesión                        → AUTH_REQUIRED
--      2. el vale existe y es de quien llama→ CONSUMPTION_NOT_FOUND
--      3. no se ha reembolsado ya           → ALREADY_REFUNDED (idempotente)
--      4. dentro de la ventana              → REFUND_WINDOW_EXPIRED
--      5. la semana no se ha reiniciado     → si cambió, no se toca el contador
--
--    La 5 no es cosmética: un consumo del domingo reembolsado el lunes
--    descontaría del contador NUEVO y regalaría un crédito. El vale se marca
--    igualmente para que no quede vivo.
-- ============================================================================
create or replace function public.refund_ai_credit(p_consumption uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_week    date := (date_trunc('week', timezone('America/Lima', now())))::date;
  v_gen     sciverse_private.ai_generations%rowtype;
  v_counter sciverse_private.ai_usage_counters%rowtype;
  v_plan    record;
  c_window  constant interval := interval '30 minutes';
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if p_consumption is null then
    return jsonb_build_object('ok', false, 'reason', 'MISSING_CONSUMPTION');
  end if;

  -- Bloquea el vale: dos reembolsos simultáneos del mismo se serializan y el
  -- segundo encuentra refunded_at ya puesto.
  select * into v_gen
    from sciverse_private.ai_generations
   where id = p_consumption
     and user_id = v_uid
     for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'CONSUMPTION_NOT_FOUND');
  end if;

  if v_gen.refunded_at is not null then
    -- ok:true para que quien reintente no entre en bucle. No suma crédito.
    return jsonb_build_object(
      'ok', true, 'reason', 'ALREADY_REFUNDED', 'refunded_at', v_gen.refunded_at);
  end if;

  if now() - v_gen.consumed_at > c_window then
    return jsonb_build_object('ok', false, 'reason', 'REFUND_WINDOW_EXPIRED');
  end if;

  update sciverse_private.ai_generations
     set refunded_at = now(), refund_reason = 'generation_failed'
   where id = v_gen.id;

  select * into v_plan from sciverse_private.effective_plan(v_uid);

  if v_gen.period_start = v_week then
    update sciverse_private.ai_usage_counters
       set used = greatest(used - 1, 0), updated_at = now()
     where user_id = v_uid
    returning * into v_counter;
  else
    select * into v_counter
      from sciverse_private.ai_usage_counters where user_id = v_uid;
  end if;

  return jsonb_build_object(
    'ok',        true,
    'limit',     v_plan.ai_weekly_limit,
    'used',      coalesce(v_counter.used, 0),
    'remaining', greatest(v_plan.ai_weekly_limit - coalesce(v_counter.used, 0), 0)
  );
end;
$$;


-- ============================================================================
-- 6. PERMISOS DE LAS FUNCIONES
--    Revocar de PUBLIC, anon Y authenticated antes de conceder: los
--    privilegios por defecto del proyecto ya concedieron a los dos últimos al
--    crear la función, y revocar de PUBLIC no quita concesiones explícitas.
-- ============================================================================
revoke all on function public.get_ai_credit_status()   from public, anon, authenticated;
revoke all on function public.consume_ai_credit()      from public, anon, authenticated;
revoke all on function public.refund_ai_credit(uuid)   from public, anon, authenticated;

grant execute on function public.get_ai_credit_status() to authenticated, service_role;
grant execute on function public.consume_ai_credit()    to authenticated, service_role;
grant execute on function public.refund_ai_credit(uuid) to authenticated, service_role;


-- ============================================================================
-- 7. EL CLIENTE DEJA DE PODER TOCAR LO QUE CONDICIONA LOS CRÉDITOS
--
--    Ya no hay columnas ai_* en `docentes`, pero `activo` sigue ahí y es la
--    puerta del consumo: sin esto, alguien suspendido se reactiva solo con un
--    PATCH. Y `plan`, aunque pase a ser heredado, se sigue mostrando.
--
--    Es seguro: no existe un solo UPDATE del cliente sobre `docentes` en todo
--    el código. «Mi cuenta» guarda con supabase.auth.updateUser (App.jsx:4114).
-- ============================================================================
revoke update on public.docentes from authenticated;
revoke update on public.docentes from anon;

grant update (nombres, apellidos, ie, celular, nivel)
  on public.docentes to authenticated;

-- `plan`, `activo`, `correo`, `user_id`, `id` y `created_at` quedan fuera
-- de la lista a propósito.


commit;


-- ============================================================================
-- RECONCILIACIÓN · contador ↔ libro   (solo lectura, para cuando haga falta)
-- ============================================================================
--
-- select c.user_id,
--        c.used                                as contador,
--        count(g.id)                           as libro,
--        c.used - count(g.id)                  as desvio
--   from sciverse_private.ai_usage_counters c
--   left join sciverse_private.ai_generations g
--          on g.user_id = c.user_id
--         and g.period_start = c.period_start
--         and g.refunded_at is null
--  where c.period_start = (date_trunc('week', timezone('America/Lima', now())))::date
--  group by c.user_id, c.used
-- having c.used <> count(g.id);
--
-- Sin filas = todo cuadra.
--
--
-- ============================================================================
-- PLAN DE ROLLBACK
-- ============================================================================
--
-- NO destructivo (recomendado):
--   begin;
--   drop function if exists public.refund_ai_credit(uuid);
--   drop function if exists public.consume_ai_credit();
--   drop function if exists public.get_ai_credit_status();
--   grant update on public.docentes to authenticated;
--   grant update on public.docentes to anon;
--   commit;
--
-- Las tablas privadas se quedan: no estorban y conservan el histórico.
--
-- COMPLETO (destructivo — pierde la auditoría de consumo):
--   ... lo anterior, más:
--   drop table if exists sciverse_private.ai_generations;
--   drop table if exists sciverse_private.ai_usage_counters;
--
-- Tras cualquiera de los dos, la generación vuelve a estar caída: es el
-- estado previo, no una regresión nueva.
-- ============================================================================

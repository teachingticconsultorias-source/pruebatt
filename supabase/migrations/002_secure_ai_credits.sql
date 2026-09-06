-- ============================================================================
-- 002_secure_ai_credits.sql
--
--                    ⚠️  DISEÑADA · NO EJECUTADA  ⚠️
--
-- Requiere el bloque de VERIFICACIÓN PREVIA (al final del fichero) antes de
-- aplicarse, y desplegarse junto al cambio de código que pasa el vale de
-- consumo al reembolso. Ver «DEPENDENCIA DE CÓDIGO» más abajo.
--
-- ----------------------------------------------------------------------------
-- QUÉ PROBLEMA RESUELVE
-- ----------------------------------------------------------------------------
-- La generación con IA está CAÍDA en producción. Los cinco endpoints llaman a
-- `consume_ai_credit` antes de tocar Gemini; esa función no existe en la base
-- real (verificado en supabase/production-full-schema.sql: 0 coincidencias de
-- `ai_credit`). PostgREST devuelve 404, los helpers lanzan, y en withCredit()
-- el consumo va ANTES de la operación, así que Gemini nunca llega a llamarse.
--
-- Esta migración instala el sistema de créditos que el código ya espera, pero
-- endurecido desde el primer minuto en lugar de replicar `supabase-freemium.sql`,
-- que nace con dos agujeros (ver «POR QUÉ NO SE USA EL SCRIPT ORIGINAL»).
--
-- ----------------------------------------------------------------------------
-- POR QUÉ NO SE USA supabase-freemium.sql TAL CUAL
-- ----------------------------------------------------------------------------
--   1. `refund_ai_credit()` sin argumentos y concedida a `authenticated`: se
--      puede invocar en bucle desde el navegador para créditos ilimitados.
--      Aquí el reembolso exige el vale de un consumo real, de un solo uso.
--
--   2. Sus `revoke all ... from public` NO habrían servido. En este proyecto
--      hay privilegios por defecto activos:
--        ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
--          GRANT ALL ON FUNCTIONS TO anon, authenticated;
--      `PUBLIC` (pseudo-rol) y `anon` (rol real) son cosas distintas: revocar
--      del primero deja intacta la concesión explícita al segundo. Por eso
--      aquí se revoca de `PUBLIC`, `anon` Y `authenticated`, y sólo después
--      se concede a quien corresponde.
--
--      Ese mismo automatismo aplica a TABLAS nuevas en `public`. Por eso el
--      libro de consumos NO vive en `public`, sino en un esquema privado que
--      PostgREST no expone y al que esos privilegios por defecto no alcanzan.
--
-- ----------------------------------------------------------------------------
-- ALCANCE — LO QUE ESTA MIGRACIÓN NO HACE
-- ----------------------------------------------------------------------------
--   · No toca el CHECK de `materiales_docente.tipo`   → 003
--   · No sincroniza el perfil con auth.users          → 004
--   · No revisa los permisos generales de `docentes`  (INSERT/DELETE/SELECT,
--     ni el GRANT ALL de `anon` sobre materiales_docente) → migración aparte
--   · No toca Auth, SMTP, plantillas ni Storage
--
-- La ÚNICA excepción es el privilegio de UPDATE sobre `public.docentes`: sin
-- restringirlo por columna, cualquier docente podría ponerse `ai_week_used = 0`
-- por PostgREST y los créditos nacerían ya rotos. Va aquí a propósito, y sólo
-- UPDATE: el resto de privilegios de la tabla queda como está.
--
-- ----------------------------------------------------------------------------
-- DEPENDENCIA DE CÓDIGO — LEER ANTES DE APLICAR
-- ----------------------------------------------------------------------------
-- `refund_ai_credit` pasa a exigir un argumento. El código actual la llama sin
-- argumentos, así que tras aplicar esto y ANTES de desplegar el cambio de
-- código:
--     · la generación vuelve a funcionar  ✔
--     · pero un fallo de Gemini NO devolvería el crédito (la llamada al
--       reembolso da 404 y queda silenciada por los `catch`)
-- Es un estado degradado, no roto. Aun así, aplicar migración y código en la
-- misma ventana. NO se crea una versión sin argumentos: existir sería
-- reabrir exactamente el agujero que esta migración cierra.
--
-- ----------------------------------------------------------------------------
-- GARANTÍAS
-- ----------------------------------------------------------------------------
--   · No borra datos ni columnas.   · No recrea tablas.
--   · No desactiva RLS.             · No toca políticas existentes.
--   · Idempotente: puede repetirse sin efectos distintos.
--   · Transaccional: o entra entera o no entra.
-- ============================================================================

begin;


-- ============================================================================
-- 0. PRECONDICIONES — aborta si producción no está donde creemos
-- ============================================================================
do $$
begin
  if to_regclass('public.docentes') is null then
    raise exception 'ABORTA: no existe public.docentes';
  end if;

  -- Si ya hubiera un refund sin argumentos, esta migración no debe pisarlo
  -- en silencio: hay que decidir a mano qué hacer con él.
  if to_regprocedure('public.refund_ai_credit()') is not null then
    raise exception
      'ABORTA: ya existe refund_ai_credit() sin argumentos. Revisar antes de continuar.';
  end if;
end;
$$;


-- ============================================================================
-- 1. ESQUEMA PRIVADO
--    PostgREST sólo expone `public` (y `graphql_public`). Nada que viva aquí
--    es alcanzable desde el navegador, y los ALTER DEFAULT PRIVILEGES del
--    proyecto están acotados a `public`, así que tampoco le alcanzan.
-- ============================================================================
create schema if not exists sciverse_private;

revoke all on schema sciverse_private from public;
revoke all on schema sciverse_private from anon, authenticated;


-- ============================================================================
-- 2. COLUMNAS DE CRÉDITO EN public.docentes
--    `ai_week_start` se añade SIN default para no forzar una reescritura de
--    tabla con una expresión volátil. Las funciones tratan NULL como
--    «semana sin iniciar» y la reinician en la primera llamada.
-- ============================================================================
alter table public.docentes
  add column if not exists ai_weekly_limit integer not null default 5,
  add column if not exists ai_week_used    integer not null default 0,
  add column if not exists ai_week_start   date;

-- A partir de aquí las filas nuevas sí nacen con la semana puesta.
alter table public.docentes
  alter column ai_week_start
  set default (date_trunc('week', timezone('America/Lima', now())))::date;

alter table public.docentes
  drop constraint if exists docentes_ai_weekly_limit_check;
alter table public.docentes
  add  constraint docentes_ai_weekly_limit_check check (ai_weekly_limit >= 0);

alter table public.docentes
  drop constraint if exists docentes_ai_week_used_check;
alter table public.docentes
  add  constraint docentes_ai_week_used_check check (ai_week_used >= 0);

comment on column public.docentes.ai_weekly_limit is
  'Creaciones con IA por semana. Sólo escribible por las funciones de crédito.';
comment on column public.docentes.ai_week_used is
  'Consumidas en la semana en curso. Sólo escribible por las funciones de crédito.';
comment on column public.docentes.ai_week_start is
  'Lunes de la semana vigente (America/Lima). NULL = pendiente de iniciar.';


-- ============================================================================
-- 3. LIBRO DE CONSUMOS
--    Cada consumo emite un vale (su `id`). El reembolso exige ese vale, y
--    `refunded_at` lo convierte en un único uso.
-- ============================================================================
create table if not exists sciverse_private.ai_credit_consumptions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users(id) on delete cascade,
  week_start    date        not null,
  consumed_at   timestamptz not null default now(),
  refunded_at   timestamptz,
  refund_reason text
);

create index if not exists ai_credit_consumptions_user_idx
  on sciverse_private.ai_credit_consumptions (user_id, consumed_at desc);

-- Cinturón y tirantes: sin privilegios y con RLS sin políticas. Sólo las
-- funciones SECURITY DEFINER llegan a esta tabla.
revoke all on sciverse_private.ai_credit_consumptions from public;
revoke all on sciverse_private.ai_credit_consumptions from anon, authenticated;
alter table sciverse_private.ai_credit_consumptions enable row level security;

comment on table sciverse_private.ai_credit_consumptions is
  'Un registro por crédito consumido. El id actúa de vale de reembolso de un solo uso.';


-- ============================================================================
-- 4. ESTADO DE CRÉDITOS
--    SECURITY DEFINER porque a partir del paso 6 `authenticated` deja de
--    poder escribir estas columnas, y esta función necesita reiniciar la
--    semana. search_path vacío y todo cualificado.
-- ============================================================================
create or replace function public.get_ai_credit_status()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_doc  public.docentes%rowtype;
  v_week date := (date_trunc('week', timezone('America/Lima', now())))::date;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select * into v_doc from public.docentes where user_id = v_uid;
  if not found then
    raise exception 'PROFILE_NOT_FOUND';
  end if;

  if v_doc.ai_week_start is distinct from v_week then
    update public.docentes
       set ai_week_start = v_week,
           ai_week_used  = 0
     where user_id = v_uid
    returning * into v_doc;
  end if;

  return jsonb_build_object(
    'plan',       v_doc.plan,
    'limit',      v_doc.ai_weekly_limit,
    'used',       v_doc.ai_week_used,
    'remaining',  greatest(v_doc.ai_weekly_limit - v_doc.ai_week_used, 0),
    'week_start', v_doc.ai_week_start,
    'next_reset', v_week + 7,
    'active',     v_doc.activo
  );
end;
$$;


-- ============================================================================
-- 5. CONSUMO
--    SIN ARGUMENTOS a propósito: el código vigente la invoca con body "{}".
--    Añadir un parámetro con default cambiaría la resolución de PostgREST y
--    el objetivo aquí es que la generación vuelva hoy, no ampliar la API.
--
--    El SELECT ... FOR UPDATE serializa los consumos concurrentes del mismo
--    docente: dos pestañas o un doble clic no pueden gastar el mismo crédito.
-- ============================================================================
create or replace function public.consume_ai_credit()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid         uuid := auth.uid();
  v_doc         public.docentes%rowtype;
  v_week        date := (date_trunc('week', timezone('America/Lima', now())))::date;
  v_consumption uuid;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  -- Bloqueo de fila: todo lo que sigue es serie para este docente.
  select * into v_doc
    from public.docentes
   where user_id = v_uid
     for update;

  if not found then
    raise exception 'PROFILE_NOT_FOUND';
  end if;

  if not v_doc.activo then
    raise exception 'ACCOUNT_INACTIVE';
  end if;

  if v_doc.ai_week_start is distinct from v_week then
    update public.docentes
       set ai_week_start = v_week,
           ai_week_used  = 0
     where user_id = v_uid
    returning * into v_doc;
  end if;

  if v_doc.ai_week_used >= v_doc.ai_weekly_limit then
    return jsonb_build_object(
      'ok',         false,
      'reason',     'WEEKLY_LIMIT_REACHED',
      'plan',       v_doc.plan,
      'limit',      v_doc.ai_weekly_limit,
      'used',       v_doc.ai_week_used,
      'remaining',  0,
      'week_start', v_doc.ai_week_start,
      'next_reset', v_week + 7
    );
  end if;

  update public.docentes
     set ai_week_used = ai_week_used + 1
   where user_id = v_uid
  returning * into v_doc;

  insert into sciverse_private.ai_credit_consumptions (user_id, week_start)
  values (v_uid, v_week)
  returning id into v_consumption;

  return jsonb_build_object(
    'ok',             true,
    'consumption_id', v_consumption,
    'plan',           v_doc.plan,
    'limit',          v_doc.ai_weekly_limit,
    'used',           v_doc.ai_week_used,
    'remaining',      greatest(v_doc.ai_weekly_limit - v_doc.ai_week_used, 0),
    'week_start',     v_doc.ai_week_start,
    'next_reset',     v_week + 7
  );
end;
$$;


-- ============================================================================
-- 6. REEMBOLSO CONTRA VALE
--
--    Cinco condiciones, todas obligatorias:
--      1. hay sesión                        → AUTH_REQUIRED
--      2. el vale existe y es del que llama → CONSUMPTION_NOT_FOUND
--      3. no se ha reembolsado ya           → ALREADY_REFUNDED (idempotente)
--      4. está dentro de la ventana         → REFUND_WINDOW_EXPIRED
--      5. la semana no se ha reiniciado     → si cambió, no se toca el contador
--
--    La 5 no es cosmética: un consumo del domingo reembolsado el lunes
--    descontaría del contador NUEVO y regalaría un crédito. El vale se marca
--    igualmente como usado para que no quede vivo.
-- ============================================================================
create or replace function public.refund_ai_credit(p_consumption uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  v_row    sciverse_private.ai_credit_consumptions%rowtype;
  v_doc    public.docentes%rowtype;
  v_week   date := (date_trunc('week', timezone('America/Lima', now())))::date;
  c_window constant interval := interval '30 minutes';
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if p_consumption is null then
    return jsonb_build_object('ok', false, 'reason', 'MISSING_CONSUMPTION');
  end if;

  -- Bloqueo del vale: dos reembolsos simultáneos del mismo vale se serializan
  -- y el segundo encuentra refunded_at ya puesto.
  select * into v_row
    from sciverse_private.ai_credit_consumptions
   where id = p_consumption
     and user_id = v_uid
     for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'CONSUMPTION_NOT_FOUND');
  end if;

  if v_row.refunded_at is not null then
    -- ok:true para que quien reintente no entre en bucle. No suma crédito.
    return jsonb_build_object(
      'ok', true, 'reason', 'ALREADY_REFUNDED', 'refunded_at', v_row.refunded_at
    );
  end if;

  if now() - v_row.consumed_at > c_window then
    return jsonb_build_object('ok', false, 'reason', 'REFUND_WINDOW_EXPIRED');
  end if;

  update sciverse_private.ai_credit_consumptions
     set refunded_at   = now(),
         refund_reason = 'generation_failed'
   where id = v_row.id;

  if v_row.week_start = v_week then
    update public.docentes
       set ai_week_used = greatest(ai_week_used - 1, 0)
     where user_id = v_uid
    returning * into v_doc;
  else
    select * into v_doc from public.docentes where user_id = v_uid;
  end if;

  return jsonb_build_object(
    'ok',        true,
    'limit',     v_doc.ai_weekly_limit,
    'used',      v_doc.ai_week_used,
    'remaining', greatest(v_doc.ai_weekly_limit - v_doc.ai_week_used, 0)
  );
end;
$$;


-- ============================================================================
-- 7. PERMISOS DE LAS FUNCIONES
--    Se revoca de PUBLIC, anon Y authenticated antes de conceder: los
--    privilegios por defecto del proyecto ya han concedido a anon y
--    authenticated en el momento de crear la función.
-- ============================================================================
revoke all on function public.get_ai_credit_status()      from public, anon, authenticated;
revoke all on function public.consume_ai_credit()         from public, anon, authenticated;
revoke all on function public.refund_ai_credit(uuid)      from public, anon, authenticated;

grant execute on function public.get_ai_credit_status()   to authenticated, service_role;
grant execute on function public.consume_ai_credit()      to authenticated, service_role;
grant execute on function public.refund_ai_credit(uuid)   to authenticated, service_role;


-- ============================================================================
-- 8. LAS COLUMNAS ECONÓMICAS DEJAN DE SER ESCRIBIBLES POR EL CLIENTE
--
--    Hoy `authenticated` tiene GRANT ALL sobre `docentes`, y RLS filtra FILAS,
--    no COLUMNAS: sin esto, un docente podría ponerse ai_week_used = 0 o
--    plan = 'premium' por PostgREST.
--
--    Es seguro: no existe un solo UPDATE del cliente sobre `docentes` en todo
--    el código. «Mi cuenta» guarda con supabase.auth.updateUser (App.jsx:4114).
--    La lista blanca deja el camino abierto para cuando se quiera editar el
--    perfil de verdad contra la tabla.
-- ============================================================================
revoke update on public.docentes from authenticated;
revoke update on public.docentes from anon;

grant update (nombres, apellidos, ie, celular, nivel)
  on public.docentes to authenticated;

-- `plan`, `activo`, `correo`, `user_id`, `id`, `created_at` y las tres
-- columnas ai_* quedan fuera de la lista a propósito.


commit;


-- ============================================================================
-- VERIFICACIÓN PREVIA · ejecutar ANTES, en una consulta aparte (solo lectura)
-- ============================================================================
--
-- select
--   to_regclass('public.docentes')                     as tabla_docentes,
--   to_regprocedure('public.consume_ai_credit()')      as consume_existente,
--   to_regprocedure('public.refund_ai_credit()')       as refund_sin_args,
--   to_regprocedure('public.refund_ai_credit(uuid)')   as refund_con_vale,
--   to_regnamespace('sciverse_private')                as esquema_privado,
--   (select count(*) from information_schema.columns
--     where table_schema='public' and table_name='docentes'
--       and column_name in ('ai_week_used','ai_weekly_limit','ai_week_start')
--   ) as columnas_credito_existentes;
--
-- Esperado antes de aplicar:
--   tabla_docentes                = public.docentes
--   consume_existente             = NULL
--   refund_sin_args               = NULL
--   refund_con_vale               = NULL
--   esquema_privado               = NULL
--   columnas_credito_existentes   = 0
--
--
-- ============================================================================
-- VERIFICACIÓN POSTERIOR · solo lectura
-- ============================================================================
--
-- -- 1. Las funciones existen y son SECURITY DEFINER con search_path fijado
-- select p.proname,
--        pg_get_function_identity_arguments(p.oid) as args,
--        p.prosecdef                               as security_definer,
--        array_to_string(p.proconfig, ' ')          as config
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--  where n.nspname = 'public'
--    and p.proname in ('get_ai_credit_status','consume_ai_credit','refund_ai_credit');
--
-- -- 2. Quién puede ejecutarlas (anon debe dar false en las tres)
-- select p.proname, r.rolname,
--        has_function_privilege(r.oid, p.oid, 'EXECUTE') as puede
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   cross join pg_roles r
--  where n.nspname = 'public'
--    and p.proname in ('get_ai_credit_status','consume_ai_credit','refund_ai_credit')
--    and r.rolname in ('anon','authenticated','service_role');
--
-- -- 3. Columnas económicas NO escribibles; las de perfil SÍ
-- select c.column_name,
--        has_column_privilege('authenticated','public.docentes', c.column_name,'UPDATE') as update_authenticated,
--        has_column_privilege('anon',         'public.docentes', c.column_name,'UPDATE') as update_anon
--   from information_schema.columns c
--  where c.table_schema='public' and c.table_name='docentes'
--  order by c.ordinal_position;
--
-- Esperado: true sólo en nombres, apellidos, ie, celular, nivel (authenticated).
--           false en TODAS para anon, y false en plan/activo/correo/ai_*.
--
-- -- 4. El libro de consumos es inalcanzable desde el cliente
-- select has_table_privilege('authenticated','sciverse_private.ai_credit_consumptions','SELECT') as lee_authenticated,
--        has_schema_privilege('authenticated','sciverse_private','USAGE')                        as usa_esquema;
-- Esperado: false, false.
--
--
-- ============================================================================
-- PLAN DE ROLLBACK
-- ============================================================================
--
-- NO destructivo (recomendado). Devuelve el estado funcional anterior y
-- conserva los contadores por si se reintenta:
--
--   begin;
--   drop function if exists public.refund_ai_credit(uuid);
--   drop function if exists public.consume_ai_credit();
--   drop function if exists public.get_ai_credit_status();
--   grant update on public.docentes to authenticated;
--   grant update on public.docentes to anon;
--   commit;
--
-- Las columnas ai_* se quedan: no estorban y borrarlas perdería el consumo
-- registrado. Volver a aplicar la migración sobre ese estado funciona, salvo
-- por la precondición del paso 0, que habrá que revisar.
--
-- COMPLETO (destructivo — sólo si se descarta el diseño por entero):
--
--   begin;
--   drop function if exists public.refund_ai_credit(uuid);
--   drop function if exists public.consume_ai_credit();
--   drop function if exists public.get_ai_credit_status();
--   drop table    if exists sciverse_private.ai_credit_consumptions;   -- PIERDE LA AUDITORÍA
--   drop schema   if exists sciverse_private;
--   alter table public.docentes
--     drop column if exists ai_week_used,      -- PIERDE EL CONSUMO DE LA SEMANA
--     drop column if exists ai_weekly_limit,
--     drop column if exists ai_week_start;
--   grant update on public.docentes to authenticated;
--   grant update on public.docentes to anon;
--   commit;
--
-- Tras cualquiera de los dos, la generación vuelve a estar caída: es el
-- estado previo a esta migración, no una regresión nueva.

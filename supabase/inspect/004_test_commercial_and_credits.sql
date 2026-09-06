-- ============================================================================
-- PRUEBAS DE 002_commercial_core.sql + 003_secure_ai_credits.sql
--
--          ⚠️  EJECUTAR SÓLO DESPUÉS DE APLICAR AMBAS MIGRACIONES  ⚠️
--
-- Bloques A y B: SOLO LECTURA.
-- Bloque C: llama a las funciones, pero dentro de una transacción que termina
--           en ROLLBACK. No persiste nada. Aun así, usar una CUENTA DE PRUEBA
--           creada por el registro normal, nunca la de una docente real.
--
-- Para obtener el id de la cuenta de prueba:
--     select id from auth.users where email = 'tu-cuenta-de-prueba@…';
-- Sustituir <UUID_PRUEBA> en el bloque C.
-- ============================================================================


-- ============================================================================
-- BLOQUE A · ESTRUCTURA  (solo lectura)
-- ============================================================================

-- A1 · Catálogo sembrado. Esperado: al menos la fila 'free' con límite 5.
select code, name, ai_weekly_limit, price_cents, is_active, sort_order
  from public.plans order by sort_order, code;

-- A2 · Las cinco funciones existen, SECURITY DEFINER y con search_path fijado.
--      Esperado: 5 filas, security_definer = true, config = 'search_path='
select n.nspname                                 as esquema,
       p.proname                                 as funcion,
       pg_get_function_identity_arguments(p.oid) as argumentos,
       p.prosecdef                               as security_definer,
       coalesce(array_to_string(p.proconfig,' '), '(SIN search_path)') as config
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where (n.nspname = 'public'
        and p.proname in ('get_my_plan','get_ai_credit_status',
                          'consume_ai_credit','refund_ai_credit'))
    or (n.nspname = 'sciverse_private' and p.proname = 'effective_plan')
 order by n.nspname, p.proname;

-- A3 · No debe existir un refund sin argumentos. Esperado: NULL
select to_regprocedure('public.refund_ai_credit()') as refund_sin_argumentos_debe_ser_null;

-- A4 · `docentes` NO debe tener columnas de crédito. Esperado: 0 filas.
select column_name
  from information_schema.columns
 where table_schema='public' and table_name='docentes'
   and column_name like 'ai_%';

-- A5 · El índice parcial que impide dos suscripciones activas.
--      Esperado: aparece subscriptions_one_active_per_user con WHERE status='active'
select indexname, indexdef from pg_indexes
 where schemaname='public' and tablename='subscriptions'
 order by indexname;

-- A6 · Toda docente con user_id tiene exactamente una suscripción activa.
--      Esperado: docentes = activas, sin_plan = 0
select (select count(*) from public.docentes where user_id is not null)      as docentes,
       (select count(*) from public.subscriptions where status='active')     as activas,
       (select count(*) from public.docentes d where d.user_id is not null
          and not exists (select 1 from public.subscriptions s
                           where s.user_id=d.user_id and s.status='active')) as sin_plan;

-- A7 · El trigger de suscripción automática está puesto y activo.
select t.tgname,
       case when t.tgenabled='D' then 'DESACTIVADO' else 'activo' end as estado
  from pg_trigger t join pg_class c on c.oid=t.tgrelid
  join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relname='docentes' and not t.tgisinternal;


-- ============================================================================
-- BLOQUE B · PERMISOS  (solo lectura) — la parte que de verdad importa
-- ============================================================================

-- B1 · Quién puede ejecutar cada función.
--      Esperado: anon = false en TODAS.
select p.proname as funcion, r.rolname as rol,
       has_function_privilege(r.oid, p.oid, 'EXECUTE') as puede_ejecutar
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 cross join pg_roles r
 where (n.nspname='public'
        and p.proname in ('get_my_plan','get_ai_credit_status',
                          'consume_ai_credit','refund_ai_credit'))
    or (n.nspname='sciverse_private' and p.proname='effective_plan')
   and r.rolname in ('anon','authenticated','service_role')
 order by p.proname, r.rolname;

-- B2 · plans y subscriptions: sólo SELECT, y anon no debe tocar subscriptions.
select table_name, grantee,
       string_agg(privilege_type, ', ' order by privilege_type) as privilegios
  from information_schema.role_table_grants
 where table_schema='public' and table_name in ('plans','subscriptions')
   and grantee in ('anon','authenticated','service_role')
 group by table_name, grantee
 order by table_name, grantee;

-- B3 · Qué columnas de docentes puede escribir el cliente.
--      Esperado: authenticated = true SÓLO en nombres, apellidos, ie, celular,
--      nivel. false en plan, activo, correo, user_id, id, created_at.
--      anon = false en TODAS.
select c.column_name as columna,
       has_column_privilege('authenticated','public.docentes', c.column_name,'UPDATE') as authenticated,
       has_column_privilege('anon',         'public.docentes', c.column_name,'UPDATE') as anon
  from information_schema.columns c
 where c.table_schema='public' and c.table_name='docentes'
 order by c.ordinal_position;

-- B4 · El esquema privado es inalcanzable desde el cliente.
--      Esperado: las seis columnas en false.
select has_schema_privilege('authenticated','sciverse_private','USAGE') as esquema_auth,
       has_schema_privilege('anon',         'sciverse_private','USAGE') as esquema_anon,
       has_table_privilege ('authenticated','sciverse_private.ai_generations','SELECT')     as gen_auth,
       has_table_privilege ('anon',         'sciverse_private.ai_generations','SELECT')     as gen_anon,
       has_table_privilege ('authenticated','sciverse_private.ai_usage_counters','SELECT')  as cnt_auth,
       has_table_privilege ('anon',         'sciverse_private.ai_usage_counters','SELECT')  as cnt_anon;


-- ============================================================================
-- BLOQUE C · COMPORTAMIENTO  (transacción revertida — no persiste nada)
--
-- Ejecutar TODO el bloque de una vez. Termina en rollback.
-- Sustituir <UUID_PRUEBA> por el id de la cuenta de prueba.
-- ============================================================================

begin;

set local role authenticated;
set local request.jwt.claims = '{"sub":"<UUID_PRUEBA>","role":"authenticated"}';

-- C1 · Plan efectivo. Esperado: plan='free', limit=5, is_fallback=false
--      (false porque el trigger o la siembra ya le crearon la suscripción).
select 'C1 plan efectivo' as prueba, public.get_my_plan() as resultado;

-- C2 · Estado inicial. Esperado: used=0, remaining=5, active=true
select 'C2 estado' as prueba, public.get_ai_credit_status() as resultado;

-- C3 · Un consumo. Esperado: ok=true, used=1, llega consumption_id.
select 'C3 consumo' as prueba, public.consume_ai_credit() as resultado;

-- C4 · Reembolso con vale inventado. Esperado: ok=false, CONSUMPTION_NOT_FOUND.
--      Prueba clave: sin consumo real no se puede fabricar crédito.
select 'C4 vale inventado' as prueba,
       public.refund_ai_credit('00000000-0000-0000-0000-000000000000'::uuid) as resultado;

-- C5 · Reembolso sin vale. Esperado: ok=false, MISSING_CONSUMPTION.
select 'C5 vale nulo' as prueba, public.refund_ai_credit(null) as resultado;

-- C6 · Ciclo honrado + repetición.
--      Esperado: refund 1 → ok=true y used baja; refund 2 → ALREADY_REFUNDED
--      y used NO vuelve a bajar.
do $$
declare v_c jsonb; v_vale uuid; v_r1 jsonb; v_r2 jsonb;
begin
  v_c    := public.consume_ai_credit();
  v_vale := (v_c ->> 'consumption_id')::uuid;
  v_r1   := public.refund_ai_credit(v_vale);
  v_r2   := public.refund_ai_credit(v_vale);
  raise notice 'C6 consumo:  %', v_c;
  raise notice 'C6 refund 1: %', v_r1;
  raise notice 'C6 refund 2: %  <- ALREADY_REFUNDED', v_r2;
end;
$$;

-- C7 · Agotar el límite. Esperado: las primeras van a ok=true y la que pasa
--      del límite devuelve ok=false con WEEKLY_LIMIT_REACHED, SIN error.
do $$
declare v_r jsonb; i integer;
begin
  for i in 1..7 loop
    v_r := public.consume_ai_credit();
    raise notice 'C7 intento %: ok=%  used=%  reason=%',
      i, v_r->>'ok', v_r->>'used', coalesce(v_r->>'reason','-');
  end loop;
end;
$$;

-- C8 · El docente NO puede tocar lo que condiciona sus créditos.
--      Esperado: ERROR de permiso denegado. Descomentar de una en una:
--      cada una aborta la transacción.
--
-- update public.docentes set activo = true      where user_id = auth.uid();
-- update public.docentes set plan   = 'premium' where user_id = auth.uid();

-- C9 · Tampoco puede cambiarse el plan por PostgREST.
--      Esperado: ERROR de permiso denegado (no hay policy de UPDATE).
-- update public.subscriptions set plan_code='free' where user_id = auth.uid();

-- C10 · Ni ver el contador ni el libro. Esperado: ERROR permiso denegado.
-- select count(*) from sciverse_private.ai_usage_counters;
-- select count(*) from sciverse_private.ai_generations;

-- C11 · Pero sí puede corregir su perfil. Esperado: 1 fila.
update public.docentes set ie = ie where user_id = auth.uid();

-- C12 · Estado final antes de revertir.
select 'C12 estado final' as prueba, public.get_ai_credit_status() as resultado;

rollback;   -- ← nada de lo anterior queda escrito


-- ============================================================================
-- BLOQUE D · CONCURRENCIA  (opcional · dos sesiones a la vez)
--
--   Sesión 1                                Sesión 2
--   -------------------------------------   ---------------------------------
--   begin;                                  begin;
--   set local role authenticated;           set local role authenticated;
--   set local request.jwt.claims = '…';     set local request.jwt.claims = '…';
--   select public.consume_ai_credit();
--                                           select public.consume_ai_credit();
--                                           ← se QUEDA ESPERANDO: correcto
--   rollback;                               ← ahora avanza
--                                           rollback;
--
-- Si la sesión 2 responde de inmediato, el bloqueo no funciona.
-- Ambas terminan en rollback: no persiste nada.
--
--
-- BLOQUE E · DOS SUSCRIPCIONES ACTIVAS  (opcional · como service_role)
--
--   begin;
--   insert into public.subscriptions (user_id, plan_code, status, source)
--   values ('<UUID_PRUEBA>', 'free', 'active', 'admin_manual');
--   -- Esperado: ERROR duplicate key … subscriptions_one_active_per_user
--   rollback;
--
-- Demuestra que la restricción la impone la BASE, no la aplicación.
-- ============================================================================

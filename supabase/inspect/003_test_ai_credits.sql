-- ============================================================================
-- PRUEBAS DE 002_secure_ai_credits.sql
--
--            ⚠️  EJECUTAR SÓLO DESPUÉS DE APLICAR LA MIGRACIÓN  ⚠️
--
-- Los bloques A y B son de SOLO LECTURA.
--
-- El bloque C sí llama a las funciones, pero va dentro de una transacción que
-- termina en ROLLBACK: nada de lo que haga queda escrito. Aun así, úsalo con
-- una CUENTA DE PRUEBA creada por el registro normal de la aplicación, nunca
-- con la cuenta de una docente real.
--
-- Cómo obtener el id de la cuenta de prueba sin exponer datos de nadie:
--     select id from auth.users where email = 'tu-cuenta-de-prueba@…' ;
-- Sustituye <UUID_PRUEBA> por ese valor en el bloque C.
-- ============================================================================


-- ============================================================================
-- BLOQUE A · ESTRUCTURA  (solo lectura)
-- ============================================================================

-- A1 · Las tres funciones existen, son SECURITY DEFINER y fijan search_path.
--      Esperado: 3 filas, security_definer = true, config = 'search_path='
select p.proname                                   as funcion,
       pg_get_function_identity_arguments(p.oid)   as argumentos,
       p.prosecdef                                 as security_definer,
       coalesce(array_to_string(p.proconfig, ' '), '(SIN search_path)') as config
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('get_ai_credit_status','consume_ai_credit','refund_ai_credit')
 order by p.proname;

-- A2 · No debe existir un refund sin argumentos.
--      Esperado: NULL
select to_regprocedure('public.refund_ai_credit()') as refund_sin_argumentos_debe_ser_null;

-- A3 · Columnas de crédito creadas con sus defaults.
--      Esperado: 3 filas
select column_name, data_type, is_nullable, column_default
  from information_schema.columns
 where table_schema = 'public' and table_name = 'docentes'
   and column_name in ('ai_weekly_limit','ai_week_used','ai_week_start')
 order by column_name;


-- ============================================================================
-- BLOQUE B · PERMISOS  (solo lectura) — la parte que de verdad importa
-- ============================================================================

-- B1 · Quién puede ejecutar cada función.
--      Esperado: anon = false en las tres. authenticated y service_role = true.
select p.proname as funcion, r.rolname as rol,
       has_function_privilege(r.oid, p.oid, 'EXECUTE') as puede_ejecutar
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 cross join pg_roles r
 where n.nspname = 'public'
   and p.proname in ('get_ai_credit_status','consume_ai_credit','refund_ai_credit')
   and r.rolname in ('anon','authenticated','service_role')
 order by p.proname, r.rolname;

-- B2 · Qué columnas de docentes puede escribir el cliente.
--      Esperado: authenticated = true SÓLO en nombres, apellidos, ie, celular,
--      nivel. false en plan, activo, correo, user_id, id, created_at y las
--      tres ai_*. anon = false en TODAS.
select c.column_name as columna,
       has_column_privilege('authenticated','public.docentes', c.column_name,'UPDATE') as authenticated,
       has_column_privilege('anon',         'public.docentes', c.column_name,'UPDATE') as anon
  from information_schema.columns c
 where c.table_schema = 'public' and c.table_name = 'docentes'
 order by c.ordinal_position;

-- B3 · El libro de consumos es inalcanzable desde el cliente.
--      Esperado: las cuatro columnas en false.
select has_schema_privilege('authenticated','sciverse_private','USAGE')  as esquema_authenticated,
       has_schema_privilege('anon',         'sciverse_private','USAGE')  as esquema_anon,
       has_table_privilege ('authenticated','sciverse_private.ai_credit_consumptions','SELECT') as lee_authenticated,
       has_table_privilege ('anon',         'sciverse_private.ai_credit_consumptions','SELECT') as lee_anon;


-- ============================================================================
-- BLOQUE C · COMPORTAMIENTO  (transacción revertida — no persiste nada)
--
-- Ejecutar TODO el bloque de una vez. Termina en rollback.
-- Sustituir <UUID_PRUEBA> por el id de la cuenta de prueba.
-- ============================================================================

begin;

-- Nos hacemos pasar por la cuenta de prueba, como haría PostgREST.
set local role authenticated;
set local request.jwt.claims = '{"sub":"<UUID_PRUEBA>","role":"authenticated"}';

-- C1 · Estado inicial.
select 'C1 estado inicial' as prueba, public.get_ai_credit_status() as resultado;

-- C2 · Un consumo. Esperado: ok=true, used sube 1, llega consumption_id.
select 'C2 consumo' as prueba, public.consume_ai_credit() as resultado;

-- C3 · Reembolso con un vale inventado.
--      Esperado: ok=false, reason=CONSUMPTION_NOT_FOUND.
--      Es la prueba clave: sin un consumo real no se puede fabricar crédito.
select 'C3 vale inventado' as prueba,
       public.refund_ai_credit('00000000-0000-0000-0000-000000000000'::uuid) as resultado;

-- C4 · Reembolso sin vale. Esperado: ok=false, reason=MISSING_CONSUMPTION.
select 'C4 vale nulo' as prueba, public.refund_ai_credit(null) as resultado;

-- C5 · Ciclo honrado: consumir, reembolsar con su vale, reembolsar OTRA VEZ.
--      Esperado: el primero ok=true y used vuelve a bajar; el segundo
--      ok=true con reason=ALREADY_REFUNDED y used NO vuelve a bajar.
do $$
declare
  v_consumo jsonb;
  v_vale    uuid;
  v_r1      jsonb;
  v_r2      jsonb;
begin
  v_consumo := public.consume_ai_credit();
  v_vale    := (v_consumo ->> 'consumption_id')::uuid;

  v_r1 := public.refund_ai_credit(v_vale);
  v_r2 := public.refund_ai_credit(v_vale);   -- repetido a propósito

  raise notice 'C5 consumo:  %', v_consumo;
  raise notice 'C5 refund 1: %', v_r1;
  raise notice 'C5 refund 2: %  <- debe decir ALREADY_REFUNDED', v_r2;
end;
$$;

-- C6 · Un docente NO puede tocarse los créditos ni el plan por PostgREST.
--      Esperado: ERROR de permiso denegado en la columna.
--      Descomentar de una en una: cada una aborta la transacción.
--
-- update public.docentes set ai_week_used   = 0         where user_id = auth.uid();
-- update public.docentes set ai_weekly_limit= 999999    where user_id = auth.uid();
-- update public.docentes set plan           = 'premium' where user_id = auth.uid();
-- update public.docentes set activo         = false     where user_id = auth.uid();

-- C7 · Pero sí puede corregir su perfil. Esperado: 1 fila actualizada.
update public.docentes set ie = ie where user_id = auth.uid();

-- C8 · El libro de consumos no es legible. Esperado: ERROR permiso denegado.
-- select count(*) from sciverse_private.ai_credit_consumptions;

-- C9 · Estado final antes de revertir.
select 'C9 estado final' as prueba, public.get_ai_credit_status() as resultado;

rollback;   -- ← nada de lo anterior queda escrito


-- ============================================================================
-- BLOQUE D · CONCURRENCIA  (opcional · dos sesiones SQL a la vez)
--
-- Comprueba que el FOR UPDATE serializa de verdad.
--
--   Sesión 1                                   Sesión 2
--   ---------------------------------------    ---------------------------------
--   begin;                                     begin;
--   set local role authenticated;              set local role authenticated;
--   set local request.jwt.claims = '…';        set local request.jwt.claims = '…';
--   select public.consume_ai_credit();
--                                              select public.consume_ai_credit();
--                                              ← se QUEDA ESPERANDO: correcto
--   rollback;                                  ← ahora avanza
--                                              rollback;
--
-- Si la sesión 2 responde de inmediato, el bloqueo no está funcionando.
-- Ambas terminan en rollback: no persiste nada.
-- ============================================================================

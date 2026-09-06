-- ============================================================================
-- VERIFICACIÓN DE 003_secure_ai_credits.sql
--
--                    ✅ SOLO LECTURA · NO MODIFICA NADA
--
-- Una sola sentencia → un único Results copiable.
-- Ni INSERT, UPDATE, DELETE, ALTER, DROP, GRANT ni REVOKE.
-- No invoca consume_ai_credit ni refund_ai_credit: la verificación no debe
-- gastar créditos de nadie.
-- No devuelve nombres, correos, teléfonos ni UUID: sólo recuentos y estados.
--
-- CUÁNDO
--   Inmediatamente después de aplicar 003_secure_ai_credits.sql.
--
-- SI FALLA DICIENDO QUE NO EXISTE sciverse_private.ai_usage_counters
--   003 no llegó a aplicarse: es una sola transacción, o entra entera o nada.
--
-- EMPIEZA POR «00 VEREDICTO»: ocho comprobaciones OK/ERROR.
-- Con el estado actual (5 docentes, plan free con límite 5) lo esperado es
-- OK en las ocho, contadores a 0 y ai_generations vacía.
-- ============================================================================

with

-- Límite efectivo de cada docente, agregado. Nunca sale un user_id.
limites as (
  select p.plan_code, p.ai_weekly_limit, count(*) as docentes
    from public.docentes d
    cross join lateral sciverse_private.effective_plan(d.user_id) p
   where d.user_id is not null
   group by p.plan_code, p.ai_weekly_limit
),

-- Contadores que superan el límite del plan de su dueño. Debe estar vacío.
excedidos as (
  select count(*) as n
    from sciverse_private.ai_usage_counters c
    cross join lateral sciverse_private.effective_plan(c.user_id) p
   where c.used > p.ai_weekly_limit
),

-- Desvío entre el contador y el libro, para la semana en curso.
desvios as (
  select count(*) as n
    from sciverse_private.ai_usage_counters c
    left join sciverse_private.ai_generations g
           on g.user_id = c.user_id
          and g.period_start = c.period_start
          and g.refunded_at is null
   where c.period_start = (date_trunc('week', timezone('America/Lima', now())))::date
   group by c.user_id, c.used
  having c.used <> count(g.id)
),

filas as (

  -- ==========================================================================
  -- 00 · VEREDICTO
  -- ==========================================================================
  select 0 as ord, '00 VEREDICTO' as seccion,
         '>>> tablas privadas creadas' as comprobacion,
         case when to_regclass('sciverse_private.ai_usage_counters') is not null
               and to_regclass('sciverse_private.ai_generations') is not null
              then 'OK' else 'ERROR' end as resultado
  union all
  select 1, '00 VEREDICTO', '>>> las tres funciones publicas existen',
         case when to_regprocedure('public.get_ai_credit_status()') is not null
               and to_regprocedure('public.consume_ai_credit()') is not null
               and to_regprocedure('public.refund_ai_credit(uuid)') is not null
              then 'OK' else 'ERROR' end
  union all
  select 2, '00 VEREDICTO', '>>> no existe refund sin argumentos',
         case when to_regprocedure('public.refund_ai_credit()') is null
              then 'OK' else 'ERROR — el agujero sigue abierto' end
  union all
  select 3, '00 VEREDICTO', '>>> anon no ejecuta ninguna funcion de credito',
         case when not has_function_privilege('anon','public.consume_ai_credit()','EXECUTE')
               and not has_function_privilege('anon','public.refund_ai_credit(uuid)','EXECUTE')
               and not has_function_privilege('anon','public.get_ai_credit_status()','EXECUTE')
              then 'OK' else 'ERROR' end
  union all
  select 4, '00 VEREDICTO', '>>> el cliente no alcanza las tablas privadas',
         case when not has_schema_privilege('anon','sciverse_private','USAGE')
               and not has_schema_privilege('authenticated','sciverse_private','USAGE')
              then 'OK' else 'ERROR' end
  union all
  select 5, '00 VEREDICTO', '>>> limite efectivo del plan free = 5',
         coalesce((select case when ai_weekly_limit = 5 then 'OK'
                               else 'REVISAR — es ' || ai_weekly_limit::text end
                     from public.plans where code = 'free'), 'ERROR — no hay plan free')
  union all
  select 6, '00 VEREDICTO', '>>> ningun contador negativo ni por encima del limite',
         case when (select n from excedidos) = 0
               and not exists (select 1 from sciverse_private.ai_usage_counters where used < 0)
              then 'OK' else 'ERROR' end
  union all
  select 7, '00 VEREDICTO', '>>> contador y libro cuadran esta semana',
         case when not exists (select 1 from desvios) then 'OK'
              else 'ERROR — hay desvio, revisar seccion 04' end
  union all
  select 8, '00 VEREDICTO', '>>> docentes.plan intacto (003 no lo toca)',
         coalesce((select string_agg(distinct coalesce(plan,'(NULL)'), ', ')
                     from public.docentes), '(sin filas)')

  -- ==========================================================================
  -- 01 · OBJETOS
  -- ==========================================================================
  union all
  select 100, '01 OBJETOS', 'sciverse_private.ai_usage_counters',
         coalesce(to_regclass('sciverse_private.ai_usage_counters')::text, 'NO EXISTE')
  union all
  select 101, '01 OBJETOS', 'sciverse_private.ai_generations',
         coalesce(to_regclass('sciverse_private.ai_generations')::text, 'NO EXISTE')
  union all
  select 110, '01 OBJETOS', 'funcion · ' || p.proname || '(' ||
         pg_get_function_identity_arguments(p.oid) || ')',
         case when p.prosecdef then 'SECURITY DEFINER' else 'INVOKER — REVISAR' end
           || ' · ' || coalesce(array_to_string(p.proconfig,' '), 'SIN search_path — REVISAR')
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('get_ai_credit_status','consume_ai_credit','refund_ai_credit')
  union all
  select 120, '01 OBJETOS', 'indices de las tablas privadas',
         coalesce((select string_agg(indexname, ', ' order by indexname)
                     from pg_indexes where schemaname = 'sciverse_private'), '(ninguno)')

  -- ==========================================================================
  -- 02 · PERMISOS
  -- ==========================================================================
  union all
  select 200, '02 PERMISOS', 'EXECUTE · ' || p.proname || ' · ' || r.rolname,
         has_function_privilege(r.oid, p.oid, 'EXECUTE')::text
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   cross join pg_roles r
   where n.nspname = 'public'
     and p.proname in ('get_ai_credit_status','consume_ai_credit','refund_ai_credit')
     and r.rolname in ('anon','authenticated','service_role')
  union all
  select 210, '02 PERMISOS', 'privilegios sobre tablas privadas (debe ser vacio)',
         coalesce((select string_agg(table_name || '/' || grantee || '/' || privilege_type, ', ')
                     from information_schema.role_table_grants
                    where table_schema = 'sciverse_private'
                      and grantee in ('anon','authenticated')), '(ninguno · correcto)')
  union all
  select 220, '02 PERMISOS', 'docentes · columnas escribibles por authenticated',
         coalesce((select string_agg(c.column_name, ', ' order by c.ordinal_position)
                     from information_schema.columns c
                    where c.table_schema='public' and c.table_name='docentes'
                      and has_column_privilege('authenticated','public.docentes',
                                               c.column_name,'UPDATE')),
                  '(ninguna)')
  union all
  select 221, '02 PERMISOS', 'docentes · columnas escribibles por anon (debe ser ninguna)',
         coalesce((select string_agg(c.column_name, ', ' order by c.ordinal_position)
                     from information_schema.columns c
                    where c.table_schema='public' and c.table_name='docentes'
                      and has_column_privilege('anon','public.docentes',
                                               c.column_name,'UPDATE')),
                  '(ninguna · correcto)')

  -- ==========================================================================
  -- 03 · LIMITES EFECTIVOS  (agregado · sin identificadores)
  -- ==========================================================================
  union all
  select 300, '03 LIMITES', 'plan ' || plan_code || ' · limite ' || ai_weekly_limit::text
                            || ' · docentes',
         docentes::text
    from limites

  -- ==========================================================================
  -- 04 · ESTADO DE USO  (agregado · sin PII)
  -- ==========================================================================
  union all
  select 400, '04 USO', 'contadores existentes',
         (select count(*)::text from sciverse_private.ai_usage_counters)
  union all
  select 401, '04 USO', 'contadores de la semana en curso',
         (select count(*)::text from sciverse_private.ai_usage_counters
           where period_start = (date_trunc('week', timezone('America/Lima', now())))::date)
  union all
  select 402, '04 USO', 'used · minimo / maximo / suma',
         coalesce((select min(used)::text || ' / ' || max(used)::text || ' / ' || sum(used)::text
                     from sciverse_private.ai_usage_counters), 'sin contadores')
  union all
  select 403, '04 USO', 'contadores negativos (debe ser 0)',
         (select count(*)::text from sciverse_private.ai_usage_counters where used < 0)
  union all
  select 404, '04 USO', 'contadores por encima de su limite (debe ser 0)',
         (select n::text from excedidos)
  union all
  select 405, '04 USO', 'docentes con contador vs docentes totales',
         (select count(*)::text from sciverse_private.ai_usage_counters) || ' de ' ||
         (select count(*)::text from public.docentes where user_id is not null)
         || '  (0 es correcto si aun nadie ha generado)'

  -- ==========================================================================
  -- 05 · INTEGRIDAD DE ai_generations
  -- ==========================================================================
  union all
  select 500, '05 GENERACIONES', 'filas totales',
         (select count(*)::text from sciverse_private.ai_generations)
  union all
  select 501, '05 GENERACIONES', 'reembolsadas',
         (select count(*)::text from sciverse_private.ai_generations
           where refunded_at is not null)
  union all
  select 502, '05 GENERACIONES', 'reembolso anterior al consumo (debe ser 0)',
         (select count(*)::text from sciverse_private.ai_generations
           where refunded_at is not null and refunded_at < consumed_at)
  union all
  select 503, '05 GENERACIONES', 'sin docente asociado (debe ser 0)',
         (select count(*)::text from sciverse_private.ai_generations g
           where not exists (select 1 from public.docentes d where d.user_id = g.user_id))
  union all
  select 504, '05 GENERACIONES', 'desvios contador-libro esta semana (debe ser 0)',
         (select count(*)::text from desvios)
)

select seccion, comprobacion, resultado
  from filas
 order by ord, comprobacion;

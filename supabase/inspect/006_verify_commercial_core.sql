-- ============================================================================
-- VERIFICACIÓN DE 002_commercial_core.sql
--
--                    ✅ SOLO LECTURA · NO MODIFICA NADA
--
-- Una sola sentencia → un único Results copiable.
-- Ni INSERT, UPDATE, DELETE, ALTER, DROP, GRANT ni REVOKE.
-- No devuelve nombres, correos, teléfonos ni UUID: sólo recuentos, estados
-- y configuración comercial.
--
-- CUÁNDO
--   Inmediatamente después de aplicar 002_commercial_core.sql.
--
-- SI FALLA DICIENDO QUE NO EXISTE public.plans O public.subscriptions
--   Entonces 002 no llegó a aplicarse: es una sola transacción, así que o
--   entró entera o no entró nada. Revisa el error del SQL Editor.
--
-- EMPIEZA POR «00 VEREDICTO»: cuatro filas que responden si 002 quedó bien.
-- Con el censo actual (5 docentes, todos «gratuito») lo esperado es:
--   plan free presente · 5 suscripciones activas · 0 sin cobertura · permisos ok
-- ============================================================================

with

-- Plan efectivo de cada docente, agregado. Nunca sale un user_id.
efectivo as (
  select p.plan_code, p.is_fallback, count(*) as n
    from public.docentes d
    cross join lateral sciverse_private.effective_plan(d.user_id) p
   where d.user_id is not null
   group by p.plan_code, p.is_fallback
),

-- Docentes con más de una suscripción activa. Debe estar vacío siempre: el
-- índice único parcial lo impide, pero se comprueba por si acaso.
duplicados as (
  select count(*) as n
    from (select user_id from public.subscriptions
           where status = 'active'
           group by user_id having count(*) > 1) x
),

filas as (

  -- ==========================================================================
  -- 00 · VEREDICTO
  -- ==========================================================================
  select 0 as ord, '00 VEREDICTO' as seccion,
         '>>> catálogo con plan free' as comprobacion,
         case when exists (select 1 from public.plans
                            where code = 'free' and is_active and ai_weekly_limit > 0)
              then 'OK' else 'FALLA' end as resultado
  union all
  select 1, '00 VEREDICTO', '>>> todo docente con user_id tiene plan efectivo',
         case when not exists (
                select 1 from public.docentes d
                 where d.user_id is not null
                   and not exists (select 1 from public.subscriptions s
                                    where s.user_id = d.user_id and s.status = 'active'))
              then 'OK' else 'FALLA — hay docentes sin suscripción' end
  union all
  select 2, '00 VEREDICTO', '>>> nadie con dos suscripciones activas',
         case when (select n from duplicados) = 0
              then 'OK' else 'FALLA — hay duplicados' end
  union all
  select 3, '00 VEREDICTO', '>>> el cliente no puede escribir nada comercial',
         case when not has_table_privilege('anon','public.subscriptions','SELECT')
               and not has_table_privilege('authenticated','public.subscriptions','UPDATE')
               and not has_table_privilege('authenticated','public.subscriptions','INSERT')
               and not has_table_privilege('authenticated','public.plans','UPDATE')
               and not has_table_privilege('anon','public.plans','UPDATE')
              then 'OK' else 'FALLA — revisar sección 06' end

  -- ==========================================================================
  -- 01 · OBJETOS CREADOS
  -- ==========================================================================
  union all
  select 100, '01 OBJETOS', 'public.plans',
         coalesce(to_regclass('public.plans')::text, 'NO EXISTE')
  union all
  select 101, '01 OBJETOS', 'public.subscriptions',
         coalesce(to_regclass('public.subscriptions')::text, 'NO EXISTE')
  union all
  select 102, '01 OBJETOS', 'esquema sciverse_private',
         coalesce(to_regnamespace('sciverse_private')::text, 'NO EXISTE')
  union all
  select 103, '01 OBJETOS', 'sciverse_private.effective_plan(uuid)',
         coalesce(to_regprocedure('sciverse_private.effective_plan(uuid)')::text, 'NO EXISTE')
  union all
  select 104, '01 OBJETOS', 'public.get_my_plan()',
         coalesce(to_regprocedure('public.get_my_plan()')::text, 'NO EXISTE')
  union all
  select 105, '01 OBJETOS', 'índice único parcial de una activa',
         coalesce((select indexname from pg_indexes
                    where schemaname='public' and tablename='subscriptions'
                      and indexname='subscriptions_one_active_per_user'), 'NO EXISTE')
  union all
  select 106, '01 OBJETOS', 'trigger al_crear_perfil_suscripcion',
         coalesce((select case when t.tgenabled='D' then 'EXISTE pero DESACTIVADO'
                               else 'existe y activo' end
                     from pg_trigger t
                     join pg_class c on c.oid=t.tgrelid
                     join pg_namespace n on n.oid=c.relnamespace
                    where n.nspname='public' and c.relname='docentes'
                      and t.tgname='al_crear_perfil_suscripcion'
                      and not t.tgisinternal), 'NO EXISTE')

  -- ==========================================================================
  -- 02 · CATÁLOGO
  -- ==========================================================================
  union all
  select 200, '02 CATALOGO', 'planes en el catálogo',
         (select count(*)::text from public.plans)
  union all
  select 201, '02 CATALOGO', 'free · ai_weekly_limit',
         coalesce((select ai_weekly_limit::text from public.plans where code='free'),
                  'NO EXISTE EL PLAN FREE')
  union all
  select 202, '02 CATALOGO', 'free · activo / precio / periodo',
         coalesce((select is_active::text || ' / ' || price_cents::text || ' ' || currency
                          || ' / ' || coalesce(billing_period_months::text,'sin vencimiento')
                     from public.plans where code='free'), '-')
  union all
  select 203, '02 CATALOGO', 'todos los códigos',
         coalesce((select string_agg(code, ', ' order by sort_order, code) from public.plans), '(vacío)')

  -- ==========================================================================
  -- 03 · SUSCRIPCIONES
  -- ==========================================================================
  union all
  select 300, '03 SUSCRIPCIONES', 'total de filas',
         (select count(*)::text from public.subscriptions)
  union all
  select 301, '03 SUSCRIPCIONES', 'activas',
         (select count(*)::text from public.subscriptions where status='active')
  union all
  select 302, '03 SUSCRIPCIONES', 'activas del plan free',
         (select count(*)::text from public.subscriptions
           where status='active' and plan_code='free')
  union all
  select 310, '03 SUSCRIPCIONES', 'por estado · ' || status,
         count(*)::text
    from public.subscriptions group by status
  union all
  select 320, '03 SUSCRIPCIONES', 'por origen · ' || source,
         count(*)::text
    from public.subscriptions group by source

  -- ==========================================================================
  -- 04 · PLAN EFECTIVO  (agregado · sin identificadores)
  -- ==========================================================================
  union all
  select 400, '04 PLAN EFECTIVO',
         'plan ' || plan_code || case when is_fallback
                                      then ' (por fallback, SIN fila de suscripción)'
                                      else ' (con suscripción real)' end,
         n::text
    from efectivo

  -- ==========================================================================
  -- 05 · COBERTURA E INTEGRIDAD
  -- ==========================================================================
  union all
  select 500, '05 COBERTURA', 'docentes totales',
         (select count(*)::text from public.docentes)
  union all
  select 501, '05 COBERTURA', 'docentes con user_id',
         (select count(*)::text from public.docentes where user_id is not null)
  union all
  select 502, '05 COBERTURA', 'CON suscripción activa',
         (select count(*)::text from public.docentes d
           where d.user_id is not null
             and exists (select 1 from public.subscriptions s
                          where s.user_id=d.user_id and s.status='active'))
  union all
  select 503, '05 COBERTURA', 'SIN suscripción activa (debe ser 0)',
         (select count(*)::text from public.docentes d
           where d.user_id is not null
             and not exists (select 1 from public.subscriptions s
                              where s.user_id=d.user_id and s.status='active'))
  union all
  select 504, '05 COBERTURA', 'usuarios con DOS activas (debe ser 0)',
         (select n::text from duplicados)
  union all
  select 505, '05 COBERTURA', 'suscripciones huérfanas sin docente (debe ser 0)',
         (select count(*)::text from public.subscriptions s
           where not exists (select 1 from public.docentes d where d.user_id = s.user_id))
  union all
  select 506, '05 COBERTURA', 'docentes.plan intacto · valores distintos',
         coalesce((select string_agg(distinct coalesce(plan,'(NULL)'), ', ')
                     from public.docentes), '(sin filas)')

  -- ==========================================================================
  -- 06 · PERMISOS
  -- ==========================================================================
  union all
  select 600, '06 PERMISOS', 'plans · ' || g.grantee,
         string_agg(g.privilege_type, ', ' order by g.privilege_type)
    from information_schema.role_table_grants g
   where g.table_schema='public' and g.table_name='plans'
     and g.grantee in ('anon','authenticated','service_role')
   group by g.grantee
  union all
  select 610, '06 PERMISOS', 'subscriptions · ' || g.grantee,
         string_agg(g.privilege_type, ', ' order by g.privilege_type)
    from information_schema.role_table_grants g
   where g.table_schema='public' and g.table_name='subscriptions'
     and g.grantee in ('anon','authenticated','service_role')
   group by g.grantee
  union all
  select 620, '06 PERMISOS', 'RLS activado · plans / subscriptions',
         (select string_agg(c.relname || '=' || c.relrowsecurity::text, ' / ' order by c.relname)
            from pg_class c join pg_namespace n on n.oid=c.relnamespace
           where n.nspname='public' and c.relname in ('plans','subscriptions'))
  union all
  select 621, '06 PERMISOS', 'políticas definidas',
         coalesce((select string_agg(tablename || '.' || cmd, ', ' order by tablename, cmd)
                     from pg_policies
                    where schemaname='public' and tablename in ('plans','subscriptions')),
                  '(ninguna)')
  union all
  select 630, '06 PERMISOS', 'anon puede USAR sciverse_private (debe ser false)',
         has_schema_privilege('anon','sciverse_private','USAGE')::text
  union all
  select 631, '06 PERMISOS', 'authenticated puede USAR sciverse_private (debe ser false)',
         has_schema_privilege('authenticated','sciverse_private','USAGE')::text
  union all
  select 640, '06 PERMISOS', 'quién ejecuta get_my_plan · anon/auth/service',
         has_function_privilege('anon','public.get_my_plan()','EXECUTE')::text || ' / ' ||
         has_function_privilege('authenticated','public.get_my_plan()','EXECUTE')::text || ' / ' ||
         has_function_privilege('service_role','public.get_my_plan()','EXECUTE')::text
)

select seccion, comprobacion, resultado
  from filas
 order by ord, comprobacion;

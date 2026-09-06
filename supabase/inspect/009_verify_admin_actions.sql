-- ============================================================================
-- VERIFICACIÓN DE 006_admin_actions.sql
--
--                    ✅ SOLO LECTURA · NO MODIFICA NADA
--
-- Una sola sentencia → un único Results copiable.
-- Ni INSERT, UPDATE, DELETE, ALTER, DROP, GRANT ni REVOKE.
-- NO invoca las funciones de acción: ejecutarlas cambiaría el estado de un
-- docente real. Se comprueba que existan y con qué permisos, no su efecto.
-- No devuelve nombres, correos ni UUID.
--
-- CUÁNDO
--   Inmediatamente después de aplicar 006_admin_actions.sql.
--
-- EMPIEZA POR «00 VEREDICTO»: siete comprobaciones OK/ERROR.
-- ============================================================================

with

acciones(nombre, args) as (
  values ('admin_set_account_status', 'uuid, uuid, boolean, text'),
         ('admin_change_plan',        'uuid, uuid, text, integer, text'),
         ('admin_extend_plan',        'uuid, uuid, integer, text'),
         ('admin_audit_recent',       'uuid, integer')
),

filas as (

  -- ==========================================================================
  -- 00 · VEREDICTO
  -- ==========================================================================
  select 0 as ord, '00 VEREDICTO' as seccion,
         '>>> las cuatro acciones existen' as comprobacion,
         case when (select count(*) from acciones a
                     where to_regprocedure('public.' || a.nombre || '(' || a.args || ')') is not null) = 4
              then 'OK' else 'ERROR' end as resultado
  union all
  select 1, '00 VEREDICTO', '>>> require_admin_role existe',
         case when to_regprocedure('sciverse_private.require_admin_role(uuid, text)') is not null
              then 'OK' else 'ERROR' end
  union all
  select 2, '00 VEREDICTO', '>>> anon NO puede ejecutar ninguna accion',
         case when not exists (
                select 1 from acciones a
                 where has_function_privilege('anon',
                         'public.' || a.nombre || '(' || a.args || ')', 'EXECUTE'))
              then 'OK' else 'ERROR' end
  union all
  select 3, '00 VEREDICTO', '>>> authenticated NO puede ejecutar ninguna accion',
         case when not exists (
                select 1 from acciones a
                 where has_function_privilege('authenticated',
                         'public.' || a.nombre || '(' || a.args || ')', 'EXECUTE'))
              then 'OK' else 'ERROR — el navegador podria mutar' end
  union all
  select 4, '00 VEREDICTO', '>>> service_role SI puede ejecutarlas',
         case when (select count(*) from acciones a
                     where has_function_privilege('service_role',
                             'public.' || a.nombre || '(' || a.args || ')', 'EXECUTE')) = 4
              then 'OK' else 'ERROR' end
  union all
  select 5, '00 VEREDICTO', '>>> sigue existiendo el indice de una sola activa',
         case when exists (select 1 from pg_indexes
                            where schemaname = 'public' and tablename = 'subscriptions'
                              and indexname = 'subscriptions_one_active_per_user')
              then 'OK' else 'ERROR — dos administradores podrian duplicar planes' end
  union all
  select 6, '00 VEREDICTO', '>>> el cliente sigue sin poder escribir en las tablas clave',
         case when not has_table_privilege('authenticated','public.subscriptions','UPDATE')
               and not has_table_privilege('authenticated','public.subscriptions','INSERT')
               and not has_table_privilege('authenticated','public.plans','UPDATE')
               and not has_table_privilege('anon','public.subscriptions','SELECT')
              then 'OK' else 'ERROR' end

  -- ==========================================================================
  -- 01 · FUNCIONES
  -- ==========================================================================
  union all
  select 100, '01 FUNCIONES', 'public.' || a.nombre,
         coalesce(to_regprocedure('public.' || a.nombre || '(' || a.args || ')')::text, 'NO EXISTE')
    from acciones a
  union all
  select 110, '01 FUNCIONES', 'seguridad · ' || p.proname,
         case when p.prosecdef then 'SECURITY DEFINER' else 'INVOKER — REVISAR' end
           || ' · ' || coalesce(array_to_string(p.proconfig, ' '), 'SIN search_path — REVISAR')
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where (n.nspname = 'public' and p.proname in
            ('admin_set_account_status','admin_change_plan','admin_extend_plan','admin_audit_recent'))
      or (n.nspname = 'sciverse_private' and p.proname = 'require_admin_role')

  -- ==========================================================================
  -- 02 · PERMISOS
  -- ==========================================================================
  union all
  select 200, '02 PERMISOS', 'EXECUTE · ' || a.nombre || ' · ' || r.rolname,
         has_function_privilege(r.rolname,
           'public.' || a.nombre || '(' || a.args || ')', 'EXECUTE')::text
    from acciones a
   cross join (values ('anon'), ('authenticated'), ('service_role')) as r(rolname)
  union all
  select 210, '02 PERMISOS', 'escritura directa del cliente sobre tablas clave',
         coalesce((select string_agg(table_name || '/' || grantee || '/' || privilege_type, ', ')
                     from information_schema.role_table_grants
                    where table_schema = 'public'
                      and table_name in ('plans','subscriptions')
                      and grantee in ('anon','authenticated')
                      and privilege_type in ('INSERT','UPDATE','DELETE')),
                  '(ninguna · correcto)')

  -- ==========================================================================
  -- 03 · CATÁLOGO Y SUSCRIPCIONES
  -- ==========================================================================
  union all
  select 300, '03 CATALOGO', 'planes activos',
         coalesce((select string_agg(code || ' (limite ' || ai_weekly_limit::text || ')',
                                     ', ' order by sort_order, code)
                     from public.plans where is_active), '(ninguno)')
  union all
  select 301, '03 CATALOGO', 'planes de pago definidos',
         (select count(*)::text from public.plans where is_active and price_cents > 0)
         || '   (0 es lo esperado hasta que se decidan nombres y precios)'
  union all
  select 310, '03 CATALOGO', 'suscripciones por estado',
         coalesce((select string_agg(status || '=' || n, ', ' order by status)
                     from (select status, count(*) as n
                             from public.subscriptions group by status) s), '(ninguna)')
  union all
  select 311, '03 CATALOGO', 'usuarios con DOS activas (debe ser 0)',
         (select count(*)::text from (
            select user_id from public.subscriptions
             where status = 'active' group by user_id having count(*) > 1) x)
  union all
  select 320, '03 CATALOGO', 'cuentas suspendidas',
         (select count(*)::text from public.docentes where not activo)

  -- ==========================================================================
  -- 04 · AUDITORÍA
  -- ==========================================================================
  union all
  select 400, '04 AUDITORIA', 'lineas registradas',
         (select count(*)::text from sciverse_private.admin_audit_log)
  union all
  select 401, '04 AUDITORIA', 'por accion',
         coalesce((select string_agg(action || '=' || n, ', ' order by action)
                     from (select action, count(*) as n
                             from sciverse_private.admin_audit_log group by action) s),
                  '(ninguna todavia)')
  union all
  select 402, '04 AUDITORIA', 'sigue siendo de solo anadir',
         case when exists (
                select 1 from pg_trigger t
                  join pg_class c on c.oid = t.tgrelid
                  join pg_namespace n on n.oid = c.relnamespace
                 where n.nspname = 'sciverse_private' and c.relname = 'admin_audit_log'
                   and t.tgname = 'admin_audit_log_no_update' and not t.tgisinternal)
              then 'sí' else 'NO — REVISAR' end
  union all
  select 403, '04 AUDITORIA', 'lineas con algo que parezca un secreto (debe ser 0)',
         (select count(*)::text from sciverse_private.admin_audit_log
           where (before_data::text || after_data::text || metadata::text)
                 ~* '(token|jwt|password|contrase|service_role|bearer)')
)

select seccion, comprobacion, resultado
  from filas
 order by ord, comprobacion;

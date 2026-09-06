-- ============================================================================
-- VERIFICACIÓN DE 005_admin_core.sql
--
--                    ✅ SOLO LECTURA · NO MODIFICA NADA
--
-- Una sola sentencia → un único Results copiable.
-- Ni INSERT, UPDATE, DELETE, ALTER, DROP, GRANT ni REVOKE.
-- No invoca las funciones de datos: no hace falta y así no depende de que
-- exista ningún administrador todavía.
-- No devuelve nombres, correos, teléfonos ni UUID.
--
-- CUÁNDO
--   Inmediatamente después de aplicar 005_admin_core.sql.
--
-- EMPIEZA POR «00 VEREDICTO»: siete comprobaciones OK/ERROR.
-- Antes del bootstrap, lo esperado es OK en las siete y 0 administradores.
-- ============================================================================

with

esperadas(nombre, args) as (
  values ('current_admin', ''),
         ('admin_summary', ''),
         ('admin_list_docentes', 'text, integer, integer'),
         ('admin_docente_detail', 'uuid')
),

filas as (

  -- ==========================================================================
  -- 00 · VEREDICTO
  -- ==========================================================================
  select 0 as ord, '00 VEREDICTO' as seccion,
         '>>> tablas administrativas creadas' as comprobacion,
         case when to_regclass('sciverse_private.admin_users') is not null
               and to_regclass('sciverse_private.admin_audit_log') is not null
              then 'OK' else 'ERROR' end as resultado
  union all
  select 1, '00 VEREDICTO', '>>> las cuatro funciones existen',
         case when (select count(*) from esperadas e
                     where to_regprocedure('public.' || e.nombre || '(' || e.args || ')') is not null) = 4
              then 'OK' else 'ERROR' end
  union all
  select 2, '00 VEREDICTO', '>>> anon no ejecuta ninguna funcion admin',
         case when not has_function_privilege('anon','public.current_admin()','EXECUTE')
               and not has_function_privilege('anon','public.admin_summary()','EXECUTE')
               and not has_function_privilege('anon','public.admin_list_docentes(text, integer, integer)','EXECUTE')
               and not has_function_privilege('anon','public.admin_docente_detail(uuid)','EXECUTE')
              then 'OK' else 'ERROR' end
  union all
  select 3, '00 VEREDICTO', '>>> authenticated solo puede preguntar si es admin',
         case when has_function_privilege('authenticated','public.current_admin()','EXECUTE')
               and not has_function_privilege('authenticated','public.admin_summary()','EXECUTE')
               and not has_function_privilege('authenticated','public.admin_list_docentes(text, integer, integer)','EXECUTE')
               and not has_function_privilege('authenticated','public.admin_docente_detail(uuid)','EXECUTE')
              then 'OK' else 'ERROR — el navegador alcanza datos administrativos' end
  union all
  select 4, '00 VEREDICTO', '>>> service_role si puede leer los datos',
         case when has_function_privilege('service_role','public.admin_summary()','EXECUTE')
               and has_function_privilege('service_role','public.admin_list_docentes(text, integer, integer)','EXECUTE')
               and has_function_privilege('service_role','public.admin_docente_detail(uuid)','EXECUTE')
              then 'OK' else 'ERROR' end
  union all
  select 5, '00 VEREDICTO', '>>> el cliente no alcanza las tablas administrativas',
         case when not has_table_privilege('anon','sciverse_private.admin_users','SELECT')
               and not has_table_privilege('authenticated','sciverse_private.admin_users','SELECT')
               and not has_table_privilege('anon','sciverse_private.admin_audit_log','SELECT')
               and not has_table_privilege('authenticated','sciverse_private.admin_audit_log','SELECT')
              then 'OK' else 'ERROR' end
  union all
  select 6, '00 VEREDICTO', '>>> la auditoria es de solo anadir',
         case when exists (
                select 1 from pg_trigger t
                  join pg_class c on c.oid = t.tgrelid
                  join pg_namespace n on n.oid = c.relnamespace
                 where n.nspname = 'sciverse_private'
                   and c.relname = 'admin_audit_log'
                   and t.tgname = 'admin_audit_log_no_update'
                   and not t.tgisinternal)
              then 'OK' else 'ERROR — se podria editar el historial' end

  -- ==========================================================================
  -- 01 · OBJETOS
  -- ==========================================================================
  union all
  select 100, '01 OBJETOS', 'sciverse_private.admin_users',
         coalesce(to_regclass('sciverse_private.admin_users')::text, 'NO EXISTE')
  union all
  select 101, '01 OBJETOS', 'sciverse_private.admin_audit_log',
         coalesce(to_regclass('sciverse_private.admin_audit_log')::text, 'NO EXISTE')
  union all
  select 110, '01 OBJETOS', 'funcion · ' || e.nombre,
         coalesce(to_regprocedure('public.' || e.nombre || '(' || e.args || ')')::text, 'NO EXISTE')
    from esperadas e
  union all
  select 120, '01 OBJETOS', 'sciverse_private.auth_user_info(uuid[])',
         coalesce(to_regprocedure('sciverse_private.auth_user_info(uuid[])')::text, 'NO EXISTE')
  union all
  select 130, '01 OBJETOS', 'indices administrativos',
         coalesce((select string_agg(indexname, ', ' order by indexname)
                     from pg_indexes
                    where schemaname = 'sciverse_private'
                      and tablename in ('admin_users','admin_audit_log')), '(ninguno)')

  -- ==========================================================================
  -- 02 · SEGURIDAD DE LAS FUNCIONES
  -- ==========================================================================
  union all
  select 200, '02 SEGURIDAD', 'definer y search_path · ' || p.proname,
         case when p.prosecdef then 'SECURITY DEFINER' else 'INVOKER — REVISAR' end
           || ' · ' || coalesce(array_to_string(p.proconfig, ' '), 'SIN search_path — REVISAR')
           || ' · propietario ' || pg_get_userbyid(p.proowner)
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where (n.nspname = 'public' and p.proname in
            ('current_admin','admin_summary','admin_list_docentes','admin_docente_detail'))
      or (n.nspname = 'sciverse_private' and p.proname = 'auth_user_info')

  -- ==========================================================================
  -- 03 · PERMISOS
  -- ==========================================================================
  union all
  select 300, '03 PERMISOS', 'EXECUTE · ' || p.proname || ' · ' || r.rolname,
         has_function_privilege(r.oid, p.oid, 'EXECUTE')::text
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   cross join pg_roles r
   where n.nspname = 'public'
     and p.proname in ('current_admin','admin_summary','admin_list_docentes','admin_docente_detail')
     and r.rolname in ('anon','authenticated','service_role')
  union all
  select 310, '03 PERMISOS', 'privilegios sobre tablas admin (debe ser vacio)',
         coalesce((select string_agg(table_name || '/' || grantee || '/' || privilege_type, ', ')
                     from information_schema.role_table_grants
                    where table_schema = 'sciverse_private'
                      and table_name in ('admin_users','admin_audit_log')
                      and grantee in ('anon','authenticated')), '(ninguno · correcto)')
  union all
  select 320, '03 PERMISOS', 'USAGE en sciverse_private · anon / auth / service',
         has_schema_privilege('anon','sciverse_private','USAGE')::text || ' / ' ||
         has_schema_privilege('authenticated','sciverse_private','USAGE')::text || ' / ' ||
         has_schema_privilege('service_role','sciverse_private','USAGE')::text
         || '   (esperado: false / false / true)'

  -- ==========================================================================
  -- 04 · ESTADO
  -- ==========================================================================
  union all
  select 400, '04 ESTADO', 'administradores registrados',
         (select count(*)::text from sciverse_private.admin_users)
  union all
  select 401, '04 ESTADO', 'administradores activos por rol',
         coalesce((select string_agg(role || '=' || n, ', ' order by role)
                     from (select role, count(*) as n
                             from sciverse_private.admin_users
                            where is_active group by role) s),
                  '(ninguno — falta el bootstrap del primer superadmin)')
  union all
  select 402, '04 ESTADO', 'superadmins activos',
         (select count(*)::text from sciverse_private.admin_users
           where is_active and role = 'superadmin')
         || '   (conviene tener AL MENOS 2)'
  union all
  select 410, '04 ESTADO', 'lineas de auditoria',
         (select count(*)::text from sciverse_private.admin_audit_log)
  union all
  select 420, '04 ESTADO', 'ADMIN_SECRET sigue en uso en api/list-docentes.js',
         'sí — se retira cuando el panel nuevo esté validado'
)

select seccion, comprobacion, resultado
  from filas
 order by ord, comprobacion;

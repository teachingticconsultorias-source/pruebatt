-- ============================================================================
-- INSPECCIÓN CONSOLIDADA DEL ESTADO REAL DE PRODUCCIÓN
--
--              ✅ ESTRICTAMENTE SOLO LECTURA · UNA SOLA CONSULTA
--
-- Es UNA ÚNICA sentencia SELECT (un gran UNION ALL). Por eso el SQL Editor
-- de Supabase muestra un solo panel de Results, en vez de uno por consulta
-- como ocurría con 001_production_state.sql.
--
-- CÓMO USARLO
--   Supabase → SQL Editor → New query → pegar TODO → Run
--   → botón de copiar / exportar del panel de Results → pegar la tabla.
--
-- GARANTÍAS
--   · Solo SELECT. Ni INSERT, UPDATE, DELETE, ALTER, DROP, GRANT o REVOKE.
--   · No invoca ninguna función de la aplicación: no consume ni reembolsa
--     créditos, no crea perfiles, no dispara triggers.
--   · Lee catálogos del sistema (pg_catalog, information_schema).
--   · Los únicos datos de las tablas de la aplicación son RECUENTOS
--     AGREGADOS. Ninguna fila individual.
--   · NO devuelve nombres, correos, teléfonos, UUID de usuarios ni secretos.
--   · Si algo no existe o no es accesible, devuelve 'unavailable' en lugar
--     de fallar. El script nunca intenta crear lo que falta.
--
-- SALIDA
--   Cuatro columnas: section | object | property | value
--   Ordenadas por un índice interno para que las secciones salgan en orden.
--
-- EMPIEZA POR LA SECCIÓN «00 VEREDICTO»: responde de un vistazo si los dos
-- fallos críticos de créditos existen de verdad en producción.
-- ============================================================================

with

-- ¿Existen los objetos? to_regclass / to_regprocedure devuelven NULL en vez
-- de lanzar error, así que sirven de guarda para todo lo demás.
obj as (
  select
    to_regclass('public.docentes')            as t_docentes,
    to_regclass('public.materiales_docente')  as t_materiales,
    to_regprocedure('public.refund_ai_credit()')     as f_refund,
    to_regprocedure('public.consume_ai_credit()')    as f_consume,
    to_regprocedure('public.get_ai_credit_status()') as f_status,
    to_regclass('supabase_migrations.schema_migrations') as t_migrations
),

-- ¿Hay alguna política de UPDATE sobre docentes que alcance a authenticated?
pol_update as (
  select count(*) as n
  from pg_policies
  where schemaname = 'public'
    and tablename = 'docentes'
    and cmd in ('UPDATE', 'ALL')
    and (roles::text like '%authenticated%' or roles::text like '%{public}%')
),

filas as (

  -- ==========================================================================
  -- 00 · VEREDICTO — la respuesta directa a los dos críticos
  -- ==========================================================================
  select 0 as ord, '00 VEREDICTO' as section, 'CRITICO-1' as object,
         'authenticated puede UPDATE ai_week_used' as property,
         coalesce(
           (select case when o.t_docentes is null then 'unavailable'
                        else has_column_privilege('authenticated', o.t_docentes, 'ai_week_used', 'UPDATE')::text
                   end from obj o), 'unavailable') as value
  union all
  select 1, '00 VEREDICTO', 'CRITICO-1',
         'authenticated puede UPDATE ai_weekly_limit',
         coalesce((select case when o.t_docentes is null then 'unavailable'
                               else has_column_privilege('authenticated', o.t_docentes, 'ai_weekly_limit', 'UPDATE')::text
                          end from obj o), 'unavailable')
  union all
  select 2, '00 VEREDICTO', 'CRITICO-1',
         'authenticated puede UPDATE plan',
         coalesce((select case when o.t_docentes is null then 'unavailable'
                               else has_column_privilege('authenticated', o.t_docentes, 'plan', 'UPDATE')::text
                          end from obj o), 'unavailable')
  union all
  select 3, '00 VEREDICTO', 'CRITICO-1',
         'politicas UPDATE sobre docentes que alcanzan authenticated',
         (select n::text from pol_update)
  union all
  select 4, '00 VEREDICTO', 'CRITICO-1',
         '>>> EXPLOTABLE (privilegio de columna + politica UPDATE)',
         coalesce((
           select case
             when o.t_docentes is null then 'unavailable'
             when has_column_privilege('authenticated', o.t_docentes, 'ai_week_used', 'UPDATE')
              and (select n from pol_update) > 0
               then 'SI — un docente puede ponerse creditos y plan a voluntad'
             else 'NO'
           end from obj o), 'unavailable')
  union all
  select 5, '00 VEREDICTO', 'CRITICO-2',
         'authenticated puede EXECUTE refund_ai_credit()',
         coalesce((select case when o.f_refund is null then 'unavailable — la funcion no existe'
                               else has_function_privilege('authenticated', o.f_refund, 'EXECUTE')::text
                          end from obj o), 'unavailable')
  union all
  select 6, '00 VEREDICTO', 'CRITICO-2',
         'anon puede EXECUTE refund_ai_credit()',
         coalesce((select case when o.f_refund is null then 'unavailable'
                               else has_function_privilege('anon', o.f_refund, 'EXECUTE')::text
                          end from obj o), 'unavailable')
  union all
  select 7, '00 VEREDICTO', 'CRITICO-2',
         'refund_ai_credit recibe algun parametro',
         coalesce((select case
                     when o.f_refund is null then 'unavailable'
                     when pg_get_function_identity_arguments(o.f_refund) = ''
                       then 'NO — sin argumentos: no puede atarse a una generacion concreta'
                     else pg_get_function_identity_arguments(o.f_refund)
                   end from obj o), 'unavailable')
  union all
  select 8, '00 VEREDICTO', 'CRITICO-2',
         '>>> EXPLOTABLE (invocable por el navegador y sin prueba de consumo)',
         coalesce((
           select case
             when o.f_refund is null then 'unavailable'
             when has_function_privilege('authenticated', o.f_refund, 'EXECUTE')
              and pg_get_function_identity_arguments(o.f_refund) = ''
               then 'SI — creditos ilimitados llamando POST /rest/v1/rpc/refund_ai_credit'
             else 'NO'
           end from obj o), 'unavailable')
  union all
  select 9, '00 VEREDICTO', 'MATERIAL TYPES',
         '>>> estado de 001_material_types.sql',
         coalesce((
           select case when pg_get_constraintdef(con.oid) like '%challenge%'
                       then 'YA APLICADA — challenge admitido'
                       else 'PENDIENTE — challenge NO admitido: los retos fallan al guardar' end
           from pg_constraint con
           join pg_class rel on rel.oid = con.conrelid
           join pg_namespace ns on ns.oid = rel.relnamespace
           where ns.nspname = 'public' and rel.relname = 'materiales_docente'
             and con.contype = 'c' and pg_get_constraintdef(con.oid) like '%tipo%'
           limit 1), 'unavailable — no se encontro el CHECK de tipo')
  union all
  select 10, '00 VEREDICTO', 'TRIGGER PERFIL',
         '>>> al_crear_usuario sobre auth.users',
         coalesce((
           select case when t.tgenabled = 'D' then 'EXISTE pero DESACTIVADO'
                       else 'EXISTE y activo' end
           from pg_trigger t
           join pg_class c on c.oid = t.tgrelid
           join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'auth' and c.relname = 'users'
             and t.tgname = 'al_crear_usuario' and not t.tgisinternal
           limit 1), 'NO EXISTE — las cuentas nuevas se quedarian sin perfil')

  -- ==========================================================================
  -- 01 · EXISTENCIA DE OBJETOS
  -- ==========================================================================
  union all
  select 100, '01 EXISTENCIA', 'public.docentes', 'existe',
         (select case when t_docentes is null then 'NO' else 'SI' end from obj)
  union all
  select 101, '01 EXISTENCIA', 'public.materiales_docente', 'existe',
         (select case when t_materiales is null then 'NO' else 'SI' end from obj)
  union all
  select 102, '01 EXISTENCIA', 'supabase_migrations.schema_migrations', 'existe',
         (select case when t_migrations is null then 'NO' else 'SI' end from obj)
  union all
  select 103, '01 EXISTENCIA', 'otras tablas en public', 'listado',
         coalesce((select string_agg(tablename, ', ' order by tablename)
                   from pg_tables where schemaname = 'public'), '(ninguna)')

  -- ==========================================================================
  -- 02 · COLUMNAS
  -- ==========================================================================
  union all
  select 200 + c.ordinal_position::int, '02 COLUMNAS',
         c.table_name,
         lpad(c.ordinal_position::text, 2, '0') || ' ' || c.column_name,
         c.data_type
           || case when c.is_nullable = 'YES' then ' · nullable' else ' · NOT NULL' end
           || coalesce(' · default ' || regexp_replace(c.column_default, '\s+', ' ', 'g'), '')
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name in ('docentes', 'materiales_docente')

  -- ==========================================================================
  -- 03 · ROW LEVEL SECURITY
  -- ==========================================================================
  union all
  select 300, '03 RLS', rel.relname, 'rls_activado', rel.relrowsecurity::text
  from pg_class rel
  join pg_namespace ns on ns.oid = rel.relnamespace
  where ns.nspname = 'public' and rel.relname in ('docentes', 'materiales_docente')
  union all
  select 301, '03 RLS', rel.relname, 'rls_forzado', rel.relforcerowsecurity::text
  from pg_class rel
  join pg_namespace ns on ns.oid = rel.relnamespace
  where ns.nspname = 'public' and rel.relname in ('docentes', 'materiales_docente')

  -- ==========================================================================
  -- 04 · POLÍTICAS RLS COMPLETAS
  -- ==========================================================================
  union all
  select 400, '04 POLICIES',
         p.tablename || ' · ' || p.cmd,
         p.policyname,
         'roles=' || p.roles::text
           || ' | permisiva=' || p.permissive
           || ' | using=' || coalesce(regexp_replace(p.qual, '\s+', ' ', 'g'), '(ninguna)')
           || ' | with_check=' || coalesce(regexp_replace(p.with_check, '\s+', ' ', 'g'), '(ninguna)')
  from pg_policies p
  where p.schemaname = 'public'
    and p.tablename in ('docentes', 'materiales_docente')

  -- ==========================================================================
  -- 05 · PRIVILEGIOS DE TABLA
  -- ==========================================================================
  union all
  select 500, '05 GRANTS TABLA', g.table_name, g.grantee,
         string_agg(g.privilege_type, ', ' order by g.privilege_type)
  from information_schema.role_table_grants g
  where g.table_schema = 'public'
    and g.table_name in ('docentes', 'materiales_docente')
    and g.grantee in ('anon', 'authenticated', 'service_role', 'PUBLIC')
  group by g.table_name, g.grantee

  -- ==========================================================================
  -- 06 · PRIVILEGIOS SOBRE LAS COLUMNAS SENSIBLES
  --      has_column_privilege tiene en cuenta el GRANT de tabla y el de
  --      columna a la vez, así que es la prueba definitiva.
  -- ==========================================================================
  union all
  select 600, '06 COLUMNAS SENSIBLES', col.name, rol.name || ' · UPDATE',
         coalesce(
           (select case when o.t_docentes is null then 'unavailable'
                        else has_column_privilege(rol.name::name, o.t_docentes, col.name, 'UPDATE')::text
                   end from obj o), 'unavailable')
  from (values ('ai_week_used'), ('ai_weekly_limit'), ('ai_week_start'),
               ('plan'), ('activo'), ('nombres'), ('nivel')) as col(name)
  cross join (values ('authenticated'), ('anon')) as rol(name)
  union all
  select 601, '06 COLUMNAS SENSIBLES', 'GRANTs explicitos por columna',
         'total definidos para anon/authenticated',
         (select count(*)::text from information_schema.column_privileges
          where table_schema = 'public'
            and table_name in ('docentes', 'materiales_docente')
            and grantee in ('anon', 'authenticated'))

  -- ==========================================================================
  -- 07 · RESTRICCIONES
  -- ==========================================================================
  union all
  select 700, '07 CONSTRAINTS', rel.relname,
         case con.contype when 'p' then 'PK' when 'f' then 'FK'
              when 'u' then 'UNIQUE' when 'c' then 'CHECK' else con.contype::text end
           || ' · ' || con.conname,
         regexp_replace(pg_get_constraintdef(con.oid), '\s+', ' ', 'g')
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace ns on ns.oid = rel.relnamespace
  where ns.nspname = 'public'
    and rel.relname in ('docentes', 'materiales_docente')

  -- ==========================================================================
  -- 08 · EL CHECK DE `tipo` Y LOS TIPOS ADMITIDOS
  -- ==========================================================================
  union all
  select 800, '08 CHECK TIPO', 'materiales_docente', 'definicion vigente',
         coalesce((
           select regexp_replace(pg_get_constraintdef(con.oid), '\s+', ' ', 'g')
           from pg_constraint con
           join pg_class rel on rel.oid = con.conrelid
           join pg_namespace ns on ns.oid = rel.relnamespace
           where ns.nspname = 'public' and rel.relname = 'materiales_docente'
             and con.contype = 'c' and pg_get_constraintdef(con.oid) like '%tipo%'
           limit 1), 'unavailable — no hay CHECK sobre tipo')
  union all
  select 801, '08 CHECK TIPO', 'frontend', 'tipos que la app escribe',
         'challenge, project, rating_scale, reading, worksheet (+ session, rubric, checklist heredados)'
  union all
  select 810, '08 CHECK TIPO', 'admitido', t.name,
         coalesce((
           select case when pg_get_constraintdef(con.oid) like '%''' || t.name || '''%'
                       then 'SI' else 'NO — se guardaria con error' end
           from pg_constraint con
           join pg_class rel on rel.oid = con.conrelid
           join pg_namespace ns on ns.oid = rel.relnamespace
           where ns.nspname = 'public' and rel.relname = 'materiales_docente'
             and con.contype = 'c' and pg_get_constraintdef(con.oid) like '%tipo%'
           limit 1), 'unavailable')
  from (values ('session'), ('project'), ('rubric'), ('checklist'),
               ('worksheet'), ('reading'), ('rating_scale'),
               ('observation_guide'), ('questionnaire'), ('challenge')) as t(name)

  -- ==========================================================================
  -- 09 · FUNCIONES: SEGURIDAD, PROPIETARIO Y search_path
  -- ==========================================================================
  union all
  select 900, '09 FUNCIONES', p.proname,
         'seguridad',
         case when p.prosecdef then 'SECURITY DEFINER' else 'SECURITY INVOKER' end
           || ' · propietario=' || pg_get_userbyid(p.proowner)
           || ' · args=(' || pg_get_function_identity_arguments(p.oid) || ')'
           || ' · config=' || coalesce(array_to_string(p.proconfig, ' '), '(sin search_path fijado)')
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in ('get_ai_credit_status', 'consume_ai_credit',
                      'refund_ai_credit', 'crear_perfil_docente')

  -- ==========================================================================
  -- 10 · QUIÉN PUEDE EJECUTAR CADA FUNCIÓN
  -- ==========================================================================
  union all
  select 1000, '10 EXECUTE', p.proname, r.rolname,
         has_function_privilege(r.oid, p.oid, 'EXECUTE')::text
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  cross join pg_roles r
  where n.nspname = 'public'
    and p.proname in ('get_ai_credit_status', 'consume_ai_credit',
                      'refund_ai_credit', 'crear_perfil_docente')
    and r.rolname in ('anon', 'authenticated', 'service_role')

  -- ==========================================================================
  -- 11 · DEFINICIÓN COMPLETA DE LAS FUNCIONES
  --      Saltos de línea colapsados para que quepa en una celda copiable.
  -- ==========================================================================
  union all
  select 1100, '11 DEFINICIONES', p.proname, 'cuerpo completo',
         regexp_replace(pg_get_functiondef(p.oid), '\s+', ' ', 'g')
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in ('get_ai_credit_status', 'consume_ai_credit',
                      'refund_ai_credit', 'crear_perfil_docente')

  -- ==========================================================================
  -- 12 · TRIGGERS
  -- ==========================================================================
  union all
  select 1200, '12 TRIGGERS', n.nspname || '.' || c.relname, t.tgname,
         case when t.tgenabled = 'D' then 'DESACTIVADO · ' else 'activo · ' end
           || regexp_replace(pg_get_triggerdef(t.oid), '\s+', ' ', 'g')
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where not t.tgisinternal
    and ((n.nspname = 'auth' and c.relname = 'users')
      or (n.nspname = 'public' and c.relname in ('docentes', 'materiales_docente')))

  -- ==========================================================================
  -- 13 · ÍNDICES
  -- ==========================================================================
  union all
  select 1300, '13 INDICES', i.tablename, i.indexname,
         regexp_replace(i.indexdef, '\s+', ' ', 'g')
  from pg_indexes i
  where i.schemaname = 'public'
    and i.tablename in ('docentes', 'materiales_docente')

  -- ==========================================================================
  -- 14 · CENSO AGREGADO  (solo recuentos · ninguna fila individual)
  --      query_to_xml se ejecuta únicamente si la tabla existe, gracias a la
  --      evaluación perezosa del CASE. Si no existe → 'unavailable'.
  -- ==========================================================================
  union all
  select 1400, '14 CENSO', 'materiales_docente', 'filas por tipo (agregado)',
         coalesce((
           select case when o.t_materiales is null then 'unavailable'
             else (xpath('/table/row/v/text()', query_to_xml(
               'select coalesce(string_agg(tipo || ''='' || n, '', '' order by n desc), ''(tabla vacia)'') as v
                  from (select tipo, count(*) as n from public.materiales_docente group by tipo) s',
               false, false, '')))[1]::text
           end from obj o), 'unavailable')
  union all
  select 1401, '14 CENSO', 'materiales_docente', 'total de filas',
         coalesce((
           select case when o.t_materiales is null then 'unavailable'
             else (xpath('/table/row/v/text()', query_to_xml(
               'select count(*)::text as v from public.materiales_docente', false, false, '')))[1]::text
           end from obj o), 'unavailable')
  union all
  select 1402, '14 CENSO', 'docentes', 'total de filas',
         coalesce((
           select case when o.t_docentes is null then 'unavailable'
             else (xpath('/table/row/v/text()', query_to_xml(
               'select count(*)::text as v from public.docentes', false, false, '')))[1]::text
           end from obj o), 'unavailable')
  union all
  select 1403, '14 CENSO', 'docentes', 'filas sin user_id (perfiles huerfanos)',
         coalesce((
           select case when o.t_docentes is null then 'unavailable'
             else (xpath('/table/row/v/text()', query_to_xml(
               'select count(*)::text as v from public.docentes where user_id is null', false, false, '')))[1]::text
           end from obj o), 'unavailable')
  union all
  select 1404, '14 CENSO', 'docentes', 'correos con mayusculas / colisiones al normalizar',
         coalesce((
           select case when o.t_docentes is null then 'unavailable'
             else (xpath('/table/row/v/text()', query_to_xml(
               'select (count(*) filter (where correo <> lower(correo)))::text || '' / '' ||
                       (count(*) - count(distinct lower(correo)))::text as v
                  from public.docentes', false, false, '')))[1]::text
           end from obj o), 'unavailable')
  union all
  select 1405, '14 CENSO', 'docentes', 'distribucion de plan (agregado)',
         coalesce((
           select case when o.t_docentes is null then 'unavailable'
             else (xpath('/table/row/v/text()', query_to_xml(
               'select coalesce(string_agg(plan || ''='' || n, '', '' order by n desc), ''(tabla vacia)'') as v
                  from (select plan, count(*) as n from public.docentes group by plan) s',
               false, false, '')))[1]::text
           end from obj o), 'unavailable')

  -- ==========================================================================
  -- 15 · MIGRACIONES REGISTRADAS
  --      Solo existe si se usó Supabase CLI. Si los scripts se ejecutaron a
  --      mano en el SQL Editor, esta tabla no existirá: es lo esperado.
  -- ==========================================================================
  union all
  select 1500, '15 MIGRACIONES', 'supabase_migrations.schema_migrations', 'versiones registradas',
         coalesce((
           select case when o.t_migrations is null
             then 'unavailable — la tabla no existe (los scripts se aplicaron a mano)'
             else (xpath('/table/row/v/text()', query_to_xml(
               'select coalesce(string_agg(version, '', '' order by version), ''(vacia)'') as v
                  from supabase_migrations.schema_migrations', false, false, '')))[1]::text
           end from obj o), 'unavailable')

  -- ==========================================================================
  -- 16 · ENTORNO
  -- ==========================================================================
  union all
  select 1600, '16 ENTORNO', 'postgres', 'version', version()
  union all
  select 1601, '16 ENTORNO', 'extensiones', 'instaladas',
         (select string_agg(extname || ' ' || extversion, ', ' order by extname) from pg_extension)
  union all
  select 1602, '16 ENTORNO', 'esquemas', 'no del sistema',
         (select string_agg(nspname, ', ' order by nspname) from pg_namespace
          where nspname not like 'pg\_%' and nspname <> 'information_schema')
)

select section, object, property, value
from filas
order by ord, section, object, property;

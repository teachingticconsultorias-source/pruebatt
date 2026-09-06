-- ============================================================================
-- VERIFICACIÓN DE 007_payments.sql
--
--                    ✅ SOLO LECTURA · NO MODIFICA NADA
--
-- Una sola sentencia → un único Results copiable.
-- Ni INSERT, UPDATE, DELETE, ALTER, DROP, GRANT ni REVOKE.
-- NO invoca las funciones de acción: aprobar o rechazar cambiaría el plan de
-- un docente real. Se comprueba que existan y con qué permisos.
-- No devuelve nombres, correos ni UUID.
--
-- CUÁNDO
--   Inmediatamente después de aplicar 007_payments.sql.
--
-- EMPIEZA POR «00 VEREDICTO»: ocho comprobaciones OK/ERROR.
-- Antes de configurar precios, lo esperado es OK en las ocho, con el plan Pro
-- inactivo y las instrucciones de pago SIN configurar.
-- ============================================================================

with

funcs(nombre, args, quien) as (
  values ('request_plan',          'text, text, text',            'authenticated'),
         ('my_payment_requests',   '',                            'authenticated'),
         ('admin_list_payments',   'text, text, integer, integer','service_role'),
         ('admin_approve_payment', 'uuid, uuid, text',            'service_role'),
         ('admin_reject_payment',  'uuid, uuid, text',            'service_role')
),

filas as (

  -- ==========================================================================
  -- 00 · VEREDICTO
  -- ==========================================================================
  select 0 as ord, '00 VEREDICTO' as seccion,
         '>>> tablas de pago creadas' as comprobacion,
         case when to_regclass('public.payment_requests') is not null
               and to_regclass('public.payment_settings') is not null
              then 'OK' else 'ERROR' end as resultado
  union all
  select 1, '00 VEREDICTO', '>>> las cinco funciones existen',
         case when (select count(*) from funcs f
                     where to_regprocedure('public.' || f.nombre || '(' || f.args || ')') is not null) = 5
              then 'OK' else 'ERROR' end
  union all
  select 2, '00 VEREDICTO', '>>> el cliente NO alcanza payment_requests directamente',
         case when not has_table_privilege('anon','public.payment_requests','SELECT')
               and not has_table_privilege('authenticated','public.payment_requests','SELECT')
               and not has_table_privilege('authenticated','public.payment_requests','INSERT')
               and not has_table_privilege('authenticated','public.payment_requests','UPDATE')
              then 'OK' else 'ERROR — las notas internas podrian filtrarse' end
  union all
  select 3, '00 VEREDICTO', '>>> anon no ejecuta nada de pagos',
         case when not exists (
                select 1 from funcs f
                 where has_function_privilege('anon',
                         'public.' || f.nombre || '(' || f.args || ')', 'EXECUTE'))
              then 'OK' else 'ERROR' end
  union all
  select 4, '00 VEREDICTO', '>>> authenticated solo pide y consulta lo suyo',
         case when has_function_privilege('authenticated','public.request_plan(text, text, text)','EXECUTE')
               and has_function_privilege('authenticated','public.my_payment_requests()','EXECUTE')
               and not has_function_privilege('authenticated','public.admin_approve_payment(uuid, uuid, text)','EXECUTE')
               and not has_function_privilege('authenticated','public.admin_reject_payment(uuid, uuid, text)','EXECUTE')
               and not has_function_privilege('authenticated','public.admin_list_payments(text, text, integer, integer)','EXECUTE')
              then 'OK' else 'ERROR — el navegador podria aprobarse pagos' end
  union all
  select 5, '00 VEREDICTO', '>>> una sola solicitud pendiente por plan',
         case when exists (select 1 from pg_indexes
                            where schemaname = 'public' and tablename = 'payment_requests'
                              and indexname = 'payment_requests_one_pending')
              then 'OK' else 'ERROR' end
  union all
  select 6, '00 VEREDICTO', '>>> rechazar exige motivo en la BASE',
         case when exists (select 1 from pg_constraint
                            where conname = 'payment_requests_rechazo_con_motivo')
              then 'OK' else 'ERROR' end
  union all
  select 7, '00 VEREDICTO', '>>> sigue existiendo el indice de una sola activa',
         case when exists (select 1 from pg_indexes
                            where schemaname = 'public' and tablename = 'subscriptions'
                              and indexname = 'subscriptions_one_active_per_user')
              then 'OK' else 'ERROR' end

  -- ==========================================================================
  -- 01 · OBJETOS
  -- ==========================================================================
  union all
  select 100, '01 OBJETOS', 'public.payment_requests',
         coalesce(to_regclass('public.payment_requests')::text, 'NO EXISTE')
  union all
  select 101, '01 OBJETOS', 'public.payment_settings',
         coalesce(to_regclass('public.payment_settings')::text, 'NO EXISTE')
  union all
  select 110, '01 OBJETOS', 'funcion · ' || f.nombre,
         coalesce(to_regprocedure('public.' || f.nombre || '(' || f.args || ')')::text, 'NO EXISTE')
    from funcs f
  union all
  select 120, '01 OBJETOS', 'restricciones de payment_requests',
         coalesce((select string_agg(conname, ', ' order by conname)
                     from pg_constraint con
                     join pg_class rel on rel.oid = con.conrelid
                    where rel.relname = 'payment_requests' and con.contype = 'c'), '(ninguna)')
  union all
  select 130, '01 OBJETOS', 'indices de payment_requests',
         coalesce((select string_agg(indexname, ', ' order by indexname)
                     from pg_indexes where schemaname = 'public'
                       and tablename = 'payment_requests'), '(ninguno)')

  -- ==========================================================================
  -- 02 · SEGURIDAD Y PERMISOS
  -- ==========================================================================
  union all
  select 200, '02 SEGURIDAD', 'definer y search_path · ' || p.proname,
         case when p.prosecdef then 'SECURITY DEFINER' else 'INVOKER — REVISAR' end
           || ' · ' || coalesce(array_to_string(p.proconfig, ' '), 'SIN search_path — REVISAR')
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('request_plan','my_payment_requests','admin_list_payments',
                       'admin_approve_payment','admin_reject_payment')
  union all
  select 210, '02 SEGURIDAD', 'EXECUTE · ' || f.nombre || ' · ' || r.rolname,
         has_function_privilege(r.rolname,
           'public.' || f.nombre || '(' || f.args || ')', 'EXECUTE')::text
    from funcs f
   cross join (values ('anon'), ('authenticated'), ('service_role')) as r(rolname)
  union all
  select 220, '02 SEGURIDAD', 'privilegios del cliente sobre payment_requests',
         coalesce((select string_agg(grantee || '/' || privilege_type, ', ')
                     from information_schema.role_table_grants
                    where table_schema = 'public' and table_name = 'payment_requests'
                      and grantee in ('anon','authenticated')), '(ninguno · correcto)')
  union all
  select 230, '02 SEGURIDAD', 'RLS · payment_requests / payment_settings',
         (select string_agg(c.relname || '=' || c.relrowsecurity::text, ' / ' order by c.relname)
            from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public'
             and c.relname in ('payment_requests','payment_settings'))

  -- ==========================================================================
  -- 03 · CONFIGURACIÓN PENDIENTE
  -- ==========================================================================
  union all
  select 300, '03 CONFIGURACION', 'plan pro · estado',
         coalesce((select case when is_active then 'ACTIVO' else 'inactivo (esperado hasta fijar precio)' end
                     from public.plans where code = 'pro'), 'NO EXISTE')
  union all
  select 301, '03 CONFIGURACION', 'plan pro · precio y limite',
         coalesce((select price_cents::text || ' centimos · ' || ai_weekly_limit::text || ' por semana'
                     from public.plans where code = 'pro'), '-')
         || '   (0 y 0 = CONFIGURACION PENDIENTE)'
  union all
  select 310, '03 CONFIGURACION', 'instrucciones de pago',
         coalesce((select case when is_configured then 'CONFIGURADAS'
                               else 'sin configurar (la app avisa en vez de inventar datos)' end
                     from public.payment_settings where id = 1), 'NO EXISTE LA FILA')
  union all
  select 320, '03 CONFIGURACION', 'planes visibles para el docente',
         coalesce((select string_agg(code || ' (' || price_cents::text || ')', ', ' order by sort_order)
                     from public.plans where is_active), '(ninguno)')

  -- ==========================================================================
  -- 04 · ESTADO
  -- ==========================================================================
  union all
  select 400, '04 ESTADO', 'solicitudes por estado',
         coalesce((select string_agg(status || '=' || n, ', ' order by status)
                     from (select status, count(*) as n
                             from public.payment_requests group by status) s),
                  '(ninguna todavia)')
  union all
  select 401, '04 ESTADO', 'aprobadas SIN suscripcion enlazada (debe ser 0)',
         (select count(*)::text from public.payment_requests
           where status = 'approved' and subscription_id is null)
  union all
  select 402, '04 ESTADO', 'rechazadas SIN motivo (debe ser 0)',
         (select count(*)::text from public.payment_requests
           where status = 'rejected'
             and nullif(btrim(coalesce(review_notes, '')), '') is null)
  union all
  select 403, '04 ESTADO', 'usuarios con DOS activas (debe ser 0)',
         (select count(*)::text from (
            select user_id from public.subscriptions
             where status = 'active' group by user_id having count(*) > 1) x)
  union all
  select 410, '04 ESTADO', 'auditoria de pagos',
         coalesce((select string_agg(action || '=' || n, ', ' order by action)
                     from (select action, count(*) as n
                             from sciverse_private.admin_audit_log
                            where action like 'PAYMENT%' group by action) s),
                  '(ninguna todavia)')
)

select seccion, comprobacion, resultado
  from filas
 order by ord, comprobacion;

-- ============================================================================
-- VERIFICACIÓN DE 008_commercial_settings.sql
--
--                    ✅ SOLO LECTURA · NO MODIFICA NADA
--
-- Una sola sentencia → un único Results copiable.
-- Ni INSERT, UPDATE, DELETE, ALTER, DROP, GRANT ni REVOKE.
-- NO invoca las funciones de acción: editar un plan o aprobar un pago
-- cambiaría datos reales. Se comprueba que existan, con qué permisos y qué
-- rol mínimo exigen — leyendo su código fuente, no ejecutándolas.
-- No devuelve nombres de docentes, correos, teléfonos ni UUID de usuarios.
--
-- El número de pago comercial (931582435) SÍ aparece: no es un dato personal
-- de ninguna docente, es el dato que la aplicación enseña a todo el mundo.
--
-- CUÁNDO
--   Inmediatamente después de aplicar 008_commercial_settings.sql.
--
-- EMPIEZA POR «00 VEREDICTO»: trece comprobaciones OK/ERROR.
-- Lo esperado es OK en las trece.
--
-- SI FALLA POR PERMISOS SOBRE `storage`
--   Quita la sección «05 STORAGE» y comprueba el bucket desde el panel:
--   Storage → payment-assets debe ser privado, 2 MB, PNG/JPEG/WEBP.
-- ============================================================================

with

nuevas(nombre, args, minimo) as (
  values ('admin_list_plans',                'uuid',                    'support'),
         ('admin_payment_config',            'uuid',                    'support'),
         ('admin_update_plan',               'uuid, text, jsonb, text', 'admin'),
         ('admin_update_payment_settings',   'uuid, jsonb, text',       'admin'),
         ('admin_update_payment_method',     'uuid, text, jsonb, text', 'admin'),
         ('admin_set_payment_qr',            'uuid, text, text',        'admin')
),

filas as (

  -- ==========================================================================
  -- 00 · VEREDICTO
  -- ==========================================================================
  select 0 as ord, '00 VEREDICTO' as seccion,
         '>>> plan Pro existe y cuesta S/ 20.00' as comprobacion,
         case when exists (select 1 from public.plans
                            where code = 'pro' and price_cents = 2000
                              and currency = 'PEN')
              then 'OK' else 'ERROR' end as resultado
  union all
  select 1, '00 VEREDICTO', '>>> plan Pro · 100 IA/semana · 1 mes · activo',
         case when exists (select 1 from public.plans
                            where code = 'pro' and ai_weekly_limit = 100
                              and billing_period_months = 1 and is_active)
              then 'OK' else 'ERROR' end
  union all
  select 2, '00 VEREDICTO', '>>> plan Free intacto · 5 por semana · gratis · activo',
         case when exists (select 1 from public.plans
                            where code = 'free' and ai_weekly_limit = 5
                              and price_cents = 0 and is_active)
              then 'OK' else 'ERROR — el gratuito es la red de seguridad' end
  union all
  select 3, '00 VEREDICTO', '>>> las seis funciones nuevas existen',
         case when (select count(*) from nuevas n
                     where to_regprocedure('public.' || n.nombre || '(' || n.args || ')') is not null) = 6
              then 'OK' else 'ERROR' end
  union all
  select 4, '00 VEREDICTO', '>>> el navegador NO ejecuta ninguna accion comercial',
         case when not exists (
                select 1 from nuevas n
                cross join (values ('anon'), ('authenticated')) as r(rolname)
                 where has_function_privilege(r.rolname,
                         'public.' || n.nombre || '(' || n.args || ')', 'EXECUTE'))
              then 'OK' else 'ERROR — el navegador podria cambiar precios' end
  union all
  select 5, '00 VEREDICTO', '>>> el cliente NO escribe en plans, settings ni methods',
         case when not has_table_privilege('authenticated','public.plans','UPDATE')
               and not has_table_privilege('authenticated','public.plans','INSERT')
               and not has_table_privilege('authenticated','public.payment_settings','UPDATE')
               and not has_table_privilege('authenticated','public.payment_methods','UPDATE')
               and not has_table_privilege('authenticated','public.payment_methods','INSERT')
               and not has_table_privilege('authenticated','public.payment_methods','DELETE')
               and not has_table_privilege('authenticated','public.subscriptions','UPDATE')
              then 'OK' else 'ERROR' end
  union all
  select 6, '00 VEREDICTO', '>>> support puede LEER pero no EDITAR',
         case when (select count(*) from pg_proc p
                     join pg_namespace ns on ns.oid = p.pronamespace
                     join nuevas n on n.nombre = p.proname
                    where ns.nspname = 'public'
                      and p.prosrc like '%require_admin_role(p_actor, ''' || n.minimo || ''')%') = 6
              then 'OK' else 'ERROR — revisar el rol minimo de cada funcion' end
  union all
  select 7, '00 VEREDICTO', '>>> Yape y Plin habilitados con receptor y numero',
         case when (select count(*) from public.payment_methods
                     where code in ('yape','plin') and is_enabled
                       and nullif(btrim(coalesce(receiver_name, '')), '') is not null
                       and nullif(btrim(coalesce(account_number, '')), '') is not null) = 2
              then 'OK' else 'ERROR' end
  union all
  select 8, '00 VEREDICTO', '>>> pagos manuales activos e instrucciones escritas',
         case when exists (select 1 from public.payment_settings
                            where id = 1 and is_configured and manual_payments_enabled
                              and nullif(btrim(coalesce(instructions, '')), '') is not null)
              then 'OK' else 'ERROR' end
  union all
  select 9, '00 VEREDICTO', '>>> aprobar emite SUBSCRIPTION_ACTIVATED aparte',
         case when exists (select 1 from pg_proc p
                            join pg_namespace ns on ns.oid = p.pronamespace
                           where ns.nspname = 'public'
                             and p.proname = 'admin_approve_payment'
                             and p.prosrc like '%SUBSCRIPTION_ACTIVATED%'
                             and p.prosrc like '%PAYMENT_APPROVED%')
              then 'OK' else 'ERROR' end
  union all
  select 10, '00 VEREDICTO', '>>> bucket del QR privado, 2 MB, solo imagenes',
         coalesce((select case when not b.public
                                and b.file_size_limit = 2097152
                                and b.allowed_mime_types @> array['image/png','image/jpeg','image/webp']
                               then 'OK'
                               else 'ERROR — revisar el bucket en Storage' end
                     from storage.buckets b where b.id = 'payment-assets'),
                  'ERROR — no existe el bucket payment-assets (crearlo desde Storage)')
  union all
  select 11, '00 VEREDICTO', '>>> el interruptor de pagos se aplica en la BASE',
         case when exists (select 1 from pg_proc p
                            join pg_namespace ns on ns.oid = p.pronamespace
                           where ns.nspname = 'public' and p.proname = 'request_plan'
                             and p.prosrc like '%PAYMENTS_CLOSED%'
                             and p.prosrc like '%METHOD_NOT_AVAILABLE%')
              then 'OK' else 'ERROR — apagar los pagos seria solo cosmetico' end
  union all
  select 12, '00 VEREDICTO', '>>> nadie tiene DOS suscripciones activas',
         case when not exists (
                select 1 from public.subscriptions
                 where status = 'active' group by user_id having count(*) > 1)
              then 'OK' else 'ERROR' end

  -- ==========================================================================
  -- 01 · CATÁLOGO
  -- ==========================================================================
  union all
  select 100, '01 CATALOGO', 'plan · ' || p.code,
         p.name || ' · ' || (p.price_cents / 100.0)::numeric(10,2)::text || ' ' || p.currency
         || ' · ' || coalesce(p.billing_period_months::text || ' mes(es)', 'sin vencimiento')
         || ' · ' || p.ai_weekly_limit::text || ' IA/semana'
         || ' · ' || case when p.is_active then 'activo' else 'INACTIVO' end
    from public.plans p
  union all
  select 110, '01 CATALOGO', 'vinetas visibles · ' || p.code,
         coalesce(array_to_string(p.benefits, ' | '), '(ninguna)')
    from public.plans p
  union all
  select 120, '01 CATALOGO', 'suscripciones activas por plan',
         coalesce((select string_agg(plan_code || '=' || n, ', ' order by plan_code)
                     from (select plan_code, count(*) as n
                             from public.subscriptions where status = 'active'
                            group by plan_code) s), '(ninguna)')

  -- ==========================================================================
  -- 02 · MÉTODOS DE PAGO
  -- ==========================================================================
  union all
  select 200, '02 METODOS', 'metodo · ' || m.code,
         m.label
         || ' · ' || case when m.is_enabled then 'habilitado' else 'deshabilitado' end
         || ' · receptor ' || coalesce(m.receiver_name, '(sin definir)')
         || ' · numero ' || coalesce(m.account_number, '(sin definir)')
         || ' · QR ' || case when m.qr_path is null then 'SIN CARGAR' else 'cargado' end
    from public.payment_methods m
  union all
  select 210, '02 METODOS', 'QR · ultima actualizacion',
         coalesce((select string_agg(m.code || '=' ||
                                     coalesce(to_char(m.qr_updated_at, 'YYYY-MM-DD HH24:MI'), 'nunca'),
                                     ', ' order by m.code)
                     from public.payment_methods m), '(ninguno)')
  union all
  select 220, '02 METODOS', 'RLS · el docente solo ve los habilitados',
         case when exists (select 1 from pg_policies
                            where schemaname = 'public' and tablename = 'payment_methods'
                              and cmd = 'SELECT' and qual like '%is_enabled%')
              then 'si' else 'NO — REVISAR' end
  union all
  select 230, '02 METODOS', 'privilegios del cliente sobre payment_methods',
         coalesce((select string_agg(grantee || '/' || privilege_type, ', ' order by grantee, privilege_type)
                     from information_schema.role_table_grants
                    where table_schema = 'public' and table_name = 'payment_methods'
                      and grantee in ('anon','authenticated')), '(ninguno)')

  -- ==========================================================================
  -- 03 · AJUSTES GLOBALES
  -- ==========================================================================
  union all
  select 300, '03 AJUSTES', 'pagos manuales',
         coalesce((select case when manual_payments_enabled then 'HABILITADOS' else 'apagados' end
                     from public.payment_settings where id = 1), 'NO EXISTE LA FILA')
  union all
  select 301, '03 AJUSTES', 'instrucciones para la docente',
         coalesce((select case when is_configured then instructions
                               else 'SIN CONFIGURAR' end
                     from public.payment_settings where id = 1), '-')
  union all
  select 302, '03 AJUSTES', 'whatsapp de coordinacion',
         coalesce((select coalesce(whatsapp, 'vacio (esperado: no hay numero oficial todavia)')
                     from public.payment_settings where id = 1), '-')
  union all
  select 310, '03 AJUSTES', 'columnas jubiladas de payment_settings',
         coalesce((select 'method=' || coalesce(method, 'null')
                        || ' receiver=' || coalesce(receiver_name, 'null')
                        || ' cuenta=' || coalesce(account_number, 'null')
                        || '   (ya no las lee nadie)'
                     from public.payment_settings where id = 1), '-')

  -- ==========================================================================
  -- 04 · FUNCIONES Y PERMISOS
  -- ==========================================================================
  union all
  select 400, '04 FUNCIONES', 'existe · ' || n.nombre,
         coalesce(to_regprocedure('public.' || n.nombre || '(' || n.args || ')')::text, 'NO EXISTE')
    from nuevas n
  union all
  select 410, '04 FUNCIONES', 'definer y search_path · ' || p.proname,
         case when p.prosecdef then 'SECURITY DEFINER' else 'INVOKER — REVISAR' end
           || ' · ' || coalesce(array_to_string(p.proconfig, ' '), 'SIN search_path — REVISAR')
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public'
     and p.proname in ('admin_list_plans','admin_payment_config','admin_update_plan',
                       'admin_update_payment_settings','admin_update_payment_method',
                       'admin_set_payment_qr','admin_approve_payment','request_plan')
  union all
  select 420, '04 FUNCIONES', 'rol minimo exigido · ' || n.nombre,
         case when exists (select 1 from pg_proc p
                            join pg_namespace ns on ns.oid = p.pronamespace
                           where ns.nspname = 'public' and p.proname = n.nombre
                             and p.prosrc like '%require_admin_role(p_actor, ''' || n.minimo || ''')%')
              then n.minimo else 'NO COINCIDE — REVISAR' end
    from nuevas n
  union all
  select 430, '04 FUNCIONES', 'EXECUTE · ' || n.nombre || ' · ' || r.rolname,
         has_function_privilege(r.rolname,
           'public.' || n.nombre || '(' || n.args || ')', 'EXECUTE')::text
    from nuevas n
   cross join (values ('anon'), ('authenticated'), ('service_role')) as r(rolname)

  -- ==========================================================================
  -- 05 · STORAGE
  -- ==========================================================================
  union all
  select 500, '05 STORAGE', 'bucket payment-assets',
         coalesce((select 'publico=' || b.public::text
                        || ' · limite=' || coalesce(b.file_size_limit::text, 'sin limite')
                        || ' · mime=' || coalesce(array_to_string(b.allowed_mime_types, ' '), 'cualquiera')
                     from storage.buckets b where b.id = 'payment-assets'),
                  'NO EXISTE — crearlo desde Storage')
  union all
  select 510, '05 STORAGE', 'politicas sobre storage.objects',
         coalesce((select string_agg(policyname || ' (' || cmd || ' → ' ||
                                     coalesce(array_to_string(roles, ','), '-') || ')',
                                     ', ' order by policyname)
                     from pg_policies
                    where schemaname = 'storage' and tablename = 'objects'
                      and (qual like '%payment-assets%' or with_check like '%payment-assets%')),
                  'ninguna — el QR no se podra ver')
  union all
  select 520, '05 STORAGE', 'politicas de ESCRITURA sobre el bucket (debe ser 0)',
         (select count(*)::text from pg_policies
           where schemaname = 'storage' and tablename = 'objects'
             and cmd in ('INSERT','UPDATE','DELETE','ALL')
             and (qual like '%payment-assets%' or with_check like '%payment-assets%'))
         || '   (mas de 0 = un docente podria subir ficheros)'
  union all
  select 530, '05 STORAGE', 'ficheros guardados en el bucket',
         coalesce((select count(*)::text from storage.objects
                    where bucket_id = 'payment-assets'), '0')

  -- ==========================================================================
  -- 06 · AUDITORÍA
  -- ==========================================================================
  union all
  select 600, '06 AUDITORIA', 'eventos comerciales registrados',
         coalesce((select string_agg(action || '=' || n, ', ' order by action)
                     from (select action, count(*) as n
                             from sciverse_private.admin_audit_log
                            where action in ('PLAN_UPDATED','PAYMENT_SETTINGS_UPDATED',
                                             'PAYMENT_METHOD_UPDATED','PAYMENT_QR_UPDATED',
                                             'PAYMENT_APPROVED','PAYMENT_REJECTED',
                                             'PAYMENT_REQUESTED','SUBSCRIPTION_ACTIVATED')
                            group by action) s), '(ninguno todavia)')
  union all
  select 610, '06 AUDITORIA', 'aprobaciones sin su SUBSCRIPTION_ACTIVATED (debe ser 0)',
         (select greatest(
                   (select count(*) from sciverse_private.admin_audit_log
                     where action = 'PAYMENT_APPROVED' and created_at > now() - interval '400 days')
                 - (select count(*) from sciverse_private.admin_audit_log
                     where action = 'SUBSCRIPTION_ACTIVATED' and created_at > now() - interval '400 days'),
                 0)::text)
         || '   (las aprobadas ANTES de 008 no tienen el evento nuevo: es normal)'
  union all
  select 620, '06 AUDITORIA', 'lineas con algo que parezca un secreto (debe ser 0)',
         (select count(*)::text from sciverse_private.admin_audit_log
           where (coalesce(before_data::text,'') || coalesce(after_data::text,'') || metadata::text)
                 ~* '(token|jwt|password|contrase|service_role|bearer)')
  union all
  select 630, '06 AUDITORIA', 'sigue siendo de solo anadir',
         case when exists (
                select 1 from pg_trigger t
                  join pg_class c on c.oid = t.tgrelid
                  join pg_namespace ns on ns.oid = c.relnamespace
                 where ns.nspname = 'sciverse_private' and c.relname = 'admin_audit_log'
                   and t.tgname = 'admin_audit_log_no_update' and not t.tgisinternal)
              then 'si' else 'NO — REVISAR' end
)

select seccion, comprobacion, resultado
  from filas
 order by ord, comprobacion;

-- ============================================================================
-- INSPECCIÓN DEL ESTADO REAL DE PRODUCCIÓN
--
--                    ✅ SOLO LECTURA · NO MODIFICA NADA
--
-- No hace INSERT, UPDATE, DELETE, ALTER, DROP, CREATE ni GRANT.
-- Se puede ejecutar en producción sin riesgo y sin ventana de mantenimiento.
--
-- CÓMO USARLO
--   Supabase → SQL Editor → New query → pegar TODO → Run.
--   Devuelve un bloque por apartado. Copia la salida y pégala de vuelta.
--
-- QUÉ RESUELVE
--   Convierte en hechos verificados los puntos que
--   docs/audit/26-PRODUCTION-BACKEND-AUDIT.md sólo pudo deducir:
--     · CRÍTICO-1  ¿puede un docente editarse créditos y plan?
--     · CRÍTICO-2  ¿quién puede ejecutar refund_ai_credit()?
--     · ¿qué CHECK de `tipo` está vigente y hay filas incompatibles?
--     · ¿existe y está activo el trigger de creación de perfil?
--     · ¿está aplicada ya 001_material_types.sql?
--
-- NINGUNA CONSULTA DEVUELVE DATOS PERSONALES DE DOCENTES.
-- Sólo metadatos del esquema y recuentos agregados.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. TABLAS Y COLUMNAS REALES
-- ----------------------------------------------------------------------------
select
  '1. COLUMNAS' as bloque,
  c.table_name,
  c.ordinal_position as pos,
  c.column_name,
  c.data_type,
  c.is_nullable,
  c.column_default
from information_schema.columns c
where c.table_schema = 'public'
  and c.table_name in ('docentes', 'materiales_docente')
order by c.table_name, c.ordinal_position;


-- ----------------------------------------------------------------------------
-- 2. TODAS LAS TABLAS DEL ESQUEMA public
--    Revela tablas creadas a mano que el repositorio no conoce.
-- ----------------------------------------------------------------------------
select
  '2. TABLAS' as bloque,
  t.table_name,
  (select count(*) from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = t.table_name) as columnas
from information_schema.tables t
where t.table_schema = 'public' and t.table_type = 'BASE TABLE'
order by t.table_name;


-- ----------------------------------------------------------------------------
-- 3. RESTRICCIONES  (PK · FK · UNIQUE · CHECK)
--    Aquí aparece el CHECK real de `materiales_docente.tipo`.
-- ----------------------------------------------------------------------------
select
  '3. CONSTRAINTS' as bloque,
  rel.relname as tabla,
  con.conname  as nombre,
  case con.contype
    when 'p' then 'PK' when 'f' then 'FK'
    when 'u' then 'UNIQUE' when 'c' then 'CHECK'
    else con.contype::text
  end as tipo,
  pg_get_constraintdef(con.oid) as definicion
from pg_constraint con
join pg_class rel on rel.oid = con.conrelid
join pg_namespace ns on ns.oid = rel.relnamespace
where ns.nspname = 'public'
  and rel.relname in ('docentes', 'materiales_docente')
order by rel.relname, con.contype, con.conname;


-- ----------------------------------------------------------------------------
-- 4. ÍNDICES
-- ----------------------------------------------------------------------------
select
  '4. INDICES' as bloque,
  tablename as tabla,
  indexname  as nombre,
  indexdef   as definicion
from pg_indexes
where schemaname = 'public'
  and tablename in ('docentes', 'materiales_docente')
order by tablename, indexname;


-- ----------------------------------------------------------------------------
-- 5. ¿RLS ACTIVADO?
-- ----------------------------------------------------------------------------
select
  '5. RLS' as bloque,
  rel.relname as tabla,
  rel.relrowsecurity  as rls_activado,
  rel.relforcerowsecurity as rls_forzado
from pg_class rel
join pg_namespace ns on ns.oid = rel.relnamespace
where ns.nspname = 'public'
  and rel.relname in ('docentes', 'materiales_docente');


-- ----------------------------------------------------------------------------
-- 6. POLÍTICAS RLS  ← CRÍTICO-1
--    Mirar la fila de `docentes` con cmd = 'UPDATE'.
--    RLS filtra FILAS, no COLUMNAS: si esa política existe y el GRANT del
--    apartado 7 concede UPDATE, el docente puede escribir CUALQUIER columna
--    de su propia fila, incluidas ai_week_used, ai_weekly_limit y plan.
-- ----------------------------------------------------------------------------
select
  '6. POLICIES' as bloque,
  tablename as tabla,
  policyname as politica,
  cmd as operacion,
  roles::text as roles,
  qual as usando,
  with_check as con_check
from pg_policies
where schemaname = 'public'
  and tablename in ('docentes', 'materiales_docente')
order by tablename, cmd, policyname;


-- ----------------------------------------------------------------------------
-- 7. PRIVILEGIOS DE TABLA  ← CRÍTICO-1 (segunda mitad de la prueba)
--    Buscar grantee = 'authenticated' con privilege_type = 'UPDATE'.
-- ----------------------------------------------------------------------------
select
  '7. GRANTS TABLA' as bloque,
  table_name as tabla,
  grantee,
  privilege_type as privilegio
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('docentes', 'materiales_docente')
  and grantee in ('anon', 'authenticated', 'service_role', 'PUBLIC')
order by table_name, grantee, privilege_type;


-- ----------------------------------------------------------------------------
-- 8. PRIVILEGIOS POR COLUMNA
--    Si está vacío, NO hay restricción por columna: el UPDATE del apartado 7
--    alcanza a todas. Es exactamente lo que hace explotable CRÍTICO-1.
-- ----------------------------------------------------------------------------
select
  '8. GRANTS COLUMNA' as bloque,
  table_name as tabla,
  column_name as columna,
  grantee,
  privilege_type as privilegio
from information_schema.column_privileges
where table_schema = 'public'
  and table_name in ('docentes', 'materiales_docente')
  and grantee in ('anon', 'authenticated')
order by table_name, column_name, grantee;


-- ----------------------------------------------------------------------------
-- 9. FUNCIONES  ← CRÍTICO-2
--    Comprobar en refund_ai_credit: seguridad (definer/invoker), propietario
--    y search_path.
-- ----------------------------------------------------------------------------
select
  '9. FUNCIONES' as bloque,
  p.proname as funcion,
  pg_get_function_identity_arguments(p.oid) as argumentos,
  case when p.prosecdef then 'SECURITY DEFINER' else 'SECURITY INVOKER' end as seguridad,
  pg_get_userbyid(p.proowner) as propietario,
  coalesce(array_to_string(p.proconfig, ', '), '(sin search_path fijado)') as configuracion
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'get_ai_credit_status', 'consume_ai_credit',
    'refund_ai_credit', 'crear_perfil_docente'
  )
order by p.proname;


-- ----------------------------------------------------------------------------
-- 10. QUIÉN PUEDE EJECUTAR CADA FUNCIÓN  ← CRÍTICO-2 (la prueba)
--     Si refund_ai_credit aparece con 'authenticated', cualquier docente
--     puede invocarla desde el navegador:
--        POST /rest/v1/rpc/refund_ai_credit
-- ----------------------------------------------------------------------------
select
  '10. EXECUTE' as bloque,
  p.proname as funcion,
  r.rolname as rol,
  has_function_privilege(r.oid, p.oid, 'EXECUTE') as puede_ejecutar
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
cross join pg_roles r
where n.nspname = 'public'
  and p.proname in (
    'get_ai_credit_status', 'consume_ai_credit',
    'refund_ai_credit', 'crear_perfil_docente'
  )
  and r.rolname in ('anon', 'authenticated', 'service_role')
order by p.proname, r.rolname;


-- ----------------------------------------------------------------------------
-- 11. CUERPO DE refund_ai_credit  ← CRÍTICO-2
--     Confirmar si valida algo: si exige consumo previo, si recibe algún
--     identificador de generación, si limita cuántas veces puede llamarse.
-- ----------------------------------------------------------------------------
select
  '11. CUERPO REFUND' as bloque,
  pg_get_functiondef(p.oid) as definicion
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'refund_ai_credit';


-- ----------------------------------------------------------------------------
-- 12. TRIGGERS  ← creación de perfil
-- ----------------------------------------------------------------------------
select
  '12. TRIGGERS' as bloque,
  c.relname as tabla,
  t.tgname as trigger,
  case when t.tgenabled = 'D' then 'DESACTIVADO' else 'activo' end as estado,
  pg_get_triggerdef(t.oid) as definicion
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where not t.tgisinternal
  and (
    (n.nspname = 'auth' and c.relname = 'users')
    or (n.nspname = 'public' and c.relname in ('docentes', 'materiales_docente'))
  )
order by c.relname, t.tgname;


-- ----------------------------------------------------------------------------
-- 13. TIPOS DE MATERIAL REALMENTE GUARDADOS
--     Recuento agregado. No devuelve contenido ni datos personales.
--     Sirve para saber si aplicar 001 rompería filas existentes.
-- ----------------------------------------------------------------------------
select
  '13. TIPOS EN USO' as bloque,
  tipo,
  count(*) as filas,
  min(created_at)::date as primera,
  max(created_at)::date as ultima
from public.materiales_docente
group by tipo
order by count(*) desc;


-- ----------------------------------------------------------------------------
-- 14. ¿ESTÁ APLICADA YA 001_material_types.sql?
--     Comprueba si 'challenge' está admitido por el CHECK vigente.
-- ----------------------------------------------------------------------------
select
  '14. ESTADO 001' as bloque,
  case
    when pg_get_constraintdef(con.oid) like '%challenge%'
      then 'APLICADA — challenge ya está admitido'
    else 'PENDIENTE — challenge NO está admitido; los retos fallan al guardar'
  end as veredicto,
  pg_get_constraintdef(con.oid) as check_vigente
from pg_constraint con
join pg_class rel on rel.oid = con.conrelid
join pg_namespace ns on ns.oid = rel.relnamespace
where ns.nspname = 'public'
  and rel.relname = 'materiales_docente'
  and con.contype = 'c'
  and pg_get_constraintdef(con.oid) like '%tipo%';


-- ----------------------------------------------------------------------------
-- 15. VOLUMEN  (agregado, sin datos personales)
-- ----------------------------------------------------------------------------
select '15. VOLUMEN' as bloque, 'docentes' as tabla, count(*) as filas from public.docentes
union all
select '15. VOLUMEN', 'docentes sin user_id', count(*) from public.docentes where user_id is null
union all
select '15. VOLUMEN', 'materiales_docente', count(*) from public.materiales_docente;


-- ----------------------------------------------------------------------------
-- 16. INTEGRIDAD DE CORREOS  (agregado)
--     Detecta el escenario de MEDIO-1: filas heredadas con mayúsculas que
--     harían fallar un registro nuevo por el índice sobre lower(correo).
-- ----------------------------------------------------------------------------
select
  '16. CORREOS' as bloque,
  count(*) filter (where correo <> lower(correo)) as con_mayusculas,
  count(*) - count(distinct lower(correo)) as colisiones_por_mayusculas
from public.docentes;


-- ----------------------------------------------------------------------------
-- 17. EXTENSIONES  (contexto: pg_cron, pgsodium, etc.)
-- ----------------------------------------------------------------------------
select '17. EXTENSIONES' as bloque, extname as extension, extversion as version
from pg_extension
order by extname;

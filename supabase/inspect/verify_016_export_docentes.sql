-- ============================================================================
-- INSPECTOR DE LA 016 · SÓLO LECTURA
--
-- Nombre según la convención corregida: `verify_0NN_<migración>`, no la
-- numeración independiente que tenían los inspectores viejos y que llegó a
-- confundir una revisión (ver docs/pendientes.md, punto 12).
--
-- No modifica nada y no expone datos de ningún docente: cuenta, lee permisos y
-- lee definiciones. Pegar cada bloque por separado en el SQL Editor.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1 · LAS SEIS DEBEN SALIR EN true
--
--     La tercera es la que de verdad importa: si `authenticated` pudiera
--     ejecutarla, cualquier docente con sesión se llevaría la lista entera
--     llamando al RPC a mano.
-- ----------------------------------------------------------------------------
with f as (
  select to_regprocedure(
    'public.admin_export_docentes(uuid,text,text,date,date,text,boolean,boolean)') as oid
)
select
  (select oid is not null from f)                                as existe,
  (select p.prosecdef from pg_proc p, f where p.oid = f.oid)     as es_security_definer,
  (select not has_function_privilege('authenticated', f.oid, 'execute') from f)
                                                                 as authenticated_NO_puede,
  (select not has_function_privilege('anon', f.oid, 'execute') from f)
                                                                 as anon_NO_puede,
  (select has_function_privilege('service_role', f.oid, 'execute') from f)
                                                                 as service_role_si_puede,
  (select p.provolatile = 'v' from pg_proc p, f where p.oid = f.oid)
                                                                 as es_volatile;


-- ----------------------------------------------------------------------------
-- 2 · ¿QUIÉN PUEDE EJECUTARLA, EXACTAMENTE?
--
--     La lista cruda de privilegios. Aquí no debería aparecer ni PUBLIC, ni
--     anon, ni authenticated.
-- ----------------------------------------------------------------------------
select r.rolname                                       as rol,
       has_function_privilege(r.rolname, p.oid, 'execute') as puede_ejecutar
  from pg_proc p
  cross join (select rolname from pg_roles
               where rolname in ('anon', 'authenticated', 'service_role', 'postgres')) r
 where p.oid = to_regprocedure(
   'public.admin_export_docentes(uuid,text,text,date,date,text,boolean,boolean)')
 order by 2 desc, 1;


-- ----------------------------------------------------------------------------
-- 3 · LA HUELLA · exportaciones registradas
--
--     Sin nombres ni correos: quién (uuid), con qué rol, cuándo, cuántas filas
--     y con qué filtros. Es exactamente lo que hace falta para rastrear una
--     fuga, y nada más.
-- ----------------------------------------------------------------------------
select l.created_at,
       l.admin_user_id,
       l.admin_role,
       l.metadata ->> 'filas'            as filas,
       l.metadata ->> 'incluye_celular'  as incluia_telefono,
       l.metadata -> 'filtros'           as filtros
  from sciverse_private.admin_audit_log l
 where l.action = 'ADMIN_EXPORTED_DOCENTES'
 order by l.created_at desc
 limit 50;


-- ----------------------------------------------------------------------------
-- 4 · ¿CUÁNTO SE EXPORTA, Y QUIÉN?
--
--     Agregado por administrador. Un pico aquí es la señal que importa.
-- ----------------------------------------------------------------------------
select l.admin_user_id,
       l.admin_role,
       count(*)                                        as veces,
       max(l.created_at)                               as ultima_vez,
       max((l.metadata ->> 'filas')::integer)          as export_mas_grande
  from sciverse_private.admin_audit_log l
 where l.action = 'ADMIN_EXPORTED_DOCENTES'
 group by 1, 2
 order by 3 desc;


-- ----------------------------------------------------------------------------
-- 5 · PRUEBA DEL GATE · debe FALLAR con ADMIN_REQUIRED
--
--     Un uuid que no está en admin_users. Si esto devuelve datos en vez de
--     lanzar la excepción, el gate no sirve.
--
--     Descomentar para probarlo:
-- ----------------------------------------------------------------------------
-- select public.admin_export_docentes('00000000-0000-0000-0000-000000000000'::uuid);


-- ----------------------------------------------------------------------------
-- 6 · EL RECORTE POR ROL, VISTO EN LOS DATOS
--
--     Con un actor `support` la columna `celular` debe venir toda en null; con
--     `admin` no. Sustituye los uuid por los de dos administradores reales de
--     `sciverse_private.admin_users` y compara. Devuelve CUENTAS, no teléfonos.
-- ----------------------------------------------------------------------------
-- select
--   (select count(*) from jsonb_array_elements(
--      (public.admin_export_docentes('<UUID-SUPPORT>'::uuid)) -> 'items') e
--     where e ->> 'celular' is not null)  as telefonos_para_support,   -- debe ser 0
--   (select count(*) from jsonb_array_elements(
--      (public.admin_export_docentes('<UUID-ADMIN>'::uuid)) -> 'items') e
--     where e ->> 'celular' is not null)  as telefonos_para_admin;     -- > 0 si hay


-- ----------------------------------------------------------------------------
-- 7 · LA FUNCIÓN VIEJA SIGUE INTACTA
--
--     `admin_list_docentes` alimenta la pantalla y NO debe haber cambiado:
--     sigue paginando y sigue siendo `stable` (no escribe auditoría).
-- ----------------------------------------------------------------------------
select p.proname,
       p.provolatile = 's'  as sigue_siendo_stable,
       p.prosecdef          as sigue_security_definer
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'admin_list_docentes';


-- ----------------------------------------------------------------------------
-- 8 · ¿HAY DOCENTES SIN `user_id`?
--
--     `effective_plan` LANZA `AUTH_REQUIRED` si el usuario es null, y las dos
--     funciones lo llaman con `cross join lateral`. Una sola fila con
--     `user_id` null haría fallar el panel entero y también el export.
--
--     Debe devolver 0. No es algo que introduzca la 016 —el listado ya era
--     así— pero conviene saberlo antes de ejecutarla.
-- ----------------------------------------------------------------------------
select count(*) as docentes_sin_user_id
  from public.docentes
 where user_id is null;


-- ----------------------------------------------------------------------------
-- 9 · PRUEBA DE HUMO MANUAL
--
--     La migración ya ejecuta las dos funciones antes del commit (bloques 5 y
--     6). Esto sólo hace falta si al aplicarla salió el aviso
--     «No hay administradores activos»: en ese caso el CUERPO del export no se
--     pudo probar, y hay que hacerlo a mano tras crear el primer admin.
--
--     Descomenta y sustituye el uuid. La llamada ESCRIBE una fila de auditoría
--     de verdad, así que quedará registrada como una exportación real.
-- ----------------------------------------------------------------------------
-- select (public.admin_export_docentes('<UUID-DE-UN-ADMIN>'::uuid)) ->> 'filas' as filas;

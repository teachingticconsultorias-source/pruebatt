-- ============================================================================
-- INSPECTOR DE LA 015 · SÓLO LECTURA
--
-- No modifica nada y no expone ningún dato de ningún docente: sólo cuenta y
-- lee definiciones de políticas. Mismo patrón que 012_verify_export_branding.
--
-- Pegar cada bloque por separado en el SQL Editor.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1 · LAS SIETE DEBEN SALIR EN true
-- ----------------------------------------------------------------------------
select
  to_regprocedure('public.es_ruta_de_logo(text)') is not null
    as funcion_del_logo_existe,

  -- La política de subida ya no menciona la extensión .docx…
  (select not (qual_o_check like '%.docx%')
     from (select coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '') as qual_o_check
             from pg_policy p join pg_class c on c.oid = p.polrelid
            where c.relname = 'objects' and p.polname = 'Mi marca de export · subir') s)
    as subir_ya_no_filtra_por_extension,

  -- …y sí exige el plan.
  (select qual_o_check like '%puede_plantilla_propia%' and qual_o_check like '%es_ruta_de_logo%'
     from (select coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '') as qual_o_check
             from pg_policy p join pg_class c on c.oid = p.polrelid
            where c.relname = 'objects' and p.polname = 'Mi marca de export · subir') s)
    as subir_exige_plan,

  -- CAMBIAR lo comprueba en las DOS mitades: sin el `using`, se podría
  -- renombrar un logo existente hasta convertirlo en plantilla.
  (select coalesce(pg_get_expr(p.polqual, p.polrelid), '') like '%puede_plantilla_propia%'
      and coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '') like '%puede_plantilla_propia%'
     from pg_policy p join pg_class c on c.oid = p.polrelid
    where c.relname = 'objects' and p.polname = 'Mi marca de export · cambiar')
    as cambiar_exige_plan_en_ambas,

  -- La tabla también.
  (select coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '') like '%puede_plantilla_propia%'
     from pg_policy p join pg_class c on c.oid = p.polrelid
    where c.relname = 'export_branding' and p.polname = 'Mi configuración de export · crear')
    as tabla_crear_exige_plan,

  (select coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '') like '%puede_plantilla_propia%'
     from pg_policy p join pg_class c on c.oid = p.polrelid
    where c.relname = 'export_branding' and p.polname = 'Mi configuración de export · cambiar')
    as tabla_cambiar_exige_plan,

  -- Y leer/borrar siguen SIN gate: quien dejó de ser Pro conserva su fichero.
  (select coalesce(pg_get_expr(p.polqual, p.polrelid), '') not like '%puede_plantilla_propia%'
     from pg_policy p join pg_class c on c.oid = p.polrelid
    where c.relname = 'objects' and p.polname = 'Mi marca de export · borrar')
    as borrar_sigue_libre;


-- ----------------------------------------------------------------------------
-- 2 · NADIE CON PLANTILLA ACTIVA SIN PLAN
--
--     Debe devolver 0. Si devuelve más, la migración no sanéo o alguien
--     encontró otra vía.
-- ----------------------------------------------------------------------------
select count(*) as plantillas_activas_sin_plan
  from public.export_branding b
 where b.modo = 'plantilla'
   and coalesce((select (ep.features ->> 'docx_custom_template')::boolean
                   from sciverse_private.effective_plan(b.user_id) ep
                  limit 1), false) is not true;


-- ----------------------------------------------------------------------------
-- 3 · QUÉ HAY EN EL BUCKET, SIN DECIR DE QUIÉN
--
--     Agregado por forma de la ruta. Si aparece algo en «otros», es un
--     fichero que la aplicación no escribe y conviene mirar.
-- ----------------------------------------------------------------------------
select
  count(*) filter (where name ~ '/logo\.(png|jpg|jpeg|webp)$') as logos,
  count(*) filter (where name ~ '/plantilla\.docx$')           as plantillas,
  count(*) filter (where name !~ '/logo\.(png|jpg|jpeg|webp)$'
                     and name !~ '/plantilla\.docx$')          as otros,
  count(*)                                                    as total
  from storage.objects
 where bucket_id = 'export-templates';


-- ----------------------------------------------------------------------------
-- 4 · LAS RUTAS «OTROS», SIN EL UID
--
--     Sólo la parte del nombre después de la carpeta, que es lo que interesa
--     para saber si alguien subió algo raro. El uid se recorta.
-- ----------------------------------------------------------------------------
select split_part(name, '/', 2) as nombre_de_fichero, count(*) as cuantos
  from storage.objects
 where bucket_id = 'export-templates'
   and name !~ '/logo\.(png|jpg|jpeg|webp)$'
   and name !~ '/plantilla\.docx$'
 group by 1
 order by 2 desc;


-- ----------------------------------------------------------------------------
-- 5 · EL TEXTO COMPLETO DE LAS POLÍTICAS, PARA LEERLO CON LOS OJOS
-- ----------------------------------------------------------------------------
select c.relname                                       as tabla,
       p.polname                                       as politica,
       case p.polcmd when 'r' then 'SELECT' when 'a' then 'INSERT'
                     when 'w' then 'UPDATE' when 'd' then 'DELETE' else p.polcmd::text end as operacion,
       pg_get_expr(p.polqual, p.polrelid)              as using_,
       pg_get_expr(p.polwithcheck, p.polrelid)         as with_check
  from pg_policy p
  join pg_class c on c.oid = p.polrelid
 where c.relname in ('export_branding', 'objects')
   and p.polname like 'Mi %export%'
 order by c.relname, p.polname;

-- ============================================================================
-- INSPECTOR · 012 Personalizar export
--
-- SOLO LECTURA. No crea, no modifica, no borra. Se puede pegar entero en el
-- editor SQL las veces que haga falta.
--
-- POR QUÉ EXISTE
-- --------------
-- Las migraciones 009, 010, 011 y 013 se aplicaron sin inspector, y cuando
-- hubo que saber si la 011 estaba puesta no había forma de averiguarlo desde
-- el repositorio: no hay tabla de control de migraciones en este proyecto.
-- Este fichero evita repetir esa situación con la 012.
--
-- NO expone nombres, correos, teléfonos ni identificadores de docentes: sólo
-- cuenta filas y comprueba la forma del esquema.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. RESUMEN · las siete comprobaciones. Todas deben devolver true.
-- ----------------------------------------------------------------------------
select
  to_regclass('public.export_branding') is not null                        as tabla_existe,

  (select relrowsecurity from pg_class
    where oid = to_regclass('public.export_branding'))                     as rls_activa,

  (select count(*) = 4 from pg_policies
    where schemaname = 'public' and tablename = 'export_branding')         as politicas_tabla,

  to_regprocedure('public.puede_plantilla_propia()') is not null           as funcion_gate,

  exists (select 1 from storage.buckets
           where id = 'export-templates' and public = false)               as bucket_privado,

  (select count(*) = 4 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname like 'Mi marca de export%')                           as politicas_bucket,

  (select count(*) = (select count(*) from public.plans)
     from public.plans where features ? 'docx_custom_template')            as capacidad_sembrada;


-- ----------------------------------------------------------------------------
-- 2. EL GATE · qué puede cada plan.
--
--    `docx_custom_template` debe ser false en el plan gratuito y true en los
--    de pago. Si algún plan no la tiene, la política de subida lo tratará
--    como false —falla cerrado— y ese plan no podrá subir plantilla.
-- ----------------------------------------------------------------------------
select code,
       coalesce((features ->> 'docx_custom_template')::boolean, false) as plantilla_propia,
       features ? 'docx_remove_watermark'                             as clave_muerta_presente
  from public.plans
 order by code;


-- ----------------------------------------------------------------------------
-- 3. LA POLÍTICA DE SUBIDA · debe comprobar carpeta Y plan.
--
--    Si `with_check` no menciona `puede_plantilla_propia`, el gate de Pro no
--    está puesto y cualquier docente podría subir su .docx llamando al API de
--    Storage directamente.
-- ----------------------------------------------------------------------------
select policyname,
       cmd,
       with_check like '%foldername%'              as comprueba_carpeta,
       with_check like '%puede_plantilla_propia%'  as comprueba_plan
  from pg_policies
 where schemaname = 'storage' and tablename = 'objects'
   and policyname like 'Mi marca de export%'
 order by policyname;


-- ----------------------------------------------------------------------------
-- 4. USO · cuántas docentes han configurado algo. Sin identificarlas.
-- ----------------------------------------------------------------------------
select modo,
       count(*)                                          as docentes,
       count(*) filter (where logo_path is not null)      as con_logo,
       count(*) filter (where plantilla_path is not null) as con_plantilla
  from public.export_branding
 group by modo
 order by modo;


-- ----------------------------------------------------------------------------
-- 5. FICHEROS HUÉRFANOS
--
--    Borrar un docente elimina su fila por `on delete cascade`, pero NO sus
--    ficheros: Storage vive en otro esquema y el cascade no lo alcanza. Esta
--    consulta los cuenta. Hoy se acepta a propósito —ver la nota en
--    docs/word-exportaciones.md—; si algún día pesan, esta es la lista.
-- ----------------------------------------------------------------------------
select count(*) as ficheros_sin_dueno
  from storage.objects o
 where o.bucket_id = 'export-templates'
   and not exists (
     select 1 from public.export_branding b
      where b.user_id::text = (storage.foldername(o.name))[1]
   );

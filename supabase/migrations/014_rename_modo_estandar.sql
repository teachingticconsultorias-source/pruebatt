-- ============================================================================
-- 014 · EL MODO POR DEFECTO DEJA DE LLAMARSE «nitia»
--
-- POR QUÉ
-- -------
-- «Nitia» es el nombre de OTRO producto. Se coló al construir Personalizar
-- export porque se usó una captura suya como referencia visual, y acabó
-- impreso en la pantalla que ve la docente («Formato de Nitia») y sembrado por
-- el código. Es un error de marca, no un detalle: la aplicación es SciVerse.
--
-- La etiqueta visible pasa a «Formato de SciVerse». El valor almacenado pasa a
-- `estandar` —neutro— para que un cambio de nombre del producto no vuelva a
-- obligar a tocar la base.
--
-- ORDEN DE APLICACIÓN: ESTA MIGRACIÓN VA ANTES DEL DEPLOY
-- -------------------------------------------------------
-- El código nuevo escribe `estandar`. Contra el CHECK viejo, ese INSERT o
-- UPDATE falla con 23514. Al revés no pasa nada: el código viejo escribe
-- `nitia`, que esta migración ya no acepta, pero el código viejo sólo está
-- vivo hasta que termine el deploy.
--
-- En sentido lectura no hay riesgo en ninguna de las dos direcciones:
-- `normalizarMarca()` cae al modo por defecto ante un valor que no reconoce,
-- así que una fila rezagada exporta en formato estándar en vez de romper.
--
-- ES REPETIBLE
-- ------------
-- Correrla dos veces no hace daño: el `update` no encuentra filas la segunda
-- vez y las restricciones se borran antes de recrearse. Si ya estaba aplicada,
-- termina sin cambios.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1 · Quitar el CHECK viejo y el default viejo
--
--     El default se quita PRIMERO porque Postgres lo valida contra el CHECK
--     nuevo al recrearlo; dejando 'nitia' puesto, el `add constraint` falla.
-- ----------------------------------------------------------------------------
alter table public.export_branding
  alter column modo drop default;

alter table public.export_branding
  drop constraint if exists export_branding_modo_check;

-- ----------------------------------------------------------------------------
-- 2 · Renombrar el valor en las filas que ya existen
--
--     Sin CHECK activo, el update pasa. Se cuenta cuántas se tocaron para
--     poder verificarlo desde el editor SQL sin exponer a ningún docente.
-- ----------------------------------------------------------------------------
do $$
declare
  tocadas integer;
begin
  update public.export_branding set modo = 'estandar' where modo = 'nitia';
  get diagnostics tocadas = row_count;
  raise notice '[sciverse] filas migradas de nitia a estandar: %', tocadas;
end $$;

-- ----------------------------------------------------------------------------
-- 3 · Volver a poner default y CHECK, ya con el nombre nuevo
-- ----------------------------------------------------------------------------
alter table public.export_branding
  alter column modo set default 'estandar';

alter table public.export_branding
  add constraint export_branding_modo_check
  check (modo in ('estandar', 'colegio', 'plantilla'));

comment on table public.export_branding is
  'Personalización de las exportaciones Word por docente. Sin fila = modo estandar. El fichero .docx y el logo viven en el bucket export-templates; aquí sólo su ruta.';

comment on column public.export_branding.modo is
  'estandar = la maqueta de SciVerse; colegio = esa maqueta con logo y colores del centro; plantilla = el .docx propio del colegio (requiere plan con docx_custom_template).';

-- ----------------------------------------------------------------------------
-- 4 · VERIFICACIÓN · pegar aparte en el editor SQL y comprobar que sale todo
--     en true y que no queda ninguna fila con el valor viejo.
-- ----------------------------------------------------------------------------
-- select
--   (select count(*) from public.export_branding where modo = 'nitia') = 0
--     as sin_filas_viejas,
--   (select column_default from information_schema.columns
--     where table_schema = 'public' and table_name = 'export_branding'
--       and column_name = 'modo') like '%estandar%'
--     as default_correcto,
--   (select pg_get_constraintdef(c.oid) from pg_constraint c
--      join pg_class t on t.oid = c.conrelid
--     where t.relname = 'export_branding'
--       and c.conname = 'export_branding_modo_check') like '%estandar%'
--     as check_correcto,
--   (select pg_get_constraintdef(c.oid) from pg_constraint c
--      join pg_class t on t.oid = c.conrelid
--     where t.relname = 'export_branding'
--       and c.conname = 'export_branding_modo_check') not like '%nitia%'
--     as check_sin_valor_viejo;

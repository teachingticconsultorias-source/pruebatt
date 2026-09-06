-- ============================================================================
-- 004_material_types.sql
--
-- Renumerada desde 001_material_types.sql: el numero refleja ahora el ORDEN
-- DE EJECUCION real (002 comercial -> 003 creditos -> 004 tipos). El
-- contenido no cambio.
--
--            ⚠️  PENDIENTE DE VALIDAR CONTRA PRODUCCIÓN  ⚠️
--
-- NO SE HA EJECUTADO. Antes de aplicarla hay que correr el bloque de
-- INSPECCIÓN de más abajo y comprobar que su resultado es el esperado.
--
-- ----------------------------------------------------------------------------
-- QUÉ PROBLEMA RESUELVE
-- ----------------------------------------------------------------------------
-- La aplicación guarda materiales con estos valores de `tipo` (verificado
-- leyendo App.jsx en el Bloque B):
--
--   session · project · rubric · checklist · worksheet · reading ·
--   rating_scale · challenge
--
-- Pero NINGUNO de los cuatro archivos SQL del repositorio incluye 'challenge'
-- en el CHECK de `materiales_docente.tipo`:
--
--   supabase-schema.sql             → session, project, rubric, checklist
--   supabase-session-resources.sql  → + worksheet, rating_scale
--   supabase-session-flow-v2.sql    → + observation_guide, rating_scale,
--                                       worksheet, reading, questionnaire
--
-- Consecuencias en producción:
--   1. TODO reto grupal generado con IA falla al guardarse (violación de CHECK).
--      El crédito ya se gastó y el trabajo se pierde.
--   2. Los dos últimos archivos se contradicen: el que se ejecutó de último
--      decide si `reading` y `questionnaire` son válidos hoy. Desde el
--      repositorio NO se puede saber cuál fue.
--
-- ----------------------------------------------------------------------------
-- GARANTÍAS
-- ----------------------------------------------------------------------------
--   • No borra datos.           • No recrea tablas.
--   • No desactiva RLS.         • No toca políticas ni funciones.
--   • Aborta si encuentra un `tipo` que no esté contemplado (no rompe filas).
--   • El nuevo CHECK es un SUPERCONJUNTO de los tres anteriores.
--
-- Se mantiene el CHECK (no se sustituye por una FK a una tabla de tipos):
-- ese cambio es del Bloque C, para que esta migración sea mínima y reversible.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- PASO 0 — INSPECCIÓN (ejecutar ANTES, revisar y solo entonces continuar)
-- ----------------------------------------------------------------------------
-- Copia estas consultas por separado en el SQL Editor de Supabase:
--
--   -- ¿Qué tipos existen realmente hoy?
--   select tipo, count(*) as filas
--   from public.materiales_docente
--   group by tipo
--   order by tipo;
--
--   -- ¿Qué CHECK está vigente? (revela cuál de los SQL corrió de último)
--   select conname, pg_get_constraintdef(oid)
--   from pg_constraint
--   where conrelid = 'public.materiales_docente'::regclass and contype = 'c';
--
--   -- ¿Sigue RLS activa? Debe devolver true en ambas tablas.
--   select relname, relrowsecurity
--   from pg_class
--   where relname in ('docentes','materiales_docente');
--
-- Si aparece algún `tipo` fuera de la lista de ALLOWED_TYPES de abajo,
-- AÑÁDELO a la lista antes de ejecutar. Si no, la migración abortará sola
-- (que es el comportamiento seguro y deseado).
-- ----------------------------------------------------------------------------


begin;

-- ----------------------------------------------------------------------------
-- PASO 1 — Verificación defensiva: ningún dato existente puede quedar fuera.
-- ----------------------------------------------------------------------------
do $$
declare
  allowed_types text[] := array[
    -- Escritos hoy por la aplicación
    'session',
    'project',
    'rubric',
    'checklist',
    'worksheet',
    'reading',
    'rating_scale',
    'challenge',          -- ← el que faltaba y rompía los retos grupales
    -- Soportados por api/generate-session-resource.js, sin interfaz todavía
    'observation_guide',
    'questionnaire'
  ];
  huerfanos text;
begin
  select string_agg(distinct tipo, ', ')
    into huerfanos
  from public.materiales_docente
  where tipo is not null
    and not (tipo = any(allowed_types));

  if huerfanos is not null then
    raise exception
      'MIGRACIÓN ABORTADA: existen materiales con tipos no contemplados (%). '
      'Añádelos a allowed_types y vuelve a ejecutar. No se ha modificado nada.',
      huerfanos;
  end if;

  raise notice 'Verificación correcta: todos los tipos existentes están contemplados.';
end $$;


-- ----------------------------------------------------------------------------
-- PASO 2 — Reemplazar el CHECK por el superconjunto.
-- ----------------------------------------------------------------------------
alter table public.materiales_docente
  drop constraint if exists materiales_docente_tipo_check;

alter table public.materiales_docente
  add constraint materiales_docente_tipo_check
  check (
    tipo in (
      'session',
      'project',
      'rubric',
      'checklist',
      'worksheet',
      'reading',
      'rating_scale',
      'challenge',
      'observation_guide',
      'questionnaire'
    )
  );


-- ----------------------------------------------------------------------------
-- PASO 3 — `updated_at` dejó de ser un dato muerto.
-- La columna existe con default now() pero nada la actualizaba nunca.
-- ----------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists materiales_docente_touch_updated_at on public.materiales_docente;
create trigger materiales_docente_touch_updated_at
  before update on public.materiales_docente
  for each row execute procedure public.touch_updated_at();

commit;


-- ============================================================================
-- VERIFICACIÓN POSTERIOR (ejecutar después)
-- ============================================================================
--   select conname, pg_get_constraintdef(oid)
--   from pg_constraint
--   where conrelid = 'public.materiales_docente'::regclass and contype = 'c';
--
--   -- Debe insertar sin error y luego borrarse:
--   -- insert into public.materiales_docente (user_id, tipo, titulo, contenido)
--   -- values (auth.uid(), 'challenge', 'Prueba de reto', '{}'::jsonb);
--
--   select relname, relrowsecurity from pg_class
--   where relname in ('docentes','materiales_docente');   -- ambas true
-- ============================================================================


-- ============================================================================
-- ROLLBACK
-- ============================================================================
-- Restaura el CHECK de supabase-session-flow-v2.sql (el más amplio de los
-- anteriores) y elimina el trigger añadido.
--
-- ⚠️ Tras revertir, los retos grupales VOLVERÁN a fallar al guardarse, y
--    cualquier material de tipo 'challenge' creado entretanto impedirá
--    recrear la restricción antigua. En ese caso, primero:
--       select count(*) from public.materiales_docente where tipo = 'challenge';
--    y decide qué hacer con esas filas antes de revertir.
--
--   begin;
--
--   drop trigger if exists materiales_docente_touch_updated_at on public.materiales_docente;
--   drop function if exists public.touch_updated_at();
--
--   alter table public.materiales_docente
--     drop constraint if exists materiales_docente_tipo_check;
--
--   alter table public.materiales_docente
--     add constraint materiales_docente_tipo_check
--     check (tipo in ('session','project','rubric','checklist',
--                     'observation_guide','rating_scale','worksheet',
--                     'reading','questionnaire'));
--
--   commit;
-- ============================================================================

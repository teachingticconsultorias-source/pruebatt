-- ============================================================================
-- 013 · LA GUÍA DE LABORATORIO PUEDE GUARDARSE EN LA BIBLIOTECA
--
-- QUÉ BLOQUEA ESTO
-- ----------------
-- `materiales_docente.tipo` tiene un CHECK cerrado desde la migración 004. Un
-- tipo que no esté en esa lista no se rechaza en la interfaz: se rechaza en
-- Postgres con 23514 (violates check constraint) DESPUÉS de haber gastado el
-- crédito y la llamada a Gemini. La docente ve su guía en pantalla y descubre
-- al volver que no está en su biblioteca.
--
-- POR QUÉ ESTA MIGRACIÓN NO DEPENDE DE SI LA 011 SE APLICÓ
-- --------------------------------------------------------
-- El CHECK no se parchea: se borra y se vuelve a crear entero. Así que esta
-- declara la lista COMPLETA —los diez tipos de la 004, más `wordsearch` de la
-- 011, más `lab_guide`— y el resultado es el mismo se hubiera aplicado la 011
-- o no:
--
--     · con la 011 aplicada  → sólo añade `lab_guide`
--     · sin ella             → añade los dos de una vez
--
-- Se escribió así a propósito, antes de saber la respuesta. Que luego se
-- confirmara que la 011 sí estaba aplicada no cambia nada: sigue siendo la
-- versión correcta, y es idempotente si hay que volver a correrla.
--
-- SUSTITUYE A LA 011
-- ------------------
-- La 011 queda marcada como SUPERSEDIDA. Su lista no incluye `lab_guide`, así
-- que ejecutarla DESPUÉS de esta lo borraría del CHECK sin que nadie se dé
-- cuenta hasta que una docente intentara guardar una guía.
--
-- LO QUE NO HACE
-- --------------
-- No borra filas, no altera datos, no toca RLS, permisos ni funciones. Es un
-- CHECK y nada más.
--
-- PRE (opcional, para saber de dónde partes):
--   select pg_get_constraintdef(c.oid)
--   from pg_constraint c join pg_class t on t.oid = c.conrelid
--   where t.relname = 'materiales_docente'
--     and c.conname = 'materiales_docente_tipo_check';
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. COMPROBACIÓN PREVIA
--
--    Si hay algún material con un tipo que la lista nueva no contempla, el
--    `add constraint` fallaría a mitad y dejaría la tabla SIN restricción.
--    Mejor abortar antes y mirar qué son esas filas.
-- ----------------------------------------------------------------------------
do $$
declare
  huerfanos int;
begin
  select count(*) into huerfanos
  from public.materiales_docente
  where tipo not in (
    'session', 'project', 'rubric', 'checklist', 'worksheet', 'reading',
    'rating_scale', 'challenge', 'observation_guide', 'questionnaire',
    'wordsearch', 'lab_guide'
  );

  if huerfanos > 0 then
    raise exception 'Hay % materiales con un tipo no declarado. Revisar antes de continuar.', huerfanos;
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 2. EL CHECK, CON LA LISTA COMPLETA
--
--    Nada se quita. `wordsearch` y `lab_guide` se añaden; los diez originales
--    siguen exactamente igual que en la 004.
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
      'questionnaire',
      'wordsearch',
      'lab_guide'
    )
  );

comment on constraint materiales_docente_tipo_check on public.materiales_docente is
  'Tipos de material que la aplicación sabe abrir y exportar. Ampliar aquí y en components/library/Library.jsx (MATERIAL_TYPES) a la vez: un tipo que la base acepte y la biblioteca no sepa pintar sale como «Material».';

-- ============================================================================
-- POST · verificación de solo lectura. Ambas columnas deben devolver true.
--
--   select pg_get_constraintdef(c.oid) like '%lab_guide%'  as acepta_laboratorio,
--          pg_get_constraintdef(c.oid) like '%wordsearch%' as acepta_sopa
--   from pg_constraint c
--   join pg_class t on t.oid = c.conrelid
--   where t.relname = 'materiales_docente'
--     and c.conname = 'materiales_docente_tipo_check';
-- ============================================================================

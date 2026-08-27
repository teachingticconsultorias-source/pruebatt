-- SciVerse V2 — ampliar tipos guardables en materiales_docente.
-- Ejecutar en Supabase SQL Editor.
-- No elimina ningún registro existente.

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
      'observation_guide',
      'rating_scale',
      'worksheet',
      'reading',
      'questionnaire'
    )
  );

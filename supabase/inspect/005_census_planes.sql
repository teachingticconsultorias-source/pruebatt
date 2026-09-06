-- ============================================================================
-- CENSO DE PLANES · paso previo obligatorio a 002_commercial_core.sql
--
--                    ✅ SOLO LECTURA · NO MODIFICA NADA
--
-- Una sola sentencia. Devuelve un único Results copiable.
-- No expone correos, nombres, teléfonos ni UUID: sólo valores de `plan`
-- y recuentos agregados.
--
-- CÓMO USARLO
--   Supabase → SQL Editor → New query → pegar TODO → Run → copiar el Results.
--
-- QUÉ RESPONDE
--   · Qué valores de `docentes.plan` existen hoy y cuántos hay de cada uno.
--   · Cómo queda cada valor tras normalizar (btrim + lower).
--   · Si 002 lo reconoce o si haría ABORTAR la migración.
--
-- LA FILA QUE IMPORTA
--   La sección «03 VEREDICTO» dice directamente si 002 puede ejecutarse.
-- ============================================================================

with

-- Normalización idéntica a la del paso 0 de 002_commercial_core.sql:
--   NULL, cadena vacía y sólo-espacios cuentan como gratuito.
censo as (
  select
    coalesce(plan, '(NULL)')                       as valor_real,
    nullif(btrim(coalesce(plan, '')), '')          as normalizado,
    count(*)                                        as docentes
  from public.docentes
  group by 1, 2
),

evaluado as (
  select
    valor_real,
    docentes,
    coalesce(lower(normalizado), '(vacío → free)') as valor_normalizado,
    case
      when normalizado is null then true                              -- NULL/''/espacios
      when lower(normalizado) in ('gratuito', 'free') then true
      else false
    end                                             as reconocido
  from censo
),

filas as (

  -- ==========================================================================
  -- 01 · VALORES TAL CUAL ESTÁN EN LA TABLA
  -- ==========================================================================
  select 100 as ord, '01 VALORES' as seccion,
         valor_real                                as detalle,
         docentes::text                            as cantidad,
         valor_normalizado                         as normalizado,
         case when reconocido then 'SÍ' else 'NO — ABORTARÍA' end as reconoce_002
    from evaluado

  -- ==========================================================================
  -- 02 · RESUMEN
  -- ==========================================================================
  union all
  select 200, '02 RESUMEN', 'docentes totales',
         (select count(*)::text from public.docentes), '', ''
  union all
  select 201, '02 RESUMEN', 'con user_id (recibirán suscripción)',
         (select count(*)::text from public.docentes where user_id is not null), '', ''
  union all
  select 202, '02 RESUMEN', 'sin user_id (perfiles huérfanos, se omiten)',
         (select count(*)::text from public.docentes where user_id is null), '', ''
  union all
  select 203, '02 RESUMEN', 'plan NULL',
         (select count(*)::text from public.docentes where plan is null), '', ''
  union all
  select 204, '02 RESUMEN', 'plan vacío o sólo espacios',
         (select count(*)::text from public.docentes
           where plan is not null and btrim(plan) = ''), '', ''
  union all
  select 205, '02 RESUMEN', 'quedarían en Free',
         (select count(*)::text from public.docentes
           where nullif(btrim(coalesce(plan,'')),'') is null
              or lower(btrim(plan)) in ('gratuito','free')), '', ''
  union all
  select 206, '02 RESUMEN', 'valor distinto de Free (bloquearían la migración)',
         (select count(*)::text from public.docentes
           where nullif(btrim(coalesce(plan,'')),'') is not null
             and lower(btrim(plan)) not in ('gratuito','free')), '', ''
  union all
  select 207, '02 RESUMEN', 'ya tienen suscripción (si 002 se ejecutó antes)',
         case when to_regclass('public.subscriptions') is null
              then 'la tabla aún no existe'
              else (xpath('/table/row/v/text()', query_to_xml(
                'select count(*)::text as v from public.subscriptions', false, false, '')))[1]::text
         end, '', ''

  -- ==========================================================================
  -- 03 · VEREDICTO
  -- ==========================================================================
  union all
  select 300, '03 VEREDICTO', '>>> ¿puede ejecutarse 002_commercial_core.sql?',
         case when exists (
                select 1 from public.docentes
                 where nullif(btrim(coalesce(plan,'')),'') is not null
                   and lower(btrim(plan)) not in ('gratuito','free'))
              then 'NO — hay planes sin equivalencia. Ver la sección 01.'
              else 'SÍ — todos los valores son traducibles a free.'
         end, '', ''
  union all
  select 301, '03 VEREDICTO', 'valores que harían abortar',
         coalesce((select string_agg(distinct plan, ' · ')
                     from public.docentes
                    where nullif(btrim(coalesce(plan,'')),'') is not null
                      and lower(btrim(plan)) not in ('gratuito','free')),
                  '(ninguno)'), '', ''
)

select seccion, detalle, cantidad, normalizado, reconoce_002
  from filas
 order by ord, detalle;

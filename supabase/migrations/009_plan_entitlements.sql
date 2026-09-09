-- ============================================================================
-- 009_plan_entitlements.sql   ·   CAPACIDADES DE CADA PLAN
--
--                    ⚠️  DISEÑADA · NO EJECUTADA  ⚠️
--
-- DEPENDE DE 002_commercial_core (crea `plans.features`) y de
-- 008_commercial_settings (deja el plan `pro` activo).
--
-- QUÉ CAMBIA, EXACTAMENTE
--     Sólo el contenido de la columna `public.plans.features` de las filas
--     `free` y `pro`. Nada más: ni tablas, ni columnas, ni funciones, ni
--     permisos, ni políticas.
--
-- POR QUÉ AQUÍ Y NO EN UNA TABLA NUEVA
--     `features` existe desde 002 exactamente para esto, su comentario ya
--     dice «interruptores de beneficio», y `get_my_plan()` YA la devuelve.
--     Crear una tabla de capacidades habría añadido un join, una RPC y una
--     migración para guardar ocho números que caben en una columna que ya
--     está y que ya viaja al servidor en cada consulta de plan.
--
-- QUÉ NO SE TOCA
--     `ai_weekly_limit` sigue siendo la ÚNICA fuente del cupo semanal, y la
--     aplica `consume_ai_credit`. El `weekly_ai_credits` de abajo es un
--     espejo informativo para la interfaz: si algún día discreparan, manda
--     la columna, no el jsonb. Duplicar el contador sería la forma más rápida
--     de que una docente acabe con dos saldos distintos.
--
-- GARANTÍAS
--     · No borra datos.             · No recrea tablas.
--     · No desactiva RLS.           · Idempotente y transaccional.
--     · `features` se FUSIONA con lo que hubiera (`||`), no se reemplaza:
--       si alguien añadió una clave a mano, sobrevive.
-- ============================================================================

begin;


-- ============================================================================
-- 0. PRECONDICIONES
-- ============================================================================
do $$
begin
  if to_regclass('public.plans') is null then
    raise exception 'ABORTA: falta 002_commercial_core.sql';
  end if;
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'plans'
                    and column_name = 'features') then
    raise exception 'ABORTA: public.plans no tiene la columna features';
  end if;
end;
$$;


-- ============================================================================
-- 1. CAPACIDADES DEL PLAN GRATUITO
--
--    Los límites no son castigos: son el tamaño de lo que se puede regalar
--    sosteniblemente. Una ficha de 10 preguntas es una ficha usable, no una
--    demostración recortada.
-- ============================================================================
update public.plans
   set features = coalesce(features, '{}'::jsonb) || jsonb_build_object(
         'weekly_ai_credits',          5,
         'worksheet_max_questions',    10,
         'reading_max_questions',      10,
         'rubric_max_criteria',        5,
         'checklist_max_criteria',     8,
         'rating_scale_max_criteria',  8,
         'steam_max_weeks',            2,
         'docx_remove_watermark',      false
       ),
       updated_at = now()
 where code = 'free';


-- ============================================================================
-- 2. CAPACIDADES DEL PLAN PRO
-- ============================================================================
update public.plans
   set features = coalesce(features, '{}'::jsonb) || jsonb_build_object(
         'weekly_ai_credits',          100,
         'worksheet_max_questions',    20,
         'reading_max_questions',      20,
         'rubric_max_criteria',        10,
         'checklist_max_criteria',     15,
         'rating_scale_max_criteria',  15,
         'steam_max_weeks',            4,
         'docx_remove_watermark',      true
       ),
       updated_at = now()
 where code = 'pro';


-- ============================================================================
-- 3. DOCUMENTACIÓN DE LA COLUMNA
--
--    El comentario de 002 decía «nada que el backend deba hacer cumplir por
--    sí solo». Este bloque cambia eso: ahora el servidor SÍ los hace cumplir,
--    y conviene que la próxima persona que lo lea lo sepa.
-- ============================================================================
comment on column public.plans.features is
  'Capacidades del plan que el servidor HACE CUMPLIR (api/_lib/entitlements.js): límites por herramienta y marca de agua. El cupo semanal NO vive aquí: lo define ai_weekly_limit y lo aplica consume_ai_credit.';


commit;


-- ============================================================================
-- COMPROBACIÓN  ·  solo lectura, después de aplicar
-- ============================================================================
--
--   select code, ai_weekly_limit, features
--     from public.plans
--    where code in ('free', 'pro')
--    order by sort_order;
--
-- Se espera:
--   free · 5   · worksheet_max_questions=10 · steam_max_weeks=2 · sin marca=false
--   pro  · 100 · worksheet_max_questions=20 · steam_max_weeks=4 · sin marca=true
--
--
-- ============================================================================
-- ANTES DE EDITARLO DESDE ADMINISTRACIÓN
-- ============================================================================
-- `admin_update_plan` NO admite `features` en su lista blanca, a propósito:
-- hasta ahora era configuración técnica. Para que estos límites se editen
-- desde el panel hará falta añadir la clave a esa lista, validar cada campo
-- por tipo y rango, y poner los controles en Administración → Planes. Es una
-- migración pequeña, pero es OTRA: mezclarla aquí obligaría a revisar dos
-- cosas a la vez.
--
--
-- ============================================================================
-- PLAN DE ROLLBACK
-- ============================================================================
--
--   begin;
--   update public.plans
--      set features = features - 'weekly_ai_credits' - 'worksheet_max_questions'
--                              - 'reading_max_questions' - 'rubric_max_criteria'
--                              - 'checklist_max_criteria' - 'rating_scale_max_criteria'
--                              - 'steam_max_weeks' - 'docx_remove_watermark'
--    where code in ('free', 'pro');
--   commit;
--
-- Revertir NO deja el producto sin límites: `api/_lib/entitlements.js` tiene
-- los mismos valores como respaldo y sigue aplicándolos. Lo que se pierde es
-- la capacidad de cambiarlos sin desplegar.
-- ============================================================================

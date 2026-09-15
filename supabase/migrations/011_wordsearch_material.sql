-- ============================================================================
-- 011 · La sopa de letras entra en la biblioteca
--
-- ⚠️  SUPERSEDIDA POR 013 · NO EJECUTAR
--
--     APLICADA en producción (confirmado el 14/09/2026 leyendo el CHECK: ya
--     contiene 'wordsearch'). Se conserva como historial.
--
--     NO volver a ejecutarla. Este CHECK no se parchea: se borra y se recrea
--     entero, y la lista de abajo NO incluye 'lab_guide'. Correrla después de
--     la 013 lo borraría del CHECK, y las guías de laboratorio dejarían de
--     guardarse en la biblioteca sin que nadie viera el fallo hasta que una
--     docente lo intentara. Para cualquier cambio de tipos, parte de la 013.
--
-- POR QUÉ HACE FALTA
-- ------------------
-- `materiales_docente.tipo` tiene un CHECK cerrado desde 004 con diez
-- valores:
--
--     session · project · rubric · checklist · worksheet · reading ·
--     rating_scale · challenge · observation_guide · questionnaire
--
-- La sopa de letras no está. Es una herramienta activa que produce un
-- recurso terminado —cuadrícula, lista de palabras y solucionario— y hasta
-- ahora era la única de las diez que no se podía guardar.
--
-- QUÉ PASA MIENTRAS NO SE APLIQUE
-- -------------------------------
-- El botón «Guardar en mi biblioteca» existe y hace un INSERT de verdad.
-- Postgres lo rechaza con 23514 (violates check constraint) y la interfaz
-- dice exactamente eso: «Este tipo de material todavía no está habilitado en
-- la base de datos», con la descarga en Word y en imagen como salida. NO se
-- muestra un éxito falso. Ver `describeSaveError()` en App.jsx.
--
-- POR QUÉ NO SE GUARDA COMO `worksheet`
-- -------------------------------------
-- Habría funcionado hoy sin migración, y era la tentación. Pero en la
-- biblioteca aparecería rotulada «Ficha de trabajo», contaría en ese filtro y
-- la docente no encontraría sus sopas donde las busca. Un rótulo falso para
-- ahorrarse una migración es la clase de deuda que después nadie deshace.
--
-- POR QUÉ SIGUE SIENDO UN CHECK Y NO UNA TABLA DE TIPOS
-- ----------------------------------------------------
-- El mismo motivo que dio 004: son diez valores que cambian una vez al año y
-- una FK obligaría a un JOIN en cada lectura de la biblioteca. Si algún día
-- pasan de veinte, se revisa.
--
-- CÓMO APLICARLA
-- --------------
--     supabase db push          (o el SQL editor del panel)
--
-- Es reversible y no toca datos: sólo amplía el conjunto permitido. Ninguna
-- fila existente puede violar el CHECK nuevo, porque es un superconjunto del
-- anterior.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- Comprobación previa: ninguna fila debe quedar fuera del CHECK nuevo.
-- Si esto devuelve algo, PARAR: hay un tipo en uso que nadie declaró.
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
    'wordsearch'
  );

  if huerfanos > 0 then
    raise exception 'Hay % materiales con un tipo no declarado. Revisar antes de continuar.', huerfanos;
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- El CHECK, con `wordsearch` añadido y nada más quitado.
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
      'wordsearch'
    )
  );

commit;

-- ----------------------------------------------------------------------------
-- QUÉ SE GUARDA EN `contenido` PARA UNA SOPA
--
-- Todo lo necesario para reabrirla SIN volver a generarla, que es el punto:
-- regenerar daría otra cuadrícula distinta y el solucionario impreso ya no
-- valdría.
--
--   {
--     "formato": "wordsearch",       -- discriminador para el visor
--     "tema": "Héroes de Dota 2",
--     "dificultad": "Media",
--     "lado": 12,
--     "palabras": ["INVOKER", "PUDGE"],   -- SOLO las que se colocaron
--     "cuadricula": [["A","B",…], …],     -- letra por celda
--     "solucionario": [                   -- dónde está cada palabra
--       { "palabra": "INVOKER", "fila": 3, "columna": 5, "direccion": "horizontal" }
--     ]
--   }
--
-- Las palabras descartadas por no caber NO se guardan: no están en el
-- tablero, y guardarlas reproduciría el fallo que este bloque corrigió
-- —imprimir una lista con palabras que el estudiante no puede encontrar.
-- ----------------------------------------------------------------------------

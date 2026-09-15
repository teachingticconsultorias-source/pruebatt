// lib/ui/validaciones.js
//
// LO QUE UN CAMPO TIENE QUE TRAER PARA QUE LA GENERACIÓN VALGA LA PENA.
//
// EL CASO QUE LO PROVOCÓ
// ----------------------
// El formulario de laboratorio aceptaba «DEMOSTRAR» como propósito de
// aprendizaje. No estaba vacío, así que pasaba el `!campo.trim()` de siempre,
// se gastaba una generación de la semana y Kantu recibía una palabra suelta de
// la que no se puede deducir ni qué se mide ni para qué. La guía salía
// genérica y la docente pagaba el crédito.
//
// Comprobar que algo «no está vacío» no dice nada sobre si sirve. Un propósito
// es una ORACIÓN: hay una acción, un contenido y un para qué. Eso se puede
// medir sin adivinar la intención — contando palabras de verdad, no caracteres,
// porque «AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA» tiene treinta caracteres y sigue sin
// ser una oración.
//
// POR QUÉ EL LISTÓN ESTÁ TAN BAJO
// -------------------------------
// Cuatro palabras y veinte caracteres. No es un juicio sobre la calidad
// pedagógica: es el mínimo por debajo del cual seguro que no hay una oración.
// «Medir la densidad de tres líquidos» pasa, y debe pasar. Un formulario que
// discute con la docente sobre su redacción es peor que uno permisivo; esto
// sólo ataja el dedo que se resbaló.

/** Palabras de verdad: se descartan signos, números sueltos y viñetas. */
function palabrasDe(texto) {
  return String(texto ?? "")
    .split(/[\s·.,;:()[\]{}"'¿?¡!/\\|—–-]+/)
    .filter((t) => /\p{L}/u.test(t));
}

/** El mínimo por debajo del cual seguro que no hay una oración. */
export const MINIMO_ORACION = { palabras: 4, caracteres: 20 };

/**
 * ¿Esto es una oración, o una palabra suelta?
 *
 * @param {string} texto
 * @param {{palabras?:number, caracteres?:number}} [minimo]
 */
export function esOracion(texto, minimo = MINIMO_ORACION) {
  const limpio = String(texto ?? "").trim();
  const { palabras = MINIMO_ORACION.palabras, caracteres = MINIMO_ORACION.caracteres } = minimo;
  return limpio.length >= caracteres && palabrasDe(limpio).length >= palabras;
}

/**
 * Cualquier campo libre del que dependa lo que se genera.
 *
 * Mismo listón y mismo motivo que el propósito: la conducta a observar de una
 * guía o el aprendizaje que evalúa un cuestionario deciden el contenido
 * entero, y una palabra suelta da un recurso genérico por el mismo crédito.
 *
 * @param {string} texto
 * @param {string} rotulo  cómo se llama el campo en la pantalla
 * @returns {string|null}
 */
export function revisarCampoLibre(texto, rotulo) {
  const limpio = String(texto ?? "").trim();
  const nombre = String(rotulo || "Este campo").replace(/\s*\*$/, "");
  if (!limpio) return `Completa «${nombre}».`;
  if (!esOracion(limpio)) {
    return `«${nombre}» debe ser una oración, no una palabra suelta: con una palabra el resultado sale genérico y gasta una generación igual.`;
  }
  return null;
}

/**
 * El propósito de aprendizaje, revisado antes de gastar una generación.
 *
 * Devuelve el motivo en español, listo para enseñar, o `null` si está bien.
 * Los tres mensajes son distintos a propósito: «completa el campo» no ayuda a
 * quien ya escribió algo y no entiende por qué no le vale.
 *
 * @param {string} texto
 * @returns {string|null}
 */
export function revisarProposito(texto) {
  const limpio = String(texto ?? "").trim();
  if (!limpio) return "Escribe el propósito de aprendizaje de la práctica.";
  if (!esOracion(limpio)) {
    return "El propósito debe ser una oración, no una palabra suelta: di qué harán los estudiantes, con qué y para qué. Ej.: «Comparar la densidad de tres líquidos y explicar por qué unos flotan sobre otros».";
  }
  return null;
}

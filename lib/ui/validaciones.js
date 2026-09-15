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

/* ==========================================================================
   LO QUE CADA FORMULARIO EXIGE, EN UN SOLO SITIO

   POR QUÉ ESTO EXISTE
   -------------------
   Cada generador comprobaba sus campos en el navegador y ningún endpoint
   comprobaba nada. Medido en la auditoría: el servidor aceptaba cualquier
   cuerpo, gastaba un crédito de la semana y devolvía un documento genérico.
   Basta una pestaña vieja, un reintento a mano o una petición cruda.

   Es la misma asimetría que ya costó dos incidentes: `tieneTema`, donde
   cliente y servidor miraban cosas distintas y los botones de Kantu quedaron
   muertos, y `revisarProposito`, que sólo vivía en el formulario.

   LA REGLA: EL MENSAJE ES EL MISMO OBJETO, NO UNA COPIA PARECIDA
   --------------------------------------------------------------
   Los textos de abajo son LOS QUE YA VEÍA LA DOCENTE, copiados literalmente de
   los formularios. Así el servidor no puede contradecir a la pantalla, y
   cambiar uno cambia los dos a la vez.

   EL LISTÓN NO SUBE
   -----------------
   Esto reproduce lo que el formulario exigía, ni un campo más. Endurecerlo
   aquí bloquearía generaciones que hoy funcionan, y eso sería un incidente,
   no un arreglo.
   ========================================================================== */

/** Un valor «presente»: texto con algo, o lista con algo. */
const lleno = (v) => Array.isArray(v) ? v.length > 0 : String(v ?? "").trim().length > 0;

/**
 * @type {Record<string, {campos: string[], mensaje: string, extra?: Function}>}
 */
export const CONTRATO_DE_FORMULARIO = {
  /* ---------------------------------------------------- PLANIFICAR */
  sesion: {
    campos: ["nivel", "grado", "area", "region", "tema", "competencia",
      "capacidades", "proposito", "contexto", "evidencia"],
    mensaje: "Completa o solicita sugerencias para el propósito, contexto y evidencia.",
  },

  steam: {
    campos: ["nivel", "grado", "region", "tema", "situacion", "competencia",
      "capacidades", "producto", "evidencias"],
    mensaje: "Completa el tema, la situación significativa y selecciona al menos dos áreas STEAM.",
    // El proyecto necesita DOS áreas, no una: es lo que lo hace STEAM.
    extra: (form) => (Array.isArray(form.areasSTEAM) && form.areasSTEAM.length >= 2)
      ? null : "Completa el tema, la situación significativa y selecciona al menos dos áreas STEAM.",
  },

  /* ------------------------------------------------------- EVALUAR */
  instrumento: {
    campos: ["tema", "evidencia"],
    mensaje: "Escribe la evidencia o solicita una sugerencia a Kantu.",
  },

  escala: {
    campos: ["tema", "region", "evidencia"],
    mensaje: "Completa tema, región y evidencia.",
  },

  observacion: {
    campos: ["tema", "region"],
    mensaje: "Escribe el tema.",
    // El campo libre decide el contenido: se le exige forma de oración.
    extra: (form) => revisarCampoLibre(form.evidencia, "Actuación o desempeño que vas a observar"),
  },

  /* ------------------------------------------- CREAR MATERIALES */
  recurso: {
    campos: ["tema"],
    mensaje: "Escribe el tema del material.",
  },

  cuestionario: {
    campos: ["tema"],
    mensaje: "Escribe el tema.",
    extra: (form) => revisarCampoLibre(form.proposito, "Qué deben demostrar que aprendieron"),
  },

  laboratorio: {
    campos: ["tema"],
    mensaje: "Escribe el tema de la práctica.",
    extra: (form) => revisarProposito(form.proposito),
  },
};

/**
 * ¿Trae el formulario lo que su herramienta necesita?
 *
 * @param {string} herramienta  clave de CONTRATO_DE_FORMULARIO
 * @param {object} form
 * @returns {string|null} el motivo en español, o null si está completo
 */
export function revisarFormulario(herramienta, form) {
  const contrato = CONTRATO_DE_FORMULARIO[herramienta];
  // Una herramienta sin contrato no se bloquea: se deja pasar. Inventar un
  // requisito aquí rompería una pantalla que hoy funciona.
  if (!contrato || !form || typeof form !== "object") return null;

  for (const campo of contrato.campos) {
    if (!lleno(form[campo])) return contrato.mensaje;
  }
  return contrato.extra ? contrato.extra(form) : null;
}

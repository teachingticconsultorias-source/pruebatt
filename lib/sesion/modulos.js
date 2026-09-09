// lib/sesion/modulos.js
//
// UNA SESIÓN SON CUATRO MÓDULOS, Y NINGUNO DEBE PERDER A LOS DEMÁS.
//
// EL FALLO QUE ESTO CORRIGE
// ------------------------
// La generación de una sesión encadena cuatro llamadas: alignment, sequence,
// assessment y annexes. Estaban en un bucle dentro del propio componente, con
// los resultados en una variable LOCAL:
//
//     const generated = {};
//     for (const modulo of MODULOS) { ... generated[modulo] = data.result; }
//
// Cuando `sequence` se truncó en producción, la excepción salió de la función
// y `generated` se fue con ella: la alineación —que había terminado bien, y era
// la que había cobrado el crédito— se perdía. La única salida que le quedaba a
// la docente era volver a generar desde cero, lo que cobra OTRO crédito por un
// trabajo que ya estaba hecho.
//
// LO QUE CAMBIA
// -------------
// El acumulador vive fuera de la ejecución (en el componente, una `ref`) y el
// bucle no lanza: devuelve en qué módulo se quedó. Con eso, reintentar es
// simplemente volver a entrar EMPEZANDO EN EL MÓDULO QUE FALLÓ, con lo ya
// generado como contexto. La alineación no se vuelve a pedir, así que el
// servidor no vuelve a cobrar: `chargesCreditForModule()` sólo cobra
// `alignment` (ver api/_lib/credits.js).
//
// POR QUÉ EL REINTENTO ES MANUAL Y NO AUTOMÁTICO
// ----------------------------------------------
// El fallo real fue `finishReason: MAX_TOKENS`, que NO es transitorio: con el
// mismo prompt y el mismo tope, el segundo intento se trunca en el mismo sitio.
// Reintentar solo duplicaría los 25 segundos de espera antes de dar el mismo
// error. La capa de transporte ya lo trata así a propósito —`gemini.js`
// reintenta 429 y 5xx, y MAX_TOKENS llega en un 200— y la corrección de verdad
// es el presupuesto por módulo de `api/generate-session.js`.
//
// Aquí el reintento existe para lo otro: la caída de red, el 503 que agotó sus
// intentos, la sesión que venció. Lo pide la docente cuando quiere, y le cuesta
// cero créditos.

/** Los cuatro módulos, en el orden en que cada uno alimenta al siguiente. */
export const MODULOS_SESION = ["alignment", "sequence", "assessment", "annexes"];

export const ETIQUETAS_MODULO = {
  alignment: "Alineación curricular",
  sequence: "Secuencia didáctica",
  assessment: "Evaluación formativa",
  annexes: "Anexos para la clase",
};

/** Cómo se nombra cada módulo dentro de una frase. */
const EN_FRASE = {
  alignment: "la alineación curricular",
  sequence: "la secuencia didáctica",
  assessment: "la evaluación formativa",
  annexes: "los anexos para la clase",
};

/**
 * Lo que ve la docente cuando un módulo no termina.
 *
 * Sin detalles técnicos: nada de MAX_TOKENS, presupuestos, códigos ni estados
 * HTTP. Eso se queda en el log de Vercel, que es donde sirve. Lo que sí dice,
 * porque es lo que la docente necesita saber para no volver a empezar, es que
 * lo ya generado sigue ahí.
 */
export function mensajeDeModuloFallido(modulo) {
  return `No pudimos terminar ${EN_FRASE[modulo] || "esta parte"}. Lo que ya está listo se conservará.`;
}

/** Texto del botón: «Reintentar secuencia didáctica». */
export function accionDeReintento(modulo) {
  if (modulo === "sequence") return "Reintentar secuencia";
  const frase = (EN_FRASE[modulo] || "esta parte").replace(/^(la|los|el) /, "");
  return `Reintentar ${frase}`;
}

/**
 * ¿Están los cuatro módulos listos?
 *
 * Es la condición para pasar al paso 2 del flujo de clase completa: sin los
 * cuatro no hay sesión que instrumentar, y avanzar con tres dejaría al docente
 * construyendo un instrumento sobre un documento a medias.
 */
export function sesionCompleta(listos) {
  return MODULOS_SESION.every((modulo) => (listos || []).includes(modulo));
}

/** Los módulos ya generados, en orden. */
export function modulosListos(parciales) {
  return MODULOS_SESION.filter((modulo) => Boolean(parciales?.[modulo]));
}

/**
 * Estado de cada módulo para la interfaz.
 *
 * Cuatro estados y no dos, porque «pendiente» y «fallido» no son lo mismo para
 * quien mira: uno se resuelve esperando y el otro pidiendo el reintento.
 *
 * @returns {{clave:string, etiqueta:string, estado:"completed"|"failed"|"processing"|"pending"}[]}
 */
export function progresoDeModulos({ listos = [], fallido = null, activo = null } = {}) {
  return MODULOS_SESION.map((modulo) => ({
    clave: modulo,
    etiqueta: ETIQUETAS_MODULO[modulo],
    estado: listos.includes(modulo)
      ? "completed"
      : modulo === fallido
        ? "failed"
        : modulo === activo
          ? "processing"
          : "pending",
  }));
}

/** «1 de 4 partes listas». */
export function textoDeProgreso(listos) {
  return `${(listos || []).length} de ${MODULOS_SESION.length} partes listas`;
}

/**
 * Genera los módulos que falten, empezando por `desde`.
 *
 * NO LANZA. Un fallo se devuelve, porque lanzar es justamente lo que hacía
 * perder los módulos anteriores. Y escribe en el objeto `parciales` que recibe
 * —no en una copia— para que quien lo tenga guardado conserve lo generado
 * aunque esta ejecución termine mal.
 *
 * @param {object}   opciones
 * @param {object}   opciones.parciales  acumulador; se escribe dentro
 * @param {string}   [opciones.desde]    módulo por el que empezar
 * @param {Function} opciones.pedir      (modulo, previos) => resultado; puede lanzar
 * @param {Function} [opciones.alActivar]
 * @param {Function} [opciones.alCompletar]
 * @returns {Promise<{ok:boolean, fallido:string|null, causa:Error|null}>}
 */
export async function generarModulos({ parciales, desde = null, pedir, alActivar, alCompletar }) {
  const inicio = desde ? MODULOS_SESION.indexOf(desde) : 0;
  if (inicio < 0) throw new Error(`Módulo desconocido: ${desde}`);

  for (let i = inicio; i < MODULOS_SESION.length; i += 1) {
    const modulo = MODULOS_SESION[i];
    // Un reintento entra por el módulo que falló, pero los siguientes pueden
    // estar ya hechos si el fallo fue de otro orden: no se rehacen.
    if (parciales[modulo]) continue;

    alActivar?.(modulo);
    let resultado = null;
    try {
      resultado = await pedir(modulo, { ...parciales });
    } catch (causa) {
      // Se corta AQUÍ: sin `sequence` no hay contexto con el que generar
      // `assessment` ni `annexes`, y pedirlos daría un documento incoherente
      // además de gastar dos llamadas a Gemini para nada.
      return { ok: false, fallido: modulo, causa };
    }
    if (!resultado) {
      return { ok: false, fallido: modulo, causa: new Error("respuesta incompleta") };
    }
    parciales[modulo] = resultado;
    alCompletar?.(modulo);
  }

  return { ok: true, fallido: null, causa: null };
}

/**
 * Arma el documento final con los cuatro módulos.
 *
 * Estaba en línea dentro del componente. Sale aquí porque ahora hay dos
 * caminos que llegan al mismo sitio —la generación normal y el reintento— y el
 * documento tiene que ser idéntico por los dos.
 */
export function componerSesion({ parciales, form }) {
  if (!sesionCompleta(modulosListos(parciales))) throw new Error("Sesión incompleta");
  const { alignment, sequence, assessment, annexes } = parciales;
  return {
    titulo: alignment.titulo,
    areasSTEAM: form.steam ? [form.area, "Enfoque STEAM"] : [form.area],
    competenciasCNEB: [form.competencia],
    capacidadesCNEB: form.capacidades,
    proposito: alignment.proposito,
    desempenosPrecisados: alignment.desempenosPrecisados,
    criteriosDetallados: assessment.criterios,
    criteriosEvaluacion: assessment.criterios.map((item) => item.criterio),
    evidencia: alignment.evidencia,
    enfoquesTransversales: alignment.enfoquesTransversales,
    preparacionDocente: sequence.preparacionDocente,
    materiales: sequence.materiales,
    inicio: sequence.inicio,
    desarrollo: sequence.desarrollo,
    cierre: sequence.cierre,
    tiempos: {
      inicio: sequence.inicio.minutos,
      desarrollo: sequence.desarrollo.minutos,
      cierre: sequence.cierre.minutos,
    },
    orientacionesDUA: sequence.orientacionesDUA,
    instrumentoSugerido: assessment.instrumentoSugerido,
    reflexionesDocente: assessment.reflexionesDocente,
    anexos: annexes.anexos,
    productoSTEAM: alignment.evidencia,
  };
}

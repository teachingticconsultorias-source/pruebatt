// lib/export/marca.js
//
// LA MARCA DEL COLEGIO EN LAS EXPORTACIONES. MODELO PURO.
//
// Sin React, sin Supabase, sin `docx`: sólo las reglas. Así se puede probar en
// node y así el exportador puede usarlo sin arrastrar medio proyecto.
//
// LOS TRES MODOS
// --------------
//   nitia      la maqueta de siempre. Es el valor por defecto y el respaldo
//              de todo lo demás.
//   colegio    la misma maqueta con el logo y los colores del colegio.
//   plantilla  el .docx del propio colegio, relleno por marcadores.
//
// POR QUÉ EL MODO SE «RESUELVE» Y NO SE LEE TAL CUAL
// --------------------------------------------------
// Lo que hay guardado es una intención, no una garantía. Una docente puede
// haber elegido `plantilla`, y meses después haber vuelto a Free, o haber
// borrado el fichero desde el panel de Storage. Exportar en ese caso no puede
// fallar ni salir en blanco: cae al modo inmediatamente inferior que sí tenga
// con qué trabajar. `modoEfectivo()` es esa caída, en un solo sitio.

/** Los tres modos, del más simple al más específico. */
export const MODOS = ["nitia", "colegio", "plantilla"];

/** Dónde puede ir el logo en la cabecera. */
export const POSICIONES = ["izquierda", "centro", "derecha"];

/** Tope del logo. El bucket admite 5 MB porque manda la plantilla. */
export const MAX_LOGO_BYTES = 1048576;

/** La marca de Nitia: lo que se usa cuando no hay nada configurado. */
export const MARCA_NITIA = Object.freeze({
  modo: "nitia",
  logoPath: null,
  logoPosicion: "izquierda",
  colorPrimario: null,
  colorAcento: null,
  plantillaPath: null,
  plantillaNombre: null,
  plantillaMarcadores: [],
});

const HEX = /^#?([0-9A-Fa-f]{6})$/;

/**
 * Un color de marca, en el formato que usa el resto del sistema visual:
 * seis dígitos hexadecimales en mayúsculas y SIN almohadilla.
 *
 * Devuelve null ante cualquier cosa que no lo sea. Un color inválido no se
 * «arregla» a un gris cualquiera: se ignora y manda el de Nitia, que al menos
 * se sabe que contrasta.
 */
export function normalizarHex(valor) {
  const encontrado = HEX.exec(String(valor ?? "").trim());
  return encontrado ? encontrado[1].toUpperCase() : null;
}

/** Una posición válida, o la de por defecto. */
export function normalizarPosicion(valor) {
  return POSICIONES.includes(valor) ? valor : "izquierda";
}

/**
 * Convierte la fila de `export_branding` en el objeto que usa el exportador.
 *
 * Acepta `null` —docente sin fila— y devuelve la marca de Nitia.
 */
export function normalizarMarca(fila) {
  if (!fila || typeof fila !== "object") return { ...MARCA_NITIA };
  return {
    modo: MODOS.includes(fila.modo) ? fila.modo : "nitia",
    logoPath: fila.logo_path || fila.logoPath || null,
    logoPosicion: normalizarPosicion(fila.logo_posicion || fila.logoPosicion),
    colorPrimario: normalizarHex(fila.color_primario ?? fila.colorPrimario),
    colorAcento: normalizarHex(fila.color_acento ?? fila.colorAcento),
    plantillaPath: fila.plantilla_path || fila.plantillaPath || null,
    plantillaNombre: fila.plantilla_nombre || fila.plantillaNombre || null,
    plantillaMarcadores: Array.isArray(fila.plantilla_marcadores || fila.plantillaMarcadores)
      ? (fila.plantilla_marcadores || fila.plantillaMarcadores) : [],
  };
}

/** ¿Hay algo del colegio que aplicar sobre la maqueta de Nitia? */
export function tieneMarcaSimple(marca) {
  return Boolean(marca?.logoPath || marca?.colorPrimario || marca?.colorAcento);
}

/**
 * El modo con el que se va a exportar DE VERDAD.
 *
 * @param {object} marca            lo guardado, ya normalizado
 * @param {boolean} puedePlantilla  capacidad del plan vigente
 */
export function modoEfectivo(marca, { puedePlantilla = false } = {}) {
  const guardado = marca?.modo || "nitia";

  if (guardado === "plantilla") {
    // Sin plan o sin fichero, no hay plantilla que aplicar. Se baja un
    // escalón en vez de fallar: la docente sigue teniendo su documento.
    if (puedePlantilla && marca?.plantillaPath) return "plantilla";
    return tieneMarcaSimple(marca) ? "colegio" : "nitia";
  }
  if (guardado === "colegio") {
    return tieneMarcaSimple(marca) ? "colegio" : "nitia";
  }
  return "nitia";
}

/** Por qué se está exportando así, dicho para la docente. */
export function explicarModo(marca, opciones = {}) {
  const efectivo = modoEfectivo(marca, opciones);
  const guardado = marca?.modo || "nitia";
  if (efectivo === guardado) {
    return {
      nitia: "Tus documentos usan el formato de Nitia.",
      colegio: "Tus documentos usan el logo y los colores de tu colegio.",
      plantilla: "Tus documentos usan la plantilla .docx de tu colegio.",
    }[efectivo];
  }
  if (guardado === "plantilla" && !opciones.puedePlantilla) {
    return "Tu plan actual no incluye plantilla propia: por ahora se usa el formato de tu colegio.";
  }
  if (guardado === "plantilla") {
    return "No encontramos tu plantilla .docx: por ahora se usa el formato de tu colegio.";
  }
  return "Todavía no has subido logo ni elegido colores: se usa el formato de Nitia.";
}

/**
 * Los colores efectivos, listos para `tema.js`.
 *
 * En modo `nitia` devuelve null y el exportador usa su paleta tal cual; así no
 * hay que decidir dos veces lo mismo.
 */
export function coloresDe(marca, opciones = {}) {
  if (modoEfectivo(marca, opciones) !== "colegio") return null;
  return {
    primario: marca.colorPrimario || null,
    acento: marca.colorAcento || null,
  };
}

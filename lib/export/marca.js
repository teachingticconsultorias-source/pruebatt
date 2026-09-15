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

/* ==========================================================================
   HASTA DÓNDE LLEGA EL MODO «PLANTILLA»

   El contrato de marcadores tiene forma de SESIÓN: datos generales, propósitos,
   desempeños, criterios, enfoques, secuencia, DUA y anexos. La sesión y la
   clase completa llenan los ocho bloques. Ningún otro tipo llena más de uno.

   Medido sobre los ejemplares de tests/fixtures/word.js, un proyecto STEAM
   vuelca su cuerpo entero en `{{secuencia}}` y deja los otros siete vacíos: los
   encabezados de la plantilla del colegio —PROPÓSITOS, DESEMPEÑOS, CRITERIOS,
   ENFOQUES— sobreviven sin nada debajo, y a continuación el proyecto repite su
   propio título y su propia tabla de datos. El documento sale peor que si no
   hubiera plantilla.

   Y no se arregla troceando mejor: un proyecto STEAM no tiene desempeños
   precisados ni orientaciones DUA, y sí tiene integración STEAM, ruta por
   semanas y sesiones, que en este contrato no tienen dónde caer. Son
   estructuras distintas, no la misma con secciones ausentes.

   Así que el modo se acota aquí, y el resto de tipos cae a `colegio`: la
   maqueta de Nitia con el logo y los colores del centro. El colegio conserva su
   identidad en TODAS sus descargas y nadie recibe un documento con huecos.

   La alternativa —un contrato por tipo— obligaría a cada docente a mantener y
   subir varias plantillas. Se reconsiderará si un colegio pide su formato
   propio de proyecto STEAM; hoy nadie lo ha pedido.
   ========================================================================== */

/**
 * Los tipos de documento cuyo contenido cabe en el contrato de marcadores.
 *
 * `complete` es la clase completa: se rellena con su parte de sesión, que es
 * la troceable, y la rúbrica se va al anexo. Ver `bloquesPorMarcador`.
 */
export const TIPOS_CON_PLANTILLA = Object.freeze(["session", "complete"]);

/**
 * ¿Este tipo de documento puede salir en la plantilla del colegio?
 *
 * Sin tipo devuelve `true`: es lo que pasa en la pantalla de ajustes, donde se
 * habla del modo en general y no de una descarga concreta.
 */
export function admitePlantilla(tipo) {
  if (tipo == null || tipo === "") return true;
  return TIPOS_CON_PLANTILLA.includes(String(tipo).replace(/-/g, "_"));
}

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
 * @param {string} [tipo]           tipo de documento que se está descargando.
 *   Sin él se resuelve el modo «en general», que es lo que necesita la
 *   pantalla de ajustes; con él se aplica además el alcance de arriba.
 */
export function modoEfectivo(marca, { puedePlantilla = false, tipo = null } = {}) {
  const guardado = marca?.modo || "nitia";

  if (guardado === "plantilla") {
    // Sin plan, sin fichero o con un tipo que el contrato no cubre, no hay
    // plantilla que aplicar. Se baja un escalón en vez de fallar: la docente
    // sigue teniendo su documento, y con la marca de su colegio.
    if (puedePlantilla && marca?.plantillaPath && admitePlantilla(tipo)) return "plantilla";
    return tieneMarcaSimple(marca) ? "colegio" : "nitia";
  }
  if (guardado === "colegio") {
    return tieneMarcaSimple(marca) ? "colegio" : "nitia";
  }
  return "nitia";
}

/**
 * La misma marca, renunciando a la plantilla.
 *
 * Es el respaldo de una descarga que ya empezó: el fichero estaba, el plan
 * estaba, y aun así `patchDocument` no pudo con él. Sin esto el documento de
 * repuesto salía con los colores de Nitia —porque el modo seguía siendo
 * `plantilla` y `coloresDe` devuelve null ahí—, así que el colegio perdía su
 * identidad justo en el momento en que algo le había fallado.
 */
export function marcaSinPlantilla(marca) {
  if (!marca || marca.modo !== "plantilla") return marca;
  return { ...marca, modo: "colegio" };
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

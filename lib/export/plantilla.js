// lib/export/plantilla.js
//
// LA PLANTILLA .DOCX DEL COLEGIO: VALIDARLA Y RELLENARLA.
//
// POR QUÉ HACEN FALTA MARCADORES
// ------------------------------
// `patchDocument()` de la librería `docx` sustituye marcadores `{{nombre}}`
// dentro de un .docx existente. No hay —ni en esa librería ni en ninguna otra—
// forma de «insertar el contenido respetando la estructura» de un .docx
// arbitrario: si el documento del colegio no dice dónde va el propósito, el
// sistema no puede adivinarlo.
//
// De ahí el contrato de abajo y la plantilla de partida descargable
// (`scripts/plantilla-base.mjs`). Al subir un fichero se detectan sus
// marcadores con `patchDetector()` y se le dice a la docente cuáles faltan,
// que es mucho más útil que una miniatura.
//
// LA VALIDACIÓN NO SE FÍA DE LA EXTENSIÓN
// ---------------------------------------
// Renombrar `virus.exe` a `plantilla.docx` es trivial. Un .docx es un ZIP, y
// todo ZIP empieza por los cuatro bytes `PK\x03\x04`. Se comprueban esos
// bytes, y además que el paquete contenga `word/document.xml`, que es lo que
// distingue un .docx de un .zip cualquiera.

import { PatchType, patchDetector, patchDocument } from "docx";

/** 5 MB. El mismo tope que declara el bucket en la migración 012. */
export const MAX_PLANTILLA_BYTES = 5 * 1024 * 1024;

export const MIME_DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** Los cuatro primeros bytes de cualquier ZIP, y por tanto de cualquier .docx. */
const FIRMA_ZIP = [0x50, 0x4b, 0x03, 0x04];

/* ==========================================================================
   EL CONTRATO

   Cada marcador dice qué recibe y de qué tipo. `linea` se sustituye dentro de
   un párrafo (nombre, fecha, área); `bloque` puede traer párrafos y tablas
   enteras, así que ocupa el párrafo completo donde esté escrito.
   ========================================================================== */
export const MARCADORES = [
  { clave: "titulo", tipo: "linea", etiqueta: "Título del documento" },
  { clave: "docente", tipo: "linea", etiqueta: "Nombre del docente" },
  { clave: "ie", tipo: "linea", etiqueta: "Institución educativa" },
  { clave: "nivel", tipo: "linea", etiqueta: "Nivel" },
  { clave: "grado", tipo: "linea", etiqueta: "Grado y sección" },
  { clave: "area", tipo: "linea", etiqueta: "Área curricular" },
  { clave: "fecha", tipo: "linea", etiqueta: "Fecha" },
  { clave: "duracion", tipo: "linea", etiqueta: "Duración" },
  { clave: "region", tipo: "linea", etiqueta: "Región" },
  { clave: "datos_generales", tipo: "bloque", etiqueta: "Tabla de datos generales" },
  { clave: "propositos", tipo: "bloque", etiqueta: "Propósitos de aprendizaje" },
  { clave: "desempenos", tipo: "bloque", etiqueta: "Desempeños precisados" },
  { clave: "criterios", tipo: "bloque", etiqueta: "Criterios de evaluación" },
  { clave: "enfoques", tipo: "bloque", etiqueta: "Enfoques transversales" },
  { clave: "secuencia", tipo: "bloque", etiqueta: "Secuencia didáctica" },
  { clave: "dua", tipo: "bloque", etiqueta: "Orientaciones DUA" },
  { clave: "anexos", tipo: "bloque", etiqueta: "Anexos" },
];

/** Los que de verdad hacen falta para que el documento sirva de algo. */
export const MARCADORES_MINIMOS = ["titulo", "secuencia"];

export const clavesDeMarcadores = () => MARCADORES.map((m) => m.clave);

/* ==========================================================================
   VALIDACIÓN
   ========================================================================== */

/**
 * ¿Este fichero es una plantilla .docx aceptable?
 *
 * @param {{name:string, size:number, type?:string}} fichero
 * @param {ArrayBuffer|Uint8Array} [bytes] contenido, para mirar la firma
 * @returns {{ok:boolean, error?:string}}
 */
export function validarPlantilla(fichero, bytes = null) {
  if (!fichero) return { ok: false, error: "Elige un archivo para subir." };

  const nombre = String(fichero.name || "");
  if (!/\.docx$/i.test(nombre)) {
    return { ok: false, error: "El archivo debe ser un .docx de Word. Si tienes un .doc o un PDF, ábrelo en Word y guárdalo como .docx." };
  }
  if (fichero.type && fichero.type !== MIME_DOCX) {
    return { ok: false, error: "Ese archivo no parece un documento de Word. Vuelve a guardarlo como .docx desde Word." };
  }
  if (!Number.isFinite(fichero.size) || fichero.size <= 0) {
    return { ok: false, error: "El archivo está vacío." };
  }
  if (fichero.size > MAX_PLANTILLA_BYTES) {
    const mb = (fichero.size / 1048576).toFixed(1);
    return { ok: false, error: `La plantilla pesa ${mb} MB y el máximo son 5 MB. Suele bastar con comprimir las imágenes del documento.` };
  }
  if (bytes) {
    const vista = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    const esZip = FIRMA_ZIP.every((byte, i) => vista[i] === byte);
    if (!esZip) {
      return { ok: false, error: "El archivo no se puede abrir como documento de Word. Vuelve a guardarlo desde Word como .docx." };
    }
  }
  return { ok: true };
}

/**
 * Los marcadores que trae el fichero.
 *
 * Devuelve `[]` si el .docx no se puede abrir: quien llama decide si eso es un
 * error o simplemente una plantilla sin marcadores.
 */
export async function detectarMarcadores(bytes) {
  try {
    const encontrados = await patchDetector({ data: bytes });
    return Array.isArray(encontrados) ? encontrados : [];
  } catch {
    return [];
  }
}

/** Qué le falta a esta plantilla para servir. */
export function marcadoresFaltantes(detectados = []) {
  return MARCADORES_MINIMOS.filter((clave) => !detectados.includes(clave));
}

/** ¿Es utilizable? Un .docx sin ningún marcador daría el documento en blanco. */
export function plantillaUtilizable(detectados = []) {
  return marcadoresFaltantes(detectados).length === 0;
}

/* ==========================================================================
   RELLENO
   ========================================================================== */

/**
 * Convierte los bloques ya construidos por `lib/docx/` en parches.
 *
 * El contenido NO se vuelve a maquetar: son los mismos párrafos y tablas que
 * produce la maqueta de Nitia, colocados dentro del documento del colegio. Así
 * una tabla de criterios sigue siendo una tabla de Word, no texto pegado.
 *
 * @param {Record<string,string>} lineas    marcador → texto
 * @param {Record<string,Array>} bloques    marcador → hijos de `docx`
 */
export function construirPatches({ lineas = {}, bloques = {} }, TextRunClase) {
  const patches = {};
  for (const [clave, valor] of Object.entries(lineas)) {
    if (valor == null || valor === "") continue;
    patches[clave] = { type: PatchType.PARAGRAPH, children: [new TextRunClase({ text: String(valor) })] };
  }
  for (const [clave, hijos] of Object.entries(bloques)) {
    if (!Array.isArray(hijos) || !hijos.length) continue;
    patches[clave] = { type: PatchType.DOCUMENT, children: hijos };
  }
  return patches;
}

/**
 * Rellena la plantilla del colegio y devuelve el .docx final.
 *
 * Un marcador declarado en la plantilla que no reciba contenido se queda como
 * está; `patchDocument` sólo toca los que se le pasan. Por eso conviene avisar
 * de los que faltan al subirla y no al exportar.
 */
export async function rellenarPlantilla({ data, patches, outputType = "blob" }) {
  return patchDocument({ outputType, data, patches, keepOriginalStyles: true });
}

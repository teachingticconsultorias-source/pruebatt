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
/**
 * ¿Estos bytes empiezan como un .docx?
 *
 * Todo .docx es un ZIP y todo ZIP empieza por `PK`. Se usa al VALIDAR
 * una subida y también al LEER lo que haya guardado: la ruta de la plantilla es
 * texto en una fila que el propio docente puede escribir, así que lo que
 * apunte no tiene por qué ser un documento de Word.
 */
export function pareceDocx(bytes) {
  if (!bytes) return false;
  const vista = new Uint8Array(bytes instanceof ArrayBuffer ? bytes : bytes.buffer ?? bytes);
  return vista.length > 4 && FIRMA_ZIP.every((byte, i) => vista[i] === byte);
}

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

/* ==========================================================================
   LA VALIDACIÓN DE VERDAD: UN PARCHEO DE PRUEBA

   `patchDetector()` dice que el texto `{{secuencia}}` existe en algún sitio del
   XML. No dice que sea SUSTITUIBLE, y son cosas distintas:

     · un marcador de bloque (`PatchType.DOCUMENT`) sustituye el párrafo
       entero donde vive, así que tiene que estar SOLO en su párrafo o celda;
     · si está pegado a texto explicativo —«Tabla de datos {{datos_generales}}»—
       el parche no se aplica y `patchDocument` no protesta: devuelve el
       documento con el `{{...}}` literal dentro;
     · Word puede haber partido «{{secuencia}}» en varios runs con distinto
       formato, y entonces el detector tampoco lo encuentra entero.

   La única comprobación fiable es hacer el trabajo: parchear con contenido de
   prueba y mirar si el marcador sobrevivió. Es rápido —el .docx ya está en
   memoria— y se hace UNA vez, al subir, en vez de descubrirlo cada vez que la
   docente exporta.
   ========================================================================== */

/** Un texto improbable, para reconocer lo que sí se sustituyó. */
const SONDA = "__SCIVERSE_SONDA__";

/**
 * Qué marcadores de esta plantilla se pueden sustituir DE VERDAD.
 *
 * @param {ArrayBuffer|Uint8Array} bytes
 * @param {string[]} candidatos  los detectados por `patchDetector`
 * @returns {Promise<{patcheables:string[], rotos:string[]}>}
 */
export async function comprobarPatcheables(bytes, candidatos, dependencias = {}) {
  const { Paragraph, TextRun: Run } = dependencias;
  if (!candidatos?.length) return { patcheables: [], rotos: [] };

  const tipoDe = (clave) => MARCADORES.find((m) => m.clave === clave)?.tipo || "linea";
  const patches = {};
  for (const clave of candidatos) {
    patches[clave] = tipoDe(clave) === "bloque"
      // Un párrafo de prueba: si el marcador no está solo en el suyo, el
      // parche de bloque no se aplica y el `{{...}}` sigue ahí.
      ? { type: PatchType.DOCUMENT, children: [new Paragraph({ children: [new Run({ text: `${SONDA}${clave}` })] })] }
      : { type: PatchType.PARAGRAPH, children: [new Run({ text: `${SONDA}${clave}` })] };
  }

  let xml = "";
  try {
    const salida = await patchDocument({ outputType: "uint8array", data: bytes, patches, keepOriginalStyles: true });
    xml = await textoDelDocumento(salida);
  } catch {
    // Si el parcheo revienta entero, ninguno es fiable.
    return { patcheables: [], rotos: [...candidatos] };
  }

  const patcheables = [], rotos = [];
  for (const clave of candidatos) {
    // Sobrevivió el marcador → no se sustituyó. Llegó la sonda → sí.
    const quedaLiteral = xml.includes(`{{${clave}}}`);
    (quedaLiteral || !xml.includes(`${SONDA}${clave}`) ? rotos : patcheables).push(clave);
  }
  return { patcheables, rotos };
}

/** El `word/document.xml` de un .docx en memoria, como texto. */
async function textoDelDocumento(bytes) {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(bytes);
  return zip.file("word/document.xml").async("string");
}

/**
 * Marcadores de bloque que COMPARTEN párrafo con otro texto.
 *
 * Medido sobre `docx@9.7.1`: `PatchType.DOCUMENT` no falla en ese caso —
 * reemplaza el PÁRRAFO ENTERO y descarta lo que hubiera al lado—. Así que el
 * riesgo no es que el marcador sobreviva, sino que la docente pierda en
 * silencio el texto que había escrito junto a él, y cualquier marcador de
 * línea que compartiera ese párrafo.
 *
 * Por eso se comprueba y se avisa: no es un fallo técnico, es una pérdida de
 * contenido que sólo se descubriría comparando el documento con la plantilla.
 */
export async function marcadoresConTextoAlLado(bytes) {
  let xml = "";
  try { xml = await textoDelDocumento(bytes); } catch { return []; }

  const deBloque = new Set(MARCADORES.filter((m) => m.tipo === "bloque").map((m) => m.clave));
  const afectados = new Set();

  for (const parrafo of xml.match(/<w:p[ >][\s\S]*?<\/w:p>/g) || []) {
    const texto = [...parrafo.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join("");
    const marcas = [...texto.matchAll(/\{\{([a-z_]+)\}\}/g)].map((m) => m[1]);
    const bloques = marcas.filter((clave) => deBloque.has(clave));
    if (!bloques.length) continue;
    // Lo que queda del párrafo al quitar TODAS sus marcas.
    const resto = texto.replace(/\{\{[a-z_]+\}\}/g, "").trim();
    if (resto || marcas.length > bloques.length || bloques.length > 1) {
      for (const clave of bloques) afectados.add(clave);
    }
  }
  return [...afectados];
}

/**
 * El aviso concreto para un marcador que la sonda no consigue sustituir.
 *
 * QUÉ DETECTA ESTO DE VERDAD
 * -------------------------
 * El texto decía que Word «parte la marca en trozos» y que por eso deja de
 * reconocerse. Se midió y NO es así: `docx@9.7.1` resuelve una marca partida en
 * varios `<w:r>` —con formatos distintos, con las llaves sueltas, con tres
 * trozos— y la sustituye igual. Prometer protección contra eso era prometer de
 * más.
 *
 * Lo que la sonda sí caza es un fichero cuyo XML no se deja parchear: un .docx
 * generado por una herramienta que escribe OOXML no estándar, un paquete
 * corrupto, o una marca dentro de una parte del documento que `patchDocument`
 * no recorre (cuadros de texto, notas al pie, contenido incrustado).
 */
export function explicarMarcadorRoto(clave) {
  return `No pudimos colocar contenido en la marca {{${clave}}}: está en una parte del documento que no sabemos rellenar —un cuadro de texto, una nota al pie o un objeto incrustado— o el fichero tiene el formato dañado. Escríbela directamente en el cuerpo del documento y vuelve a guardar desde Word.`;
}

/** El aviso para un marcador de bloque que comparte párrafo con otro texto. */
export function explicarMarcadorCompartido(clave) {
  return `La marca {{${clave}}} debe estar SOLA en su propio párrafo o celda. Ahí se coloca una tabla completa, así que al rellenarla se borraría el texto que tienes a su lado.`;
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
 * produce la maqueta de SciVerse, colocados dentro del documento del colegio. Así
 * una tabla de criterios sigue siendo una tabla de Word, no texto pegado.
 *
 * @param {Record<string,string>} lineas    marcador → texto
 * @param {Record<string,Array>} bloques    marcador → hijos de `docx`
 */
export function construirPatches({ lineas = {}, bloques = {} }, TextRunClase, ParagraphClase = null) {
  const patches = {};

  // TODOS los marcadores declarados reciben parche, incluidos los que no
  // tienen contenido.
  //
  // `patchDocument` sólo toca los que se le pasan: un marcador declarado y no
  // parcheado se queda LITERAL en el documento de la docente. Le pasaría a una
  // sesión sin anexos, a un proyecto STEAM —que sólo llena `secuencia`— o a
  // cualquier plantilla que declare más marcas de las que ese tipo de
  // documento usa. Se vacían, que es lo que la docente espera de una sección
  // que no aplica.
  for (const { clave, tipo } of MARCADORES) {
    if (tipo === "linea") {
      const valor = lineas[clave];
      patches[clave] = { type: PatchType.PARAGRAPH,
        children: [new TextRunClase({ text: valor == null ? "" : String(valor) })] };
      continue;
    }
    const hijos = bloques[clave];
    if (Array.isArray(hijos) && hijos.length) {
      patches[clave] = { type: PatchType.DOCUMENT, children: hijos };
    } else if (ParagraphClase) {
      // Un bloque vacío deja un párrafo en blanco: `patchDocument` no sabe
      // eliminar el párrafo del marcador, sólo sustituirlo.
      patches[clave] = { type: PatchType.DOCUMENT,
        children: [new ParagraphClase({ children: [new TextRunClase({ text: "" })] })] };
    }
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

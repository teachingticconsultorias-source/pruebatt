import { p, title, subtitle, seccion, heading, barraMomento, subtitulo, destacado,
  vinieta, table, tablaEtiquetas, tablaDatos, widths, section, documentFrom,
  contentWidth, answerSpace, textBlocks, clean, filename, download, pageBreak,
  fijarMarcaDeDocumento } from "./core.js";
import { ANCHOS, COLOR, TAMANO, aplicarMarca, restablecerMarca } from "./tema.js";
import { admitePlantilla, coloresDe, marcaSinPlantilla } from "../export/marca.js";
import { construirPatches, rellenarPlantilla } from "../export/plantilla.js";
import { Paragraph, TextRun } from "docx";
import { sessionBloques, sessionChildren, sessionSections, tablaRubrica } from "./plantillas/sesion.js";
import { projectChildren, projectSections } from "./plantillas/steam.js";
import { labGuideChildren, labGuideSections } from "./plantillas/laboratorio.js";

export const LABELS = { session: "Sesión de aprendizaje", project: "Proyecto STEAM", rubric: "Rúbrica",
  checklist: "Lista de cotejo", rating_scale: "Escala de valoración", worksheet: "Ficha de trabajo",
  reading: "Ficha de lectura", challenge: "Reto grupal", wordsearch: "Sopa de letras",
  observation_guide: "Guía de observación", questionnaire: "Cuestionario",
  lab_guide: "Guía de laboratorio", complete: "Clase completa" };

/**
 * Orientación de un documento.
 *
 * Las 25 plantillas oficiales son verticales, incluida su rúbrica de cinco
 * columnas. Así que la horizontal deja de ser la norma de los instrumentos y
 * queda sólo donde el contenido lo exige de verdad: el registro nominal de
 * cotejo y escala —una columna por criterio más los nombres— y la sopa grande.
 */
export function orientationFor(type, { columns = 0, gridSize = 0 } = {}) {
  return columns > 4 || (type === "wordsearch" && gridSize >= 18) ? "landscape" : "portrait";
}
const list = value => value == null ? [] : Array.isArray(value) ? value : [value];
const label = key => ({ desempenosPrecisados: "Desempeños precisados", preguntasMediacion: "Preguntas de mediación",
  evidenciaObservable: "Evidencia observable", adaptacionesDUA: "Apoyos DUA", propositoOrganizacion: "Propósito y organización",
  evaluacionFormativa: "Evaluación formativa", acompanamiento: "Acompañamiento", metacognicion: "Metacognición",
  metodologia: "Metodología", motivacion: "Motivación", problematizacion: "Problematización", descripcion: "Descripción",
  mensajeLogro: "Mensaje de logro", criteriosCompartidos: "Criterios compartidos", saberesPrevios: "Saberes previos",
  actitudObservable: "Actitud observable", condicionExito: "Condición de éxito", situacionSignificativa: "Situación significativa",
  productoEsperado: "Producto esperado", actividadCentral: "Actividad central", rutaSemanas: "Ruta de trabajo",
  proposito: "Propósito", titulo: "Título", competencia: "Competencia", criterios: "Criterios", reflexion: "Reflexión",
  numero: "Número", duracion: "Duración", sesion: "Sesión", area: "Área" }[key] ||
  key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ").replace(/^./, c => c.toUpperCase()));

// Conserva el texto de campos anidados; no serializa objetos a JSON ni cambia
// los criterios. Los nombres técnicos de transporte no pertenecen al papel.
export function blocks(value, depth = 0) {
  if (value == null || value === "") return [];
  if (typeof value !== "object") return textBlocks(value);
  if (Array.isArray(value)) return value.flatMap(v => typeof v === "object"
    ? blocks(v, depth + 1) : [vinieta(v)]);
  return Object.entries(value).filter(([k, v]) => v != null && !["id", "tipo", "type", "model", "_credits", "minutos"].includes(k))
    .flatMap(([k, v]) => {
      if (["titulo", "subtitulo"].includes(k)) return [subtitulo(v, { color: COLOR.navy })];
      if (["descripcion", "contenido", "texto"].includes(k)) return blocks(v, depth + 1);
      if (typeof v !== "object") return [p(`**${label(k)}:** ${clean(v)}`, { size: TAMANO.cuerpo, spacing: { after: 80 } })];
      return [depth < 1 ? seccion(label(k)) : subtitulo(label(k), { color: COLOR.navy }), ...blocks(v, depth + 1)];
    });
}
function block(name, value) { return value == null || value === "" || (Array.isArray(value) && !value.length) ? [] : [seccion(name), ...blocks(value)]; }

function teacherInfo(form = {}, profile = {}, orientation = "portrait") {
  const teacher = profile.nombre || [profile.nombres, profile.apellidos].filter(Boolean).join(" ") || form.docente || "";
  return tablaEtiquetas([["Docente", teacher, "IE", profile.ie || form.institucion || ""],
    ["Nivel", form.nivel || "", "Grado y sección", [form.grado, form.seccion].filter(Boolean).join(" · ")],
    ["Área", form.area || "", "Fecha", form.fecha || ""],
    ["Duración", form.duracion ? `${form.duracion}${/^\d+$/.test(String(form.duracion)) ? " minutos" : ""}` : form.duracionSemanas ? `${form.duracionSemanas} semanas` : "", "Región", form.region || ""]],
  widths(ANCHOS.datosGenerales, contentWidth(orientation)));
}
/** Cabecera del estudiante: los datos que rellena a mano antes de empezar. */
function studentInfo(form = {}) {
  return tablaEtiquetas([["Nombre y apellidos", ""], ["Grado y sección", [form.grado, form.seccion].filter(Boolean).join(" · ")],
    ["Fecha", form.fecha || ""], ["Área", form.area || ""], ["Tema", form.tema || ""]],
  widths(ANCHOS.etiquetaValor));
}
function learning(form, r) {
  const filas = [["Propósito", r.proposito || form.proposito],
    ["Competencia", clean(r.competencia || r.competenciasCNEB || form.competencia)],
    ["Capacidades", list(r.capacidades || r.capacidadesCNEB || form.capacidades).map(vinieta)],
    ["Evidencia", r.evidencia || form.evidencia]]
    .filter(([, v]) => v != null && v !== "" && !(Array.isArray(v) && !v.length));
  return filas.length ? [seccion("Propósitos de aprendizaje"), tablaEtiquetas(filas)] : [];
}

function criteriaOf(r) { return list(r.criterios || r.indicadores).map(c => typeof c === "string" ? { criterio: c } : c); }
function instrumentSections(type, { form = {}, resource: r = {}, profile = {}, students }) {
  const criteria = criteriaOf(r), total = contentWidth("landscape");
  const meta = { tipo: LABELS[type], area: form.area };
  const intro = [title(LABELS[type].toUpperCase()), subtitle(r.titulo || form.tema || ""),
    seccion("Datos generales"), teacherInfo(form, profile),
    ...learning(form, { ...r, capacidades: [...new Set([
      ...list(r.capacidades || form.capacidades), ...criteria.map(c => c.capacidad).filter(Boolean)])] }),
    ...block("Indicaciones", r.indicaciones || r.instrucciones)];

  if (type === "rubric") {
    // Vertical, como la plantilla: sus cinco columnas caben en A4 sin reducir
    // la letra. La fila puede partirse entre páginas —descriptor largo— y la
    // cabecera se repite, que es lo que evita leer una tabla a ciegas.
    return [section([...intro, seccion("Rúbrica analítica de evaluación"),
      tablaRubrica(criteria.length ? criteria : [{ criterio: "" }])], "portrait", meta)];
  }

  intro.push(seccion("Criterios de evaluación"), ...criteria.flatMap((c, i) => [
    p(`**C${i + 1}.** ${clean(c.criterio || c.indicador)}`, { size: TAMANO.cuerpo, keepLines: true, spacing: { after: 40 } }),
    ...(c.capacidad ? [p(clean(c.capacidad), { italics: true, size: TAMANO.nota, color: COLOR.auxiliar })] : [])]));

  if (type === "observation_guide") return [section([...intro,
    ...block("Situación de observación", r.situacionObservacion),
    tablaDatos(["Aspecto", "Indicador observable", "Registro / observaciones"],
      criteria.map(c => [c.aspecto, c.indicador || c.criterio, ""]), widths([1, 2, 2]))], "portrait", meta)];

  const names = Array.isArray(students) ? students : Array.from({ length: Number(students || form.numeroEstudiantes || (type === "checklist" ? 30 : 25)) }, () => "");
  const sections = [section(intro, "portrait", meta)];
  // Máximo seis criterios por tabla: se repite el registro en otro bloque
  // horizontal si hay más. Ningún criterio se recorta ni se reduce la fuente.
  for (let offset = 0; offset < Math.max(criteria.length, 1); offset += 6) {
    const group = criteria.slice(offset, offset + 6);
    const columnWidths = widths([0.5, 3, ...group.map(() => 1)], total);
    const legend = type === "checklist" ? "Marque Sí o No en cada criterio." : "S = Siempre · AV = A veces · NH = No lo hace · NO = No observado";
    const rows = names.map((name, i) => [String(i + 1), clean(name), ...group.map(() => type === "checklist" ? "☐ Sí   ☐ No" : "")]);
    sections.push(section([seccion(`Registro de estudiantes${criteria.length > 6 ? ` · C${offset + 1}–C${offset + group.length}` : ""}`),
      p(legend, { keepNext: true, size: TAMANO.cuerpo }),
      // Conserva escalas personalizadas generadas sin reescribir sus niveles.
      ...(type === "rating_scale" && r.niveles?.length ? [p(`Niveles del instrumento: ${clean(r.niveles)}`, { keepNext: true, size: TAMANO.cuerpo })] : []),
      // Aquí SÍ tiene sentido `cantSplit`: una fila es un número, un nombre y
      // unas casillas. Partirla por la mitad sería un error de maquetación.
      tablaDatos(["Nº", "Apellidos y nombres", ...group.map((_, i) => `C${offset + i + 1}`)], rows, columnWidths,
        { rowHeight: 320, cantSplit: true })], "landscape", meta));
  }
  return sections;
}

function questions(items, start = 0) {
  return list(items).flatMap((q, i) => {
    if (typeof q === "string") q = { pregunta: q };
    return [...block("Lectura", q.textoLectura),
      p(`**${start + i + 1}.** ${clean(q.pregunta || q.texto)}`, { size: TAMANO.cuerpo, keepNext: true, spacing: { after: 60 } }),
      ...list(q.opciones).map((o, j) => p(`${String.fromCharCode(65 + j)}. ${clean(o)}`, { size: TAMANO.cuerpo, keepNext: true, spacing: { after: 40 } })),
      ...(q.tipo === "verdadero_falso" ? [p("☐ Verdadero     ☐ Falso", { size: TAMANO.cuerpo })] : answerSpace(q.tipo === "respuesta_larga" || q.nivel === "critico" ? 4 : 3))];
  });
}
function worksheetSections({ form = {}, resource: r = {} }) {
  let number = 0;
  const meta = { tipo: "Ficha de trabajo", area: form.area };
  const sections = [];
  let children = [title("FICHA DE TRABAJO"), subtitle(r.titulo || form.tema || ""),
    seccion("Datos del estudiante"), studentInfo(form),
    ...block("Propósito", r.propositoEstudiante || r.proposito),
    ...(r.instrucciones || r.indicacionGeneral ? [destacado(`**Instrucciones:** ${clean(r.instrucciones || r.indicacionGeneral)}`)] : [])];
  for (const s of list(r.secciones)) {
    children.push(seccion(s.titulo), ...blocks(s.indicacion || s.instrucciones));
    for (const a of list(s.actividades || s.items)) {
      if (a.tipo === "texto") children.push(...blocks(a.texto));
      else if (a.tipo === "tabla") {
        const cols = list(a.columnas);
        const caption = p(`**${++number}.** ${clean(a.texto)}`, { size: TAMANO.cuerpo, keepNext: true });
        const orientation = orientationFor("worksheet", { columns: cols.length });
        const rows = a.filas?.length ? a.filas : Array.from({ length: 3 }, () => cols.map(() => ""));
        if (orientation === "landscape") {
          if (children.length) sections.push(section(children, "portrait", meta));
          sections.push(section([caption, tablaDatos(cols, rows, widths(cols.map(() => 1), contentWidth(orientation)), { rowHeight: 650 })], orientation, meta));
          children = [];
        } else {
          children.push(caption);
          if (cols.length) children.push(tablaDatos(cols, rows, widths(cols.map(() => 1)), { rowHeight: 650 }));
        }
      } else if (["lista", "pasos"].includes(a.tipo)) {
        children.push(p(`**${++number}.** ${clean(a.texto)}`, { size: TAMANO.cuerpo, keepNext: true }),
          ...list(a.opciones).map((v, i) => p(`${i + 1}) ${clean(v)}`, { size: TAMANO.cuerpo })));
      } else children.push(...questions([a], number++));
    }
  }
  children.push(...questions(r.preguntas, number));
  if (r.metacognicion?.length) children.push(seccion("Reflexionamos"), ...questions(r.metacognicion));
  if (r.cierre) children.push(seccion(r.cierre.titulo || "Reflexionamos"), ...questions(r.cierre.preguntas));
  if (children.length) sections.push(section(children, "portrait", meta));
  return sections;
}
function readingSections({ form = {}, resource: r = {} }) {
  const children = [title("FICHA DE LECTURA"), subtitle(r.titulo || form.tema || ""),
    seccion("Datos del estudiante"), studentInfo(form),
    seccion("ANTES DE LEER"), ...(r.proposito ? [destacado(`**Propósito:** ${clean(r.proposito)}`)] : []),
    ...blocks(r.antesDeLeer || r.antesLectura),
    seccion("TEXTO"), ...textBlocks(r.texto), ...block("Vocabulario", r.vocabulario), seccion("DESPUÉS DE LEER")];
  let n = 0;
  for (const [level, name] of [["literal", "Literal"], ["inferencial", "Inferencial"], ["critico", "Crítica"]]) {
    const group = list(r.preguntas).filter(q => (q.nivel || "literal").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() === level);
    if (group.length) { children.push(subtitulo(name, { color: COLOR.navy }), ...questions(group, n)); n += group.length; }
  }
  const other = list(r.preguntas).filter(q => q.nivel && !["literal", "inferencial", "critico", "crítico"].includes(q.nivel));
  children.push(...questions(other, n), ...block("Reflexión", r.reflexion || r.despuesDeLeer));
  return [section(children, "portrait", { tipo: "Ficha de lectura", area: form.area })];
}
function challengeSections({ resource: r = {}, form = {} }) {
  const datos = [["Área", clean(r.area || form.area)], ["Duración", clean(r.duracion)],
    ["Equipo", clean(r.equipo || r.teamSize)], ["Competencia", clean(r.competencia)]]
    .filter(([, v]) => v);
  return [section([title("RETO GRUPAL"), subtitle(r.titulo || r.title || ""),
    ...(datos.length ? [seccion("Datos del reto"), tablaEtiquetas(datos)] : []),
    ...block("Capacidades", r.capacidades),
    ...block("Misión", r.mision), ...block("Objetivo", r.objetivo),
    ...block("Roles", r.roles), ...block("Producto", r.producto),
    ...block("Materiales", r.materiales), ...block("Preparación", r.preparacion),
    seccion("Pasos"), ...list(r.pasos).map((v, i) => p(`**${i + 1}.** ${clean(v)}`, { size: TAMANO.cuerpo, keepLines: true })),
    ...block("Condición de éxito", r.condicionExito || r.condicion), ...block("Variante", r.variante || r.variacion),
    ...block("Reglas", r.reglas), ...block("Criterios", r.criterios), ...block("Preguntas para reflexionar", r.preguntas),
    ...block("Apoyos DUA", r.adaptacionesDUA)], "portrait", { tipo: "Reto grupal", area: r.area || form.area })];
}

const VECTORS = { horizontal: [0, 1], horizontal_back: [0, -1], vertical: [1, 0], vertical_back: [-1, 0],
  diagonal: [1, 1], diagonal_back: [-1, -1], diagonal2: [1, -1], diagonal2_back: [-1, 1] };
function wordsearchSections({ resource: r = {}, form = {} }) {
  const grid = r.gridData?.grid || r.cuadricula || [], size = grid.length;
  if (!size) throw new Error("No hay cuadrícula para exportar.");
  const orientation = orientationFor("wordsearch", { gridSize: size });
  const meta = { tipo: "Sopa de letras", area: form.area };
  // La altura imprimible limita la cuadrícula horizontal; se reserva espacio
  // para título e instrucciones. Celdas de 10 pt como mínimo, sin deformarlas.
  const side = Math.min(430, Math.floor((orientation === "landscape" ? 6900 : 9500) / size));
  const found = new Set();
  for (const w of r.gridData?.placedWords || r.solucionario || []) {
    const [dr, dc] = VECTORS[w.direction || w.direccion] || [0, 1];
    for (let i = 0; i < (w.word || w.palabra || "").length; i++) found.add(`${(w.row ?? w.fila) + dr * i},${(w.col ?? w.columna) + dc * i}`);
  }
  // La cuadrícula es la única excepción legítima a las alturas exactas: una
  // celda de sopa tiene que ser cuadrada o las letras dejan de alinearse.
  const gridTable = solved => table(null, grid.map((row, y) => row.map((c, x) => p(c, {
    bold: solved && found.has(`${y},${x}`), shading: solved && found.has(`${y},${x}`) ? { fill: COLOR.fondo } : undefined,
    size: TAMANO.nota, alignment: "center", color: solved && found.has(`${y},${x}`) ? COLOR.navy : undefined,
    spacing: { before: 0, after: 0, line: 220 } }))),
    Array(size).fill(side), { rowHeight: side, exact: true, grid: true, repeatHeader: false });
  return [section([title("SOPA DE LETRAS"), subtitle(r.titulo || ""),
    destacado(`**Palabras:** ${clean(r.palabras)}`), gridTable(false),
    pageBreak(), title("SOLUCIONARIO · Para el docente"), subtitle(r.titulo || ""), gridTable(true),
    destacado(`**Palabras:** ${clean(r.palabras)}`)], orientation, meta)];
}

export function buildSections(type, options = {}) {
  type = type.replace(/-/g, "_");
  if (["rubric", "checklist", "rating_scale", "observation_guide"].includes(type)) return instrumentSections(type, options);
  if (type === "session") return sessionSections(options);
  if (type === "project" || type === "project_steam") return projectSections(options);
  if (type === "lab_guide") return labGuideSections(options);
  if (type === "reading") return readingSections(options);
  if (type === "worksheet" || type === "questionnaire") return worksheetSections(options);
  if (type === "challenge") return challengeSections(options);
  if (type === "wordsearch") return wordsearchSections(options);
  return [section([title(clean(options.resource?.titulo) || LABELS[type] || "Documento SciVerse"), ...blocks(options.resource)],
    "portrait", { tipo: LABELS[type] || "Documento", area: options.form?.area })];
}
/**
 * Arma el documento con la marca del docente, si la tiene.
 *
 * La marca se aplica ANTES de construir las secciones y se deshace después,
 * pase lo que pase: un documento que fallara a medias no puede dejar los
 * colores del colegio pegados al siguiente, que quizá sea de otra docente en
 * otra pestaña.
 */
export function buildDocument(type, options = {}) {
  // El tipo importa: en modo «plantilla», un STEAM no va a la plantilla del
  // colegio —ver TIPOS_CON_PLANTILLA— y por tanto sí tiene que recoger sus
  // colores. Sin pasarlo, `coloresDe` devolvía null y ese documento salía sin
  // marca ninguna: ni plantilla, ni logo, ni colores.
  aplicarMarca(coloresDe(options.marca, { puedePlantilla: options.puedePlantilla, tipo: type }));
  fijarMarcaDeDocumento(options.marca || null);
  try {
    return documentFrom(buildSections(type, options), options.resource?.titulo || LABELS[type]);
  } finally {
    restablecerMarca();
    fijarMarcaDeDocumento(null);
  }
}

/**
 * Clase completa: un solo documento con sesión, instrumento y material.
 *
 * LA RÚBRICA NO SE IMPRIME DOS VECES
 * ----------------------------------
 * La plantilla oficial de sesión ya reserva su ANEXO 3 para una rúbrica
 * analítica. Si el instrumento elegido en el paso 2 ES una rúbrica, se coloca
 * ahí —que es su sitio— y no se añade además como parte independiente. Con
 * cualquier otro instrumento (cotejo, escala) la parte se conserva entera:
 * nada de lo generado se pierde por esta decisión.
 */
export function buildCompleteClass({ session: sessionContext, instrument, material,
  profile = {}, marca = null, puedePlantilla = false }) {
  // La marca se aplicaba en `buildDocument`, y la clase completa no pasa por
  // ahí: se armaba sin logo y sin colores aunque el colegio los tuviera
  // puestos. Mismo patrón, mismo `finally`.
  aplicarMarca(coloresDe(marca, { puedePlantilla, tipo: "complete" }));
  fijarMarcaDeDocumento(marca);
  try {
    const rubrica = instrument?.type === "rubric" ? instrument.resource : null;
    const form = sessionContext.form || {};
    const sections = [section([title("PARTE I · SESIÓN"),
      ...sessionChildren({ form, resource: sessionContext.result, profile, rubrica })],
    "portrait", { tipo: "Clase completa", area: form.area })];

    if (instrument?.resource && !rubrica) {
      const built = buildSections(instrument.type, { form: instrument.form || form, resource: instrument.resource, profile });
      built[0].children.unshift(title("PARTE II · INSTRUMENTO"));
      sections.push(...built);
    }
    if (material?.resource) {
      const built = buildSections(material.type, { form: material.form || form, resource: material.resource, profile });
      built[0].children.unshift(title("PARTE III · MATERIAL"));
      sections.push(...built);
    }
    return documentFrom(sections, sessionContext.result.titulo);
  } finally {
    restablecerMarca();
    fijarMarcaDeDocumento(null);
  }
}

/* --------------------------------------------------------------------------
   MODO PLANTILLA PROPIA

   El contenido NO se vuelve a maquetar: son los MISMOS párrafos y tablas que
   produce la maqueta de Nitia, colocados dentro del .docx del colegio. Una
   tabla de criterios sigue siendo una tabla de Word, no texto pegado.

   Lo que cambia es dónde caen: en los marcadores `{{...}}` que la plantilla
   declara. Ver el contrato en lib/export/plantilla.js.
   -------------------------------------------------------------------------- */

/**
 * Los bloques ya construidos, repartidos por marcador.
 *
 * La maqueta DECLARA sus secciones (`sessionBloques`); aquí no se deduce nada.
 * La primera versión intentaba trocear el resultado leyendo el texto de los
 * párrafos ya construidos y fallaba en silencio: los objetos de `docx` no
 * exponen su texto así, los ocho cubos salían vacíos y los ocho marcadores de
 * bloque llegaban literales al documento de la docente.
 */
function bloquesPorMarcador(type, { resource: r = {}, form = {}, profile = {}, rubrica = null }) {
  if (type === "session" || type === "complete") {
    return sessionBloques({ form, resource: r, profile, rubrica });
  }
  // Para el resto no hay un troceado natural: el cuerpo entero va al marcador
  // `{{secuencia}}`, que es el que la plantilla base reserva para el contenido
  // principal. Ver docs/word-exportaciones.md.
  const secciones = buildSections(type, { form, resource: r, profile });
  return { secuencia: secciones.flatMap(s => s.children) };
}

/** Las líneas sueltas: nombre, fecha, área… */
function lineasDe({ resource: r = {}, form = {}, profile = {} }) {
  const docente = profile.nombre || [profile.nombres, profile.apellidos].filter(Boolean).join(" ") || form.docente || "";
  return {
    titulo: clean(r.titulo || form.tema || ""),
    docente,
    ie: profile.ie || form.institucion || "",
    nivel: form.nivel || "",
    grado: [form.grado, form.seccion].filter(Boolean).join(" · "),
    area: form.area || "",
    fecha: form.fecha || "",
    duracion: form.duracion ? `${form.duracion}${/^\d+$/.test(String(form.duracion)) ? " minutos" : ""}` : "",
    region: form.region || "",
  };
}

/**
 * Rellena el .docx del colegio con el contenido ya construido.
 *
 * EL CONTENIDO VA NEUTRO
 * ----------------------
 * Los bloques se construyen DENTRO de `aplicarMarca({ neutra: true })`: negro,
 * gris, borde automático y ningún relleno. El documento anfitrión es del
 * colegio y ya trae su identidad; lo que insertamos no puede traer otra.
 *
 * Esto no se hacía, y no bastaba con que lo hiciera `buildDocument`: la ruta
 * de plantilla no pasa por ahí. Los párrafos y tablas salían con el navy y el
 * azul de Nitia y se incrustaban tal cual en el membrete del colegio.
 */
async function rellenarConPlantilla(type, opciones) {
  const { marca } = opciones;
  aplicarMarca(coloresDe(marca, { puedePlantilla: marca?.puedePlantilla, tipo: type }));
  let patches;
  try {
    patches = construirPatches({
      lineas: lineasDe(opciones),
      bloques: bloquesPorMarcador(type, opciones),
    }, TextRun, Paragraph);
  } finally {
    restablecerMarca();
  }
  if (!Object.keys(patches).length) return null;
  return rellenarPlantilla({ data: marca.plantillaBytes, patches, outputType: "blob" });
}

/** Descarga un blob ya construido, con el mismo mecanismo que `download()`. */
function descargarBlob(blob, nombre) {
  const url = URL.createObjectURL(blob), anchor = document.createElement("a");
  anchor.href = url; anchor.download = nombre;
  document.body.appendChild(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

/* --------------------------------------------------------------------------
   QUIÉN SABE LA MARCA DEL DOCENTE

   Este módulo NO puede importar Supabase: lo usan las pruebas de OOXML, que
   corren en node sin sesión ni variables de entorno. Y enhebrar la marca por
   los doce puntos de descarga significaría que el que se olvidara exportaría
   sin ella.

   Así que se registra un resolvedor una sola vez, al arrancar la aplicación
   (`lib/export/almacen.js` → `configurarMarca`). Sin registrar, devuelve null
   y todo sale en el formato de Nitia, que es exactamente lo que deben hacer
   las pruebas y lo que debe pasar si la marca no carga.
   -------------------------------------------------------------------------- */
let resolverMarca = async () => null;

export function configurarMarca(resolvedor) {
  resolverMarca = typeof resolvedor === "function" ? resolvedor : async () => null;
}

/** La marca vigente, o null si no hay o si falla. Nunca lanza. */
async function marcaParaExportar() {
  try { return await resolverMarca(); } catch { return null; }
}

export async function downloadResource(type, resource, form = {}, profile = {}) {
  let marca = await marcaParaExportar();
  const nombre = filename(LABELS[type.replace(/-/g, "_")] || type, resource?.titulo || resource?.title || form.tema);

  // Modo «plantilla propia»: el contenido se inyecta en el .docx del colegio,
  // pero SÓLO en los tipos que el contrato de marcadores cubre de verdad. Un
  // proyecto STEAM llena uno de los ocho bloques y deja siete encabezados del
  // colegio vacíos; sale mejor con la maqueta de Nitia y su marca. Ver
  // TIPOS_CON_PLANTILLA en lib/export/marca.js.
  //
  // Si algo falla —fichero borrado, marcadores que no cuadran— se cae al
  // documento de siempre en vez de dejar a la docente sin descarga.
  if (admitePlantilla(type) && marca?.modoEfectivo === "plantilla" && marca.plantillaBytes) {
    try {
      const blob = await rellenarConPlantilla(type, { resource, form, profile, marca });
      if (blob) return descargarBlob(blob, nombre);
    } catch (error) {
      console.warn("[sciverse:export] la plantilla propia no se pudo aplicar", error?.message || error);
      // Si la plantilla falló a mitad, el repuesto lleva al menos el logo y
      // los colores del colegio. Perder las dos cosas a la vez sería castigar
      // dos veces por el mismo problema.
      marca = marcaSinPlantilla(marca);
    }
  }
  await download(buildDocument(type, { resource, form, profile, marca,
    puedePlantilla: marca?.puedePlantilla }), nombre);
}

export async function downloadCompleteClass(options) {
  let marca = await marcaParaExportar();
  const nombre = filename("Clase completa", options.session.result.titulo);

  // La clase completa también honra la plantilla del colegio. Se rellena con la
  // SESIÓN —que es su parte troceable— llevándose la rúbrica al anexo si el
  // instrumento lo es. Ver la nota sobre cobertura en docs/word-exportaciones.md.
  if (marca?.modoEfectivo === "plantilla" && marca.plantillaBytes) {
    try {
      const rubrica = options.instrument?.type === "rubric" ? options.instrument.resource : null;
      const blob = await rellenarConPlantilla("complete", {
        resource: options.session.result, form: options.session.form || {},
        profile: options.profile || {}, marca, rubrica,
      });
      if (blob) return descargarBlob(blob, nombre);
    } catch (error) {
      console.warn("[sciverse:export] la plantilla propia no se pudo aplicar", error?.message || error);
      marca = marcaSinPlantilla(marca);
    }
  }
  await download(buildCompleteClass({ ...options, marca, puedePlantilla: marca?.puedePlantilla }), nombre);
}
export async function downloadText(name, content, documentTitle = "Documento SciVerse") {
  await download(documentFrom([section([title(documentTitle), ...textBlocks(content)], "portrait",
    { tipo: documentTitle })], documentTitle), filename(name));
}

// Reexportados para quien ya los importaba de aquí.
export { projectChildren, sessionChildren, labGuideChildren, tablaRubrica, barraMomento, heading };

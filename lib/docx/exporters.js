import { p, title, heading, table, widths, section, documentFrom, contentWidth,
  answerSpace, textBlocks, clean, filename, download, pageBreak } from "./core.js";

export const LABELS = { session: "Sesión de aprendizaje", project: "Proyecto STEAM", rubric: "Rúbrica",
  checklist: "Lista de cotejo", rating_scale: "Escala de valoración", worksheet: "Ficha de trabajo",
  reading: "Ficha de lectura", challenge: "Reto grupal", wordsearch: "Sopa de letras",
  observation_guide: "Guía de observación", questionnaire: "Cuestionario", complete: "Clase completa" };
export function orientationFor(type, { columns = 0, gridSize = 0 } = {}) {
  return ["rubric", "checklist", "rating_scale"].includes(type) || columns > 4 || (type === "wordsearch" && gridSize >= 18)
    ? "landscape" : "portrait";
}
const list = value => value == null ? [] : Array.isArray(value) ? value : [value];
const label = key => ({ desempenosPrecisados: "Desempeños precisados", preguntasMediacion: "Preguntas de mediación",
  evidenciaObservable: "Evidencia observable", adaptacionesDUA: "Apoyos DUA", propositoOrganizacion: "Propósito y organización",
  evaluacionFormativa: "Evaluación formativa", acompanamiento: "Acompañamiento", metacognicion: "Metacognición",
  metodologia: "Metodología", motivacion: "Motivación", problematizacion: "Problematización", descripcion: "Descripción",
  proposito: "Propósito", titulo: "Título", competencia: "Competencia", criterios: "Criterios", reflexion: "Reflexión",
  numero: "Número", duracion: "Duración", sesion: "Sesión", area: "Área" }[key] ||
  key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ").replace(/^./, c => c.toUpperCase()));

// Conserva el texto de campos anidados; no serializa objetos a JSON ni cambia
// los criterios. Los nombres técnicos de transporte no pertenecen al papel.
export function blocks(value, depth = 0) {
  if (value == null || value === "") return [];
  if (typeof value !== "object") return textBlocks(value);
  if (Array.isArray(value)) return value.flatMap((v, i) => typeof v === "object"
    ? blocks(v, depth + 1) : [p(`• ${clean(v)}`)]);
  return Object.entries(value).filter(([k, v]) => v != null && !["id", "tipo", "type", "model", "_credits", "minutos"].includes(k))
    .flatMap(([k, v]) => {
      if (["titulo", "subtitulo"].includes(k)) return [heading(v)];
      if (["descripcion", "contenido", "texto"].includes(k)) return blocks(v, depth + 1);
      if (typeof v !== "object") return [p(`**${label(k)}:** ${clean(v)}`)];
      return [depth < 1 ? heading(label(k)) : p(label(k), { bold: true, keepNext: true }), ...blocks(v, depth + 1)];
    });
}
function block(name, value) { return value == null || value === "" || (Array.isArray(value) && !value.length) ? [] : [heading(name), ...blocks(value)]; }
function teacherInfo(form = {}, profile = {}, orientation = "portrait") {
  const teacher = profile.nombre || [profile.nombres, profile.apellidos].filter(Boolean).join(" ") || form.docente || "";
  return table(null, [["Docente", teacher, "IE", profile.ie || form.institucion || ""],
    ["Nivel", form.nivel || "", "Grado y sección", [form.grado, form.seccion].filter(Boolean).join(" · ")],
    ["Área", form.area || "", "Fecha", form.fecha || ""],
    ["Duración", form.duracion ? `${form.duracion}${/^\d+$/.test(String(form.duracion)) ? " minutos" : ""}` : form.duracionSemanas ? `${form.duracionSemanas} semanas` : "", "Región", form.region || ""]],
  widths([1.1, 2.2, 1.2, 2.2], contentWidth(orientation)));
}
function studentInfo(form = {}) {
  return table(null, [["Nombre y apellidos", ""], ["Grado y sección", [form.grado, form.seccion].filter(Boolean).join(" · ")],
    ["Fecha", form.fecha || ""], ["Área", form.area || ""], ["Tema", form.tema || ""]], widths([1, 3]), { rowHeight: 420 });
}
function learning(form, r) {
  return [...block("Propósito", r.proposito || form.proposito),
    ...block("Competencia", r.competencia || r.competenciasCNEB || form.competencia),
    ...block("Capacidades", r.capacidades || r.capacidadesCNEB || form.capacidades),
    ...block("Evidencia", r.evidencia || form.evidencia)];
}
function sessionSections({ form = {}, resource: r = {}, profile = {} }) {
  return [section([title("SESIÓN DE APRENDIZAJE"), p(r.titulo || form.tema, { bold: true, size: 26 }),
    heading("Datos generales"), teacherInfo(form, profile), heading("Propósitos de aprendizaje"), ...learning(form, r),
    ...block("Desempeños precisados", r.desempenosPrecisados),
    ...block("Criterios de evaluación", r.criteriosDetallados || r.criteriosEvaluacion),
    ...block("Enfoques transversales", r.enfoquesTransversales),
    ...block("Preparación docente", r.preparacionDocente), ...block("Materiales", r.materiales),
    heading("Secuencia didáctica"),
    ...["inicio", "desarrollo", "cierre"].flatMap(k => [heading(`${k.toUpperCase()}${r[k]?.minutos || r.tiempos?.[k] ? ` · ${r[k]?.minutos || r.tiempos[k]} minutos` : ""}`), ...blocks(r[k])]),
    ...block("Orientaciones DUA", r.orientacionesDUA), ...block("Instrumento sugerido", r.instrumentoSugerido),
    ...block("Reflexiones del docente", r.reflexionesDocente), ...block("Anexos para la clase", r.anexos)])];
}

function criteriaOf(r) { return list(r.criterios || r.indicadores).map(c => typeof c === "string" ? { criterio: c } : c); }
function instrumentSections(type, { form = {}, resource: r = {}, profile = {}, students }) {
  const criteria = criteriaOf(r), total = contentWidth("landscape");
  const intro = [title(LABELS[type].toUpperCase()), p(r.titulo || form.tema, { bold: true, size: 26 }),
    teacherInfo(form, profile), ...learning(form, { ...r, capacidades: [...new Set([
      ...list(r.capacidades || form.capacidades), ...criteria.map(c => c.capacidad).filter(Boolean)])] }),
    ...block("Indicaciones", r.indicaciones || r.instrucciones)];
  if (type === "rubric") {
    const rows = criteria.map(c => [c.criterio,
      c.inicio ?? c.c, c.enProceso ?? c.proceso ?? c.b, c.logroEsperado ?? c.esperado ?? c.a,
      c.logroDestacado ?? c.destacado ?? c.ad]);
    // Distribución equilibrada: ocho criterios no deben dejar una última
    // página con una sola fila. Se mantienen enteros todos los descriptores.
    const perPage = Math.ceil(rows.length / Math.max(1, Math.ceil(rows.length / 6)));
    const children = [];
    for (let offset = 0; offset < rows.length; offset += perPage) {
      if (offset) children.push(pageBreak());
      children.push(heading("Rúbrica de evaluación"), table(
        ["Criterio", "Inicio", "En proceso", "Logro esperado", "Logro destacado"], rows.slice(offset, offset + perPage),
        widths([1.25, 1, 1, 1, 1], total)));
    }
    return [section(intro), section(children.length ? children : [heading("Rúbrica de evaluación")], "landscape")];
  }
  intro.push(heading("Criterios de evaluación"), ...criteria.flatMap((c, i) => [p(`C${i + 1}. ${clean(c.criterio || c.indicador)}`, { keepLines: true }),
    ...(c.capacidad ? [p(c.capacidad, { italics: true })] : [])]));
  if (type === "observation_guide") return [section([...intro,
    ...block("Situación de observación", r.situacionObservacion),
    table(["Aspecto", "Indicador observable", "Registro / observaciones"], criteria.map(c => [c.aspecto, c.indicador || c.criterio, ""]), widths([1, 2, 2]))])];
  const names = Array.isArray(students) ? students : Array.from({ length: Number(students || form.numeroEstudiantes || (type === "checklist" ? 30 : 25)) }, () => "");
  const sections = [section(intro)];
  // Máximo seis criterios por tabla: se repite el registro en otro bloque
  // horizontal si hay más. Ningún criterio se recorta ni se reduce la fuente.
  for (let offset = 0; offset < Math.max(criteria.length, 1); offset += 6) {
    const group = criteria.slice(offset, offset + 6);
    const columnWidths = widths([0.5, 3, ...group.map(() => 1)], total);
    const legend = type === "checklist" ? "Marque Sí o No en cada criterio." : "S = Siempre · AV = A veces · NH = No lo hace · NO = No observado";
    const rows = names.map((name, i) => [String(i + 1), clean(name), ...group.map(() => type === "checklist" ? "☐ Sí   ☐ No" : "")]);
    sections.push(section([heading(`Registro de estudiantes${criteria.length > 6 ? ` · C${offset + 1}–C${offset + group.length}` : ""}`),
      p(legend, { keepNext: true }),
      // Conserva escalas personalizadas generadas sin reescribir sus niveles.
      ...(type === "rating_scale" && r.niveles?.length ? [p(`Niveles del instrumento: ${clean(r.niveles)}`, { keepNext: true })] : []),
      table(["Nº", "Apellidos y nombres", ...group.map((_, i) => `C${offset + i + 1}`)], rows, columnWidths, { rowHeight: 320 })], "landscape"));
  }
  return sections;
}
function questions(items, start = 0) {
  return list(items).flatMap((q, i) => {
    if (typeof q === "string") q = { pregunta: q };
    return [...block("Lectura", q.textoLectura), p(`${start + i + 1}. ${clean(q.pregunta || q.texto)}`, { bold: true, keepNext: true }),
      ...list(q.opciones).map((o, j) => p(`${String.fromCharCode(65 + j)}. ${clean(o)}`, { keepNext: true })),
      ...(q.tipo === "verdadero_falso" ? [p("☐ Verdadero     ☐ Falso")] : answerSpace(q.tipo === "respuesta_larga" || q.nivel === "critico" ? 4 : 3))];
  });
}
function worksheetSections({ form = {}, resource: r = {} }) {
  let number = 0;
  const sections = [];
  let children = [title("FICHA DE TRABAJO"), p(r.titulo, { bold: true, size: 26 }), studentInfo(form),
    ...block("Propósito", r.propositoEstudiante || r.proposito), ...block("Instrucciones", r.instrucciones || r.indicacionGeneral)];
  for (const s of list(r.secciones)) {
    children.push(heading(s.titulo), ...blocks(s.indicacion || s.instrucciones));
    for (const a of list(s.actividades || s.items)) {
      if (a.tipo === "texto") children.push(...blocks(a.texto));
      else if (a.tipo === "tabla") {
        const cols = list(a.columnas);
        const caption = p(`${++number}. ${clean(a.texto)}`, { bold: true, keepNext: true });
        const orientation = orientationFor("worksheet", { columns: cols.length });
        const rows = a.filas?.length ? a.filas : Array.from({ length: 3 }, () => cols.map(() => ""));
        if (orientation === "landscape") {
          if (children.length) sections.push(section(children));
          sections.push(section([caption, table(cols, rows, widths(cols.map(() => 1), contentWidth(orientation)), { rowHeight: 650 })], orientation));
          children = [];
        } else {
          children.push(caption);
          if (cols.length) children.push(table(cols, rows, widths(cols.map(() => 1)), { rowHeight: 650 }));
        }
      } else if (["lista", "pasos"].includes(a.tipo)) {
        children.push(p(`${++number}. ${clean(a.texto)}`, { bold: true, keepNext: true }),
          ...list(a.opciones).map((v, i) => p(`${i + 1}) ${clean(v)}`)));
      } else children.push(...questions([a], number++));
    }
  }
  children.push(...questions(r.preguntas, number));
  if (r.metacognicion?.length) children.push(heading("Reflexionamos"), ...questions(r.metacognicion));
  if (r.cierre) children.push(heading(r.cierre.titulo || "Reflexionamos"), ...questions(r.cierre.preguntas));
  if (children.length) sections.push(section(children));
  return sections;
}
function readingSections({ form = {}, resource: r = {} }) {
  const children = [title("FICHA DE LECTURA"), p(r.titulo, { bold: true, size: 26 }), studentInfo(form),
    heading("ANTES DE LEER"), ...block("Propósito", r.proposito), ...blocks(r.antesDeLeer || r.antesLectura),
    heading("TEXTO"), ...textBlocks(r.texto), ...block("Vocabulario", r.vocabulario), heading("DESPUÉS DE LEER")];
  let n = 0;
  for (const [level, name] of [["literal", "Literal"], ["inferencial", "Inferencial"], ["critico", "Crítica"]]) {
    const group = list(r.preguntas).filter(q => (q.nivel || "literal").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() === level);
    if (group.length) { children.push(heading(name), ...questions(group, n)); n += group.length; }
  }
  const other = list(r.preguntas).filter(q => q.nivel && !["literal", "inferencial", "critico", "crítico"].includes(q.nivel));
  children.push(...questions(other, n), ...block("Reflexión", r.reflexion || r.despuesDeLeer));
  return [section(children)];
}
function projectSections({ form = {}, resource: r = {}, profile = {} }) {
  return [section([title("PROYECTO STEAM"), p(r.titulo, { bold: true, size: 26 }), teacherInfo(form, profile),
    ...Object.entries(r).filter(([k]) => !["titulo", "id", "model", "_credits"].includes(k)).flatMap(([k, v]) => block(label(k), v))])];
}
function challengeSections({ resource: r = {}, form = {} }) {
  return [section([title("RETO GRUPAL"), p(r.titulo || r.title, { bold: true, size: 26 }),
    ...block("Área", r.area || form.area), ...block("Duración", r.duracion), ...block("Equipo", r.equipo || r.teamSize),
    ...block("Misión", r.mision), ...block("Objetivo", r.objetivo), ...block("Competencia", r.competencia),
    ...block("Capacidades", r.capacidades), ...block("Roles", r.roles), ...block("Producto", r.producto),
    ...block("Materiales", r.materiales), ...block("Preparación", r.preparacion), heading("Pasos"),
    ...list(r.pasos).flatMap((v, i) => [p(`${i + 1}. ${clean(v)}`, { keepLines: true })]),
    ...block("Condición de éxito", r.condicionExito || r.condicion), ...block("Variante", r.variante || r.variacion),
    ...block("Reglas", r.reglas), ...block("Criterios", r.criterios), ...block("Preguntas para reflexionar", r.preguntas),
    ...block("Apoyos DUA", r.adaptacionesDUA)])];
}
const VECTORS = { horizontal: [0, 1], horizontal_back: [0, -1], vertical: [1, 0], vertical_back: [-1, 0],
  diagonal: [1, 1], diagonal_back: [-1, -1], diagonal2: [1, -1], diagonal2_back: [-1, 1] };
function wordsearchSections({ resource: r = {} }) {
  const grid = r.gridData?.grid || r.cuadricula || [], size = grid.length;
  if (!size) throw new Error("No hay cuadrícula para exportar.");
  const orientation = orientationFor("wordsearch", { gridSize: size });
  // La altura imprimible limita la cuadrícula horizontal; se reserva espacio
  // para título e instrucciones. Celdas de 10 pt como mínimo, sin deformarlas.
  const side = Math.min(430, Math.floor((orientation === "landscape" ? 6900 : 9500) / size));
  const found = new Set();
  for (const w of r.gridData?.placedWords || r.solucionario || []) {
    const [dr, dc] = VECTORS[w.direction || w.direccion] || [0, 1];
    for (let i = 0; i < (w.word || w.palabra || "").length; i++) found.add(`${(w.row ?? w.fila) + dr * i},${(w.col ?? w.columna) + dc * i}`);
  }
  const gridTable = solved => table(null, grid.map((row, y) => row.map((c, x) => p(c, {
    bold: solved && found.has(`${y},${x}`), shading: solved && found.has(`${y},${x}`) ? { fill: "D9E4E2" } : undefined,
    size: 20, alignment: "center", spacing: { before: 0, after: 0, line: 220 } }))),
    Array(size).fill(side), { rowHeight: side, exact: true, grid: true });
  return [section([title("SOPA DE LETRAS"), p(r.titulo, { bold: true }),
    p(`Palabras: ${clean(r.palabras)}`), gridTable(false),
    pageBreak(), title("SOLUCIONARIO · Para el docente"), p(r.titulo), gridTable(true), p(`Palabras: ${clean(r.palabras)}`)], orientation)];
}

export function buildSections(type, options = {}) {
  type = type.replace(/-/g, "_");
  if (["rubric", "checklist", "rating_scale", "observation_guide"].includes(type)) return instrumentSections(type, options);
  if (type === "session") return sessionSections(options);
  if (type === "project" || type === "project_steam") return projectSections(options);
  if (type === "reading") return readingSections(options);
  if (type === "worksheet" || type === "questionnaire") return worksheetSections(options);
  if (type === "challenge") return challengeSections(options);
  if (type === "wordsearch") return wordsearchSections(options);
  return [section([title(options.resource?.titulo || LABELS[type] || "Documento SciVerse"), ...blocks(options.resource)])];
}
export function buildDocument(type, options = {}) {
  return documentFrom(buildSections(type, options), options.resource?.titulo || LABELS[type]);
}
export function buildCompleteClass({ session: sessionContext, instrument, material, profile = {} }) {
  const parts = [{ name: "PARTE I · SESIÓN", type: "session", context: sessionContext, resource: sessionContext.result }];
  if (instrument?.resource) parts.push({ name: "PARTE II · INSTRUMENTO", type: instrument.type, context: instrument, resource: instrument.resource });
  if (material?.resource) parts.push({ name: "PARTE III · MATERIAL", type: material.type, context: material, resource: material.resource });
  const sections = parts.flatMap(part => {
    const built = buildSections(part.type, { form: part.context.form || sessionContext.form, resource: part.resource, profile });
    built[0].children.unshift(title(part.name));
    return built;
  });
  return documentFrom(sections, sessionContext.result.titulo);
}
export async function downloadResource(type, resource, form = {}, profile = {}) {
  await download(buildDocument(type, { resource, form, profile }), filename(LABELS[type.replace(/-/g, "_")] || type, resource?.titulo || resource?.title || form.tema));
}
export async function downloadCompleteClass(options) {
  await download(buildCompleteClass(options), filename("Clase completa", options.session.result.titulo));
}
export async function downloadText(name, content, documentTitle = "Documento SciVerse") {
  await download(documentFrom([section([title(documentTitle), ...textBlocks(content)])], documentTitle), filename(name));
}

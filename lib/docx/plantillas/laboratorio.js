// lib/docx/plantillas/laboratorio.js
//
// LA GUÍA DE LABORATORIO, CON LA MAQUETA DEL PACK OFICIAL.
//
// Son DOS documentos en uno, separados por un salto de página, tal como están
// en PLANTILLAS/SCIVERSE/GUÍA DE LABORATORIO/:
//
//   · Ficha del Estudiante — 5 secciones, la que se fotocopia y se entrega.
//   · Guía del Docente     — 9 secciones romanas, la que se queda la docente.
//
// Van juntas porque son la MISMA práctica: comparten pregunta, materiales y
// los cinco momentos de la indagación. Word las separa en un clic para
// imprimir sólo la ficha.
//
// LO QUE SE DEJA EN BLANCO A PROPÓSITO
// ------------------------------------
// La hipótesis y las variables de la ficha del estudiante NO se generan: las
// escribe él en clase, y ése es justamente el ejercicio. La plantilla las trae
// como líneas y celdas vacías, y aquí se reproducen igual. La hipótesis modelo
// va en la guía de la docente, con su nota de que no se entrega.
//
// EL ESTÁNDAR DE APRENDIZAJE SE OMITE
// -----------------------------------
// La sección II de la guía oficial reserva una fila para la copia textual del
// estándar del ciclo. SciVerse no tiene ese dato y pedírselo al modelo sería
// invitarle a redactar normativa; se omite la fila entera, como en la sesión.

import { ANCHOS, COLOR, TAMANO } from "../tema.js";
import { answerSpace, barraMomento, clean, contentWidth, destacado, p, pageBreak,
  seccion, section, subtitle, subtitulo, table, tablaDatos, tablaEtiquetas,
  title, vinieta, widths } from "../core.js";
import { tablaRubrica } from "./sesion.js";

const lista = v => v == null ? [] : Array.isArray(v) ? v : [v];
const hay = v => v != null && v !== "" && !(Array.isArray(v) && !v.length);
const campo = (rotulo, valor, opciones = {}) => p(`**${rotulo}:** ${clean(valor)}`,
  { size: TAMANO.cuerpo, color: COLOR.navy, spacing: { after: 60 }, ...opciones });

/** Los cinco momentos, en el orden que fija la plantilla. */
export const MOMENTOS_INDAGACION = [
  "1. Problematizamos (la pregunta y la hipótesis)",
  "2. Diseñamos la estrategia (procedimiento)",
  "3. Registramos datos (tablas y gráficos)",
  "4. Analizamos y concluimos",
  "5. Evaluamos y comunicamos",
];

/* ==========================================================================
   FICHA DEL ESTUDIANTE
   ========================================================================== */

/** Casillas de verificación reales, sobre el fondo ámbar de seguridad. */
function compromisosDeSeguridad(normas) {
  const filas = normas.map(n => [p(`☐   ${clean(n)}`, { size: TAMANO.cuerpo, spacing: { after: 60 } })]);
  return table(null, filas, widths([1]), { fills: [COLOR.seguridad], cantSplit: false });
}

/**
 * Cuadrícula para el gráfico a mano.
 *
 * 16 × 8 celdas cuadradas, como el papel milimetrado de la plantilla. Es la
 * única excepción legítima a las alturas automáticas: una celda de cuadrícula
 * tiene que ser cuadrada o deja de servir para dibujar.
 */
function cuadriculaDeGrafico(columnas = 16, filas = 8) {
  const lado = Math.floor(contentWidth() / columnas);
  const vacia = () => p("", { size: TAMANO.nota, spacing: { before: 0, after: 0, line: 200 } });
  return table(null,
    Array.from({ length: filas }, () => Array.from({ length: columnas }, vacia)),
    Array(columnas).fill(lado),
    { rowHeight: lado, exact: true, grid: true, repeatHeader: false });
}

export function fichaEstudianteChildren({ form = {}, resource: r = {}, profile = {} }) {
  const kit = lista(r.materialesKit).filter(hay);
  const caseros = lista(r.materialesCaseros).filter(hay);
  const columnas = lista(r.columnasRegistro).filter(hay);
  const registro = columnas.length ? columnas : ["", "", "", ""];

  return [
    title("🔬 GUÍA DE LABORATORIO", { size: TAMANO.tituloMayor }),
    p("Ficha del Estudiante", { bold: true, size: TAMANO.nota, color: COLOR.auxiliar,
      alignment: "center", keepNext: true, spacing: { after: 60 } }),
    subtitle(r.titulo || form.tema || ""),

    seccion("📌  I. ENCABEZADO Y DATOS GENERALES"),
    tablaEtiquetas([
      ["Institución Educativa", profile.ie || form.institucion || ""],
      // Lo rellena el equipo a mano: celda vacía, nunca cuarenta guiones bajos.
      ["Integrantes del equipo", ""],
      ["Grado y sección", [form.grado, form.seccion].filter(Boolean).join(" · ")],
      ["Fecha", form.fecha || ""],
    ], widths(ANCHOS.etiquetaValor)),

    seccion("🎯  II. PROPÓSITO DE LA PRÁCTICA"),
    subtitulo("¿Qué aprenderemos hoy?", { color: COLOR.navy }),
    ...(hay(r.proposito) ? [destacado(clean(r.proposito))] : []),

    ...(hay(r.normasSeguridad) ? [seccion("⚠️  III. MIS COMPROMISOS DE SEGURIDAD"),
      compromisosDeSeguridad(lista(r.normasSeguridad).filter(hay))] : []),

    seccion("🛠️  IV. MATERIALES Y REACTIVOS"),
    subtitulo("¿Qué necesitamos?", { color: COLOR.navy }),
    tablaDatos(["Materiales del kit de laboratorio", "Materiales caseros o traídos"],
      [[kit.map(vinieta), caseros.map(vinieta)]], widths([1, 1])),

    seccion("🧪  V. PASOS PARA LA INDAGACIÓN (EL RETO CIENTÍFICO)"),

    barraMomento(MOMENTOS_INDAGACION[0]),
    ...(hay(r.preguntaIndagatoria) ? [campo("Nuestra pregunta indagatoria", r.preguntaIndagatoria)] : []),
    // La hipótesis y las variables las escribe el estudiante: van en blanco.
    p("**Nuestra hipótesis:**", { size: TAMANO.cuerpo, color: COLOR.navy, keepNext: true, spacing: { after: 60 } }),
    ...answerSpace(2),
    p("**Identificamos variables:**", { size: TAMANO.cuerpo, color: COLOR.navy, keepNext: true, spacing: { after: 100 } }),
    tablaDatos(["Variable independiente (causa)", "Variable dependiente (efecto)"],
      [["", ""]], widths([1, 1]), { rowHeight: 500 }),

    barraMomento(MOMENTOS_INDAGACION[1]),
    ...lista(r.procedimiento).filter(hay).map((paso, i) =>
      p(`${i + 1}. ${clean(paso)}`, { size: TAMANO.cuerpo, spacing: { after: 60 } })),
    p("**Dibuja aquí el montaje del experimento:**", { size: TAMANO.cuerpo, color: COLOR.navy, keepNext: true, spacing: { before: 120, after: 80 } }),
    table(null, [[p("", { spacing: { before: 0, after: 0 } })]], widths([1]), { rowHeight: 2200, cantSplit: false }),

    barraMomento(MOMENTOS_INDAGACION[2]),
    tablaDatos(registro, Array.from({ length: 4 }, () => registro.map(() => "")),
      widths(registro.map(() => 1)), { rowHeight: 420 }),
    p("**Espacio para gráfico (barras o líneas):**", { size: TAMANO.cuerpo, color: COLOR.navy, keepNext: true, spacing: { before: 180, after: 80 } }),
    cuadriculaDeGrafico(),

    barraMomento(MOMENTOS_INDAGACION[3]),
    ...(hay(r.preguntasAnalisis) ? [p("**Preguntas guía:**", { size: TAMANO.cuerpo, color: COLOR.navy, keepNext: true, spacing: { after: 60 } }),
      ...lista(r.preguntasAnalisis).filter(hay).map(vinieta)] : []),
    p("**Nuestra conclusión final:**", { size: TAMANO.cuerpo, color: COLOR.navy, keepNext: true, spacing: { before: 100, after: 60 } }),
    ...answerSpace(3),

    barraMomento(MOMENTOS_INDAGACION[4]),
    ...(hay(r.preguntasMetacognicion) ? [p("**Metacognición y autoevaluación:**", { size: TAMANO.cuerpo, color: COLOR.navy, keepNext: true, spacing: { after: 60 } }),
      ...lista(r.preguntasMetacognicion).filter(hay).map(vinieta)] : []),
    ...answerSpace(2),
  ];
}

/* ==========================================================================
   GUÍA DEL DOCENTE
   ========================================================================== */
export function guiaDocenteChildren({ form = {}, resource: r = {}, profile = {} }) {
  const g = r.guiaDocente || {};
  const docente = profile.nombre || [profile.nombres, profile.apellidos].filter(Boolean).join(" ") || form.docente || "";
  const capacidades = lista(form.capacidades).filter(hay);
  const criterios = lista(g.criterios).filter(hay);
  const enfoques = lista(g.enfoquesTransversales).filter(hay);
  const gestion = lista(g.gestionTiempo).filter(f => hay(f?.momento));
  const rubrica = lista(g.rubrica).filter(c => hay(c?.criterio));

  // Sin «Estándar de aprendizaje»: ver la cabecera de este fichero.
  const vinculo = [
    ["Competencia", clean(form.competencia)],
    ["Capacidades", capacidades.length ? capacidades.map(vinieta) : ""],
    ["Desempeño precisado", clean(g.desempenoPrecisado)],
    ["Evidencia de aprendizaje", clean(g.evidencia)],
    ["Criterios de evaluación", criterios.length ? criterios.map(vinieta) : ""],
    ["Enfoques transversales", enfoques.length ? enfoques.map(vinieta) : ""],
  ].filter(([, valor]) => hay(valor));

  return [
    title("🔬 GUÍA DE LABORATORIO", { size: TAMANO.tituloMayor }),
    p("Guía del Docente", { bold: true, size: TAMANO.nota, color: COLOR.auxiliar,
      alignment: "center", keepNext: true, spacing: { after: 60 } }),
    subtitle(r.titulo || form.tema || ""),

    seccion("📌  I. DATOS GENERALES"),
    tablaEtiquetas([
      ["Docente", docente, "IE", profile.ie || form.institucion || ""],
      ["Área", form.area || "", "Grado y sección", [form.grado, form.seccion].filter(Boolean).join(" · ")],
      ["Duración", form.duracion ? `${form.duracion}${/^\d+$/.test(String(form.duracion)) ? " minutos" : ""}` : "",
        "Equipos", form.integrantes ? `${form.integrantes} integrantes` : ""],
    ], widths(ANCHOS.datosGenerales)),

    ...(vinculo.length ? [seccion("🎯  II. VÍNCULO CURRICULAR"),
      tablaEtiquetas(vinculo, widths(ANCHOS.etiquetaValor))] : []),

    seccion("🧭  III. PROPÓSITO Y PREGUNTA DE INDAGACIÓN"),
    ...(hay(r.proposito) ? [campo("Propósito de la práctica", r.proposito)] : []),
    ...(hay(r.preguntaIndagatoria) ? [campo("Pregunta de indagación", r.preguntaIndagatoria)] : []),
    ...(hay(g.hipotesisModelo) ? [destacado(`**Hipótesis modelo** (referencial, no se entrega a los estudiantes): ${clean(g.hipotesisModelo)}`)] : []),

    seccion("🛠️  IV. PREPARACIÓN PREVIA DEL DOCENTE"),
    ...(hay(g.preparacion) ? [subtitulo("Materiales y armado"),
      ...lista(g.preparacion).filter(hay).map(vinieta)] : []),
    ...(hay(g.seguridadDocente) ? [subtitulo("Seguridad del docente"),
      table(null, [[p(`⚠️  ${clean(g.seguridadDocente)}`, { size: TAMANO.cuerpo, spacing: { after: 0 } })]],
        widths([1]), { fills: [COLOR.seguridad], cantSplit: false })] : []),

    ...(gestion.length ? [seccion("⏱️  V. GESTIÓN DEL TIEMPO SUGERIDA"),
      tablaDatos(["Momento", "Tiempo", "Observación para el docente"],
        gestion.map(f => [clean(f.momento), clean(f.tiempo), clean(f.observacion)]),
        widths([4, 2, 4]))] : []),

    ...(hay(g.orientaciones) ? [seccion("🧑‍🏫  VI. ORIENTACIONES POR MOMENTO DE LA INDAGACIÓN"),
      ...lista(g.orientaciones).filter(o => hay(o?.momento)).flatMap(o => [
        barraMomento(clean(o.momento)),
        ...(hay(o.queObservar) ? [campo("Qué observar", o.queObservar)] : []),
        ...(hay(o.errorFrecuente) ? [campo("Error frecuente", o.errorFrecuente)] : []),
        ...(hay(o.comoIntervenir) ? [destacado(`**Cómo intervenir:** ${clean(o.comoIntervenir)}`)] : []),
      ])] : []),

    ...(hay(g.solucionario) ? [seccion("✅  VII. SOLUCIONARIO DE REFERENCIA"),
      ...(hay(g.solucionario.resultadoEsperado) ? [campo("Resultado o rango de datos esperado", g.solucionario.resultadoEsperado)] : []),
      ...(hay(g.solucionario.conclusionModelo) ? [campo("Conclusión modelo", g.solucionario.conclusionModelo)] : []),
      p("**Nota:** este solucionario es una referencia para el docente; no se entrega a los estudiantes.",
        { size: TAMANO.cuerpo, color: COLOR.navy, spacing: { before: 60 } })] : []),

    ...(hay(g.dua) ? [seccion("♿  VIII. ORIENTACIONES DUA"),
      ...lista(g.dua).filter(hay).map(vinieta)] : []),

    ...(rubrica.length ? [seccion("📊  IX. INSTRUMENTO DE EVALUACIÓN: RÚBRICA ANALÍTICA"),
      tablaRubrica(rubrica)] : []),
  ];
}

/* ==========================================================================
   DOCUMENTO
   ========================================================================== */
export function labGuideChildren(opciones = {}) {
  return [
    ...fichaEstudianteChildren(opciones),
    // Un solo salto: la docente imprime la ficha por separado desde Word.
    pageBreak(),
    ...guiaDocenteChildren(opciones),
  ];
}

export function labGuideSections(opciones = {}) {
  return [section(labGuideChildren(opciones), "portrait",
    { tipo: "Guía de laboratorio", area: opciones.form?.area })];
}

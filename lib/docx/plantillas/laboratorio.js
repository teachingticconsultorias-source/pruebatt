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
   LOS DOS RÓTULOS

   Es lo único que distingue una mitad de la otra, y tienen que aparecer
   EXACTAMENTE UNA VEZ cada uno. Van aquí, como constantes, para que la prueba
   cuente lo mismo que escribe el documento: si alguien cambia el texto, la
   prueba lo sigue en vez de quedarse mirando una cadena vieja.

   Se escriben tal cual los traen las dos plantillas del pack
   (PLANTILLAS/SCIVERSE/GUÍA DE LABORATORIO/), en caja de título y no en
   mayúsculas: el título en mayúsculas es «GUÍA DE LABORATORIO», común a las
   dos, y el rótulo va debajo.
   ========================================================================== */
export const ROTULO_FICHA = "Ficha del Estudiante";
export const ROTULO_DOCENTE = "Guía del Docente";

/* ==========================================================================
   PIEZAS QUE SE DIBUJAN, NO SE ESCRIBEN
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

/* ==========================================================================
   LOS BLOQUES, DECLARADOS UNA SOLA VEZ

   Cada clave es una sección de una de las dos plantillas oficiales, y trae ya
   construidos sus párrafos y tablas. Las tres composiciones de abajo —ficha
   sola, guía sola, documento completo— se arman TOMANDO de aquí, nunca
   reconstruyendo ni releyendo el texto de párrafos ya hechos.

   La diferencia importa: los objetos de `docx` no exponen su texto, así que
   cualquier troceado que intente deducir dónde empieza una sección leyendo lo
   ya construido devuelve vacío en silencio. Es exactamente lo que pasó con el
   troceado por marcador de la sesión. Aquí no hay nada que deducir: el orden
   y el contenido de las dos plantillas los fijan `BLOQUES_FICHA` y
   `BLOQUES_DOCENTE`, y una prueba comprueba que la suma cuadra.

   Un bloque vacío es una sección que esa práctica no tiene —no hay normas de
   seguridad, no hay rúbrica—. Se queda en `[]` y desaparece sin dejar un
   encabezado huérfano.
   ========================================================================== */

/** El orden de la Ficha del Estudiante: cabecera + las cinco secciones. */
export const BLOQUES_FICHA = [
  "ficha_cabecera", "ficha_datos", "ficha_proposito",
  "ficha_seguridad", "ficha_materiales", "ficha_indagacion",
];

/** El orden de la Guía del Docente: cabecera + las nueve romanas. */
export const BLOQUES_DOCENTE = [
  "docente_cabecera", "docente_datos", "docente_vinculo", "docente_indagacion",
  "docente_preparacion", "docente_gestion", "docente_orientaciones",
  "docente_solucionario", "docente_dua", "docente_rubrica",
];

/**
 * Las dos plantillas oficiales, sección por sección.
 *
 * @returns {Record<string, import("docx").FileChild[]>} un bloque por clave de
 *   `BLOQUES_FICHA` y `BLOQUES_DOCENTE`, en ese orden.
 */
export function laboratorioBloques({ form = {}, resource: r = {}, profile = {} } = {}) {
  const kit = lista(r.materialesKit).filter(hay);
  const caseros = lista(r.materialesCaseros).filter(hay);
  const columnas = lista(r.columnasRegistro).filter(hay);
  const registro = columnas.length ? columnas : ["", "", "", ""];

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

  /** La portada de cada mitad. El rótulo es lo único que las distingue. */
  const cabecera = (rotulo) => [
    title("🔬 GUÍA DE LABORATORIO", { size: TAMANO.tituloMayor }),
    p(rotulo, { bold: true, size: TAMANO.nota, color: COLOR.auxiliar,
      alignment: "center", keepNext: true, spacing: { after: 60 } }),
    // El título que escribió la docente manda sobre el que propuso el modelo:
    // si se molestó en escribirlo, es el suyo el que quiere ver impreso.
    subtitle(clean(form.titulo) || r.titulo || form.tema || ""),
  ];

  return {
    /* ------------------------------------------ FICHA DEL ESTUDIANTE */
    ficha_cabecera: cabecera(ROTULO_FICHA),

    // `ficha_datos` y `docente_datos` no llevan condición: su tabla se llena
    // del FORMULARIO (IE, grado, fecha), que siempre tiene algo, no del recurso
    // que devuelve el modelo. Lo mismo la cabecera. El resto sí desaparece.
    ficha_datos: [
      seccion("📌  I. ENCABEZADO Y DATOS GENERALES"),
      tablaEtiquetas([
        ["Institución Educativa", profile.ie || form.institucion || ""],
        // Lo rellena el equipo a mano: celda vacía, nunca cuarenta guiones bajos.
        ["Integrantes del equipo", ""],
        ["Grado y sección", [form.grado, form.seccion].filter(Boolean).join(" · ")],
        ["Fecha", form.fecha || ""],
      ], widths(ANCHOS.etiquetaValor)),
    ],

    ficha_proposito: hay(r.proposito) ? [
      seccion("🎯  II. PROPÓSITO DE LA PRÁCTICA"),
      subtitulo("¿Qué aprenderemos hoy?", { color: COLOR.navy }),
      destacado(clean(r.proposito)),
    ] : [],

    ficha_seguridad: hay(r.normasSeguridad) ? [
      seccion("⚠️  III. MIS COMPROMISOS DE SEGURIDAD"),
      compromisosDeSeguridad(lista(r.normasSeguridad).filter(hay)),
    ] : [],

    ficha_materiales: (kit.length || caseros.length) ? [
      seccion("🛠️  IV. MATERIALES Y REACTIVOS"),
      subtitulo("¿Qué necesitamos?", { color: COLOR.navy }),
      tablaDatos(["Materiales del kit de laboratorio", "Materiales caseros o traídos"],
        [[kit.map(vinieta), caseros.map(vinieta)]], widths([1, 1])),
    ] : [],

    ficha_indagacion: [
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
    ],

    /* ---------------------------------------------- GUÍA DEL DOCENTE */
    docente_cabecera: cabecera(ROTULO_DOCENTE),

    docente_datos: [
      seccion("📌  I. DATOS GENERALES"),
      tablaEtiquetas([
        ["Docente", docente, "IE", profile.ie || form.institucion || ""],
        ["Área", form.area || "", "Grado y sección", [form.grado, form.seccion].filter(Boolean).join(" · ")],
        ["Duración", form.duracion ? `${form.duracion}${/^\d+$/.test(String(form.duracion)) ? " minutos" : ""}` : "",
          "Equipos", form.integrantes ? `${form.integrantes} integrantes` : ""],
      ], widths(ANCHOS.datosGenerales)),
    ],

    docente_vinculo: vinculo.length ? [
      seccion("🎯  II. VÍNCULO CURRICULAR"),
      tablaEtiquetas(vinculo, widths(ANCHOS.etiquetaValor)),
    ] : [],

    docente_indagacion: (hay(r.proposito) || hay(r.preguntaIndagatoria) || hay(g.hipotesisModelo)) ? [
      seccion("🧭  III. PROPÓSITO Y PREGUNTA DE INDAGACIÓN"),
      ...(hay(r.proposito) ? [campo("Propósito de la práctica", r.proposito)] : []),
      ...(hay(r.preguntaIndagatoria) ? [campo("Pregunta de indagación", r.preguntaIndagatoria)] : []),
      ...(hay(g.hipotesisModelo) ? [destacado(`**Hipótesis modelo** (referencial, no se entrega a los estudiantes): ${clean(g.hipotesisModelo)}`)] : []),
    ] : [],

    docente_preparacion: (hay(g.preparacion) || hay(g.seguridadDocente)) ? [
      seccion("🛠️  IV. PREPARACIÓN PREVIA DEL DOCENTE"),
      ...(hay(g.preparacion) ? [subtitulo("Materiales y armado"),
        ...lista(g.preparacion).filter(hay).map(vinieta)] : []),
      ...(hay(g.seguridadDocente) ? [subtitulo("Seguridad del docente"),
        table(null, [[p(`⚠️  ${clean(g.seguridadDocente)}`, { size: TAMANO.cuerpo, spacing: { after: 0 } })]],
          widths([1]), { fills: [COLOR.seguridad], cantSplit: false })] : []),
    ] : [],

    docente_gestion: gestion.length ? [
      seccion("⏱️  V. GESTIÓN DEL TIEMPO SUGERIDA"),
      tablaDatos(["Momento", "Tiempo", "Observación para el docente"],
        gestion.map(f => [clean(f.momento), clean(f.tiempo), clean(f.observacion)]),
        widths([4, 2, 4])),
    ] : [],

    docente_orientaciones: hay(g.orientaciones) ? [
      seccion("🧑‍🏫  VI. ORIENTACIONES POR MOMENTO DE LA INDAGACIÓN"),
      ...lista(g.orientaciones).filter(o => hay(o?.momento)).flatMap(o => [
        barraMomento(clean(o.momento)),
        ...(hay(o.queObservar) ? [campo("Qué observar", o.queObservar)] : []),
        ...(hay(o.errorFrecuente) ? [campo("Error frecuente", o.errorFrecuente)] : []),
        ...(hay(o.comoIntervenir) ? [destacado(`**Cómo intervenir:** ${clean(o.comoIntervenir)}`)] : []),
      ]),
    ] : [],

    docente_solucionario: hay(g.solucionario) ? [
      seccion("✅  VII. SOLUCIONARIO DE REFERENCIA"),
      ...(hay(g.solucionario.resultadoEsperado) ? [campo("Resultado o rango de datos esperado", g.solucionario.resultadoEsperado)] : []),
      ...(hay(g.solucionario.conclusionModelo) ? [campo("Conclusión modelo", g.solucionario.conclusionModelo)] : []),
      p("**Nota:** este solucionario es una referencia para el docente; no se entrega a los estudiantes.",
        { size: TAMANO.cuerpo, color: COLOR.navy, spacing: { before: 60 } }),
    ] : [],

    docente_dua: hay(g.dua) ? [
      seccion("♿  VIII. ORIENTACIONES DUA"),
      ...lista(g.dua).filter(hay).map(vinieta),
    ] : [],

    docente_rubrica: rubrica.length ? [
      seccion("📊  IX. INSTRUMENTO DE EVALUACIÓN: RÚBRICA ANALÍTICA"),
      tablaRubrica(rubrica),
    ] : [],
  };
}

/** Junta los bloques que pide una lista de claves, en ese orden. */
const componer = (bloques, claves) => claves.flatMap((clave) => bloques[clave]);

/* ==========================================================================
   LAS TRES COMPOSICIONES
   ========================================================================== */

export function fichaEstudianteChildren(opciones = {}) {
  return componer(laboratorioBloques(opciones), BLOQUES_FICHA);
}

export function guiaDocenteChildren(opciones = {}) {
  return componer(laboratorioBloques(opciones), BLOQUES_DOCENTE);
}

export function labGuideChildren(opciones = {}) {
  const bloques = laboratorioBloques(opciones);
  return [
    ...componer(bloques, BLOQUES_FICHA),
    // Un solo salto: la docente imprime la ficha por separado desde Word.
    pageBreak(),
    ...componer(bloques, BLOQUES_DOCENTE),
  ];
}

export function labGuideSections(opciones = {}) {
  return [section(labGuideChildren(opciones), "portrait",
    { tipo: "Guía de laboratorio", area: opciones.form?.area })];
}

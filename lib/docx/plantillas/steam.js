// lib/docx/plantillas/steam.js
//
// EL PROYECTO STEAM, CON LA MAQUETA DEL PACK OFICIAL.
//
// Antes esto era `Object.entries(resource)` volcado a encabezados y viñetas:
// funcionaba, pero producía un documento sin jerarquía en el que la ruta de
// trabajo y las sesiones se leían igual que una lista de materiales.
//
// La plantilla oficial tiene nueve secciones numeradas en romanos, una tabla
// S/T/E/A/M con la inicial destacada, una barra por semana y una tabla por
// sesión. Los nueve bloques coinciden campo a campo con `PROJECT_SCHEMA` de
// api/generate-project-steam.js, así que no hay que inventar ni pedir nada:
// sólo colocarlo.
//
// «ÁREA ARTICULADORA»
// -------------------
// La plantilla la pide en Datos informativos. SciVerse no genera ese dato como
// tal, pero el formulario SÍ tiene un campo que el código ya trata así:
// `areaCurricular` («Área curricular principal»), que el generador envía como
// `form.area`. Se reutiliza ese, que es real, y si no llega se omite la fila.

import { ANCHOS, COLOR, TAMANO } from "../tema.js";
import { barraMomento, clean, destacado, p, seccion, section, subtitle, table,
  tablaDatos, tablaEtiquetas, title, vinieta, widths } from "../core.js";

const lista = v => v == null ? [] : Array.isArray(v) ? v : [v];
const hay = v => v != null && v !== "" && !(Array.isArray(v) && !v.length);
const campo = (rotulo, valor, opciones = {}) => p(`**${rotulo}:** ${clean(valor)}`,
  { size: TAMANO.cuerpo, color: COLOR.navy, spacing: { after: 80 }, ...opciones });

/**
 * Un bloque de texto largo dentro de su propio recuadro, como en la plantilla.
 *
 * Es una tabla de una sola celda: crece con el contenido sin tope, que es
 * exactamente lo que necesita una situacion significativa de diez lineas.
 */
const recuadro = valor => table(null, [[clean(valor)]], widths([1]),
  { fills: [COLOR.fondo], cantSplit: false });

function filasDatos(form = {}, profile = {}) {
  const docente = profile.nombre || [profile.nombres, profile.apellidos].filter(Boolean).join(" ") || form.docente || "";
  const area = form.areaCurricular || form.area || "";
  return [
    ["Docente", docente, "IE", profile.ie || form.institucion || ""],
    ["Nivel", form.nivel || "", "Grado y sección", [form.grado, form.seccion].filter(Boolean).join(" · ")],
    ...(area ? [["Área articuladora", area, "Duración",
      form.duracionSemanas ? `${form.duracionSemanas} semanas` : form.duracion || ""]] : []),
    ["Fecha", form.fecha || "", "Región", form.region || ""],
  ];
}

/**
 * S · T · E · A · M con la inicial en columna estrecha sobre navy.
 *
 * La inicial se deduce del nombre del componente que generó el modelo. Si un
 * aporte no encaja en ninguna letra —puede pasar— la columna queda vacía en
 * vez de forzar una inicial equivocada.
 */
const INICIALES = [["S", /ciencia|science/i], ["T", /tecnolog/i], ["E", /ingenier|engineer/i],
  ["A", /arte|art\b/i], ["M", /matem/i]];
const inicialDe = nombre => (INICIALES.find(([, re]) => re.test(clean(nombre)))?.[0]) || "";

function integracionSteam(r = {}) {
  const filas = lista(r.integracionSTEAM).map(item => typeof item === "string"
    ? ["", clean(item), ""]
    : [inicialDe(item.area), item.area || "", item.aporte || item.descripcion || ""]);
  if (!filas.length) return [];
  return [seccion("IV.  INTEGRACIÓN STEAM"),
    tablaDatos([" ", "Componente", "¿Cómo interviene en el proyecto?"], filas,
      widths(ANCHOS.steam), {
        // La inicial va sobre navy también en el cuerpo: es el ancla visual de
        // la tabla y lo que la distingue de cualquier otra de dos columnas.
        fills: [COLOR.navy, COLOR.fondo, COLOR.blanco],
        colors: [COLOR.blanco, COLOR.azul, COLOR.texto],
      })];
}

function competenciasPorArea(r = {}) {
  const filas = lista(r.competencias).map(c => typeof c === "string"
    ? ["", clean(c)] : [c.area || "", c.competencia || ""]);
  if (!filas.length) return [];
  return [seccion("V.  COMPETENCIAS POR ÁREA"),
    tablaDatos(["Área curricular", "Competencia"], filas, widths(ANCHOS.competencias))];
}

/** Ruta de trabajo: una barra navy por semana y su bloque, que crece. */
function rutaPorSemanas(r = {}) {
  const semanas = lista(r.rutaSemanas || r.semanas);
  if (!semanas.length) return [];
  const salida = [seccion("VIII.  RUTA DE TRABAJO POR SEMANAS")];
  semanas.forEach((s, i) => {
    salida.push(barraMomento(`SEMANA ${s.semana || i + 1}${s.titulo ? ` · ${clean(s.titulo)}` : ""}`));
    if (hay(s.proposito)) salida.push(campo("Propósito", s.proposito));
    const actividades = lista(s.actividades).filter(hay);
    if (actividades.length) {
      salida.push(p("**Actividades:**", { size: TAMANO.cuerpo, color: COLOR.navy, keepNext: true, spacing: { after: 60 } }));
      salida.push(...actividades.map(vinieta));
    }
    if (hay(s.evidencia)) salida.push(destacado(`**Evidencia:** ${clean(s.evidencia)}`));
  });
  return salida;
}

/** Sesiones agrupadas bajo su semana, cada una con su tabla de cinco filas. */
function sesionesDelProyecto(r = {}) {
  const sesiones = lista(r.sesiones);
  if (!sesiones.length) return [];
  const semanas = lista(r.rutaSemanas || r.semanas);
  const salida = [seccion("IX.  SESIONES DE APRENDIZAJE")];
  let semanaImpresa = null;
  sesiones.forEach((s, i) => {
    // Sin `semana` declarada se reparten en orden entre las semanas conocidas,
    // que es como las agrupa la plantilla; con una sola semana, todas caen ahí.
    const numero = s.semana || (semanas.length
      ? semanas[Math.min(Math.floor(i * semanas.length / sesiones.length), semanas.length - 1)]?.semana || null
      : null);
    if (numero && numero !== semanaImpresa) {
      const titulo = semanas.find(w => (w.semana || 0) === numero)?.titulo;
      salida.push(p(`SEMANA ${numero}${titulo ? ` · ${clean(titulo)}` : ""}`,
        { bold: true, size: TAMANO.nota, color: COLOR.navy, keepNext: true,
          shading: { type: "clear", fill: COLOR.fondo }, spacing: { before: 220, after: 140 } }));
      semanaImpresa = numero;
    }
    salida.push(barraMomento(`SESIÓN ${i + 1} · ${clean(s.titulo || "")}`, { fill: COLOR.azul, size: TAMANO.nota }));
    const filas = [
      ["Competencia", clean(s.competencia)],
      ["Actividad central", clean(s.actividadCentral || s.actividad)],
      ["Evidencia", clean(s.evidencia)],
      ["Criterios", lista(s.criterios).filter(hay).map(vinieta)],
      ["Instrumento", clean(s.instrumento)],
    ].filter(([, valor]) => hay(valor));
    if (filas.length) salida.push(tablaEtiquetas(filas, widths(ANCHOS.sesionProyecto)));
  });
  return salida;
}

export function projectChildren({ form = {}, resource: r = {}, profile = {} }) {
  const evidencias = lista(r.evidencias).filter(hay);
  return [
    title("PROYECTO STEAM", { size: TAMANO.tituloMayor }),
    subtitle(r.titulo || form.tema || ""),

    seccion("I.  DATOS INFORMATIVOS"),
    tablaEtiquetas(filasDatos(form, profile), widths(ANCHOS.datosGenerales)),

    ...(hay(r.situacionSignificativa || form.situacion) ? [seccion("II.  SITUACIÓN SIGNIFICATIVA"),
      recuadro(r.situacionSignificativa || form.situacion)] : []),
    ...(hay(r.reto) ? [seccion("III.  RETO STEAM"), recuadro(r.reto)] : []),
    ...integracionSteam(r),
    ...competenciasPorArea(r),
    ...(hay(r.productoEsperado) ? [seccion("VI.  PRODUCTO ESPERADO"), recuadro(r.productoEsperado)] : []),
    ...(evidencias.length ? [seccion("VII.  EVIDENCIAS"), ...evidencias.map(vinieta)] : []),
    ...rutaPorSemanas(r),
    ...sesionesDelProyecto(r),
  ];
}

export function projectSections(options = {}) {
  return [section(projectChildren(options), "portrait",
    { tipo: "Proyecto STEAM", area: options.form?.areaCurricular || options.form?.area })];
}

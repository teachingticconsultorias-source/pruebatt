// lib/docx/plantillas/sesion.js
//
// LA SESIÓN DE APRENDIZAJE, CON LA MAQUETA DEL PACK OFICIAL.
//
// Las 25 plantillas de PLANTILLAS/SCIVERSE/ comparten catorce secciones, en
// este orden, y siete tablas con anchos fijos. Eso es lo que se reproduce.
// Lo que NO se reproduce es su contenido: cada dato sale de lo que Gemini ya
// generó. La plantilla es la forma; el fondo es del docente.
//
// LO QUE SE OMITE A PROPÓSITO
// ---------------------------
// La plantilla trae una fila «Estándar de aprendizaje (ciclo · CNEB)» que pide
// la copia TEXTUAL del estándar oficial. SciVerse no tiene ese dato y pedírselo
// al modelo sería invitarle a redactar normativa. La fila se omite entera: ni
// «Por completar» ni «N/A», que en un documento que va a una carpeta pedagógica
// se leen como un descuido. Cuando exista la tabla oficial, se añade aquí.
//
// TOLERANCIA DE ESQUEMA
// ---------------------
// Un material guardado hace meses puede traer `criteriosEvaluacion` como
// cadenas y `enfoquesTransversales` con `actitud` en vez de `actitudObservable`.
// Se leen las dos formas: la biblioteca tiene que seguir abriendo.

import { ANCHOS, COLOR, NIVELES_RUBRICA, TAMANO } from "../tema.js";
import { answerSpace, barraMomento, clean, contentWidth, destacado, p, pageBreak,
  rellenosRubrica, seccion, section, subtitle, subtitulo, tablaDatos,
  tablaEtiquetas, title, vinieta, widths } from "../core.js";

const lista = v => v == null ? [] : Array.isArray(v) ? v : [v];
const hay = v => v != null && v !== "" && !(Array.isArray(v) && !v.length);
const texto = v => clean(v);
/**
 * Un texto de varias lineas se convierte en varios parrafos.
 *
 * El contenido de un anexo llega con saltos de linea. Volcarlo en un solo
 * parrafo produce el «texto corrido sin jerarquia» del que se queja el
 * encargo; respetar los saltos devuelve la estructura que el modelo escribio.
 */
const SALTO_DE_LINEA = new RegExp("\\r?\\n+");
const parrafos = (valor, opciones = {}) => String(valor ?? "").split(SALTO_DE_LINEA)
  .map(linea => linea.trim()).filter(Boolean)
  .map(linea => p(texto(linea), { size: TAMANO.cuerpo, ...opciones }));


/** Un párrafo `Rótulo: valor` con el rótulo en negrita navy. */
const campo = (rotulo, valor, opciones = {}) => p(`**${rotulo}:** ${texto(valor)}`,
  { size: TAMANO.cuerpo, color: COLOR.navy, spacing: { after: 80 }, ...opciones });

/* ==========================================================================
   FILAS DE LAS TABLAS
   ========================================================================== */
function filasDatos(form = {}, profile = {}) {
  const docente = profile.nombre || [profile.nombres, profile.apellidos].filter(Boolean).join(" ") || form.docente || "";
  const duracion = form.duracion
    ? `${form.duracion}${/^\d+$/.test(String(form.duracion)) ? " minutos" : ""}`
    : form.duracionSemanas ? `${form.duracionSemanas} semanas` : "";
  return [
    ["Docente", docente, "IE", profile.ie || form.institucion || ""],
    ["Nivel", form.nivel || "", "Grado y sección", [form.grado, form.seccion].filter(Boolean).join(" · ")],
    ["Área", form.area || "", "Fecha", form.fecha || ""],
    ["Duración", duracion, "Región", form.region || ""],
  ];
}

function filasProposito(form = {}, r = {}) {
  const capacidades = lista(r.capacidades || r.capacidadesCNEB || form.capacidades);
  const filas = [
    ["Propósito", r.proposito || form.proposito],
    ["Competencia", clean(r.competencia || r.competenciasCNEB || form.competencia)],
    ["Capacidades", capacidades.length ? capacidades.map(vinieta) : ""],
    ["Evidencia", r.evidencia || form.evidencia],
  ];
  return filas.filter(([, valor]) => hay(valor));
}

/** `[{capacidad, desempeno}]` o una lista plana de cadenas. */
function filasDesempenos(r = {}) {
  return lista(r.desempenosPrecisados).map(d => typeof d === "string"
    ? ["", d] : [d.capacidad || "", d.desempeno || d.desempeño || d.descripcion || ""]);
}

/** `criteriosDetallados` trae la terna completa; `criteriosEvaluacion`, sólo el texto. */
function filasCriterios(r = {}) {
  const detallados = lista(r.criteriosDetallados || r.criterios).filter(c => typeof c === "object");
  if (detallados.length) {
    return detallados.map(c => [c.capacidad || "", c.criterio || "", c.evidenciaObservable || c.evidencia || ""]);
  }
  return lista(r.criteriosEvaluacion).map(c => ["", clean(c), ""]);
}

function filasEnfoques(r = {}) {
  return lista(r.enfoquesTransversales).map(e => typeof e === "string"
    ? [e, "", ""] : [e.enfoque || "", e.valor || "", e.actitudObservable || e.actitud || ""]);
}

/* ==========================================================================
   SECUENCIA DIDÁCTICA
   ========================================================================== */
/** Bloque `descripcion + preguntas` de un subproceso de Inicio o Cierre. */
function bloque(rotulo, datos, { color = COLOR.azul } = {}) {
  if (!hay(datos)) return [];
  const valor = typeof datos === "string" ? { descripcion: datos } : datos;
  const salida = [subtitulo(rotulo, { color })];
  if (hay(valor.descripcion)) salida.push(p(texto(valor.descripcion), { size: TAMANO.cuerpo }));
  salida.push(...lista(valor.preguntas).map(vinieta));
  return salida;
}

function inicioDe(inicio = {}) {
  if (!hay(inicio)) return [];
  const criterios = lista(inicio.propositoOrganizacion?.criteriosCompartidos);
  return [
    barraMomento(`Inicio${inicio.minutos ? ` · ${inicio.minutos} minutos` : ""}`),
    ...bloque("Motivación", inicio.motivacion),
    ...bloque("Saberes previos", inicio.saberesPrevios),
    ...bloque("Problematización", inicio.problematizacion),
    ...bloque("Propósito y organización", inicio.propositoOrganizacion?.descripcion
      ? { descripcion: inicio.propositoOrganizacion.descripcion } : inicio.propositoOrganizacion),
    ...(criterios.length ? [subtitulo("Criterios compartidos"), ...criterios.map(vinieta)] : []),
  ];
}

/**
 * Desarrollo: los procesos REALMENTE generados, no un catálogo por área.
 *
 * Las plantillas de Comunicación, Castellano L2, Inglés y Arte ofrecen dos o
 * tres «rutas» para que el docente elija una. La generación ya eligió —el
 * servidor escoge la ruta según la competencia— así que el documento muestra
 * la que salió, y no las tres. Imprimir rutas que nadie va a usar convierte
 * una sesión de siete páginas en una de doce.
 */
function desarrolloDe(desarrollo = {}) {
  if (!hay(desarrollo)) return [];
  const salida = [barraMomento(`Desarrollo${desarrollo.minutos ? ` · ${desarrollo.minutos} minutos` : ""}`)];
  if (hay(desarrollo.metodologia)) salida.push(campo("Metodología", desarrollo.metodologia, { spacing: { after: 140 } }));
  for (const proceso of lista(desarrollo.procesos)) {
    if (typeof proceso === "string") { salida.push(subtitulo(proceso, { color: COLOR.navy })); continue; }
    salida.push(subtitulo(proceso.subtitulo || proceso.titulo || "Proceso", { color: COLOR.navy }));
    if (hay(proceso.actividad || proceso.descripcion)) salida.push(campo("Actividad", proceso.actividad || proceso.descripcion));
    const preguntas = lista(proceso.preguntasMediacion);
    if (preguntas.length) {
      salida.push(p("**Preguntas de mediación:**", { size: TAMANO.cuerpo, color: COLOR.navy, keepNext: true, spacing: { after: 40 } }));
      salida.push(...preguntas.map(vinieta));
    }
    if (hay(proceso.acompanamiento)) salida.push(campo("Acompañamiento", proceso.acompanamiento));
    if (hay(proceso.evaluacionFormativa)) salida.push(destacado(`**Evaluación formativa:** ${texto(proceso.evaluacionFormativa)}`));
  }
  return salida;
}

function cierreDe(cierre = {}) {
  if (!hay(cierre)) return [];
  const salida = [barraMomento(`Cierre${cierre.minutos ? ` · ${cierre.minutos} minutos` : ""}`),
    ...bloque("Metacognición", cierre.metacognicion)];
  if (hay(cierre.evaluacion)) {
    salida.push(subtitulo("Evaluación"));
    if (hay(cierre.evaluacion.descripcion)) salida.push(p(texto(cierre.evaluacion.descripcion), { size: TAMANO.cuerpo }));
    if (hay(cierre.evaluacion.mensajeLogro)) salida.push(destacado(`**Mensaje de logro:** ${texto(cierre.evaluacion.mensajeLogro)}`));
  }
  if (hay(cierre.transferencia)) {
    salida.push(subtitulo("Transferencia"));
    if (hay(cierre.transferencia.descripcion)) salida.push(p(texto(cierre.transferencia.descripcion), { size: TAMANO.cuerpo }));
    if (hay(cierre.transferencia.consigna)) salida.push(campo("Consigna", cierre.transferencia.consigna));
  }
  return salida;
}

/* ==========================================================================
   ANEXOS
   ========================================================================== */
/** Tabla de rúbrica analítica, AD → A → B → C, con la escala de color del pack. */
export function tablaRubrica(criterios, orientacion = "portrait") {
  const filas = criterios.map(c => [c.criterio || c.indicador || "",
    c.logroDestacado ?? c.destacado ?? c.ad ?? "",
    c.logroEsperado ?? c.esperado ?? c.a ?? "",
    c.enProceso ?? c.proceso ?? c.b ?? "",
    c.inicio ?? c.c ?? ""]);
  return tablaDatos(["Criterio", ...NIVELES_RUBRICA.map(n => n.titulo)], filas,
    widths(ANCHOS.rubrica, contentWidth(orientacion)),
    // Sin `cantSplit`: un descriptor largo debe poder continuar en la página
    // siguiente en vez de empujar la fila entera y dejar un hueco.
    { ...rellenosRubrica(), cantSplit: false });
}

/**
 * ¿Este anexo lo rellena el estudiante?
 *
 * El prompt pide tres anexos: una ficha o texto base, UNA ACTIVIDAD PARA
 * ESTUDIANTES y un recurso de apoyo. Sólo el segundo es una guía de trabajo, y
 * sólo él lleva la cabecera de datos del equipo que trae la plantilla. Antes se
 * detectaba con `/guía|ficha|actividad/`, y «FICHA INFORMATIVA» —que es para
 * leer, no para escribir— se llevaba la cabecera sin que viniera a cuento.
 */
const ES_GUIA_DE_TRABAJO = anexo => {
  const etiqueta = `${clean(anexo.titulo)} ${clean(anexo.tipo)}`.toLowerCase();
  if (/informativ|lectura|texto|apoyo|recurso/.test(etiqueta)) return false;
  return /gu[íi]a|actividad|trabajo|ficha de trabajo|taller|pr[áa]ctica/.test(etiqueta);
};

/** Cabecera que el estudiante rellena a mano: celdas vacías, no subrayados. */
const datosDelEquipo = () => tablaEtiquetas(
  [["Nombres de los integrantes", ""], ["Grado y sección", ""], ["Fecha", ""]],
  widths(ANCHOS.etiquetaValor));

function anexosDe(r = {}, rubrica = null) {
  const anexos = lista(r.anexos).filter(hay);
  const criteriosRubrica = rubrica ? lista(rubrica.criterios || rubrica.indicadores).filter(c => typeof c === "object") : [];
  if (!anexos.length && !criteriosRubrica.length) return [];

  const salida = [pageBreak(), title("ANEXOS PARA LA CLASE", { size: TAMANO.subtitulo })];
  let ocupaPagina = true;
  anexos.forEach((anexo, i) => {
    // SALTO DE PÁGINA CON CRITERIO.
    //
    // La plantilla abre cada anexo en una hoja porque los suyos son fichas
    // completas. Los nuestros dependen de lo que haya escrito el modelo: con
    // un anexo de tres líneas, un salto fijo deja tres cuartos de página en
    // blanco, que es justo lo que no debe pasar. Sólo se salta cuando el anexo
    // ANTERIOR llenó la hoja; si no, éste continúa debajo y la aprovecha.
    const guia = ES_GUIA_DE_TRABAJO(anexo);
    if (i && ocupaPagina) salida.push(pageBreak());

    const nombre = clean(anexo.titulo || anexo.tipo || `Recurso ${i + 1}`).toUpperCase();
    salida.push(seccion(`ANEXO ${i + 1} · ${nombre}`));
    if (hay(anexo.proposito)) salida.push(campo("Propósito", anexo.proposito, { spacing: { after: 100 } }));
    if (guia) salida.push(datosDelEquipo());
    if (hay(anexo.contenido)) salida.push(...parrafos(anexo.contenido));
    if (hay(anexo.instrucciones)) salida.push(destacado(`**Instrucciones:** ${texto(anexo.instrucciones)}`));
    if (guia) {
      salida.push(subtitulo("Respuestas del equipo"), ...answerSpace(6));
    }
    ocupaPagina = guia || clean(anexo.contenido).length >= 700;
  });

  if (criteriosRubrica.length) {
    salida.push(pageBreak(), seccion(`ANEXO ${anexos.length + 1} · RÚBRICA ANALÍTICA DE EVALUACIÓN`));
    if (hay(rubrica.titulo)) salida.push(campo("Evalúa", rubrica.titulo, { spacing: { after: 140 } }));
    salida.push(tablaRubrica(criteriosRubrica));
    if (hay(rubrica.indicaciones || rubrica.instrucciones)) {
      salida.push(destacado(`**Instrucciones:** ${texto(rubrica.indicaciones || rubrica.instrucciones)}`));
    }
  }
  return salida;
}

/* ==========================================================================
   DOCUMENTO
   ========================================================================== */
export function sessionChildren({ form = {}, resource: r = {}, profile = {}, rubrica = null }) {
  const desempenos = filasDesempenos(r);
  const criterios = filasCriterios(r);
  const enfoques = filasEnfoques(r);
  const proposito = filasProposito(form, r);
  const preparacion = lista(r.preparacionDocente).filter(hay);
  const materiales = lista(r.materiales).filter(hay);
  const dua = lista(r.orientacionesDUA).filter(hay);
  const reflexiones = lista(r.reflexionesDocente).filter(hay);
  const secuencia = [...inicioDe(r.inicio), ...desarrolloDe(r.desarrollo), ...cierreDe(r.cierre)];

  return [
    title("SESIÓN DE APRENDIZAJE"),
    subtitle(r.titulo || form.tema || ""),

    seccion("DATOS GENERALES"),
    tablaEtiquetas(filasDatos(form, profile), widths(ANCHOS.datosGenerales)),

    ...(proposito.length ? [seccion("PROPÓSITOS DE APRENDIZAJE"),
      tablaEtiquetas(proposito, widths(ANCHOS.etiquetaValor))] : []),

    ...(desempenos.length ? [seccion("DESEMPEÑOS PRECISADOS"),
      tablaDatos(["Capacidad", "Desempeño"], desempenos, widths(ANCHOS.desempenos))] : []),

    ...(criterios.length ? [seccion("CRITERIOS DE EVALUACIÓN"),
      tablaDatos(["Capacidad", "Criterio", "Evidencia observable"], criterios, widths(ANCHOS.criterios))] : []),

    ...(enfoques.length ? [seccion("ENFOQUES TRANSVERSALES"),
      tablaDatos(["Enfoque", "Valor", "Actitud observable"], enfoques, widths(ANCHOS.enfoques))] : []),

    ...(preparacion.length ? [seccion("PREPARACIÓN DOCENTE"), ...preparacion.map(vinieta)] : []),
    ...(materiales.length ? [seccion("MATERIALES"), ...materiales.map(vinieta)] : []),
    ...(secuencia.length ? [seccion("SECUENCIA DIDÁCTICA"), ...secuencia] : []),
    ...(dua.length ? [seccion("ORIENTACIONES DUA"), ...dua.map(vinieta)] : []),
    ...(hay(r.instrumentoSugerido) ? [seccion("INSTRUMENTO SUGERIDO"),
      p(texto(r.instrumentoSugerido), { size: TAMANO.cuerpo })] : []),
    ...(reflexiones.length ? [seccion("REFLEXIONES DEL DOCENTE"), ...reflexiones.map(vinieta)] : []),
    ...anexosDe(r, rubrica),
  ];
}

export function sessionSections(options = {}) {
  return [section(sessionChildren(options), "portrait",
    { tipo: "Sesión de aprendizaje", area: options.form?.area })];
}

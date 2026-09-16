// lib/admin/exportar-docentes.js
//
// LA LISTA DE DOCENTES, EN UN .XLSX QUE SE PUEDE USAR.
//
// POR QUÉ EXCELJS Y NO SheetJS
// ----------------------------
// Todo lo que hace útil a este fichero —fila congelada, autofiltro, relleno de
// encabezado, anchos por columna, filas alternadas, fechas como fechas de
// verdad y teléfonos como texto— vive en la API pública de ExcelJS. La versión
// npm gratuita de SheetJS no expone estilos: habría que comprar la Pro o
// parchear el XML a mano. Es la misma decisión que se tomó con `docx`.
//
// POR QUÉ SE CARGA CON `import()` DINÁMICO
// ----------------------------------------
// Son unos 900 KB. Cargarlos en el bundle principal se los descargaría cada
// docente de primaria con un móvil de gama baja para una función que sólo usa
// el equipo. Así sólo llega al navegador cuando alguien pulsa Exportar.
//
// EL TELÉFONO COMO TEXTO, NO COMO NÚMERO
// --------------------------------------
// Un celular peruano empieza por 9 y tiene nueve dígitos; si Excel lo lee como
// número, se come cualquier cero inicial y los formatos con prefijo se
// convierten en notación científica. Se escribe como texto y se marca la
// columna con `numFmt: "@"`.

/** El azul del sistema visual de SciVerse, sin almohadilla: lo que quiere ExcelJS. */
const AZUL_CABECERA = "FF0B2E4F";
const FILA_ALTERNA = "FFF2F7FB";
const BORDE = "FFD5E3EF";

/**
 * Las columnas del fichero, en orden.
 *
 * `celular` se declara siempre pero se OMITE al construir si el rol no lo
 * trae: un encabezado «Teléfono» con la columna vacía haría pensar que no hay
 * teléfonos, cuando lo que pasa es que ese rol no los ve.
 */
export const COLUMNAS = [
  { clave: "nombre_completo", titulo: "Nombre completo", ancho: 28 },
  { clave: "email", titulo: "Correo electrónico", ancho: 30 },
  { clave: "celular", titulo: "Teléfono / WhatsApp", ancho: 18, texto: true, sensible: true },
  { clave: "ie", titulo: "Institución educativa", ancho: 34 },
  { clave: "nivel", titulo: "Nivel", ancho: 13 },
  { clave: "plan_nombre", titulo: "Plan", ancho: 14 },
  { clave: "plan_hasta", titulo: "Vence el", ancho: 13, fecha: true },
  { clave: "created_at", titulo: "Registro", ancho: 13, fecha: true },
  { clave: "ultima_generacion", titulo: "Última generación", ancho: 17, fecha: true },
  { clave: "generaciones_total", titulo: "Generaciones", ancho: 13, numero: true },
  { clave: "usadas_semana_texto", titulo: "Uso semanal", ancho: 13 },
  { clave: "email_confirmado_texto", titulo: "Correo confirmado", ancho: 17 },
  { clave: "activo_texto", titulo: "Estado", ancho: 12 },
];

const si = (v) => (v ? "Sí" : "No");

/** Una fecha de verdad para Excel, o null. Nunca una cadena que parezca fecha. */
function comoFecha(valor) {
  if (!valor) return null;
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Aplana una fila del endpoint a lo que van a ver los ojos. */
export function prepararFila(item) {
  return {
    nombre_completo: [item.nombres, item.apellidos].filter(Boolean).join(" ").trim(),
    email: item.email || "",
    celular: item.celular || "",
    ie: item.ie || "",
    nivel: item.nivel ? item.nivel[0].toUpperCase() + item.nivel.slice(1) : "",
    plan_nombre: item.plan_nombre || item.plan || "Free",
    plan_hasta: comoFecha(item.plan_hasta),
    created_at: comoFecha(item.created_at),
    ultima_generacion: comoFecha(item.ultima_generacion),
    generaciones_total: Number(item.generaciones_total ?? 0),
    usadas_semana_texto: item.limite_semanal != null
      ? `${item.usadas_semana ?? 0} / ${item.limite_semanal}`
      : String(item.usadas_semana ?? 0),
    email_confirmado_texto: si(item.email_confirmado),
    activo_texto: item.activo ? "Activo" : "Inactivo",
  };
}

/** Los conteos de la segunda hoja. Se calculan de las filas, no se piden aparte. */
export function resumirDocentes(items) {
  const cuenta = (lista, clave) => {
    const mapa = new Map();
    for (const it of lista) {
      const k = clave(it) || "(sin dato)";
      mapa.set(k, (mapa.get(k) || 0) + 1);
    }
    return [...mapa.entries()].sort((a, b) => b[1] - a[1]);
  };
  const esPro = (it) => String(it.plan || "").toLowerCase() !== "free"
    && String(it.plan || "").toLowerCase() !== "gratuito"
    && Boolean(it.plan);

  return {
    total: items.length,
    pro: items.filter(esPro).length,
    free: items.filter((it) => !esPro(it)).length,
    confirmados: items.filter((it) => it.email_confirmado).length,
    activos: items.filter((it) => it.activo).length,
    conGeneraciones: items.filter((it) => Number(it.generaciones_total ?? 0) > 0).length,
    porNivel: cuenta(items, (it) => it.nivel),
    porPlan: cuenta(items, (it) => it.plan_nombre || it.plan),
  };
}

/** `docentes-sciverse-2026-09-15.xlsx` */
export function nombreDeArchivo(fecha = new Date()) {
  return `docentes-sciverse-${fecha.toISOString().slice(0, 10)}.xlsx`;
}

/** Un texto corto que describe los filtros, para la hoja de resumen. */
export function describirFiltros(filtros = {}) {
  const partes = [];
  if (filtros.search) partes.push(`Búsqueda: «${filtros.search}»`);
  if (filtros.plan) partes.push(`Plan: ${filtros.plan}`);
  if (filtros.desde) partes.push(`Registrados desde: ${filtros.desde}`);
  if (filtros.hasta) partes.push(`Registrados hasta: ${filtros.hasta}`);
  if (filtros.nivel) partes.push(`Nivel: ${filtros.nivel}`);
  // Ojo con la cadena vacía: `"" != null` es verdadero, así que un filtro sin
  // poner se describía como «Correo confirmado: No». Un resumen que miente
  // sobre lo que se filtró es peor que no tener resumen.
  const puesto = (v) => v !== "" && v != null;
  if (puesto(filtros.confirmado)) {
    partes.push(`Correo confirmado: ${si(filtros.confirmado === "true" || filtros.confirmado === true)}`);
  }
  if (puesto(filtros.activo)) {
    partes.push(`Estado: ${filtros.activo === "true" || filtros.activo === true ? "Activo" : "Inactivo"}`);
  }
  return partes.length ? partes.join(" · ") : "Sin filtros: todos los docentes";
}

/**
 * Construye el libro y devuelve el Blob.
 *
 * @param {object[]} items    lo que devolvió /api/admin/export-docentes
 * @param {object} opciones   { filtros, rol, incluirCelular }
 */
export async function construirLibro(items, { filtros = {}, rol = "admin", incluirCelular = true } = {}) {
  // Aquí y no arriba: los 900 KB sólo se descargan al pulsar Exportar.
  const { default: ExcelJS } = await import("exceljs");

  const columnas = COLUMNAS.filter((c) => !c.sensible || incluirCelular);
  const libro = new ExcelJS.Workbook();
  libro.creator = "SciVerse · Teaching TIC";
  libro.created = new Date();

  /* ---------------------------------------------------------- HOJA 1 */
  const hoja = libro.addWorksheet("Docentes", {
    views: [{ state: "frozen", ySplit: 1 }],   // la cabecera no se va al hacer scroll
  });
  hoja.columns = columnas.map((c) => ({ header: c.titulo, key: c.clave, width: c.ancho }));

  const cabecera = hoja.getRow(1);
  cabecera.height = 22;
  cabecera.eachCell((celda) => {
    celda.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL_CABECERA } };
    celda.alignment = { vertical: "middle", horizontal: "left" };
  });

  for (const item of items) {
    const fila = prepararFila(item);
    hoja.addRow(columnas.reduce((acc, c) => ({ ...acc, [c.clave]: fila[c.clave] }), {}));
  }

  // Formatos por columna: las fechas como fechas, el teléfono como texto.
  columnas.forEach((c, i) => {
    const col = hoja.getColumn(i + 1);
    if (c.fecha) col.numFmt = "dd/mm/yyyy";
    if (c.texto) col.numFmt = "@";
    if (c.numero) col.alignment = { horizontal: "center" };
  });

  // Filas alternadas y bordes suaves. Desde la 2: la 1 es la cabecera.
  for (let n = 2; n <= items.length + 1; n += 1) {
    const fila = hoja.getRow(n);
    fila.eachCell((celda) => {
      celda.border = {
        bottom: { style: "thin", color: { argb: BORDE } },
      };
      if (n % 2 === 0) {
        celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: FILA_ALTERNA } };
      }
    });
  }

  // El autofiltro de Excel, sobre la fila de encabezado.
  if (items.length) {
    hoja.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columnas.length } };
  }

  /* ---------------------------------------------------------- HOJA 2 */
  const resumen = resumirDocentes(items);
  const hoja2 = libro.addWorksheet("Resumen");
  hoja2.columns = [{ width: 32 }, { width: 14 }];

  const titulo = (texto) => {
    const f = hoja2.addRow([texto, ""]);
    f.getCell(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    f.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL_CABECERA } };
    f.getCell(2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL_CABECERA } };
    return f;
  };
  const dato = (etiqueta, valor) => {
    const f = hoja2.addRow([etiqueta, valor]);
    f.getCell(1).font = { bold: true };
    return f;
  };

  titulo("EXPORTACIÓN");
  dato("Generado el", new Date()).getCell(2).numFmt = "dd/mm/yyyy hh:mm";
  dato("Filtros aplicados", describirFiltros(filtros));
  dato("Exportado con rol", rol);
  if (!incluirCelular) dato("Teléfono", "No incluido para este rol");
  hoja2.addRow([]);

  titulo("TOTALES");
  dato("Docentes exportados", resumen.total);
  dato("Plan Pro", resumen.pro);
  dato("Plan Free", resumen.free);
  dato("Con correo confirmado", resumen.confirmados);
  dato("Cuentas activas", resumen.activos);
  dato("Han generado al menos una vez", resumen.conGeneraciones);
  hoja2.addRow([]);

  titulo("POR NIVEL");
  for (const [nivel, n] of resumen.porNivel) dato(nivel, n);
  hoja2.addRow([]);

  titulo("POR PLAN");
  for (const [plan, n] of resumen.porPlan) dato(plan, n);

  const buffer = await libro.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

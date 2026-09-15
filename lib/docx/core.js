import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, TableLayoutType, BorderStyle, ShadingType, VerticalAlign,
  AlignmentType, Header, Footer, PageNumber, PageOrientation, SectionType,
  HeightRule, PageBreak, ImageRun } from "docx";
import { ANCHOS, COLOR, ESPACIO, FUENTE, MARCA, PAGINA, PIE, TAMANO,
  TAMANO_MINIMO, TINTA_SOBRE_RUBRICA } from "./tema.js";

/* ==========================================================================
   PRIMITIVAS DEL DOCUMENTO

   Todo lo visual vive en tema.js y se aplica aquí. Ningún exportador vuelve a
   escribir un color, una fuente ni un tamaño: si lo hiciera, la próxima vez
   que cambie la identidad habría que perseguirla por diez ficheros.
   ========================================================================== */

// Todas las medidas son DXA (1440 por pulgada); las fuentes, medios puntos.

/**
 * Los nombres en inglés de `THEME` son alias de roles de la paleta ACTIVA.
 *
 * Esto era un objeto literal, y por tanto una FOTO de la paleta de Nitia
 * tomada al importar el módulo: `THEME.border` seguía siendo el azul claro de
 * Nitia aunque el documento fuera de un colegio con su propia marca. El Proxy
 * de `COLOR` no llegaba aquí porque estos valores se habían copiado.
 */
const ROLES = { ink: "texto", accent: "navy", azul: "azul", muted: "auxiliar",
  border: "borde", fill: "fondo" };
const FIJOS = { font: FUENTE, body: TAMANO.cuerpo, minimum: TAMANO_MINIMO };
export const THEME = new Proxy(FIJOS, {
  get: (base, clave) => (clave in ROLES ? COLOR[ROLES[clave]] : base[clave]),
  has: (base, clave) => clave in ROLES || clave in base,
  ownKeys: () => [...Reflect.ownKeys(FIJOS), ...Object.keys(ROLES)],
  getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }),
});

/**
 * Relleno de párrafo o de celda… o nada.
 *
 * En modo plantilla la paleta trae `null` en todos los rellenos: el fondo lo
 * pone el documento del colegio. Un `w:shd` con `fill` vacío no es lo mismo
 * que no tener `w:shd`, así que se omite el nodo entero.
 */
const relleno = (fill) => (fill ? { shading: { type: ShadingType.CLEAR, fill } } : {});
export const PAGE = { portrait: { width: PAGINA.ancho, height: PAGINA.alto },
  landscape: { width: PAGINA.alto, height: PAGINA.ancho }, margin: PAGINA.margen };
export const contentWidth = (orientation = "portrait") => PAGE[orientation].width - 2 * PAGE.margin;

export function clean(value) {
  if (value == null) return "";
  if (Array.isArray(value)) return value.map(clean).filter(Boolean).join(" · ");
  if (typeof value === "object") return Object.values(value).map(clean).filter(Boolean).join(" · ");
  return String(value).replace(/\b(?:undefined|null)\b|\[object Object\]/g, "")
    .replace(/```\w*|`/g, "").replace(/^\s*#{1,6}\s*/gm, "")
    .replace(/\*\*|__/g, "").replace(/\|/g, " · ").trim();
}
export function run(value, options = {}) {
  const text = typeof value === "string" ? `${/^\s/.test(value) ? " " : ""}${clean(value)}${/\s$/.test(value) ? " " : ""}` : clean(value);
  return new TextRun({ text, font: THEME.font, color: THEME.ink,
    ...options, size: Math.max(options.size || THEME.body, THEME.minimum) });
}
export function p(value = "", options = {}) {
  const { bold, size, color, italics, ...paragraph } = options;
  const chunks = typeof value === "string" ? value.split(/(\*\*[^*]+\*\*)/g) : [value];
  return new Paragraph({ spacing: ESPACIO.parrafo, widowControl: true,
    ...paragraph, children: chunks.map(t => run(t, { bold: bold || /^\*\*/.test(t), size, color: color || THEME.ink, italics })) });
}

/** Título del documento: centrado, navy, sin regla. */
export const title = (value, { size = TAMANO.titulo } = {}) => p(value, { bold: true, size, color: COLOR.navy,
  alignment: AlignmentType.CENTER, keepNext: true, keepLines: true, spacing: { before: 0, after: 60 } });

/** Subtítulo del documento: el tema, sobre fondo suave y centrado. */
export const subtitle = value => p(value, { bold: true, italics: true, size: TAMANO.subtitulo, color: COLOR.azul,
  alignment: AlignmentType.CENTER, keepNext: true, keepLines: true,
  ...relleno(COLOR.fondo), spacing: { before: 0, after: 220 } });

/**
 * Encabezado de sección: negrita navy con regla azul debajo.
 *
 * Es la firma visual del pack y aparece 14 veces en una sesión. `keepNext`
 * impide el título huérfano al pie de una página.
 */
export function seccion(value, { size = TAMANO.seccion } = {}) {
  return p(value, { bold: true, size, color: COLOR.navy, keepNext: true, keepLines: true,
    spacing: ESPACIO.seccion,
    border: { bottom: { style: BorderStyle.SINGLE, size: 10, color: COLOR.azul } } });
}
/** Compatibilidad: `heading` era el nombre anterior de lo mismo. */
export const heading = seccion;

/** Barra de momento: blanco sobre navy. Inicio · Desarrollo · Cierre, semanas. */
export function barraMomento(value, { fill, size = TAMANO.momento } = {}) {
  // Sin relleno la barra deja de ser una barra: el texto se queda solo, así
  // que va en la tinta del cuerpo y no en el blanco que iba encima del navy.
  const fondo = fill === undefined ? COLOR.cabecera : fill;
  return p(value, { bold: true, size, color: fondo ? COLOR.tintaCabecera : COLOR.texto,
    keepNext: true, keepLines: true, ...relleno(fondo), spacing: ESPACIO.momento });
}
/** Subtítulo de proceso o de bloque dentro de un momento. */
export const subtitulo = (value, { color = COLOR.azul } = {}) => p(value, { bold: true, size: TAMANO.cuerpo,
  color, keepNext: true, keepLines: true, spacing: ESPACIO.subtitulo });
/** Párrafo destacado sobre fondo suave: instrucciones, mensaje de logro. */
export const destacado = value => p(value, { bold: true, size: TAMANO.cuerpo, color: COLOR.navy,
  ...relleno(COLOR.fondo), spacing: { after: 140 } });
/** Viñeta real de lista. */
export const vinieta = value => p(`• ${clean(value)}`, { size: TAMANO.cuerpo, spacing: ESPACIO.vinieta });

export const pageBreak = () => new Paragraph({ children: [new PageBreak()] });

export function widths(weights, total = contentWidth()) {
  const sum = weights.reduce((a, b) => a + b, 0);
  const values = weights.map(w => Math.floor(total * w / sum));
  values[values.length - 1] += total - values.reduce((a, b) => a + b, 0);
  return values;
}

export function cell(value, width, { header = false, fill, center = false, padding = 100,
  color, bold, size = THEME.minimum, ...options } = {}) {
  const values = Array.isArray(value) ? value : [value];
  return new TableCell({ width: { size: width, type: WidthType.DXA },
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: padding, bottom: padding, left: padding, right: padding },
    ...relleno(fill || (header ? COLOR.cabecera : COLOR.celda)),
    ...options, children: values.map(v => v instanceof Paragraph ? v : p(v, {
      bold: bold ?? header, size, color: color || (header ? COLOR.tintaCabecera : THEME.ink),
      alignment: center || header ? AlignmentType.CENTER : undefined,
      spacing: ESPACIO.celda })) });
}

/**
 * Tabla con cabecera navy.
 *
 * DOS DECISIONES QUE AFECTAN AL CONTENIDO LARGO
 * ---------------------------------------------
 * 1. `repeatHeader` va activado por defecto. Una tabla de criterios que salta
 *    de página sin repetir su cabecera obliga a la docente a volver atrás para
 *    saber qué columna está leyendo.
 *
 * 2. `cantSplit` va DESACTIVADO por defecto, al revés que antes. Prohibir que
 *    una fila se parta sólo tiene sentido en filas cortas —el registro
 *    nominal—. En una rúbrica con cuatro descriptores largos, la fila puede
 *    medir más que la página: Word la empuja entera a la siguiente y deja
 *    media página en blanco, o la parte igualmente. Preferimos una fila
 *    partida correctamente a una tabla deformada.
 */
export function table(headers, data, columnWidths, { rowHeight, exact = false, grid = false,
  repeatHeader = true, cantSplit = false, headerFill, fills = null, colors = null,
  labelColumn = false, cellSize = THEME.minimum } = {}) {
  const border = { style: BorderStyle.SINGLE, size: 4, color: THEME.border };
  const makeRow = (values, header = false) => new TableRow({
    tableHeader: header && repeatHeader ? true : undefined,
    ...(cantSplit ? { cantSplit: true } : {}),
    ...(rowHeight ? { height: { value: rowHeight, rule: exact ? HeightRule.EXACT : HeightRule.ATLEAST } } : {}),
    children: values.map((v, i) => cell(v, columnWidths[i], { header, center: grid,
      size: cellSize,
      // La primera columna de una tabla etiqueta/valor lleva el fondo suave y
      // la tinta navy: es lo que distingue el rótulo del dato en el pack.
      ...(!header && labelColumn && i === 0 ? { fill: COLOR.fondo, color: COLOR.navy, bold: true } : {}),
      ...(!header && fills?.[i] ? { fill: fills[i] } : {}),
      ...(!header && colors?.[i] ? { color: colors[i] } : {}),
      ...(header ? { fill: headerFill === undefined ? COLOR.cabecera : headerFill } : {}),
      ...(grid ? { padding: 0 } : {}) })) });
  return new Table({ width: { size: columnWidths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    alignment: AlignmentType.CENTER, layout: TableLayoutType.FIXED, columnWidths,
    borders: Object.fromEntries(["top", "bottom", "left", "right", "insideHorizontal", "insideVertical"].map(k => [k, border])),
    rows: [...(headers ? [makeRow(headers, true)] : []), ...data.map(row => makeRow(row))] });
}

/** Tabla etiqueta/valor sin cabecera: Datos generales, Propósitos, sesión STEAM. */
export function tablaEtiquetas(filas, columnWidths = widths(ANCHOS.etiquetaValor)) {
  return table(null, filas, columnWidths, { labelColumn: true, cantSplit: false });
}
/** Tabla con cabecera: Desempeños, Criterios, Enfoques, Competencias, Rúbrica. */
export function tablaDatos(headers, filas, columnWidths, options = {}) {
  return table(headers, filas, columnWidths, { repeatHeader: true, ...options });
}
/** Colores de relleno y tinta de una fila de rúbrica, en orden AD→C. */
export const rellenosRubrica = () => ({
  fills: [COLOR.fondo, COLOR.rubrica.ad, COLOR.rubrica.a, COLOR.rubrica.b, COLOR.rubrica.c],
  colors: [COLOR.navy, TINTA_SOBRE_RUBRICA.ad, TINTA_SOBRE_RUBRICA.a, TINTA_SOBRE_RUBRICA.b, TINTA_SOBRE_RUBRICA.c],
});

export function answerSpace(lines = 3) {
  const line = { style: BorderStyle.SINGLE, size: 3, color: COLOR.borde };
  return Array.from({ length: lines }, (_, i) => p("", { keepNext: i < lines - 1,
    spacing: { before: 60, after: 100, line: 320 }, border: { bottom: line, between: line } }));
}

/**
 * Encabezado de página: SCIVERSE · TIPO · ÁREA.
 *
 * El pack pone el tipo de documento y el área ahí arriba, y se agradece
 * cuando en la mesa hay seis impresiones distintas.
 */
/* --------------------------------------------------------------------------
   LA MARCA DEL DOCUMENTO EN CURSO

   Igual que la paleta activa de tema.js, y por el mismo motivo: la cabecera se
   construye dentro de `section()`, que la llaman cinco maquetas distintas.
   Añadir `marca` a las cinco significaría que la que se olvidara imprimiría el
   documento del colegio sin su logo. Se fija una vez por documento.
   -------------------------------------------------------------------------- */
let marcaDelDocumento = null;

/** La fija `buildDocument()` antes de armar las secciones. */
export function fijarMarcaDeDocumento(marca) {
  marcaDelDocumento = marca || null;
}

export function header({ tipo = "", area = "", marca } = {}) {
  marca = marca ?? marcaDelDocumento;
  const texto = [MARCA, tipo, area].map(v => clean(v)).filter(Boolean).join(" · ").toUpperCase();
  const linea = { bottom: { style: BorderStyle.SINGLE, size: 4, color: COLOR.borde } };

  // EL LOGO DEL COLEGIO
  //
  // Va en su propio párrafo, encima de la línea de identidad, con la
  // alineación que eligió la docente. Se limita a 90 dxa de alto (≈1,6 cm)
  // para que no empuje el contenido: una cabecera alta se come una página
  // cada diez, y el logo de un colegio suele llegar en cualquier proporción.
  const logo = marca?.logoBytes
    ? [new Paragraph({
        alignment: ALINEACION_LOGO[marca.logoPosicion] || AlignmentType.LEFT,
        spacing: { after: 40 },
        children: [new ImageRun({
          data: marca.logoBytes,
          type: marca.logoTipo || "png",
          transformation: proporcionDeLogo(marca),
        })],
      })]
    : [];

  return new Header({ children: [
    ...logo,
    p(texto, { size: TAMANO.nota, color: COLOR.auxiliar, spacing: { after: 80 }, border: linea }),
  ] });
}

const ALINEACION_LOGO = {
  izquierda: AlignmentType.LEFT,
  centro: AlignmentType.CENTER,
  derecha: AlignmentType.RIGHT,
};

/** Alto fijo de 42 pt; el ancho sale de la proporción real, con tope. */
function proporcionDeLogo(marca) {
  const alto = 42;
  const razon = marca.logoAncho && marca.logoAlto ? marca.logoAncho / marca.logoAlto : 3;
  const ancho = Math.round(Math.min(Math.max(alto * razon, 42), 200));
  return { width: ancho, height: alto };
}
/** Pie con la firma y «Página X de Y» mediante campos reales de Word. */
export function footer() {
  const gris = { font: FUENTE, size: TAMANO.nota, color: COLOR.auxiliar };
  return new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [
    run(PIE, { size: TAMANO.nota, color: COLOR.auxiliar }),
    new TextRun({ ...gris, text: "   |   Página " }),
    new TextRun({ ...gris, children: [PageNumber.CURRENT] }),
    new TextRun({ ...gris, text: " de " }),
    new TextRun({ ...gris, children: [PageNumber.TOTAL_PAGES] })] })] });
}

export function section(children, orientation = "portrait", meta = {}) {
  return { properties: { type: SectionType.NEXT_PAGE, page: {
    // docx intercambia width/height al usar LANDSCAPE: recibe siempre las
    // dimensiones base A4 verticales para evitar el doble intercambio.
    size: { ...PAGE.portrait, orientation: orientation === "landscape" ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT },
    margin: { top: PAGE.margin, bottom: PAGE.margin, left: PAGE.margin, right: PAGE.margin,
      header: PAGINA.header, footer: PAGINA.footer } } },
    headers: { default: header(meta) }, footers: { default: footer() }, children };
}
/** Nombre explícito para el cambio de sección con orientación. */
export const sectionBreak = section;

export function documentFrom(sections, name) {
  return new Document({ creator: "Teaching TIC", title: clean(name),
    styles: { default: { document: { run: { font: THEME.font, size: THEME.body, color: THEME.ink },
      paragraph: { spacing: ESPACIO.parrafo, widowControl: true } } } }, sections });
}
export function filename(prefix, name = "") {
  return `${clean(prefix).replace(/\.docx$/i, "")}_${clean(name)}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\.docx$/i, "").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 120) + ".docx";
}
export async function download(doc, name) {
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob), anchor = document.createElement("a");
  anchor.href = url; anchor.download = name;
  document.body.appendChild(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

// Respaldo para plantillas antiguas: Markdown se convierte a estructura Word.
export function textBlocks(value, total = contentWidth()) {
  const lines = String(value ?? "").split(/\r?\n/), output = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || /^```/.test(line)) continue;
    if (line.includes("|")) {
      const rows = [];
      while (i < lines.length && lines[i].includes("|")) {
        const row = lines[i++].trim().replace(/^\||\|$/g, "").split("|").map(s => s.trim());
        if (!row.every(s => /^:?-+:?$/.test(s))) rows.push(row);
      }
      i--;
      const count = Math.max(...rows.map(r => r.length));
      const normalized = rows.map(r => Array.from({ length: count }, (_, n) => r[n] || ""));
      output.push(table(normalized[0], normalized.slice(1), widths(Array(count).fill(1), total)));
    } else if (/^[-_=]{4,}$/.test(line)) output.push(...answerSpace(1));
    else if (/^#{1,6}\s|^[IVX]+\.\s|^[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s·:]+$/.test(line)) output.push(seccion(line));
    else output.push(p(line.replace(/^[-*]\s/, "• ").replace(/_{4,}/g, "                 ")));
  }
  return output;
}

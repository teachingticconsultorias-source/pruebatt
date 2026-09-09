import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, TableLayoutType, BorderStyle, ShadingType, VerticalAlign,
  AlignmentType, Header, Footer, PageNumber, PageOrientation, SectionType,
  HeightRule, PageBreak } from "docx";

// Todas las medidas son DXA (1440 por pulgada); las fuentes, medios puntos.
export const THEME = { font: "Arial", body: 22, minimum: 20, ink: "202B33",
  accent: "225C58", muted: "566260", border: "A7B3B1", fill: "EDF2F1" };
export const PAGE = { portrait: { width: 11906, height: 16838 },
  landscape: { width: 16838, height: 11906 }, margin: 1000 };
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
  return new Paragraph({ spacing: { after: 100, line: 280 }, widowControl: true,
    ...paragraph, children: chunks.map(t => run(t, { bold: bold || /^\*\*/.test(t), size, color: color || THEME.ink, italics })) });
}
export const title = value => p(value, { bold: true, size: 30, color: THEME.accent,
  keepNext: true, keepLines: true, spacing: { before: 0, after: 220 } });
export const heading = value => p(value, { bold: true, size: 24, color: THEME.accent,
  keepNext: true, keepLines: true, spacing: { before: 200, after: 100 } });
export const pageBreak = () => new Paragraph({ children: [new PageBreak()] });
export function widths(weights, total = contentWidth()) {
  const sum = weights.reduce((a, b) => a + b, 0);
  const values = weights.map(w => Math.floor(total * w / sum));
  values[values.length - 1] += total - values.reduce((a, b) => a + b, 0);
  return values;
}
export function cell(value, width, { header = false, fill, center = false, padding = 100, ...options } = {}) {
  const values = Array.isArray(value) ? value : [value];
  return new TableCell({ width: { size: width, type: WidthType.DXA },
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: padding, bottom: padding, left: padding, right: padding },
    shading: { type: ShadingType.CLEAR, fill: fill || (header ? THEME.fill : "FFFFFF") },
    ...options, children: values.map(v => v instanceof Paragraph ? v : p(v, {
      bold: header, size: THEME.minimum, alignment: center ? AlignmentType.CENTER : undefined,
      spacing: { after: 0, line: 240 } })) });
}
export function table(headers, data, columnWidths, { rowHeight, exact = false, grid = false } = {}) {
  const border = { style: BorderStyle.SINGLE, size: 4, color: THEME.border };
  const makeRow = (values, header = false) => new TableRow({ tableHeader: header || undefined, cantSplit: true,
    ...(rowHeight ? { height: { value: rowHeight, rule: exact ? HeightRule.EXACT : HeightRule.ATLEAST } } : {}),
    children: values.map((v, i) => cell(v, columnWidths[i], { header, center: grid,
      ...(grid ? { padding: 0 } : {}) })) });
  return new Table({ width: { size: columnWidths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    alignment: AlignmentType.CENTER, layout: TableLayoutType.FIXED, columnWidths,
    borders: Object.fromEntries(["top", "bottom", "left", "right", "insideHorizontal", "insideVertical"].map(k => [k, border])),
    rows: [...(headers ? [makeRow(headers, true)] : []), ...data.map(row => makeRow(row))] });
}
export function answerSpace(lines = 3) {
  const line = { style: BorderStyle.SINGLE, size: 3, color: THEME.border };
  return Array.from({ length: lines }, (_, i) => p("", { keepNext: i < lines - 1,
    spacing: { before: 60, after: 100, line: 320 }, border: { bottom: line, between: line } }));
}
export function section(children, orientation = "portrait") {
  return { properties: { type: SectionType.NEXT_PAGE, page: {
    // docx intercambia width/height al usar LANDSCAPE: recibe siempre las
    // dimensiones base A4 verticales para evitar el doble intercambio.
    size: { ...PAGE.portrait, orientation: orientation === "landscape" ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT },
    margin: { top: PAGE.margin, bottom: PAGE.margin, left: PAGE.margin, right: PAGE.margin, header: 420, footer: 420 } } },
    headers: { default: new Header({ children: [p("SciVerse · una iniciativa de Teaching TIC", {
      size: 20, color: THEME.muted, spacing: { after: 80 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: THEME.border } } })] }) },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER,
      children: [run("Teaching TIC · Kantu · Página ", { size: 20, color: THEME.muted }),
        new TextRun({ children: [PageNumber.CURRENT], font: THEME.font, size: 20 }), run(" de ", { size: 20 }),
        new TextRun({ children: [PageNumber.TOTAL_PAGES], font: THEME.font, size: 20 })] })] }) }, children };
}
export function documentFrom(sections, name) {
  return new Document({ creator: "Teaching TIC", title: clean(name),
    styles: { default: { document: { run: { font: THEME.font, size: THEME.body, color: THEME.ink },
      paragraph: { spacing: { after: 100, line: 280 }, widowControl: true } } } }, sections });
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
    else if (/^#{1,6}\s|^[IVX]+\.\s|^[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s·:]+$/.test(line)) output.push(heading(line));
    else output.push(p(line.replace(/^[-*]\s/, "• ").replace(/_{4,}/g, "                 ")));
  }
  return output;
}

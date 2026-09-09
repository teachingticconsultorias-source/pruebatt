import { describe, it, expect } from "vitest";
import fs from "node:fs";
import JSZip from "jszip";
import { Packer } from "docx";
import { buildDocument, buildCompleteClass } from "../lib/docx/exporters.js";
import { documentFrom, section, textBlocks, filename } from "../lib/docx/core.js";
import { fixtures, form, instrument, worksheet, wordsearch } from "./fixtures/word.js";

async function unpack(doc) {
  const zip = await JSZip.loadAsync(await Packer.toBuffer(doc));
  const xml = await zip.file("word/document.xml").async("string");
  const all = (await Promise.all(Object.keys(zip.files).filter(n => /^word\/.*\.xml$/.test(n)).map(n => zip.file(n).async("string")))).join("\n");
  return { xml, all };
}
const orientations = xml => [...xml.matchAll(/<w:pgSz\b[^>]*w:orient="([^"]+)"[^>]*\/>/g)].map(m => m[1]);
const tables = xml => xml.match(/<w:tbl>[\s\S]*?<\/w:tbl>/g) || [];
const rows = xml => xml.match(/<w:tr[ >][\s\S]*?<\/w:tr>/g) || [];

describe("Word · documentos reales empaquetados", () => {
  it.each(fixtures)("%s tiene identidad, contenido limpio y fuente legible", async (_, type, resource) => {
    const { xml, all } = await unpack(type === "complete" ? buildCompleteClass(resource) : buildDocument(type, { form, resource }));
    expect(xml).not.toMatch(/undefined|\[object Object\]|\bnull\b|\*\*|##|`|\|/);
    expect(all).toContain("SciVerse · una iniciativa de Teaching TIC");
    expect(all).toContain("Teaching TIC · Kantu · Página");
    expect(all).toContain("NUMPAGES");
    expect(all).toContain("PAGE");
    for (const match of all.matchAll(/<w:sz w:val="(\d+)"/g)) expect(Number(match[1])).toBeGreaterThanOrEqual(20);
    for (const match of xml.matchAll(/<w:pgSz w:w="(\d+)" w:h="(\d+)" w:orient="([^"]+)"/g)) {
      expect(Number(match[1]) > Number(match[2])).toBe(match[3] === "landscape");
    }
    expect(xml).toContain("w:keepNext");
  });

  it("cotejo: 30 estudiantes, seis criterios breves, tabla horizontal", async () => {
    const { xml } = await unpack(buildDocument("checklist", { form, resource: instrument }));
    expect(orientations(xml)).toEqual(["portrait", "landscape"]);
    const register = tables(xml).at(-1);
    expect(rows(register)).toHaveLength(31);
    expect(rows(register)[0]).toContain("C6");
    expect(rows(register)[0]).not.toContain(instrument.criterios[0].criterio);
    expect(register).toContain("☐ Sí"); expect(register).toContain("☐ No");
    expect(register.match(/<w:tblHeader/g)).toHaveLength(1);
    expect(register.match(/<w:cantSplit/g)).toHaveLength(31);
  });
  it("no recorta criterios: 14 se distribuyen en tres registros", async () => {
    const criteria = Array.from({ length: 14 }, (_, i) => ({ criterio: `Criterio único ${i + 1}` }));
    const { xml } = await unpack(buildDocument("checklist", { form, resource: { criterios: criteria } }));
    expect(orientations(xml)).toEqual(["portrait", "landscape", "landscape", "landscape"]);
    expect(xml).toContain("C14");
    for (const c of criteria) expect(xml).toContain(c.criterio);
  });
  it("escala: 25 estudiantes, tabla real y leyenda completa", async () => {
    const { xml } = await unpack(buildDocument("rating_scale", { form, resource: instrument }));
    expect(orientations(xml)).toEqual(["portrait", "landscape"]);
    expect(rows(tables(xml).at(-1))).toHaveLength(26);
    for (const text of ["S = Siempre", "AV = A veces", "NH = No lo hace", "NO = No observado", "C6"]) expect(xml).toContain(text);
  });
  it("rúbrica: ocho criterios y cuatro niveles en cinco columnas legibles", async () => {
    const { xml } = await unpack(buildDocument("rubric", { form, resource: fixtures[3][2] }));
    const rubric = tables(xml).at(-1);
    expect(orientations(xml).at(-1)).toBe("landscape");
    const rubricTables = tables(xml).slice(1);
    expect(rubricTables.map(t => rows(t).length)).toEqual([5, 5]);
    expect(rows(rubric)[0].match(/<w:tc>/g)).toHaveLength(5);
    expect(rows(rubric)[0]).toMatch(/Criterio[\s\S]*Inicio[\s\S]*En proceso[\s\S]*Logro esperado[\s\S]*Logro destacado/);
  });
  it("sesión vertical y Clase completa vuelve a vertical para el material", async () => {
    expect(orientations((await unpack(buildDocument("session", { form, resource: fixtures[0][2] }))).xml)).toEqual(["portrait"]);
    const { xml } = await unpack(buildCompleteClass(fixtures[1][2]));
    expect(orientations(xml)).toEqual(["portrait", "portrait", "landscape", "portrait"]);
    expect(xml).toMatch(/PARTE I · SESIÓN[\s\S]*PARTE II · INSTRUMENTO[\s\S]*PARTE III · MATERIAL/);
    expect(xml.match(/<w:sectPr>/g)).toHaveLength(4);
  });
  it("ficha: campos, actividades, tabla, opciones y bordes para respuestas", async () => {
    const { xml } = await unpack(buildDocument("worksheet", { form, resource: worksheet }));
    for (const value of ["Nombre y apellidos", "Grado y sección", "Fecha", "Área", "Tema", "¿Qué cambios observaste?", "Evaporación"]) expect(xml).toContain(value);
    expect(xml).toContain("w:pBdr");
    expect(xml).not.toContain("_____");
    expect(tables(xml)).toHaveLength(2);
  });
  it("mantiene el esquema antiguo secciones.items y su cierre", async () => {
    const { xml } = await unpack(buildDocument("worksheet", { resource: { secciones: [{ titulo: "Prueba", items: [{ tipo: "respuesta_corta", texto: "Pregunta antigua" }] }], cierre: { preguntas: ["Reflexión antigua"] } } }));
    expect(xml).toContain("Pregunta antigua"); expect(xml).toContain("Reflexión antigua");
  });
  it("una tabla ancha de ficha cambia de sección y vuelve a vertical", async () => {
    const resource = { secciones: [{ titulo: "Registro", actividades: [
      { tipo: "tabla", texto: "Compara los datos", columnas: ["A", "B", "C", "D", "E", "F"] },
      { tipo: "respuesta_corta", texto: "Explica tu conclusión" }] }] };
    const { xml } = await unpack(buildDocument("worksheet", { form, resource }));
    expect(orientations(xml)).toEqual(["portrait", "landscape", "portrait"]);
    expect(xml).toContain("Explica tu conclusión");
  });
  it("conserva los descriptores de las dos versiones antiguas de rúbrica", async () => {
    for (const criterion of [{ criterio: "Criterio", ad: "Avanzado", a: "Esperado", b: "En proceso", c: "Inicial" },
      { criterio: "Criterio", destacado: "Avanzado", esperado: "Esperado", proceso: "En proceso", inicio: "Inicial" }]) {
      const { xml } = await unpack(buildDocument("rubric", { resource: { criterios: [criterion] } }));
      for (const value of ["Avanzado", "Esperado", "En proceso", "Inicial"]) expect(xml).toContain(value);
    }
  });
  it("lectura conserva texto, vocabulario y tres niveles", async () => {
    const { xml } = await unpack(buildDocument("reading", { form, resource: fixtures[7][2] }));
    for (const value of ["ANTES DE LEER", "TEXTO", "DESPUÉS DE LEER", "Literal", "Inferencial", "Crítica", "Vocabulario"]) expect(xml).toContain(value);
  });
  it("reto conserva sus bloques completos", async () => {
    const { xml } = await unpack(buildDocument("challenge", { resource: fixtures[8][2] }));
    for (const value of ["Misión", "Objetivo", "Roles", "Producto", "Materiales", "Preparación", "Pasos", "Condición de éxito", "Variante", "Criterios"]) expect(xml).toContain(value);
  });
  it("sopa grande: celdas cuadradas, centrada y solucionario separado", async () => {
    const { xml } = await unpack(buildDocument("wordsearch", { resource: wordsearch }));
    expect(orientations(xml)).toEqual(["landscape"]);
    expect(tables(xml)).toHaveLength(2);
    expect(rows(tables(xml)[0])).toHaveLength(20);
    expect(xml).toContain('w:type="page"');
    expect(xml).toContain("SOLUCIONARIO");
    expect(xml).toContain('w:hRule="exact"');
    const height = xml.match(/<w:trHeight w:val="(\d+)"/)[1];
    const width = tables(xml)[0].match(/<w:gridCol w:w="(\d+)"/)[1];
    expect(height).toBe(width);
    expect(xml).toContain('w:jc w:val="center"');
  });
  it("Markdown accidental se convierte en tabla y runs, sin marcas", async () => {
    const { xml } = await unpack(documentFrom([section(textBlocks("## Título\n**Texto importante**\n| Campo | Valor |\n| --- | --- |\n| Agua | Limpia |\n________"))], "Prueba"));
    expect(xml).not.toMatch(/##|\*\*|\||____/); expect(tables(xml)).toHaveLength(1);
    expect(xml).toContain("Texto importante"); expect(xml).toContain("<w:b/>");
  });
  it("nombres portables sin caracteres reservados", () => {
    expect(filename("Lista de cotejo", "Redes: sociales / 2.º")).toBe("Lista_de_cotejo_Redes_sociales_2.docx");
    expect(filename("sesion.docx")).not.toContain("docx.docx");
  });
  it("todas las pantallas activas usan los constructores compartidos", () => {
    for (const file of ["App.jsx", "components/SessionNextFlow.jsx", "components/SessionResourcesPanel.jsx"]) {
      const src = fs.readFileSync(file, "utf8");
      expect(src).toContain("lib/docx/exporters.js");
      expect(src).not.toMatch(/new Document\(|Packer\.toBlob|from "docx"/);
    }
    const app = fs.readFileSync("App.jsx", "utf8");
    expect(app).toContain("onNext={keepInstrument}");
    expect(app).toContain("downloadCompleteClass({session:sessionContext,instrument:instrumentContext,material:materialContext,profile})");
    expect(app).toContain('downloadResource(full.tipo,');
  });
});

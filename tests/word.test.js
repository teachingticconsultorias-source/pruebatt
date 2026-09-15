import { describe, it, expect } from "vitest";
import fs from "node:fs";
import JSZip from "jszip";
import { Packer } from "docx";
import { buildDocument, buildCompleteClass } from "../lib/docx/exporters.js";
import { documentFrom, section, textBlocks, filename } from "../lib/docx/core.js";
import { challenge, complete, fixtures, form, formDPCC, formLargo, instrument,
  instrumentoLargo, project, reading, session, sessionDPCC, sessionLarga,
  worksheet, wordsearch } from "./fixtures/word.js";

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
    // El pack entregado firmaba de dos maneras distintas; ahora hay una sola.
    expect(all).toContain("SciVerse · una iniciativa de Teaching TIC");
    expect(all).not.toContain("Teaching TIC · Kantu");
    expect(all).toContain("SCIVERSE ·");
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
  it("rúbrica: vertical, una sola tabla y los ocho criterios completos", async () => {
    // La plantilla oficial resuelve sus cinco columnas en A4 vertical. Se deja
    // de partir en bloques: la tabla es una sola y repite cabecera.
    const { xml } = await unpack(buildDocument("rubric", { form, resource: fixtures[3][2] }));
    const rubric = tables(xml).at(-1);
    expect(orientations(xml)).toEqual(["portrait"]);
    expect(rows(rubric)).toHaveLength(9);
    expect(rows(rubric)[0].match(/<w:tc>/g)).toHaveLength(5);
    expect(rows(rubric)[0]).toMatch(/Criterio[\s\S]*Logro destacado \(AD\)[\s\S]*Logrado \(A\)[\s\S]*En proceso \(B\)[\s\S]*En inicio \(C\)/);
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
    for (const file of ["App.jsx", "components/LabGuideGenerator.jsx"]) {
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

/* ============================================================================
   IDENTIDAD DE LAS PLANTILLAS OFICIALES

   Fase 2 del encargo: las exportaciones adoptan el lenguaje visual medido en
   PLANTILLAS/SCIVERSE/ —Calibri, navy 0B2E4F, azul 1C74BC, fondo EAF4FB, A4
   vertical con margen 900— sin perder nada de lo que SciVerse ya generaba.

   Estas pruebas no miran «que se vea bonito»: miran los atributos concretos
   del OOXML que producen ese resultado, y las reglas que evitan que el texto
   generado por Gemini se corte cuando es largo.
   ========================================================================== */
describe("Word · identidad y estructura de las plantillas", () => {
  const sesion = () => buildDocument("session", { form, resource: session });
  const proyecto = () => buildDocument("project", { form, resource: project });

  it("usa Calibri, la paleta del pack y ningún color suelto fuera de tema.js", async () => {
    const { all, xml } = await unpack(sesion());
    expect(all).toContain('w:ascii="Calibri"');
    expect(all).not.toMatch(/w:ascii="(?!Calibri)/);
    expect(xml).toContain('w:val="0B2E4F"');   // navy
    expect(xml).toContain('w:val="1C74BC"');   // azul
    expect(xml).toContain('w:fill="0B2E4F"');  // barra de momento y cabeceras
    expect(xml).toContain('w:fill="EAF4FB"');  // celda-etiqueta y destacados
  });

  it("los encabezados de sección llevan su regla azul inferior", async () => {
    const { xml } = await unpack(sesion());
    const reglas = xml.match(/<w:bottom w:val="single" w:color="1C74BC" w:sz="10"/g) || [];
    expect(reglas.length).toBeGreaterThanOrEqual(11);
  });

  it("header con marca, tipo y área; footer único con Página X de Y", async () => {
    const zip = await JSZip.loadAsync(await Packer.toBuffer(sesion()));
    const cabecera = await zip.file(Object.keys(zip.files).find(n => /header\d*\.xml$/.test(n))).async("string");
    const pie = await zip.file(Object.keys(zip.files).find(n => /footer\d*\.xml$/.test(n))).async("string");
    expect(cabecera).toContain("SCIVERSE");
    expect(cabecera).toContain("SESIÓN DE APRENDIZAJE");
    expect(cabecera).toContain("CIENCIA Y TECNOLOGÍA");
    expect(pie).toContain("SciVerse · una iniciativa de Teaching TIC");
    expect(pie).toContain("PAGE");
    expect(pie).toContain("NUMPAGES");
  });

  it("A4 vertical con el margen de 900 del pack", async () => {
    const { xml } = await unpack(sesion());
    expect(xml).toContain('<w:pgSz w:w="11906" w:h="16838" w:orient="portrait"');
    expect(xml).toMatch(/<w:pgMar w:top="900" w:right="900" w:bottom="900" w:left="900"/);
  });

  it("la sesión tiene las catorce secciones de la plantilla", async () => {
    const { xml } = await unpack(sesion());
    const secciones = ["DATOS GENERALES", "PROPÓSITOS DE APRENDIZAJE", "DESEMPEÑOS PRECISADOS",
      "CRITERIOS DE EVALUACIÓN", "ENFOQUES TRANSVERSALES", "PREPARACIÓN DOCENTE", "MATERIALES",
      "SECUENCIA DIDÁCTICA", "ORIENTACIONES DUA", "INSTRUMENTO SUGERIDO", "REFLEXIONES DEL DOCENTE",
      "ANEXO 1 ·", "ANEXO 2 ·", "ANEXO 3 ·"];
    expect(secciones).toHaveLength(14);
    for (const titulo of secciones) expect(xml, titulo).toContain(titulo);
  });

  it("NO inventa el estándar de aprendizaje: la fila simplemente no está", async () => {
    const { xml } = await unpack(sesion());
    expect(xml).not.toContain("Estándar de aprendizaje");
    expect(xml).not.toMatch(/Por completar|N\/A|Generado por IA/);
  });

  it("propósitos, desempeños, criterios y enfoques son tablas reales", async () => {
    const { xml } = await unpack(sesion());
    const cabeceras = tables(xml).map(t => rows(t)[0]);
    expect(xml).toMatch(/Propósito[\s\S]*Competencia[\s\S]*Capacidades[\s\S]*Evidencia/);
    expect(cabeceras.some(r => /Capacidad[\s\S]*Desempeño/.test(r))).toBe(true);
    expect(cabeceras.some(r => /Capacidad[\s\S]*Criterio[\s\S]*Evidencia observable/.test(r))).toBe(true);
    expect(cabeceras.some(r => /Enfoque[\s\S]*Valor[\s\S]*Actitud observable/.test(r))).toBe(true);
    // Datos generales + propósitos + desempeños + criterios + enfoques.
    expect(tables(xml).length).toBeGreaterThanOrEqual(5);
  });

  it("la secuencia usa barras navy para Inicio, Desarrollo y Cierre", async () => {
    const { xml } = await unpack(sesion());
    for (const momento of ["Inicio · 15 minutos", "Desarrollo · 60 minutos", "Cierre · 15 minutos"]) {
      expect(xml).toContain(momento);
    }
    expect(xml).toContain("Criterios compartidos");
    expect(xml).toContain("Mensaje de logro");
    expect(xml).toContain("Consigna");
    expect(xml).toContain("Preguntas de mediación");
    // Los procesos son los que generó el modelo, no un catálogo por área.
    expect(xml).toContain("Planteamiento del problema");
    expect(xml).toContain("Recojo de datos y análisis de resultados");
  });

  it("el bloque de anexos abre en página nueva y no desperdicia hojas", async () => {
    const { xml } = await unpack(sesion());
    expect(xml).toContain("ANEXOS PARA LA CLASE");
    const saltos = (xml.match(/w:type="page"/g) || []).length;
    // Al menos uno: los anexos NO continúan debajo de las reflexiones.
    expect(saltos).toBeGreaterThanOrEqual(1);
    // Y como mucho uno por anexo: un anexo de tres líneas no abre hoja propia,
    // que es lo que dejaba tres cuartos de página en blanco.
    expect(saltos).toBeLessThanOrEqual(session.anexos.length);
  });

  it("no genera anexos vacíos si el recurso no los trae", async () => {
    const { xml } = await unpack(buildDocument("session", { form, resource: { ...session, anexos: [] } }));
    expect(xml).not.toContain("ANEXOS PARA LA CLASE");
    expect(xml).not.toContain("ANEXO 1");
  });

  it("la rúbrica va de AD a C con la escala de color del pack", async () => {
    const { xml } = await unpack(buildDocument("rubric", { form, resource: instrument }));
    const rubrica = tables(xml).at(-1);
    const fila = rows(rubrica)[1];
    expect(fila).toContain('w:fill="1C74BC"');  // AD
    expect(fila).toContain('w:fill="6BB3E0"');  // A
    expect(fila).toContain('w:fill="BBDBF0"');  // B
    expect(fila).toContain('w:fill="EAF4FB"');  // C
    expect(fila).toContain('w:val="FFFFFF"');   // texto legible sobre el azul
    expect(rubrica).toContain("<w:tblHeader");
  });

  it("STEAM: las nueve secciones romanas, la tabla S/T/E/A/M, semanas y sesiones", async () => {
    const { xml } = await unpack(proyecto());
    for (const romano of ["I.  DATOS INFORMATIVOS", "II.  SITUACIÓN SIGNIFICATIVA", "III.  RETO STEAM",
      "IV.  INTEGRACIÓN STEAM", "V.  COMPETENCIAS POR ÁREA", "VI.  PRODUCTO ESPERADO",
      "VII.  EVIDENCIAS", "VIII.  RUTA DE TRABAJO POR SEMANAS", "IX.  SESIONES DE APRENDIZAJE"]) {
      expect(xml, romano).toContain(romano);
    }
    const steam = tables(xml).find(t => /Componente[\s\S]*interviene/.test(rows(t)[0]));
    expect(steam).toBeTruthy();
    expect(rows(steam)).toHaveLength(6);
    for (const inicial of ["S", "T", "E", "A", "M"]) expect(steam).toContain(">" + inicial + "<");
    expect(xml).toContain("SEMANA 1 · Investigamos y medimos");
    expect(xml).toContain("SEMANA 2 · Construimos y comunicamos");
    expect(xml).toContain("SESIÓN 1 · ¿Cómo viaja el agua?");
    expect(xml).toContain("Actividad central");
    expect(xml).toContain("Instrumento");
    // Nada de volcado genérico de claves técnicas.
    expect(xml).not.toContain("Ruta Semanas");
    expect(xml).not.toContain("Integracion");
  });

  it("clase completa: la rúbrica del paso 2 va al anexo y NO se repite", async () => {
    const conRubrica = { ...complete, instrument: { type: "rubric", form, resource: instrument } };
    const { xml } = await unpack(buildCompleteClass(conRubrica));
    expect(xml).toContain("PARTE I · SESIÓN");
    expect(xml).not.toContain("PARTE II · INSTRUMENTO");
    expect(xml).toContain("PARTE III · MATERIAL");
    expect(xml).toContain("RÚBRICA ANALÍTICA DE EVALUACIÓN");
    expect((xml.match(/Logro destacado \(AD\)/g) || [])).toHaveLength(1);
    for (const c of instrument.criterios) expect(xml).toContain(c.criterio);
  });

  it("clase completa: cualquier otro instrumento conserva su parte entera", async () => {
    const { xml } = await unpack(buildCompleteClass(complete));
    expect(xml).toMatch(/PARTE I · SESIÓN[\s\S]*PARTE II · INSTRUMENTO[\s\S]*PARTE III · MATERIAL/);
  });
});

describe("Word · resistencia al contenido largo", () => {
  it("cantSplit ya no es global: sólo lo llevan los registros nominales", async () => {
    const { xml } = await unpack(buildDocument("session", { form, resource: session }));
    expect(xml).not.toContain("<w:cantSplit");
    const rubrica = (await unpack(buildDocument("rubric", { form, resource: instrumentoLargo }))).xml;
    // Una fila con cuatro descriptores largos DEBE poder partirse: prohibirlo
    // dejaría media página en blanco y empujaría la tabla entera.
    expect(rubrica).not.toContain("<w:cantSplit");
    const cotejo = (await unpack(buildDocument("checklist", { form, resource: instrument }))).xml;
    expect(cotejo).toContain("<w:cantSplit");
  });

  it("las tablas extensas repiten cabecera al cambiar de página", async () => {
    for (const [tipo, recurso] of [["session", sessionLarga], ["rubric", instrumentoLargo],
      ["project", project], ["checklist", instrument]]) {
      const { xml } = await unpack(buildDocument(tipo, { form: formLargo, resource: recurso }));
      expect(xml, tipo).toContain("<w:tblHeader");
    }
  });

  it("ninguna celda tiene altura exacta salvo la cuadrícula de la sopa", async () => {
    for (const [, tipo, recurso] of fixtures.filter(([n]) => !n.includes("sopa"))) {
      const doc = tipo === "complete" ? buildCompleteClass(recurso) : buildDocument(tipo, { form, resource: recurso });
      const { xml } = await unpack(doc);
      expect(xml, tipo).not.toContain('w:hRule="exact"');
    }
    const sopa = (await unpack(buildDocument("wordsearch", { resource: wordsearch }))).xml;
    expect(sopa).toContain('w:hRule="exact"');
  });

  it("un área, un título y unos criterios larguísimos entran completos", async () => {
    const { xml } = await unpack(buildDocument("session", { form: formLargo, resource: sessionLarga }));
    expect(xml).toContain("Desarrollo Personal, Ciudadanía y Cívica (DPCC)");
    expect(xml).toContain("Institución Educativa Emblemática Nuestra Señora de la Asunción de Chiquián");
    expect(formLargo.tema.length).toBeGreaterThan(150);
    expect(xml).toContain(formLargo.tema);
    // El párrafo largo aparece en desempeños, criterios y enfoques, entero.
    expect(xml).toContain("incorporando al menos dos fuentes de información revisadas en clase.");
    expect(xml).not.toMatch(/undefined|\[object Object\]|\bnull\b/);
    // Y nunca se recurre a letra ilegible para hacerlo caber.
    for (const m of xml.matchAll(/<w:sz w:val="(\d+)"/g)) expect(Number(m[1])).toBeGreaterThanOrEqual(20);
  });

  it("la horizontal queda sólo donde el contenido la exige", async () => {
    const cotejo = (await unpack(buildDocument("checklist", { form, resource: instrument }))).xml;
    expect(orientations(cotejo)).toEqual(["portrait", "landscape"]);
    const escala = (await unpack(buildDocument("rating_scale", { form, resource: instrument }))).xml;
    expect(orientations(escala)).toEqual(["portrait", "landscape"]);
    const sopa = (await unpack(buildDocument("wordsearch", { resource: wordsearch }))).xml;
    expect(orientations(sopa)).toEqual(["landscape"]);
    // Sesión, proyecto, rúbrica, reto y lectura siguen la plantilla: vertical.
    for (const [tipo, recurso] of [["session", session], ["project", project],
      ["rubric", instrument], ["challenge", challenge], ["reading", reading]]) {
      const { xml } = await unpack(buildDocument(tipo, { form, resource: recurso }));
      expect(orientations(xml), tipo).toEqual(["portrait"]);
    }
  });

  it("nada de Markdown, pipes ni marcadores técnicos en ningún documento", async () => {
    for (const [nombre, tipo, recurso] of fixtures) {
      const doc = tipo === "complete" ? buildCompleteClass(recurso) : buildDocument(tipo, { form, resource: recurso });
      const { xml } = await unpack(doc);
      expect(xml, nombre).not.toMatch(/undefined|\[object Object\]|\bnull\b|\*\*|##|`|\|/);
      expect(xml, nombre).not.toContain("_____");
    }
  });
});

/* ============================================================================
   FIDELIDAD A LA MAQUETA · lo que NO puede volver a ser texto corrido

   El encargo de correccion señala el riesgo concreto: que alguien sustituya una
   tabla por parrafos «Capacidad: … / Desempeño: …». Estas pruebas fallan si eso
   ocurre, porque comprueban que el dato vive DENTRO de un <w:tbl>.
   ========================================================================== */
describe("Word · la sesión reproduce la maqueta, no la parafrasea", () => {
  const construye = (resource = session, formulario = form) =>
    buildDocument("session", { form: formulario, resource });

  /** ¿Aparece este texto dentro de alguna tabla del documento? */
  const enTabla = (xml, texto) => tables(xml).some(t => t.includes(texto));

  it("las cinco estructuras de la primera mitad son tablas de verdad", async () => {
    const { xml } = await unpack(construye());
    // Datos generales
    expect(enTabla(xml, "IE Demostración")).toBe(true);
    expect(enTabla(xml, "Ciencia y Tecnología")).toBe(true);
    // Propósitos
    expect(enTabla(xml, session.proposito)).toBe(true);
    expect(enTabla(xml, "Evidencia")).toBe(true);
    // Desempeños
    expect(enTabla(xml, session.desempenosPrecisados[0].desempeno)).toBe(true);
    // Criterios
    expect(enTabla(xml, session.criteriosDetallados[0].criterio)).toBe(true);
    expect(enTabla(xml, "Evidencia observable")).toBe(true);
    // Enfoques
    expect(enTabla(xml, session.enfoquesTransversales[0].actitudObservable)).toBe(true);
  });

  it("NO existe la forma «Capacidad: … / Desempeño: …» como sustituto de tabla", async () => {
    const { xml } = await unpack(construye());
    for (const patron of ["Capacidad:", "Desempeño:", "Evidencia observable:",
      "Actitud observable:", "Enfoque:", "Valor:"]) {
      expect(xml, patron).not.toContain(patron);
    }
  });

  it("cabeceras navy con texto blanco en las tres tablas con encabezado", async () => {
    const { xml } = await unpack(construye());
    const conCabecera = tables(xml).filter(t => rows(t)[0].includes('w:fill="0B2E4F"'));
    expect(conCabecera).toHaveLength(3);   // desempeños, criterios, enfoques
    for (const t of conCabecera) {
      expect(rows(t)[0]).toContain('w:val="FFFFFF"');
      expect(t).toContain("<w:tblHeader");
    }
  });

  it("las etiquetas de datos generales y propósitos van sobre celeste", async () => {
    const { xml } = await unpack(construye());
    const etiqueta = tables(xml).filter(t => t.includes('w:fill="EAF4FB"'));
    expect(etiqueta.length).toBeGreaterThanOrEqual(2);
  });

  it("el tema va en la banda celeste, no como texto negro suelto", async () => {
    const { xml } = await unpack(construye());
    const banda = xml.match(/<w:p>(?:(?!<\/w:p>)[\s\S])*Ciclo del agua(?:(?!<\/w:p>)[\s\S])*<\/w:p>/);
    expect(banda).toBeTruthy();
    expect(banda[0]).toContain('w:fill="EAF4FB"');
    expect(banda[0]).toContain('w:val="1C74BC"');
    expect(banda[0]).toContain('w:jc w:val="center"');
  });

  it("no queda ni rastro del teal del diseño anterior", async () => {
    for (const [nombre, tipo, recurso] of fixtures) {
      const doc = tipo === "complete" ? buildCompleteClass(recurso) : buildDocument(tipo, { form, resource: recurso });
      const { all } = await unpack(doc);
      expect(all, nombre).not.toMatch(/225C58|EDF2F1|A7B3B1|202B33|3EC6C0/);
    }
  });

  it("la cabecera de datos del equipo va SOLO en la guía de trabajo", async () => {
    const { xml } = await unpack(construye());
    // Una ficha informativa se lee; no se rellena.
    const anexo1 = xml.slice(xml.indexOf("ANEXO 1"), xml.indexOf("ANEXO 2"));
    expect(anexo1).not.toContain("Nombres de los integrantes");
    const anexo2 = xml.slice(xml.indexOf("ANEXO 2"), xml.indexOf("ANEXO 3"));
    expect(anexo2).toContain("Nombres de los integrantes");
    expect(anexo2).toContain("Grado y sección");
    expect(anexo2).toContain("Fecha");
    // Espacios para escribir: bordes de párrafo, nunca guiones bajos.
    expect(anexo2).toContain("w:pBdr");
    expect(xml).not.toContain("____");
  });

  it("los anexos no dejan páginas casi vacías", async () => {
    // Un anexo corto NO abre hoja propia: continúa debajo del anterior.
    const { xml } = await unpack(construye());
    const saltos = (xml.match(/w:type="page"/g) || []).length;
    expect(saltos).toBeLessThanOrEqual(session.anexos.length);
    expect(xml).toContain("ANEXOS PARA LA CLASE");
  });
});

describe("Word · caso real DPCC en Secundaria", () => {
  it("el área más larga del catálogo entra entera y en su celda", async () => {
    const { xml } = await unpack(buildDocument("session", { form: formDPCC, resource: sessionDPCC }));
    expect(xml).toContain("Desarrollo Personal, Ciudadanía y Cívica (DPCC)");
    expect(tables(xml)[0]).toContain("Desarrollo Personal, Ciudadanía y Cívica (DPCC)");
    // La IE larga crece en su celda, no se recorta.
    expect(tables(xml)[0]).toContain(formDPCC.institucion);
    // El título de 111 caracteres va completo en la banda.
    expect(xml).toContain(formDPCC.tema);
  });

  it("desempeños, criterios y enfoques siguen siendo tablas con DPCC", async () => {
    const { xml } = await unpack(buildDocument("session", { form: formDPCC, resource: sessionDPCC }));
    const enTabla = t => tables(xml).some(x => x.includes(t));
    expect(enTabla(sessionDPCC.desempenosPrecisados[0].desempeno)).toBe(true);
    expect(enTabla(sessionDPCC.criteriosDetallados[0].criterio)).toBe(true);
    expect(enTabla(sessionDPCC.enfoquesTransversales[1].actitudObservable)).toBe(true);
    // Los tres procesos de DPCC aparecen con su subtítulo.
    for (const proceso of sessionDPCC.desarrollo.procesos) expect(xml).toContain(proceso.subtitulo);
    expect(xml).not.toContain('w:hRule="exact"');
  });
});

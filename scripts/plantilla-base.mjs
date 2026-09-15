#!/usr/bin/env node
/* ==========================================================================
   LA PLANTILLA DE PARTIDA DEL COLEGIO

   Genera `public/plantillas/plantilla-base-sciverse.docx`: un documento de
   Word con los marcadores `{{...}}` colocados y explicados, para que una
   docente Pro lo descargue, le ponga el membrete y los estilos de su colegio,
   y lo vuelva a subir.

   POR QUÉ SE GENERA Y NO SE COMMITEA A MANO
   -----------------------------------------
   Porque el contrato de marcadores vive en `lib/export/plantilla.js`. Si
   alguien añade uno allí y la plantilla fuera un binario hecho a mano, las dos
   cosas se separarían en silencio. Aquí se lee la misma lista, así que la
   plantilla no puede quedarse atrás: basta volver a ejecutar esto.

   USO
   ---
     node scripts/plantilla-base.mjs        (regenera el .docx versionado)
   ========================================================================== */
import fs from "node:fs/promises";
import path from "node:path";
import { Document, Packer, Paragraph, TextRun, AlignmentType, BorderStyle,
  ShadingType, HeadingLevel } from "docx";

import { MARCADORES, MARCADORES_MINIMOS } from "../lib/export/plantilla.js";
import { COLOR_NITIA, FUENTE, TAMANO } from "../lib/docx/tema.js";

const texto = (contenido, opciones = {}) => new Paragraph({
  spacing: { after: 120 },
  ...opciones,
  children: [new TextRun({ text: contenido, font: FUENTE, size: TAMANO.cuerpo, ...(opciones.run || {}) })],
});

const titulo = (contenido) => new Paragraph({
  alignment: AlignmentType.CENTER, spacing: { after: 160 },
  children: [new TextRun({ text: contenido, font: FUENTE, size: TAMANO.titulo, bold: true, color: COLOR_NITIA.navy })],
});

const seccion = (contenido) => new Paragraph({
  spacing: { before: 260, after: 120 },
  border: { bottom: { style: BorderStyle.SINGLE, size: 10, color: COLOR_NITIA.azul } },
  children: [new TextRun({ text: contenido, font: FUENTE, size: TAMANO.seccion, bold: true, color: COLOR_NITIA.navy })],
});

const nota = (contenido) => new Paragraph({
  spacing: { after: 140 },
  shading: { type: ShadingType.CLEAR, fill: COLOR_NITIA.fondo },
  children: [new TextRun({ text: contenido, font: FUENTE, size: TAMANO.nota, italics: true, color: COLOR_NITIA.auxiliar })],
});

const marcador = (clave) => new Paragraph({
  spacing: { after: 160 },
  children: [new TextRun({ text: `{{${clave}}}`, font: FUENTE, size: TAMANO.cuerpo, bold: true, color: COLOR_NITIA.azul })],
});

const lineas = MARCADORES.filter((m) => m.tipo === "linea");
const bloques = MARCADORES.filter((m) => m.tipo === "bloque");

const documento = new Document({
  creator: "Teaching TIC",
  title: "Plantilla base de exportación · SciVerse",
  styles: { default: { document: { run: { font: FUENTE, size: TAMANO.cuerpo, color: COLOR_NITIA.texto } } } },
  sections: [{
    properties: { page: { margin: { top: 900, right: 900, bottom: 900, left: 900 } } },
    children: [
      titulo("PLANTILLA BASE DE TU COLEGIO"),
      nota("Este documento es tuyo: cámbiale el membrete, los tipos de letra, los colores y el orden de las secciones como quieras. Lo único que NO debes borrar son las marcas entre llaves dobles: ahí es donde SciVerse coloca el contenido que genera. Cuando termines, súbelo en Mi cuenta → Personalizar export."),

      seccion("CÓMO FUNCIONA"),
      texto("Cada marca entre llaves se sustituye por su contenido al exportar. Puedes moverlas, ponerlas dentro de una tabla o dentro de un cuadro de texto, y puedes borrar las que no quieras usar."),
      texto("Dos de ellas son obligatorias porque sin ellas el documento saldría vacío:", { run: { bold: true } }),
      ...MARCADORES_MINIMOS.map((clave) => texto(`   •  {{${clave}}}`, { run: { bold: true, color: COLOR_NITIA.azul } })),
      nota("Consejo: escribe las marcas a mano o pégalas como texto sin formato. Si Word parte «{{titulo}}» en trozos con distinto formato, la marca deja de reconocerse."),

      seccion("DATOS QUE SE SUSTITUYEN EN LÍNEA"),
      texto("Sirven dentro de una frase o de una celda: «Área: {{area}}»."),
      ...lineas.flatMap((m) => [
        texto(`${m.etiqueta}`, { run: { bold: true, color: COLOR_NITIA.navy }, spacing: { after: 40 } }),
        marcador(m.clave),
      ]),

      seccion("BLOQUES DE CONTENIDO"),
      texto("Estos traen párrafos y tablas completas. Ponlos en su propia línea, no dentro de una frase."),
      ...bloques.flatMap((m) => [
        texto(`${m.etiqueta}`, { run: { bold: true, color: COLOR_NITIA.navy }, spacing: { after: 40 } }),
        marcador(m.clave),
      ]),

      seccion("EJEMPLO DE USO"),
      texto("Así podría empezar tu documento:"),
      new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 120, after: 80 },
        children: [new TextRun({ text: "{{titulo}}", font: FUENTE, size: 30, bold: true, color: COLOR_NITIA.navy })] }),
      texto("Institución educativa: {{ie}}          Docente: {{docente}}"),
      texto("Área: {{area}}          Grado: {{grado}}          Fecha: {{fecha}}"),
      marcador("propositos"),
      marcador("secuencia"),
    ],
  }],
});

const destino = path.join(process.cwd(), "public", "plantillas");
await fs.mkdir(destino, { recursive: true });
const archivo = path.join(destino, "plantilla-base-sciverse.docx");
await fs.writeFile(archivo, await Packer.toBuffer(documento));
console.log(`${archivo}  ·  ${MARCADORES.length} marcadores`);

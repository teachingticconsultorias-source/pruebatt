#!/usr/bin/env node
/* ==========================================================================
   LA PLANTILLA DE PARTIDA DEL COLEGIO

   Genera `public/plantillas/plantilla-base-sciverse.docx`.

   QUÉ ESTABA MAL EN LA PRIMERA VERSIÓN
   ------------------------------------
   Era un MANUAL con marcadores intercalados: cada marcador tenía encima su
   párrafo explicativo («Tabla de datos generales», «Sirven dentro de una
   frase…»). Al rellenarla sin modificar, `patchDocument` sustituía los
   párrafos de los marcadores y dejaba intactos TODOS los demás — que eran las
   instrucciones. El resultado era medio documento de ayuda y medio sesión.

   Ahora son dos cosas separadas por un salto de página:

     PÁGINA 1   las instrucciones, con un aviso enorme de que se borre.
                No contiene NI UN marcador.
     PÁGINA 2+  el esqueleto limpio, listo para usar tal cual: cada marcador
                de bloque solo en su párrafo, y los de línea dentro de una
                tabla de datos con su etiqueta en la celda de al lado.

   POR QUÉ CADA MARCADOR DE BLOQUE VA SOLO
   ---------------------------------------
   Medido sobre `docx@9.7.1`: `PatchType.DOCUMENT` reemplaza el PÁRRAFO ENTERO
   donde vive el marcador. No falla si hay texto al lado — se lo come. Así que
   un marcador de bloque compartiendo párrafo es pérdida silenciosa de lo que
   la docente escribió. La validación de subida lo detecta y lo rechaza;
   aquí, simplemente, no se hace.

   POR QUÉ SE GENERA Y NO SE COMMITEA A MANO
   -----------------------------------------
   El contrato vive en `lib/export/plantilla.js`. Si la plantilla fuera un
   binario hecho a mano, añadir un marcador allí la dejaría atrás en silencio.

   USO
   ---
     npx vite-node scripts/plantilla-base.mjs
   ========================================================================== */
import fs from "node:fs/promises";
import path from "node:path";
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, ShadingType, WidthType, TableLayoutType,
  PageBreak } from "docx";

import { MARCADORES, MARCADORES_MINIMOS } from "../lib/export/plantilla.js";
import { COLOR_NITIA, FUENTE, TAMANO } from "../lib/docx/tema.js";

const ANCHO = 10106;   // A4 menos los márgenes de 900

const run = (text, extra = {}) => new TextRun({ text, font: FUENTE, size: TAMANO.cuerpo, ...extra });
const texto = (contenido, opciones = {}) => new Paragraph({
  spacing: { after: 120 }, ...opciones,
  children: [run(contenido, opciones.run || {})],
});
const seccion = (contenido) => new Paragraph({
  spacing: { before: 260, after: 120 },
  border: { bottom: { style: BorderStyle.SINGLE, size: 10, color: COLOR_NITIA.azul } },
  children: [run(contenido, { size: TAMANO.seccion, bold: true, color: COLOR_NITIA.navy })],
});

/** Un marcador de bloque: SOLO en su párrafo. Nada más en esta línea. */
const bloque = (clave) => new Paragraph({
  spacing: { before: 60, after: 200 },
  children: [run(`{{${clave}}}`, { color: COLOR_NITIA.azul, bold: true })],
});

const celda = (hijos, { ancho, fill }) => new TableCell({
  width: { size: ancho, type: WidthType.DXA },
  margins: { top: 100, bottom: 100, left: 100, right: 100 },
  shading: fill ? { type: ShadingType.CLEAR, fill } : undefined,
  children: hijos,
});

/** Etiqueta | {{marcador}} — el de línea sí puede vivir en una celda con rótulo. */
const filaDeDato = (etiqueta, clave) => new TableRow({ children: [
  celda([texto(etiqueta, { spacing: { after: 0 }, run: { bold: true, color: COLOR_NITIA.navy, size: TAMANO.nota } })],
    { ancho: 2800, fill: COLOR_NITIA.fondo }),
  celda([texto(`{{${clave}}}`, { spacing: { after: 0 }, run: { color: COLOR_NITIA.azul } })],
    { ancho: ANCHO - 2800 }),
] });

const tablaDeDatos = (lineas) => new Table({
  width: { size: ANCHO, type: WidthType.DXA },
  layout: TableLayoutType.FIXED, columnWidths: [2800, ANCHO - 2800],
  borders: Object.fromEntries(["top", "bottom", "left", "right", "insideHorizontal", "insideVertical"]
    .map((k) => [k, { style: BorderStyle.SINGLE, size: 4, color: COLOR_NITIA.borde }])),
  rows: lineas.map((m) => filaDeDato(m.etiqueta, m.clave)),
});

const lineas = MARCADORES.filter((m) => m.tipo === "linea");
const bloques = MARCADORES.filter((m) => m.tipo === "bloque");

/* --------------------------------------------------------------------------
   PÁGINA 1 · INSTRUCCIONES. Ni un solo marcador aquí dentro.
   -------------------------------------------------------------------------- */
const instrucciones = [
  new Paragraph({
    alignment: AlignmentType.CENTER, spacing: { after: 60 },
    shading: { type: ShadingType.CLEAR, fill: "FFF4DE" },
    children: [run("BORRA ESTA PÁGINA ANTES DE SUBIR LA PLANTILLA", { bold: true, size: TAMANO.seccion, color: "7A4B00" })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER, spacing: { after: 240 },
    children: [run("Es sólo la ayuda. Lo que se usa empieza en la página siguiente.", { italics: true, color: COLOR_NITIA.auxiliar })],
  }),

  seccion("CÓMO ADAPTAR ESTA PLANTILLA"),
  texto("La página 2 es tu documento. Ponle el membrete de tu colegio, cambia los tipos de letra, los colores y el orden de las secciones, añade lo que necesites y quita lo que no uses."),
  texto("Lo único que no debes tocar son las marcas entre llaves dobles. Ahí es donde SciVerse coloca lo que genera."),

  seccion("LAS DOS REGLAS QUE IMPORTAN"),
  texto("1. Una marca de BLOQUE va sola en su párrafo.", { run: { bold: true, color: COLOR_NITIA.navy } }),
  texto("Las marcas de bloque traen tablas y varios párrafos, así que ocupan toda la línea donde están. Si escribes texto a su lado, ese texto se perderá al rellenar el documento. Déjalas solas, en su propia línea o en su propia celda."),
  texto("2. Escribe las marcas a mano.", { run: { bold: true, color: COLOR_NITIA.navy, } }),
  texto("Si las copias con formato, Word puede partirlas en trozos y dejan de reconocerse. Al subir la plantilla te avisaremos si eso ha pasado."),

  seccion("QUÉ TRAE CADA MARCA"),
  texto("De línea — se sustituyen por un texto corto y pueden ir dentro de una frase o de una celda:", { run: { bold: true } }),
  ...lineas.map((m) => texto(`     ${m.clave}  ·  ${m.etiqueta}`, { spacing: { after: 40 }, run: { size: TAMANO.nota, color: COLOR_NITIA.auxiliar } })),
  texto("De bloque — traen tablas y párrafos completos, y van solas en su línea:", { spacing: { before: 140 }, run: { bold: true } }),
  ...bloques.map((m) => texto(`     ${m.clave}  ·  ${m.etiqueta}`, { spacing: { after: 40 }, run: { size: TAMANO.nota, color: COLOR_NITIA.auxiliar } })),

  seccion("LO MÍNIMO PARA QUE FUNCIONE"),
  // Sin llaves: escribir «{{secuencia}}» aquí convertiría este párrafo de ayuda
  // en un marcador de bloque real, y al rellenar se comería la explicación.
  // La propia validación de subida lo detectó al regenerar la plantilla.
  texto(`Sin estas dos el documento saldría vacío, y no aceptaremos la plantilla: las marcas ${MARCADORES_MINIMOS.join(" y ")}. El resto son opcionales: si borras una marca, esa sección simplemente no aparecerá.`),

  new Paragraph({ children: [new PageBreak()] }),
];

/* --------------------------------------------------------------------------
   PÁGINA 2 · EL ESQUELETO. Utilizable tal cual, sin una palabra de ayuda.
   -------------------------------------------------------------------------- */
const esqueleto = [
  new Paragraph({
    alignment: AlignmentType.CENTER, spacing: { after: 200 },
    children: [run("{{titulo}}", { size: TAMANO.titulo, bold: true, color: COLOR_NITIA.navy })],
  }),

  seccion("DATOS GENERALES"),
  tablaDeDatos(lineas.filter((m) => m.clave !== "titulo")),

  seccion("PROPÓSITOS DE APRENDIZAJE"),
  bloque("propositos"),

  seccion("DESEMPEÑOS PRECISADOS"),
  bloque("desempenos"),

  seccion("CRITERIOS DE EVALUACIÓN"),
  bloque("criterios"),

  seccion("ENFOQUES TRANSVERSALES"),
  bloque("enfoques"),

  // Estos TRES bloques traen sus propios encabezados dentro —la secuencia se
  // lleva preparación y materiales; el DUA, instrumento y reflexiones; los
  // anexos, su portada y su salto de página—. Ponerles uno encima los duplica:
  // se vio al renderizar el primer documento de prueba.
  bloque("secuencia"),
  bloque("dua"),
  bloque("anexos"),

  // `datos_generales` trae la tabla completa de la maqueta de Nitia. Se ofrece
  // como alternativa a la tabla de arriba: quien prefiera la suya, borra esta
  // línea; quien prefiera la nuestra, borra la tabla y deja esto.
  seccion("TABLA DE DATOS DE NITIA (alternativa a la de arriba)"),
  bloque("datos_generales"),
];

const documento = new Document({
  creator: "Teaching TIC",
  title: "Plantilla base de exportación · SciVerse",
  styles: { default: { document: { run: { font: FUENTE, size: TAMANO.cuerpo, color: COLOR_NITIA.texto } } } },
  sections: [{
    properties: { page: { margin: { top: 900, right: 900, bottom: 900, left: 900 } } },
    children: [...instrucciones, ...esqueleto],
  }],
});

const destino = path.join(process.cwd(), "public", "plantillas");
await fs.mkdir(destino, { recursive: true });
const archivo = path.join(destino, "plantilla-base-sciverse.docx");
await fs.writeFile(archivo, await Packer.toBuffer(documento));
console.log(`${archivo}  ·  ${MARCADORES.length} marcadores, instrucciones en página aparte`);

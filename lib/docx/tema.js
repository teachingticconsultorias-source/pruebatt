// lib/docx/tema.js
//
// EL SISTEMA VISUAL DE LOS DOCUMENTOS SCIVERSE.
//
// DE DÓNDE SALEN ESTOS VALORES
// ----------------------------
// No están elegidos: están medidos. Salen del OOXML de las plantillas
// oficiales de PLANTILLAS/SCIVERSE/ —25 DOCX— leyendo `w:color`, `w:shd`,
// `w:sz`, `w:pgMar` y `w:gridCol` de cada una. Las 25 comparten exactamente
// la misma paleta, la misma tipografía y la misma geometría, así que aquí
// caben en un solo fichero.
//
// Las plantillas NO se copian ni se rellenan: son la referencia. Lo que se
// reproduce es su lenguaje, con el exportador dinámico de siempre.
//
// POR QUÉ PROPORCIONES Y NO LOS ANCHOS LITERALES
// ----------------------------------------------
// Las plantillas miden sus tablas en 10107 dxa porque usan márgenes de 900.
// Copiar esos números a otro margen desbordaría la caja. Por eso `ANCHOS`
// guarda PESOS: `widths()` los reparte sobre el ancho imprimible real, y la
// tabla encaja aunque mañana cambie el margen o la orientación.

/* ==========================================================================
   PALETA
   ========================================================================== */
const PALETA_NITIA = {
  /** Titulares, cabecera de tabla, barra de momento. */
  navy: "0B2E4F",
  /** Acento: regla bajo la sección, subtítulos, barra de sesión. */
  azul: "1C74BC",
  /** Celda-etiqueta y recuadros destacados. */
  fondo: "EAF4FB",
  /** Cuerpo de texto. */
  texto: "1A1A1A",
  /** Texto secundario y apoyos. */
  auxiliar: "6B7C8C",
  blanco: "FFFFFF",
  /** Borde de tabla y líneas de respuesta. */
  borde: "BBDBF0",
  /** Aviso de seguridad (guía de laboratorio, pendiente de herramienta). */
  seguridad: "FFF4DE",
  /** Escala de logro, de mayor a menor. */
  rubrica: { ad: "1C74BC", a: "6BB3E0", b: "BBDBF0", c: "EAF4FB" },
};

/* --------------------------------------------------------------------------
   LA PALETA ACTIVA

   El modo «formato de mi colegio» cambia dos colores: el primario y el acento.
   Enhebrar un objeto de tema por las trescientas líneas de maqueta —core,
   sesión, STEAM, laboratorio— sería un refactor grande para un cambio de dos
   valores, y cada sitio que se olvidara quedaría con el color de Nitia dentro
   de un documento del colegio.

   En su lugar hay UNA paleta activa y `COLOR` es una vista sobre ella. Todo el
   código que ya escribía `COLOR.navy` sigue igual y recoge el color correcto.
   Es seguro porque construir un documento es síncrono y de un solo hilo: se
   aplica la marca, se arma el .docx y se vuelve a Nitia.
   -------------------------------------------------------------------------- */
let activa = { ...PALETA_NITIA };

/**
 * Fija los colores del colegio para el documento que se va a construir.
 * Sin argumento, o con colores inválidos, vuelve a la paleta de Nitia.
 */
export function aplicarMarca(colores) {
  activa = { ...PALETA_NITIA };
  if (colores?.primario) activa.navy = colores.primario;
  if (colores?.acento) activa.azul = colores.acento;
}

/** Deshace lo anterior. Se llama al terminar de construir. */
export function restablecerMarca() {
  activa = { ...PALETA_NITIA };
}

/** Los valores de Nitia, para quien necesite el original pase lo que pase. */
export const COLOR_NITIA = Object.freeze({ ...PALETA_NITIA });

export const COLOR = new Proxy({}, {
  get: (_, clave) => activa[clave],
  has: (_, clave) => clave in activa,
  ownKeys: () => Reflect.ownKeys(activa),
  getOwnPropertyDescriptor: (_, clave) => ({ value: activa[clave], enumerable: true, configurable: true }),
});

/**
 * Color de texto legible sobre cada nivel de la rúbrica.
 *
 * `1C74BC` es oscuro: encima va blanco. Los otros tres son claros y piden
 * tinta. No se decide «a ojo» en cada exportador, se decide aquí una vez.
 */
export const TINTA_SOBRE_RUBRICA = { ad: COLOR.blanco, a: COLOR.texto, b: COLOR.texto, c: COLOR.texto };

/* ==========================================================================
   TIPOGRAFÍA · medios puntos, que es la unidad de `w:sz`
   ========================================================================== */
export const FUENTE = "Calibri";
export const TAMANO = {
  /** Título del documento: 16 pt. */
  titulo: 32,
  /** Título de las familias que lo llevan mayor —STEAM, laboratorio—: 17 pt. */
  tituloMayor: 34,
  /** Subtítulo del documento sobre fondo suave: 13 pt. */
  subtitulo: 26,
  /** Encabezado de sección: 12,5 pt. */
  seccion: 25,
  /** Barra de momento: 11 pt. */
  momento: 22,
  /** Cuerpo y subtítulos de proceso: 10,5 pt. */
  cuerpo: 21,
  /** Notas, pies y celdas densas: 10 pt. */
  nota: 20,
};
/** Por debajo de 10 pt no se imprime bien. Nada baja de aquí, nunca. */
export const TAMANO_MINIMO = TAMANO.nota;

/* ==========================================================================
   PÁGINA · A4 en dxa (1440 por pulgada)
   ========================================================================== */
export const PAGINA = {
  ancho: 11906,
  alto: 16838,
  /** 900 dxa ≈ 1,59 cm, el margen de las plantillas. */
  margen: 900,
  header: 708,
  footer: 708,
};

/* ==========================================================================
   ESPACIADO · en vigésimas de punto, como `w:spacing`
   ========================================================================== */
export const ESPACIO = {
  seccion: { before: 260, after: 120 },
  momento: { before: 220, after: 100 },
  subtitulo: { before: 160, after: 60 },
  parrafo: { after: 100, line: 280 },
  celda: { after: 0, line: 240 },
  vinieta: { after: 70, line: 260 },
};

/* ==========================================================================
   PROPORCIONES DE TABLA · medidas sobre las plantillas, normalizadas
   ========================================================================== */
export const ANCHOS = {
  /** Docente | valor | IE | valor — 2000/3550/2000/3550. */
  datosGenerales: [2, 3.55, 2, 3.55],
  /** Etiqueta | valor — 2425/7682. */
  etiquetaValor: [2.4, 7.6],
  /** Capacidad | Desempeño — 3200/6607. */
  desempenos: [3.2, 6.6],
  /** Capacidad | Criterio | Evidencia observable — 2200/4200/3407. */
  criterios: [2.2, 4.2, 3.4],
  /** Enfoque | Valor | Actitud observable — 2200/2600/5007. */
  enfoques: [2.2, 2.6, 5],
  /** Criterio | AD | A | B | C — 1617/2122×4. */
  rubrica: [1.6, 2.1, 2.1, 2.1, 2.1],
  /** Inicial | Componente | Aporte — 700/2200/7207. */
  steam: [0.7, 2.2, 7.2],
  /** Área | Competencia — 3200/6907. */
  competencias: [3.2, 6.9],
  /** Etiqueta | valor de una sesión del proyecto — 2400/7707. */
  sesionProyecto: [2.4, 7.7],
};

/** Los cuatro niveles de logro, en el orden de la plantilla: de mayor a menor. */
export const NIVELES_RUBRICA = [
  { clave: "ad", titulo: "Logro destacado (AD)" },
  { clave: "a", titulo: "Logrado (A)" },
  { clave: "b", titulo: "En proceso (B)" },
  { clave: "c", titulo: "En inicio (C)" },
];

/* ==========================================================================
   IDENTIDAD

   El pack entregado se contradice: las sesiones firman «Elaborado con
   Teaching Tic - Sciverse» y el proyecto STEAM «SciVerse · una iniciativa de
   Teaching TIC». Se elige la segunda —es la que ya usaba el exportador— y se
   usa en todos los documentos, para que dos descargas del mismo docente no
   parezcan de dos productos distintos.
   ========================================================================== */
export const PIE = "SciVerse · una iniciativa de Teaching TIC";
export const MARCA = "SCIVERSE";

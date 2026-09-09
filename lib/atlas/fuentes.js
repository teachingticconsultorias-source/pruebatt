// lib/atlas/fuentes.js
//
// QUÉ ENSEÑA CADA ATLAS.
//
// UN SOLO PACK, DOS EXPERIENCIAS
// ------------------------------
// Los dos atlas salen del mismo BodyParts3D 4.0. No es un atajo: al revisar
// las licencias resultó que la geometría de cabeza y cuello del proyecto OMF
// ES BodyParts3D —643 mallas, según su propio README— y que sus datasets
// dentales añadidos llevan restricciones que SciVerse no puede cumplir
// (uno es CC BY-NC-SA 4.0, y SciVerse cobra un plan Pro).
//
// Filtrando el mismo pack por región anatómica salen 648 estructuras de
// cabeza y cuello, incluidas las 28 piezas dentarias y las dos encías. Es
// decir: la misma cobertura, con una sola licencia limpia —CC BY 4.0— y sin
// descargar 35 MB más. Ver docs/ATLAS-3D-INTEGRATION.md.
//
// DÓNDE ESTÁ LA FRONTERA
// ----------------------
// El modelo está de pie y en metros: mide 1,73 y la cabeza empieza sobre los
// 1,38. El corte se hace por la caja envolvente de cada estructura, no por su
// nombre, porque los nombres de BodyParts3D no dicen la región.

import { SISTEMAS } from "./i18n.es.js";

/** Altura, en metros del modelo, a partir de la cual empieza cabeza y cuello. */
const ALTURA_CUELLO = 1.38;

/* ==========================================================================
   ATLAS DEL CUERPO HUMANO · agrupado por sistemas
   ========================================================================== */
export const FUENTE_HUMANA = {
  id: "humano",
  /** Los 2.234 elementos del pack. */
  incluye: () => true,
  grupoDe: (parte) => parte.system,
  grupos: SISTEMAS,
  etiquetaGrupos: "sistemas",
  /** Sistemas encendidos al abrir: el cuerpo reconocible, sin la maraña vascular. */
  visiblesAlInicio: [
    "skeletal", "muscular", "cardiac", "respiratory", "digestive", "nervous",
    "sensory", "urinary", "endocrine", "integumentary", "reproductive",
  ],
};

/* ==========================================================================
   ATLAS ORAL Y MAXILOFACIAL · agrupado por categorías clínicas

   Las categorías son las que pidió el encargo. Se deducen del sistema que
   trae el manifiesto y, cuando el sistema no basta, del nombre: los dientes
   vienen marcados como «skeletal» y mezclarlos con el cráneo dejaría la
   dentición sin su propia categoría, que es justo lo que se enseña aquí.
   ========================================================================== */
export const CATEGORIAS_OMF = {
  huesos: { nombre: "Huesos y referencias anatómicas", color: "#E8EFEF" },
  denticion: { nombre: "Dentición", color: "#FFF4D1" },
  musculos: { nombre: "Músculos", color: "#D9705F" },
  nervios: { nombre: "Nervios", color: "#FFBB00" },
  vasos: { nombre: "Vasos", color: "#D9421F" },
  articulaciones: { nombre: "Articulaciones", color: "#6FD4CE" },
  relacionadas: { nombre: "Estructuras relacionadas", color: "#B98BD1" },
};

const ES_DIENTE = /tooth|gingiva/i;
const ES_ARTICULACION = /joint|ligament|disk|temporomandibular|articul/i;

export function categoriaOmf(parte) {
  if (ES_DIENTE.test(parte.name)) return "denticion";
  if (ES_ARTICULACION.test(parte.name)) return "articulaciones";

  switch (parte.system) {
    case "skeletal":
      return "huesos";
    case "muscular":
      return "musculos";
    case "nervous":
      return "nervios";
    case "arterial":
    case "venous":
    case "cardiac":
    case "lymphatic":
      return "vasos";
    case "connective":
      return "articulaciones";
    default:
      return "relacionadas";
  }
}

export const FUENTE_OMF = {
  id: "omf",
  incluye: (parte) => parte.bounds[0][1] > ALTURA_CUELLO,
  grupoDe: categoriaOmf,
  grupos: CATEGORIAS_OMF,
  etiquetaGrupos: "categorías",
  /** Todo encendido: el conjunto ya es pequeño y así se ve la región completa. */
  visiblesAlInicio: Object.keys(CATEGORIAS_OMF),
};

export const FUENTES = { humano: FUENTE_HUMANA, omf: FUENTE_OMF };

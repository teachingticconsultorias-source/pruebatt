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

/**
 * Y hasta dónde se separa del eje.
 *
 * Sólo con la altura entraban el supraespinoso, el trapecio y las ramas
 * toracoacromiales: hombro, no cabeza. La cabeza y el cuello son estrechos, y
 * medio metro de separación lateral basta para distinguirlos. Con este corte
 * quedan 642 estructuras, que es la cifra que declara el propio OMFAtlas para
 * su región (643 mallas de BodyParts3D), e incluye clavícula y platisma, que
 * sí son referencias cervicales.
 */
const SEPARACION_MAX = 0.15;

const separacionLateral = (parte) =>
  Math.max(Math.abs(parte.bounds[0][0]), Math.abs(parte.bounds[1][0]));

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
  /**
   * Sistemas encendidos al abrir.
   *
   * Sin la maraña vascular —arterias y venas son 1.043 de las 2.234— y SIN
   * «Piel y anexos». La piel es una sola malla que envuelve el cuerpo
   * entero: encendida, tapa literalmente todo lo demás y el atlas abre
   * mostrando un maniquí. Son cinco estructuras (piel, ceja, vello de la
   * cabeza, labio y vello púbico) y se encienden a mano cuando hacen falta.
   */
  visiblesAlInicio: [
    "skeletal", "muscular", "cardiac", "respiratory", "digestive", "nervous",
    "sensory", "urinary", "endocrine", "reproductive",
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

/* ==========================================================================
   ATAJOS DEL ATLAS ORAL

   Un docente de odontología no entra a encender siete casillas: entra a ver
   los nervios, o la dentición. Los atajos dejan la vista en un clic y no
   sustituyen a las categorías: escriben sobre ellas, así que después se
   puede seguir afinando a mano.
   ========================================================================== */
export const ATAJOS_OMF = [
  { id: "todas", nombre: "Todas", grupos: Object.keys(CATEGORIAS_OMF) },
  { id: "esqueleto", nombre: "Esqueleto", grupos: ["huesos", "articulaciones"] },
  { id: "denticion", nombre: "Dentición", grupos: ["denticion"] },
  { id: "musculos", nombre: "Músculos", grupos: ["musculos"] },
  { id: "nervios", nombre: "Nervios", grupos: ["nervios"] },
  { id: "vasos", nombre: "Vasos", grupos: ["vasos"] },
];

export const FUENTE_OMF = {
  id: "omf",
  incluye: (parte) =>
    parte.bounds[0][1] > ALTURA_CUELLO && separacionLateral(parte) <= SEPARACION_MAX,
  grupoDe: categoriaOmf,
  grupos: CATEGORIAS_OMF,
  etiquetaGrupos: "categorías",
  /** Todo encendido: el conjunto ya es pequeño y así se ve la región completa. */
  visiblesAlInicio: Object.keys(CATEGORIAS_OMF),
  atajos: ATAJOS_OMF,
};

export const FUENTES = { humano: FUENTE_HUMANA, omf: FUENTE_OMF };

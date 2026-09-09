// lib/atlas/metadatos.js
//
// LA FICHA DE UNA ESTRUCTURA, ARMADA CON DATOS REALES.
//
// DE DÓNDE SALE LA INFORMACIÓN
// ----------------------------
// `atlas.json` no trae sólo geometría: trae 3.432 conceptos de la
// Foundational Model of Anatomy, y cada uno lista las mallas que le
// pertenecen. La mandíbula, por ejemplo, aparece en 23 conceptos, desde
// «entidad anatómica» (las 2.234) hasta «esqueleto de la boca» (una).
//
// Ese grafo es lo que permite responder tres preguntas sin inventarse nada:
//
//   ¿dónde está?     → los conceptos que son regiones del cuerpo
//   ¿qué es?         → los conceptos más específicos a los que pertenece
//   ¿con qué va?     → las otras mallas del concepto más específico
//
// POR QUÉ SE FILTRA POR TAMAÑO
// ----------------------------
// Un concepto que agrupa 2.234 mallas es cierto y no informa. Otro que
// agrupa una sola es el nombre de la propia estructura. Lo útil está en
// medio, y de ahí salen los dos límites de abajo. Sin ellos, la ficha de
// cualquier hueso diría «es una entidad anatómica» y ofrecería como
// relacionadas las otras 2.233 estructuras del cuerpo.
//
// LO QUE NO HAY NO SE RELLENA
// ---------------------------
// BodyParts3D no tiene descripción por estructura. Sólo nueve órganos la
// tienen en una fuente reutilizable. Cuando falta, el campo no aparece: la
// ficha se queda con nombre, sistema, identificador, región y relaciones,
// que es información real. Ver `textos-anatomia.es.js`.

import {
  DESCRIPCION_DE_ORGANO, FUNCION_DE_SISTEMA, NOTA_DOCENTE, TEMAS,
} from "./textos-anatomia.es.js";

/** Conceptos que sitúan en el cuerpo. Mismo criterio que el generador. */
const CONCEPTOS_DE_REGION = new Set([
  "FMA20394", "FMA7181", "FMA7154", "FMA7155", "FMA24728", "FMA46565",
  "FMA53672", "FMA53673", "FMA49184", "FMA9576", "FMA9826", "FMA9827",
  "FMA9577", "FMA9578", "FMA9579", "FMA7480", "FMA13478",
  "FMA7184", "FMA7185", "FMA7186", "FMA7187", "FMA7188",
]);

/** Un grupo con más mallas que esto ya no dice nada de la estructura. */
const MAX_GRUPO = 60;

/** Y con más que esto, ofrecerlo como «estructuras relacionadas» es ruido. */
const MAX_HERMANAS = 26;

/** Cuántas se enseñan. Más que esto es una lista que nadie lee. */
const TOPE_GRUPOS = 6;
const TOPE_RELACIONADAS = 12;

/**
 * Clases de la ontología, que no son grupos anatómicos.
 *
 * La FMA mezcla anatomía con su propia taxonomía. «Maxilar inferior» y
 * «músculo del compartimento anterior del muslo» sitúan la estructura; «órgano
 * con cavidad» y «componente de órgano» sólo dicen en qué casilla del modelo
 * informático cae. A una docente lo segundo no le sirve, y ocupa el sitio de
 * lo primero.
 *
 * Se filtra por el nombre en INGLÉS, que es el del dataset: filtrar por la
 * traducción ataría este criterio a cómo quede el español.
 */
const CLASE_DE_ONTOLOGIA =
  /\b(organ|entity|component|cluster|cardinal|immaterial|anatomical structure|body part)\b/i;

/* ==========================================================================
   NOTACIÓN FDI

   Adaptado de `toothNumber()` en `src/content.js` de OMFAtlas
   (MIT, © 2026 Ahmad Sofi-Mahmudi).

   Dos dígitos: el cuadrante desde el punto de vista del PACIENTE y la
   posición contando desde la línea media. Que el lado sea el del paciente y
   no el del observador es justo lo que más se confunde al aprenderlo, y por
   eso la ficha lo dice cada vez.
   ========================================================================== */
export function numeroFdi(nombreOriginal) {
  if (!/tooth/i.test(nombreOriginal)) return null;

  const cuadrante = /Right upper/i.test(nombreOriginal) ? 1
    : /Left upper/i.test(nombreOriginal) ? 2
      : /Left lower/i.test(nombreOriginal) ? 3
        : /Right lower/i.test(nombreOriginal) ? 4
          : null;
  if (!cuadrante) return null;

  const posicion = /central/i.test(nombreOriginal) ? 1
    : /lateral/i.test(nombreOriginal) ? 2
      : /canine/i.test(nombreOriginal) ? 3
        : /first.*premolar/i.test(nombreOriginal) ? 4
          : /second.*premolar/i.test(nombreOriginal) ? 5
            : /first.*molar/i.test(nombreOriginal) ? 6
              : /second.*molar/i.test(nombreOriginal) ? 7
                : null;

  return posicion ? cuadrante * 10 + posicion : null;
}

/* ==========================================================================
   ÍNDICE DEL GRAFO

   Se construye una vez por sesión. Recorrer 3.432 conceptos en cada clic
   costaría más que la propia selección.
   ========================================================================== */
export function crearIndice(manifiesto) {
  const conceptoPorId = new Map();
  const conceptosDeParte = new Map();

  for (const concepto of manifiesto.concepts || []) {
    conceptoPorId.set(concepto.id, concepto);
    for (const elemento of concepto.elements) {
      let lista = conceptosDeParte.get(elemento);
      if (!lista) { lista = []; conceptosDeParte.set(elemento, lista); }
      lista.push(concepto.id);
    }
  }

  const indicePorIdDeParte = new Map();
  manifiesto.parts.forEach((p, i) => indicePorIdDeParte.set(p.id, i));

  return { conceptoPorId, conceptosDeParte, indicePorIdDeParte };
}

/* ========================================================================== */
/**
 * Ficha completa de una estructura.
 *
 * Devuelve sólo los campos que existen. El panel no tiene que comprobar
 * nada: si un campo no está, esa sección no se dibuja.
 *
 * @param {number} indice          índice global de la estructura
 * @param {object} datos           { manifiesto, partes, nombres, indice }
 * @param {object} fuente          la fuente del atlas (ver fuentes.js)
 * @param {Set<number>} enfoque    estructuras de este atlas
 */
export function fichaDe(indice, { manifiesto, partes, nombres, indice: grafo }, fuente, enfoque) {
  const parte = partes?.[indice];
  if (!parte) return null;

  const grupo = fuente.grupoDe(parte);
  const definicion = fuente.grupos[grupo] || {};

  const enEspanol = nombres?.partes?.[parte.id];
  const conceptos = grafo.conceptosDeParte.get(parte.id) || [];

  /* ---- región: de lo general a lo concreto ------------------------------ */
  const regiones = conceptos
    .filter((id) => CONCEPTOS_DE_REGION.has(id))
    .map((id) => grafo.conceptoPorId.get(id))
    .filter((c) => c && nombres?.conceptos?.[c.id])
    .sort((a, b) => b.elements.length - a.elements.length)
    .map((c) => ({ id: c.id, nombre: nombres.conceptos[c.id] }));

  /* ---- grupos anatómicos: de lo concreto a lo general -------------------

     No se dice «es un» ni «forma parte de»: el manifiesto guarda a qué
     conceptos pertenece una malla, pero NO el tipo de relación. Afirmar
     cuál es sería añadir información que el dato no tiene.                */
  const candidatos = conceptos
    .map((id) => grafo.conceptoPorId.get(id))
    .filter((c) => c
      && c.elements.length >= 2
      && c.elements.length <= MAX_GRUPO
      && !CONCEPTOS_DE_REGION.has(c.id)
      && !CLASE_DE_ONTOLOGIA.test(c.name)
      && nombres?.conceptos?.[c.id])
    .sort((a, b) => a.elements.length - b.elements.length);

  const grupos = candidatos
    .slice(0, TOPE_GRUPOS)
    .map((c) => ({ id: c.id, nombre: nombres.conceptos[c.id], cuantas: c.elements.length }));

  /* ---- estructuras relacionadas ----------------------------------------

     Del concepto más específico que tenga compañía. Se limitan a las de
     este atlas: en el atlas maxilofacial no tiene sentido ofrecer como
     relacionada una estructura del pie.                                    */
  let relacionadas = [];
  let origenRelacion = null;

  for (const concepto of candidatos) {
    if (concepto.elements.length > MAX_HERMANAS) break;
    const hermanas = concepto.elements
      .filter((id) => id !== parte.id)
      .map((id) => grafo.indicePorIdDeParte.get(id))
      .filter((i) => i !== undefined && (!enfoque || enfoque.has(i)))
      .map((i) => ({ indice: i, nombre: nombres?.partes?.[partes[i].id] || partes[i].name }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

    if (hermanas.length) {
      relacionadas = hermanas.slice(0, TOPE_RELACIONADAS);
      origenRelacion = { id: concepto.id, nombre: nombres.conceptos[concepto.id] };
      break;
    }
  }

  /* ---- textos ----------------------------------------------------------- */
  const tema = TEMAS.find((t) => t.coincide.test(parte.name)) || null;
  const fdi = numeroFdi(parte.name);

  return {
    indice,
    id: parte.id,
    nombre: enEspanol || parte.name,
    // Cuando falta traducción se enseña el original y se marca, en vez de
    // dejar hueco o —peor— escribir «undefined».
    sinTraducir: !enEspanol,
    nombreOriginal: parte.name,
    sistema: definicion.nombre || "Otras estructuras",
    color: definicion.color || "#B4C6C4",
    fma: parte.conceptId || null,
    descripcion: DESCRIPCION_DE_ORGANO[parte.name] || null,
    funcion: FUNCION_DE_SISTEMA[parte.system] || null,
    regiones,
    grupos,
    relacionadas,
    origenRelacion,
    tema,
    fdi,
    notaDocente: NOTA_DOCENTE[parte.system] || null,
  };
}

/**
 * Índice de búsqueda: español, original y FMA en una sola cadena.
 *
 * Se construye una vez y no en cada tecla. Con 2.234 estructuras, recorrer y
 * normalizar en cada pulsación se nota al escribir en un móvil.
 */
export function crearIndiceDeBusqueda(partesDelAtlas, partes, nombres) {
  return partesDelAtlas.map((p) => {
    const es = nombres?.partes?.[p.id] || "";
    return {
      indice: p.indiceGlobal,
      // Se busca sobre las tres a la vez: «corazón», «heart» y «FMA7088»
      // tienen que encontrar lo mismo.
      texto: sinTildes(`${es} ${p.name} ${p.conceptId || ""} ${p.id}`),
      nombre: es || p.name,
    };
  });
}

export function sinTildes(texto) {
  return String(texto).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

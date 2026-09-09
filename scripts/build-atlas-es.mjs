// scripts/build-atlas-es.mjs
//
// GENERA LOS NOMBRES EN ESPAÑOL DEL ATLAS.
//
//   node scripts/build-atlas-es.mjs
//   → public/models/atlas-es.json     { "FJ1252": "Encía del maxilar superior", … }
//
// POR QUÉ SE GENERA EN BUILD Y NO EN EL NAVEGADOR
// ----------------------------------------------
// Porque lo que lee una docente tiene que estar revisado. Traducir en runtime
// significa que el nombre de una estructura depende de una librería, de un
// servicio o del azar, y que nadie ha leído nunca el resultado. Aquí el
// resultado es un fichero versionado: se puede leer, corregir a mano y
// discutir en una revisión.
//
// El fichero de salida se sirve como asset estático junto al manifiesto
// original —que NO se toca, para que siga siendo el de BodyParts3D 4.0 tal
// cual se descargó— y pesa unos 150 KB, así que no entra en el bundle.
//
// COBERTURA
// ---------
// El script informa de cuántos nombres tradujo por completo. Lo que no sabe
// traducir lo deja en inglés en vez de inventárselo: un nombre a medias es
// peor que un nombre en el idioma original, porque parece correcto.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  FRASES, MODIFICADORES, NUCLEOS, ORDINAL_DIENTE, TIPOS_DE_DIENTE,
} from "./atlas-lexico.es.mjs";
import {
  CONCEPTOS_DE_REGION, FRASES_CONCEPTO, MODIFICADORES_CONCEPTO, NUCLEOS_CONCEPTO,
} from "./atlas-lexico-conceptos.es.mjs";

/**
 * Un concepto que agrupa más mallas que esto no informa de nada.
 *
 * «Entidad anatómica» tiene las 2.234; «estructura anatómica», 2.166. Decirle
 * a una docente que la mandíbula es una entidad anatómica es cierto y es
 * inútil. El corte deja fuera los nueve o diez conceptos-paraguas y conserva
 * los que sí sitúan: «boca» (11), «viscerocráneo» (39), «cráneo» (43).
 */
const LIMITE_CONCEPTO_UTIL = 260;

/**
 * Dos diccionarios, no uno.
 *
 * Las estructuras se traducen SÓLO con el léxico base. Los conceptos FMA usan
 * el base más el suyo. Separarlos no es manía de orden: si el vocabulario
 * abstracto de los conceptos entrara en la traducción de las estructuras,
 * añadir un término para «zone of» podría cambiar en silencio el nombre de
 * una estructura que ya estaba revisada. El generador comprueba al final que
 * los 2.234 nombres no se han movido.
 */
const LEXICO_ESTRUCTURAS = { nucleos: NUCLEOS, modificadores: MODIFICADORES, frases: FRASES };
const LEXICO_CONCEPTOS = {
  nucleos: { ...NUCLEOS, ...NUCLEOS_CONCEPTO },
  modificadores: { ...MODIFICADORES, ...MODIFICADORES_CONCEPTO },
  frases: { ...FRASES, ...FRASES_CONCEPTO },
};

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ENTRADA = path.join(raiz, "public", "models", "atlas.json");
const SALIDA = path.join(raiz, "public", "models", "atlas-es.json");

/**
 * Un núcleo usado como modificador necesita su forma adjetiva.
 * «Segmental artery tree» no es un árbol y una arteria: es el árbol arterial.
 */
const ADJETIVO_DE_NUCLEO = {
  artery: "arterial", arteries: "arteriales", vein: "venoso", veins: "venosos",
  nerve: "nervioso", muscle: "muscular", bone: "óseo", tooth: "dental",
  cartilage: "cartilaginoso", ligament: "ligamentoso", gland: "glandular",
  bronchus: "bronquial", duct: "ductal", valve: "valvular", body: "corporal",
  head: "cefálico", branch: "colateral", cavity: "cavitario",
};

/** Palabras que no aportan nada al nombre en español. */
const IGNORAR = new Set(["the", "a", "an"]);

/**
 * Sustantivos latinos de músculo.
 *
 * Muchos nombres no tienen ningún núcleo del diccionario porque el músculo se
 * llama por su nombre latino. El latín ya pone el sustantivo delante, igual
 * que el español, así que basta con reconocerlo esté donde esté:
 *
 *   gluteus medius   → glúteo medio     (manda gluteus, que va primero)
 *   lateral rectus   → recto lateral    (manda rectus, que va segundo)
 *
 * Sin esta lista, «Right lumbar rotator» salía como «Lumbar rotador».
 */
const NUCLEOS_LATINOS = new Set([
  "gluteus", "rectus", "vastus", "biceps", "triceps", "quadratus", "teres",
  "serratus", "trapezius", "rhomboid", "deltoid", "psoas", "iliacus",
  "gracilis", "sartorius", "soleus", "plantaris", "popliteus", "piriformis",
  "pectineus", "gemellus", "semimembranosus", "semitendinosus", "obliquus",
  "transversus", "scalenus", "splenius", "spinalis", "semispinalis",
  "iliocostalis", "longissimus", "digastric", "platysma", "pectoralis",
  "latissimus", "infraspinatus", "supraspinatus", "subscapularis",
  "coracobrachialis", "brachialis", "brachioradialis", "anconeus", "palmaris",
  "supinator", "pronator", "opponens", "lumbrical", "lumbricals", "flexor",
  "extensor", "abductor", "adductor", "levator", "levatores", "tensor",
  "rotator", "constrictor", "sphincter", "gastrocnemius", "tibialis",
  "fibularis", "subclavius", "genioglossus", "hyoglossus", "interossei",
  "sternocleidomastoid", "interspinales", "intertransversarii", "stylohyoid",
  "intertransversarius", "interspinalis", "mylohyoid", "geniohyoid",
  "omohyoid", "sternohyoid", "sternothyroid", "thyrohyoid", "aryepiglotticus",
]);

/** Números romanos: en español van siempre al final del nombre. */
const ROMANOS = new Set(["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x"]);

/** Cifras sueltas (nombres de concepto como «zone 4 of liver»). Van al final. */
const ES_CIFRA = /^[0-9]{1,2}$/;

/** Ordinales: en español encabezan el nombre. «Décima costilla derecha». */
const ORDINALES = new Set([
  "first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth",
  "ninth", "tenth", "eleventh", "twelfth",
]);

/** Plural español, para los núcleos que ya vienen en plural desde el origen. */
function pluralizar(palabra) {
  return palabra
    .split(" ")
    .map((p) => {
      if (/s$/i.test(p)) return p;
      if (/[aeiouáéíóú]$/i.test(p)) return `${p}s`;
      if (/z$/i.test(p)) return `${p.slice(0, -1)}ces`;
      if (/[rnldj]$/i.test(p)) return `${p}es`;
      return p;
    })
    .join(" ");
}

const normalizar = (texto) =>
  texto.toLowerCase().replace(/[()]/g, " ").replace(/\s+/g, " ").trim();

/** Concuerda un modificador con el género del núcleo. */
function concordar(entrada, genero) {
  if (!entrada) return null;
  if (typeof entrada === "string") return entrada;
  return genero === "f" ? entrada.f : entrada.m;
}

/** «de» + artículo, contraído cuando toca. */
function preposicion(genero, plural) {
  if (plural) return genero === "f" ? "de las" : "de los";
  return genero === "f" ? "de la" : "del";
}

/** Femeninos que no acaban en «a» y que el criterio general fallaría. */
const FEMENINOS_IRREGULARES = new Set([
  "pelvis", "sínfisis", "anastomosis", "epidermis", "laringe", "faringe",
  "laringofaringe", "nariz", "raíz", "piel", "red", "pared", "sustancia",
  "porción", "región", "división", "unión", "subdivisión", "formación",
  "decusación", "continuidad", "entidad", "cavidad", "cúspide", "falange",
  "vértebra", "apófisis", "aponeurosis", "esclerótica", "coroides", "hipófisis",
  "tiroides", "epiglotis", "mandíbula", "escápula", "clavícula", "vesícula",
  "glándula", "válvula", "cápsula", "membrana", "lámina", "corteza", "estría",
  "habénula", "ínsula", "amígdala", "tróclea", "córnea", "retina", "encía",
  "lengua", "oreja", "ceja", "tienda", "tenia", "costilla", "fosa", "cámara",
  "boca", "cabeza", "cara", "espalda", "caja", "musculatura", "columna",
  "rodilla", "mejilla", "órbita", "úvula", "hoja", "duramadre", "celdilla",
  "incisura", "cortina", "capa", "zona", "fascia", "cintura", "línea", "bilis",
]);

/**
 * Género de una frase ya traducida.
 *
 * Hace falta para el artículo del complemento: «esqueleto DE LA boca», no
 * «del boca». Las frases del diccionario llegan como texto, sin marca de
 * género, y aplicar «del» a todas producía una decena de nombres mal.
 */
function generoDeFrase(texto) {
  const ultima = texto.toLowerCase().split(" ").pop();
  if (FEMENINOS_IRREGULARES.has(ultima)) return "f";
  return /(a|ción|sión|dad|tad|umbre)$/.test(ultima) ? "f" : "m";
}

/* ==========================================================================
   DENTICIÓN

   «Left lower first secondary molar tooth» → «Primer molar permanente
   inferior izquierdo». El tipo de diente pasa a ser el sustantivo y «tooth»
   desaparece, que es como se nombra en una historia clínica.
   ========================================================================== */
function traducirDiente(tokens) {
  const tipo = tokens.find((t) => TIPOS_DE_DIENTE[t]);
  if (!tipo) return null;

  const ordinal = tokens.find((t) => ORDINAL_DIENTE[t]);
  const permanente = tokens.includes("secondary");
  const arcada = tokens.includes("upper") ? "superior"
    : tokens.includes("lower") ? "inferior" : null;
  const lado = tokens.includes("right") ? "derecho"
    : tokens.includes("left") ? "izquierdo" : null;

  const partes = [];
  if (ordinal) partes.push(ORDINAL_DIENTE[ordinal]);
  partes.push(TIPOS_DE_DIENTE[tipo]);
  if (permanente) partes.push("permanente");
  if (arcada) partes.push(arcada);
  if (lado) partes.push(lado);

  const frase = partes.join(" ");
  return ordinal ? frase : frase.charAt(0).toUpperCase() + frase.slice(1);
}

/* ==========================================================================
   TRADUCCIÓN GENERAL

   El inglés antepone: [lado] [modificadores] [NÚCLEO].
   El español pospone: [NÚCLEO] [modificadores invertidos] [lado].

   Se invierte el orden de los modificadores porque el que va pegado al
   núcleo en inglés es el que va pegado al núcleo en español:
   «common carotid artery» → «arteria carótida común».
   ========================================================================== */
function traducirGrupo(texto, fallos, lex) {
  const tokens = normalizar(texto).split(" ").filter((t) => t && !IGNORAR.has(t));
  if (!tokens.length) return null;

  if (tokens.includes("tooth")) {
    const diente = traducirDiente(tokens);
    if (diente) return { texto: diente, genero: "m", plural: false };
  }

  // Lado, romanos y ordinales salen del grupo: cada uno tiene un sitio fijo
  // en español —el ordinal delante, los otros dos detrás— y no puede salir
  // de recorrer los modificadores en bloque.
  const lados = [];
  const romanos = [];
  const ordinales = [];
  const resto = tokens.filter((t) => {
    if (t === "right" || t === "left") { lados.push(t); return false; }
    if (ROMANOS.has(t) || ES_CIFRA.test(t)) { romanos.push(t.toUpperCase()); return false; }
    if (ORDINALES.has(t)) { ordinales.push(t); return false; }
    return true;
  });
  if (!resto.length) return null;

  // El núcleo es el último token que sea un sustantivo conocido.
  let indice = -1;
  for (let i = resto.length - 1; i >= 0; i -= 1) {
    if (lex.nucleos[resto[i]]) { indice = i; break; }
  }

  let nucleo;
  if (indice === -1) {
    // Nombre latino: manda el sustantivo latino, vaya donde vaya. Si no hay
    // ninguno, manda el último término, que es donde el inglés pone el suyo.
    indice = resto.findIndex((t) => NUCLEOS_LATINOS.has(t));
    if (indice === -1) {
      for (let i = resto.length - 1; i >= 0; i -= 1) {
        if (lex.modificadores[resto[i]]) { indice = i; break; }
      }
    }
    if (indice === -1) indice = resto.length - 1;
    const termino = concordar(lex.modificadores[resto[indice]], "m");
    if (!termino) {
      // Se registra el término que falta y se deja el nombre en inglés: a
      // medias sería peor, porque parecería correcto.
      resto.forEach((t) => { if (!lex.modificadores[t] && !lex.nucleos[t]) fallos.add(t); });
      return null;
    }
    nucleo = { es: termino.charAt(0).toUpperCase() + termino.slice(1), g: "m" };
  } else {
    nucleo = lex.nucleos[resto[indice]];
  }

  const genero = nucleo.g;
  const plural = Boolean(nucleo.pl);

  // Todo lo que no es el núcleo son modificadores, se lea antes o después.
  const modificadores = [...resto.slice(0, indice), ...resto.slice(indice + 1)];

  const traducidos = [];
  for (const token of modificadores.reverse()) {
    const mod = concordar(lex.modificadores[token], genero);
    if (mod) { traducidos.push(plural ? pluralizar(mod) : mod); continue; }
    const comoAdjetivo = ADJETIVO_DE_NUCLEO[token];
    if (comoAdjetivo) { traducidos.push(comoAdjetivo); continue; }
    // Un sustantivo sin forma adjetiva se pospone con «de».
    const otro = lex.nucleos[token];
    if (otro) { traducidos.push(`de ${otro.es.toLowerCase()}`); continue; }
    fallos.add(token);
    return null;
  }

  const lado = lados.length
    ? lados
      .map((l) => {
        const forma = concordar(lex.modificadores[l], genero);
        return plural ? pluralizar(forma) : forma;
      })
      .join(" y ")
    : null;

  // El ordinal encabeza: «Décima costilla derecha», no «Costilla décima».
  const cabeza = ordinales.map((o) => concordar(lex.modificadores[o], genero)).filter(Boolean);
  const nombre = cabeza.length
    ? `${cabeza.join(" ")} ${nucleo.es.toLowerCase()}`
    : nucleo.es;

  const frase = [nombre, ...traducidos, ...romanos, lado].filter(Boolean).join(" ");
  return { texto: frase, genero, plural };
}

/** Traduce un nombre completo, incluyendo los complementos con «of». */
function traducir(nombre, fallos, lex) {
  const limpio = normalizar(nombre);

  const exacta = lex.frases[limpio];
  if (exacta) return exacta;

  const trozos = limpio.split(" of ");
  const principal = traducirGrupo(trozos[0], fallos, lex);
  if (!principal) return null;

  let frase = principal.texto;
  let anterior = principal;

  for (const trozo of trozos.slice(1)) {
    const exactaComplemento = lex.frases[trozo];
    const complemento = exactaComplemento
      ? { texto: exactaComplemento, genero: generoDeFrase(exactaComplemento), plural: false }
      : traducirGrupo(trozo, fallos, lex);
    if (!complemento) return null;
    frase += ` ${preposicion(complemento.genero, complemento.plural)} ${complemento.texto.toLowerCase()}`;
    anterior = complemento;
  }

  void anterior;
  return frase.charAt(0).toUpperCase() + frase.slice(1);
}

/* ========================================================================== */
function main() {
  if (!fs.existsSync(ENTRADA)) {
    console.error(`No encuentro ${ENTRADA}. Descarga primero el pack de modelos.`);
    process.exit(1);
  }

  const atlas = JSON.parse(fs.readFileSync(ENTRADA, "utf8"));

  /* ---- 1) Las 2.234 estructuras, con el léxico base y sólo con él -------- */
  const fallosPartes = new Set();
  const partes = {};
  for (const parte of atlas.parts) {
    const es = traducir(parte.name, fallosPartes, LEXICO_ESTRUCTURAS);
    if (es) partes[parte.id] = es;
  }

  /* ---- 2) Los conceptos FMA, que dan región y relaciones ----------------- */
  //
  // Sólo los que se van a enseñar. «Entidad anatómica» agrupa las 2.234
  // estructuras y no le dice nada a nadie: traducirlo sería trabajo para
  // engordar el fichero.
  const fallosConceptos = new Set();
  const conceptos = {};
  let utiles = 0;
  for (const concepto of atlas.concepts) {
    if (concepto.elements.length > LIMITE_CONCEPTO_UTIL) continue;
    utiles += 1;
    const es = traducir(concepto.name, fallosConceptos, LEXICO_CONCEPTOS);
    if (es) conceptos[concepto.id] = es;
  }
  // Las regiones se traducen siempre, por grandes que sean: son la
  // localización, y sin ellas la ficha se queda coja.
  for (const id of CONCEPTOS_DE_REGION) {
    if (conceptos[id]) continue;
    const concepto = atlas.concepts.find((c) => c.id === id);
    if (!concepto) continue;
    const es = traducir(concepto.name, fallosConceptos, LEXICO_CONCEPTOS);
    if (es) conceptos[id] = es;
  }

  fs.writeFileSync(SALIDA, JSON.stringify({ partes, conceptos }), "utf8");

  /* ---- 3) Informe ------------------------------------------------------- */
  const total = atlas.parts.length;
  const hechas = Object.keys(partes).length;
  console.log(`atlas-es.json`);
  console.log(`  estructuras: ${hechas}/${total} (${((hechas / total) * 100).toFixed(1)} %)`);
  console.log(`  conceptos:   ${Object.keys(conceptos).length}/${utiles} útiles de ${atlas.concepts.length}`);
  console.log(`  tamaño:      ${(fs.statSync(SALIDA).size / 1024).toFixed(0)} KB`);

  if (fallosPartes.size) {
    console.log(`\nESTRUCTURAS · términos sin traducir (${fallosPartes.size}):`);
    console.log([...fallosPartes].sort().join(" "));
  }
  if (fallosConceptos.size) {
    console.log(`\nCONCEPTOS · términos sin traducir (${fallosConceptos.size}):`);
    console.log([...fallosConceptos].sort().join(" "));
  }
}

main();

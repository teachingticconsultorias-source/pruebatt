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
function traducirGrupo(texto, fallos) {
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
    if (ROMANOS.has(t)) { romanos.push(t.toUpperCase()); return false; }
    if (ORDINALES.has(t)) { ordinales.push(t); return false; }
    return true;
  });
  if (!resto.length) return null;

  // El núcleo es el último token que sea un sustantivo conocido.
  let indice = -1;
  for (let i = resto.length - 1; i >= 0; i -= 1) {
    if (NUCLEOS[resto[i]]) { indice = i; break; }
  }

  let nucleo;
  if (indice === -1) {
    // Nombre latino: manda el sustantivo latino, vaya donde vaya. Si no hay
    // ninguno, manda el último término, que es donde el inglés pone el suyo.
    indice = resto.findIndex((t) => NUCLEOS_LATINOS.has(t));
    if (indice === -1) {
      for (let i = resto.length - 1; i >= 0; i -= 1) {
        if (MODIFICADORES[resto[i]]) { indice = i; break; }
      }
    }
    if (indice === -1) indice = resto.length - 1;
    const termino = concordar(MODIFICADORES[resto[indice]], "m");
    if (!termino) {
      // Se registra el término que falta y se deja el nombre en inglés: a
      // medias sería peor, porque parecería correcto.
      resto.forEach((t) => { if (!MODIFICADORES[t] && !NUCLEOS[t]) fallos.add(t); });
      return null;
    }
    nucleo = { es: termino.charAt(0).toUpperCase() + termino.slice(1), g: "m" };
  } else {
    nucleo = NUCLEOS[resto[indice]];
  }

  const genero = nucleo.g;
  const plural = Boolean(nucleo.pl);

  // Todo lo que no es el núcleo son modificadores, se lea antes o después.
  const modificadores = [...resto.slice(0, indice), ...resto.slice(indice + 1)];

  const traducidos = [];
  for (const token of modificadores.reverse()) {
    const mod = concordar(MODIFICADORES[token], genero);
    if (mod) { traducidos.push(plural ? pluralizar(mod) : mod); continue; }
    const comoAdjetivo = ADJETIVO_DE_NUCLEO[token];
    if (comoAdjetivo) { traducidos.push(comoAdjetivo); continue; }
    // Un sustantivo sin forma adjetiva se pospone con «de».
    const otro = NUCLEOS[token];
    if (otro) { traducidos.push(`de ${otro.es.toLowerCase()}`); continue; }
    fallos.add(token);
    return null;
  }

  const lado = lados.length
    ? lados
      .map((l) => {
        const forma = concordar(MODIFICADORES[l], genero);
        return plural ? pluralizar(forma) : forma;
      })
      .join(" y ")
    : null;

  // El ordinal encabeza: «Décima costilla derecha», no «Costilla décima».
  const cabeza = ordinales.map((o) => concordar(MODIFICADORES[o], genero)).filter(Boolean);
  const nombre = cabeza.length
    ? `${cabeza.join(" ")} ${nucleo.es.toLowerCase()}`
    : nucleo.es;

  const frase = [nombre, ...traducidos, ...romanos, lado].filter(Boolean).join(" ");
  return { texto: frase, genero, plural };
}

/** Traduce un nombre completo, incluyendo los complementos con «of». */
function traducir(nombre, fallos) {
  const limpio = normalizar(nombre);

  const exacta = FRASES[limpio];
  if (exacta) return exacta;

  const trozos = limpio.split(" of ");
  const principal = traducirGrupo(trozos[0], fallos);
  if (!principal) return null;

  let frase = principal.texto;
  let anterior = principal;

  for (const trozo of trozos.slice(1)) {
    const exactaComplemento = FRASES[trozo];
    const complemento = exactaComplemento
      ? { texto: exactaComplemento, genero: "m", plural: false }
      : traducirGrupo(trozo, fallos);
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
  const fallos = new Set();
  const nombres = {};
  let traducidos = 0;

  for (const parte of atlas.parts) {
    const es = traducir(parte.name, fallos);
    if (es) { nombres[parte.id] = es; traducidos += 1; }
  }

  fs.writeFileSync(SALIDA, JSON.stringify(nombres), "utf8");

  const total = atlas.parts.length;
  const pct = ((traducidos / total) * 100).toFixed(1);
  console.log(`atlas-es.json · ${traducidos}/${total} nombres (${pct}%)`);
  console.log(`tamaño: ${(fs.statSync(SALIDA).size / 1024).toFixed(0)} KB`);
  if (fallos.size) {
    console.log(`\ntérminos sin traducir (${fallos.size}):`);
    console.log([...fallos].sort().join(" "));
  }
}

main();

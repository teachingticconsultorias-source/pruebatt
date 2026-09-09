// lib/atlas/carga.js
//
// DESCARGA Y ARMADO DE LA GEOMETRÍA.
//
// EL FORMATO
// ----------
// `atlas.json` describe 2.234 estructuras y 15 bloques binarios. Cada
// estructura dice en qué bloque está y en qué desplazamiento empiezan sus
// tres buffers:
//
//   positions  Float32  vertexCount * 3
//   normals    Int16    vertexCount * 3   (normalizado en la GPU)
//   indices    Uint32   indexCount
//
// Las normales van en enteros de 16 bits en vez de coma flotante: la mitad
// de memoria por el mismo resultado visible, que con 1,2 millones de
// vértices son 14 MB menos.
//
// POR QUÉ SE FUSIONAN LAS MALLAS
// ------------------------------
// 2.234 mallas independientes son 2.234 llamadas de dibujo por fotograma.
// Ningún móvil aguanta eso. Se fusionan en una malla por bloque —15 llamadas
// en total— y cada vértice lleva el número de la estructura a la que
// pertenece. Con eso, mostrar, ocultar, aislar y colorear se resuelven en la
// GPU leyendo una textura, sin volver a tocar la geometría. Ver `visor.js`.
//
// CACHÉ DE SESIÓN
// ---------------
// La promesa se guarda a nivel de módulo: los dos atlas comparten el mismo
// pack, así que pasar de uno a otro no vuelve a descargar nada. Cuesta unos
// 64 MB de memoria mientras la pestaña esté abierta; la alternativa era
// bajar 32 MB otra vez cada vez que la docente cambia de atlas.
//
// La descompresión y la comprobación de tamaño siguen la misma estrategia que
// `app/model-download.ts` de human-atlas (MIT, © 2026 ashemag): un host
// estático puede servir el .gz ya descomprimido o como fichero gzip, y hay
// que distinguirlo mirando la firma en vez de suponerlo.

const RUTA_MANIFIESTO = "/models/atlas.json";
const RUTA_NOMBRES = "/models/atlas-es.json";

/** Descargas simultáneas. Tres llenan el ancho de banda sin ahogar el móvil. */
const EN_PARALELO = 3;

/** Caché de sesión: una sola promesa para toda la aplicación. */
let cache = null;

export class ErrorDeAtlas extends Error {
  constructor(mensaje, causa = null) {
    super(mensaje);
    this.name = "ErrorDeAtlas";
    this.causa = causa;
  }
}

/**
 * Convierte la respuesta en un ArrayBuffer, descomprimiendo si hace falta.
 *
 * `fetch` ya descomprime cuando el servidor manda `Content-Encoding: gzip`,
 * así que descomprimir a ciegas rompería justo en los hosts que lo hacen
 * bien. Se mira la firma gzip (0x1f 0x8b) y se decide con el dato, no con la
 * suposición.
 */
async function aBuffer(respuesta, bytesEsperados) {
  if (!respuesta.ok) throw new ErrorDeAtlas(`HTTP ${respuesta.status}`);

  const carga = await respuesta.arrayBuffer();
  const firma = new Uint8Array(carga, 0, Math.min(2, carga.byteLength));
  const esGzip = firma[0] === 0x1f && firma[1] === 0x8b;

  if (!esGzip) {
    if (carga.byteLength !== bytesEsperados) {
      throw new ErrorDeAtlas("Un bloque del modelo llegó incompleto.");
    }
    return carga;
  }

  if (typeof DecompressionStream === "undefined") {
    throw new ErrorDeAtlas("El navegador no puede descomprimir el modelo.");
  }

  const flujo = new Blob([carga]).stream().pipeThrough(new DecompressionStream("gzip"));
  const buffer = await new Response(flujo).arrayBuffer();
  if (buffer.byteLength !== bytesEsperados) {
    throw new ErrorDeAtlas("Un bloque del modelo llegó incompleto.");
  }
  return buffer;
}

/**
 * Fusiona todas las estructuras de un bloque en una sola malla.
 *
 * Se copia en vez de crear vistas sobre el buffer original a propósito: una
 * vista mantiene vivo el buffer entero de 4 MB aunque sólo se use un trozo,
 * y con 15 bloques eso duplicaría la memoria sin que se note por qué.
 *
 * `rangos` dice dónde quedó cada estructura dentro de la malla fusionada. Sin
 * eso, después de fusionar sería imposible saber qué triángulo es de quién, y
 * el rayo de selección tendría que recorrer los 2,29 millones de triángulos en
 * vez de los pocos miles de las estructuras candidatas.
 *
 * @returns {{posiciones, normales, indices, indiceDeParte, cuenta, rangos}}
 */
export function fusionarBloque(buffer, partes) {
  let vertices = 0;
  let indices = 0;
  for (const p of partes) { vertices += p.vertexCount; indices += p.indexCount; }

  const posiciones = new Float32Array(vertices * 3);
  const normales = new Int16Array(vertices * 3);
  const indiceDeParte = new Float32Array(vertices);
  const elementos = new Uint32Array(indices);
  const rangos = [];

  let vOffset = 0;
  let iOffset = 0;

  for (const p of partes) {
    rangos.push({
      parte: p.indiceGlobal,
      desdeIndice: iOffset,
      cuantosIndices: p.indexCount,
    });
    const pos = new Float32Array(buffer, p.positions, p.vertexCount * 3);
    const nor = new Int16Array(buffer, p.normals, p.vertexCount * 3);
    const idx = new Uint32Array(buffer, p.indices, p.indexCount);

    posiciones.set(pos, vOffset * 3);
    normales.set(nor, vOffset * 3);
    indiceDeParte.fill(p.indiceGlobal, vOffset, vOffset + p.vertexCount);

    // Los índices de cada estructura empiezan en cero: hay que desplazarlos
    // al sitio que ocupan sus vértices dentro de la malla fusionada.
    for (let k = 0; k < idx.length; k += 1) elementos[iOffset + k] = idx[k] + vOffset;

    vOffset += p.vertexCount;
    iOffset += p.indexCount;
  }

  return { posiciones, normales, indices: elementos, indiceDeParte, cuenta: vertices, rangos };
}

async function descargarJson(ruta, signal) {
  const r = await fetch(ruta, { signal });
  if (!r.ok) throw new ErrorDeAtlas(`No se pudo leer ${ruta} (HTTP ${r.status})`);
  return r.json();
}

/**
 * Carga el atlas completo. Reutiliza la descarga anterior si ya se hizo.
 *
 * @param {(pct:number, fase:string) => void} onProgreso
 * @returns {Promise<{partes:Array, nombres:object, bloques:Array}>}
 */
export function cargarAtlas({ onProgreso } = {}) {
  if (cache) {
    // Ya está en memoria: se avisa del 100 % para que la pantalla de carga no
    // se quede esperando un progreso que nunca va a llegar.
    onProgreso?.(100, "listo");
    return cache;
  }

  cache = (async () => {
    onProgreso?.(0, "manifiesto");

    const [manifiesto, nombres] = await Promise.all([
      descargarJson(RUTA_MANIFIESTO),
      // Los nombres en español son un extra: si faltan, el atlas funciona
      // con los originales en vez de no abrirse.
      descargarJson(RUTA_NOMBRES).catch(() => ({})),
    ]);

    const partes = manifiesto.parts.map((p, i) => ({ ...p, indiceGlobal: i }));
    const porBloque = manifiesto.chunks.map(() => []);
    for (const p of partes) porBloque[p.chunk]?.push(p);

    const bloques = new Array(manifiesto.chunks.length);
    let hechos = 0;

    async function traerBloque(i) {
      const bloque = manifiesto.chunks[i];
      const comprimido = Boolean(bloque.gzip);
      const url = comprimido ? bloque.gzip : bloque.url;
      const respuesta = await fetch(url);
      const buffer = await aBuffer(respuesta, bloque.bytes);
      bloques[i] = fusionarBloque(buffer, porBloque[i]);
      hechos += 1;
      onProgreso?.(Math.round((hechos / manifiesto.chunks.length) * 100), "estructuras");
    }

    // Cola sencilla: `EN_PARALELO` trabajadores tirando del mismo contador.
    let siguiente = 0;
    await Promise.all(
      Array.from({ length: Math.min(EN_PARALELO, manifiesto.chunks.length) }, async () => {
        while (siguiente < manifiesto.chunks.length) {
          const i = siguiente;
          siguiente += 1;
          await traerBloque(i);
        }
      })
    );

    return { manifiesto, partes, nombres, bloques };
  })();

  // Un fallo no se queda cacheado: si falla la red, el siguiente intento
  // tiene que poder volver a descargar.
  cache.catch(() => { cache = null; });

  return cache;
}

/** Sólo para pruebas: vacía la caché de sesión. */
export function olvidarAtlas() {
  cache = null;
}

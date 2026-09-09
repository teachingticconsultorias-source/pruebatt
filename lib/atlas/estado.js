// lib/atlas/estado.js
//
// LAS TRANSICIONES DEL ATLAS, FORMALIZADAS.
//
// EL FALLO QUE ESTO PREVIENE
// --------------------------
// En producción, seleccionar una estructura reencuadraba la cámara al cuerpo
// completo. La causa inmediata estaba en el puente con React, pero el motivo
// de fondo era que no había ninguna regla escrita sobre qué acción puede
// mover la cámara. Cada sitio decidía por su cuenta y nadie podía comprobar
// la regla porque no existía.
//
// Aquí hay dos cosas separadas a propósito:
//
//   1. `reducir()` — el estado, y NADA más. Cinco porciones independientes.
//   2. `ORDEN_DE_CAMARA` — qué acción, y sólo cuál, mueve la cámara.
//
// La tabla se puede leer de un vistazo y se puede probar. Si mañana alguien
// hace que seleccionar centre la cámara, tendrá que escribirlo en la tabla, y
// el test que dice que `SELECCIONAR` no mueve nada fallará.
//
// LAS CINCO PORCIONES, Y POR QUÉ NO SON UNA
// -----------------------------------------
//   seleccion  qué estructura está resaltada y descrita
//   aislada    qué estructura se está viendo sola, temporalmente
//   ocultas    piezas que la docente quitó de en medio, una a una
//   grupos     qué sistemas o categorías están encendidos
//   (cámara)   NO está aquí: vive en el visor, en una referencia
//
// La cámara queda fuera del estado de React a propósito. Es un objeto que
// cambia sesenta veces por segundo mientras se arrastra el ratón; meterla en
// `useState` sería re-renderizar el árbol entero en cada fotograma. Ver
// `lib/atlas/camara.js`.
//
// Aislar es una CAPA, no una modificación: no toca `grupos` ni `ocultas`, así
// que salir del aislamiento devuelve la vista anterior sin guardar copia.

/**
 * Qué mueve la cámara. Todo lo que no esté aquí, no la mueve.
 *
 * `null` es una respuesta explícita, no un hueco: dice «esta acción no toca
 * la cámara» y el test lo comprueba.
 */
export const ORDEN_DE_CAMARA = {
  /* ---- las que sí, porque el usuario las pide ------------------------- */
  CENTRAR: "enfocar",                 // encuadra la estructura seleccionada
  CENTRAR_MODELO: "centrar",          // encuadre general
  RESTABLECER_VISTA: "restablecer",   // ángulo y distancia iniciales
  VISTA: "vista",                     // anterior · posterior · izquierda · …
  ZOOM: "zoom",

  /* ---- las que NO, y es el punto de todo esto ------------------------- */
  SELECCIONAR: null,
  QUITAR_SELECCION: null,
  ALTERNAR_AISLAMIENTO: null,
  ALTERNAR_OCULTA: null,
  RESTAURAR_OCULTAS: null,
  ALTERNAR_GRUPO: null,
  APLICAR_ATAJO: null,
  MOSTRAR_TODO: null,
  OCULTAR_TODO: null,
  RESTAURAR_VISIBILIDAD: null,
  BUSCAR: null,
};

/** ¿Esta acción puede mover la cámara? */
export function mueveLaCamara(tipo) {
  return ORDEN_DE_CAMARA[tipo] != null;
}

/**
 * Estado inicial.
 *
 * @param {object} fuente  la fuente del atlas (ver fuentes.js)
 */
export function estadoInicial(fuente) {
  return {
    seleccion: null,
    aislada: null,
    ocultas: new Set(),
    grupos: new Set(fuente.visiblesAlInicio),
    busqueda: "",
    atajo: fuente.atajos ? "todas" : null,
  };
}

/** Añade o quita de un Set sin mutarlo. */
function alternar(conjunto, valor) {
  const copia = new Set(conjunto);
  if (copia.has(valor)) copia.delete(valor); else copia.add(valor);
  return copia;
}

/**
 * La única función que cambia el estado del atlas.
 *
 * Pura: mismos argumentos, mismo resultado, sin tocar el visor. Lo que haya
 * que hacerle al visor lo decide `ORDEN_DE_CAMARA`, no esto.
 *
 * @param {object} estado
 * @param {{tipo:string}} accion
 * @param {object} contexto  { fuente, grupoDe }
 */
export function reducir(estado, accion, contexto = {}) {
  const { fuente, grupoDe } = contexto;

  switch (accion.tipo) {
    /* ==================================================== SELECCIÓN ==== */
    case "SELECCIONAR": {
      const { indice } = accion;
      if (indice == null) return reducir(estado, { tipo: "QUITAR_SELECCION" }, contexto);

      // Elegir una estructura la hace visible: si viene de la búsqueda o de
      // «relacionadas», su sistema puede estar apagado y ella misma oculta.
      // Sin esto la docente la elige y no pasa nada visible.
      const ocultas = estado.ocultas.has(indice)
        ? new Set([...estado.ocultas].filter((i) => i !== indice))
        : estado.ocultas;

      let grupos = estado.grupos;
      const grupo = grupoDe?.(indice);
      if (grupo && !grupos.has(grupo)) grupos = new Set(grupos).add(grupo);

      // Aislar sigue a la selección: si estabas viendo una estructura sola y
      // saltas a otra, se aísla la nueva. Lo contrario dejaría en pantalla una
      // estructura que ya no es la descrita en la ficha.
      const aislada = estado.aislada != null ? indice : null;

      return { ...estado, seleccion: indice, ocultas, grupos, aislada };
    }

    case "QUITAR_SELECCION":
      // Quitar la selección también sale del aislamiento: aislar sin nada
      // seleccionado dejaría el lienzo vacío y sin forma de entender por qué.
      return { ...estado, seleccion: null, aislada: null };

    /* ==================================================== AISLAMIENTO === */
    case "ALTERNAR_AISLAMIENTO": {
      if (estado.seleccion == null) return estado;
      return { ...estado, aislada: estado.aislada != null ? null : estado.seleccion };
    }

    /* ======================================================== OCULTAR === */
    case "ALTERNAR_OCULTA": {
      const indice = accion.indice ?? estado.seleccion;
      if (indice == null) return estado;

      const seOculta = !estado.ocultas.has(indice);
      const ocultas = alternar(estado.ocultas, indice);

      // Ocultar la estructura descrita en la ficha deja la ficha hablando de
      // algo que no se ve. Se limpia la selección, y con ella el aislamiento.
      if (seOculta && indice === estado.seleccion) {
        return { ...estado, ocultas, seleccion: null, aislada: null };
      }
      return { ...estado, ocultas };
    }

    case "RESTAURAR_OCULTAS":
      // NO toca los grupos: esconder una pieza y apagar un sistema son
      // preguntas distintas, y mezclarlas obligaba a rehacer la vista entera
      // por haber quitado un hueso de delante.
      return { ...estado, ocultas: new Set() };

    /* ========================================================= GRUPOS === */
    case "ALTERNAR_GRUPO":
      return {
        ...estado,
        grupos: alternar(estado.grupos, accion.clave),
        atajo: null,
        aislada: null,
      };

    case "APLICAR_ATAJO":
      return {
        ...estado,
        grupos: new Set(accion.grupos),
        atajo: accion.id ?? null,
        aislada: null,
      };

    case "MOSTRAR_TODO":
      // Semántica declarada: enciende TODO, incluida «Piel y anexos», que
      // arranca apagada. Es lo que dice el botón.
      return {
        ...estado,
        grupos: new Set(Object.keys(fuente.grupos)),
        atajo: "todas",
        aislada: null,
      };

    case "OCULTAR_TODO":
      return { ...estado, grupos: new Set(), atajo: null, aislada: null };

    case "RESTAURAR_VISIBILIDAD":
      // Devuelve la visibilidad al arranque y NADA más. No mueve la cámara:
      // para eso está «Restablecer vista», que a su vez no toca esto.
      return {
        ...estado,
        grupos: new Set(fuente.visiblesAlInicio),
        ocultas: new Set(),
        aislada: null,
        atajo: fuente.atajos ? "todas" : null,
      };

    /* ======================================================= BÚSQUEDA === */
    case "BUSCAR":
      return { ...estado, busqueda: accion.texto };

    /* ---- las de cámara no tocan el estado, y por eso caen aquí -------- */
    case "CENTRAR":
    case "CENTRAR_MODELO":
    case "RESTABLECER_VISTA":
    case "VISTA":
    case "ZOOM":
      return estado;

    default:
      return estado;
  }
}

/**
 * Qué estructuras se ven, a partir del estado.
 *
 * Pura y derivada: no hay una lista de visibles que mantener en sincronía con
 * las otras porciones, que es de donde salía el «panel OFF pero malla ON».
 *
 * @param {Array} partesDelAtlas  las de este atlas, con `indiceGlobal`
 * @param {object} estado
 * @param {(parte:object)=>string} grupoDeParte
 */
export function calcularVisibles(partesDelAtlas, estado, grupoDeParte) {
  const visibles = new Set();
  if (!partesDelAtlas?.length) return visibles;

  // Aislar es una capa encima: manda sobre grupos y ocultas mientras dura, y
  // al quitarla todo vuelve solo porque nunca se modificó nada.
  if (estado.aislada != null) {
    visibles.add(estado.aislada);
    return visibles;
  }

  for (const parte of partesDelAtlas) {
    const i = parte.indiceGlobal;
    if (!estado.grupos.has(grupoDeParte(parte))) continue;
    if (estado.ocultas.has(i)) continue;
    visibles.add(i);
  }
  return visibles;
}

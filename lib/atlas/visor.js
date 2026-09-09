// lib/atlas/visor.js
//
// EL MOTOR 3D. Three.js puro, sin React.
//
// POR QUÉ ESTÁ SEPARADO DE REACT
// ------------------------------
// Un bucle de render y un árbol que se vuelve a pintar en cada `setState` no
// se llevan bien. Aquí dentro no hay estado de React: el componente crea el
// visor una vez, le manda órdenes y escucha selecciones. Así el panel de
// información se abre y se cierra sin que la escena se entere.
//
// CÓMO SE MUESTRAN 2.234 ESTRUCTURAS
// ----------------------------------
// Fusionadas en 15 mallas (ver `carga.js`) y con el estado de cada estructura
// en una textura de un píxel de alto:
//
//   rgb → color del sistema al que pertenece
//   a   → 0 oculta · 1 visible · 2 señalada · 3 seleccionada
//
// Mostrar, ocultar y aislar son entonces escrituras en un array de floats.
// No se recorre la geometría ni se reconstruye nada, y da igual que sean diez
// estructuras o dos mil.
//
// CÓMO SE SABE DÓNDE TOCÓ LA DOCENTE
// ----------------------------------
// Con un rayo real contra los triángulos, no con una aproximación. Lanzarlo
// contra los 2,29 millones tardaría cientos de milisegundos, así que primero
// se descarta por cajas envolventes —las que ya trae el manifiesto—, se
// ordenan las candidatas por distancia y se para en cuanto ninguna caja
// pendiente puede estar más cerca que el mejor impacto encontrado. En la
// práctica se examinan una o dos estructuras, no dos mil, y por eso el mismo
// rayo sirve para el resaltado al pasar el ratón.

import * as THREE from "three";

import { crearCamara } from "./camara.js";

// Sin gestión de color automática: el sombreado de abajo hace su propia
// conversión a lineal y su propio gamma al final. Con las dos cosas activas,
// el modelo salía lavado y el fondo no casaba con el resto de la aplicación.
THREE.ColorManagement.enabled = false;

/** Límite de píxeles por punto. Más allá se calienta el móvil sin verse mejor. */
const DPR_MOVIL = 1.5;
const DPR_ESCRITORIO = 2;

/** Un toque que se mueve más que esto es un giro, no una selección. */
const TOLERANCIA_TOQUE = 6;

const ESTADO_OCULTA = 0;
const ESTADO_VISIBLE = 1;
const ESTADO_SENALADA = 2;
const ESTADO_SELECCIONADA = 3;

const VERTEX = /* glsl */ `
  attribute float indiceDeParte;
  uniform sampler2D estados;
  uniform float anchoEstados;
  varying vec3 vColor;
  varying vec3 vNormal;
  varying vec3 vVista;
  varying float vEstado;

  void main() {
    vec4 st = texture2D(estados, vec2((indiceDeParte + 0.5) / anchoEstados, 0.5));

    if (st.a < 0.5) {
      // Oculta: fuera del volumen de recorte. Sale más barato que descartarla
      // en el fragmento porque ni siquiera se llega a rasterizar.
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      return;
    }

    // El color llega en sRGB, que es como se escribe una paleta. Se pasa a
    // lineal antes de iluminar: sumar luces sobre valores con gamma aplicado
    // es lo que aplana los volúmenes y deja los medios tonos sucios.
    vColor = pow(st.rgb, vec3(2.2));
    vEstado = st.a;

    vec4 enVista = modelViewMatrix * vec4(position, 1.0);
    vVista = -enVista.xyz;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * enVista;
  }
`;

// Tres luces y un realce de silueta. No busca realismo: busca que dos
// estructuras del mismo color se distingan la una de la otra, que es lo que
// hace falta para leer anatomía.
const FRAGMENT = /* glsl */ `
  precision highp float;

  uniform vec3 colorSeleccion;
  uniform vec3 cielo;
  uniform vec3 suelo;
  varying vec3 vColor;
  varying vec3 vNormal;
  varying vec3 vVista;
  varying float vEstado;

  // Curva de exposición ACES en su forma reducida. Comprime los brillos sin
  // quemarlos, que es justo lo que pasaba con el sombreado plano anterior en
  // las superficies orientadas a la luz.
  vec3 aces(vec3 x) {
    return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
  }

  void main() {
    vec3 n = normalize(vNormal);
    vec3 v = normalize(vVista);

    // Las normales de BodyParts3D no siempre miran hacia fuera, y el material
    // dibuja las dos caras: si no se voltean, media estructura sale negra.
    if (dot(n, v) < 0.0) n = -n;

    vec3 luzPrincipal = normalize(vec3(-0.35, 0.72, 0.60));
    vec3 luzRelleno   = normalize(vec3(0.65, -0.15, 0.40));

    float difusa  = max(dot(n, luzPrincipal), 0.0);
    float relleno = max(dot(n, luzRelleno), 0.0) * 0.30;

    // Ambiente hemisférico: cielo frío arriba, rebote cálido abajo. Da
    // profundidad en las zonas que no reciben luz directa, donde antes sólo
    // había un gris uniforme.
    float hemi = n.y * 0.5 + 0.5;
    vec3 ambiente = mix(suelo, cielo, hemi) * 0.42;

    // Especular muy contenido: sugiere la curvatura sin parecer plástico.
    vec3 media = normalize(luzPrincipal + v);
    float brillo = pow(max(dot(n, media), 0.0), 28.0) * 0.16;

    // Realce de silueta. Es lo que separa un músculo del músculo de al lado
    // cuando los dos comparten color.
    float borde = pow(1.0 - max(dot(n, v), 0.0), 3.5);

    vec3 color = vColor * (ambiente + difusa * 0.78 + relleno) + brillo;
    color += borde * 0.22 * mix(vec3(1.0), vColor + 0.35, 0.5);

    // Señalada al pasar el ratón: un aclarado leve, sin cambiar de color.
    float senalada = step(1.5, vEstado) * (1.0 - step(2.5, vEstado));
    color = mix(color, color * 1.35 + 0.05, senalada);

    // Seleccionada: CONTORNO, no repintado.
    //
    // Antes se teñía la estructura al 55 % con el color de marca, y eso la
    // hacía irreconocible justo cuando se quiere identificarla: un músculo
    // seleccionado dejaba de parecer un músculo. Ahora el color base se
    // conserva, el interior sube un 12 % para que se lea como activa, y lo
    // que destaca de verdad es el contorno, donde el factor de silueta que
    // se calcula arriba vale casi uno. Nada de blanco ni de fluorescente.
    float elegida = step(2.5, vEstado);
    vec3 realce = color * 1.12 + colorSeleccion * borde * 1.7;
    color = mix(color, realce, elegida);

    gl_FragColor = vec4(pow(aces(color), vec3(1.0 / 2.2)), 1.0);
  }
`;

/**
 * ¿Se puede crear un contexto WebGL? Se comprueba antes de montar nada.
 *
 * Sin DOM —renderizado en servidor, o una prueba— la respuesta es que no: es
 * la única contestación honesta, y hace que el armazón enseñe el aviso en vez
 * de reventar buscando `document`.
 */
export function hayWebgl() {
  if (typeof document === "undefined" || typeof window === "undefined") return false;
  try {
    const lienzo = document.createElement("canvas");
    return Boolean(
      window.WebGLRenderingContext &&
      (lienzo.getContext("webgl2") || lienzo.getContext("webgl"))
    );
  } catch {
    return false;
  }
}

/**
 * Crea el visor dentro de `contenedor`.
 *
 * @param {object} config
 * @param {HTMLElement} config.contenedor
 * @param {Array} config.bloques          mallas fusionadas de `carga.js`
 * @param {Array} config.partes           manifiesto con `indiceGlobal`
 * @param {number[][]} config.colores     color rgb 0..1 por índice global
 * @param {Set<number>} [config.enfoque]  estructuras de este atlas
 * @param {(indice:number|null)=>void} config.alSeleccionar
 * @param {(indice:number|null)=>void} [config.alSenalar]
 */
export function crearVisor({
  contenedor, bloques, partes, colores, enfoque, alSeleccionar, alSenalar,
}) {
  const esTactil = window.matchMedia("(pointer: coarse)").matches;
  const haySenalado = window.matchMedia("(hover: hover)").matches;
  const sinMovimiento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ----------------------------------------------------------- renderizador */
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      antialias: !esTactil,
      powerPreference: "high-performance",
    });
  } catch (error) {
    throw new Error("WEBGL_NO_DISPONIBLE", { cause: error });
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, esTactil ? DPR_MOVIL : DPR_ESCRITORIO));
  renderer.setClearColor(0x0d2422, 1);
  const lienzo = renderer.domElement;
  lienzo.style.display = "block";
  lienzo.style.width = "100%";
  lienzo.style.height = "100%";
  lienzo.style.touchAction = "none";
  lienzo.setAttribute("tabindex", "0");
  contenedor.appendChild(lienzo);

  const escena = new THREE.Scene();
  const camara = new THREE.PerspectiveCamera(42, 1, 0.01, 40);

  /* ------------------------------------------------- textura con los estados */
  const ancho = THREE.MathUtils.ceilPowerOfTwo(Math.max(partes.length, 2));
  const datos = new Float32Array(ancho * 4);
  for (let i = 0; i < partes.length; i += 1) {
    const c = colores[i] || [0.7, 0.75, 0.75];
    datos[i * 4] = c[0];
    datos[i * 4 + 1] = c[1];
    datos[i * 4 + 2] = c[2];
    datos[i * 4 + 3] = ESTADO_VISIBLE;
  }
  const textura = new THREE.DataTexture(datos, ancho, 1, THREE.RGBAFormat, THREE.FloatType);
  // Sin filtrado: se quiere el valor exacto del téxel, no una mezcla con el
  // vecino. Con interpolación, una estructura oculta junto a una visible
  // acabaría medio dibujada.
  textura.minFilter = THREE.NearestFilter;
  textura.magFilter = THREE.NearestFilter;
  textura.generateMipmaps = false;
  textura.needsUpdate = true;

  const material = new THREE.ShaderMaterial({
    uniforms: {
      estados: { value: textura },
      anchoEstados: { value: ancho },
      // Verde azulado de SciVerse, subido de luminancia porque ahora sólo se
      // usa como contorno aditivo: al 0,09 no se veía sobre un hueso claro.
      colorSeleccion: { value: new THREE.Vector3(0.16, 0.86, 0.78) },
      cielo: { value: new THREE.Vector3(0.82, 0.86, 0.92) },
      suelo: { value: new THREE.Vector3(0.34, 0.28, 0.24) },
    },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    side: THREE.DoubleSide,
  });

  /* -------------------------------------------------------------- geometría */
  const geometrias = [];
  // Dónde vive cada estructura dentro de las mallas fusionadas. Es lo que
  // permite lanzar el rayo sólo contra sus triángulos.
  const ubicacion = new Map();

  for (const bloque of bloques) {
    if (!bloque || !bloque.cuenta) continue;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(bloque.posiciones, 3));
    g.setAttribute("normal", new THREE.BufferAttribute(bloque.normales, 3, true));
    g.setAttribute("indiceDeParte", new THREE.BufferAttribute(bloque.indiceDeParte, 1));
    g.setIndex(new THREE.BufferAttribute(bloque.indices, 1));
    // La esfera envolvente se calcula una vez: sin ella Three la recalcula en
    // cada fotograma sobre un millón de vértices.
    g.computeBoundingSphere();
    geometrias.push(g);
    escena.add(new THREE.Mesh(g, material));

    for (const r of bloque.rangos || []) {
      ubicacion.set(r.parte, {
        posiciones: bloque.posiciones,
        indices: bloque.indices,
        desde: r.desdeIndice,
        cuantos: r.cuantosIndices,
      });
    }
  }

  /* --------------------------------------------------------------- encuadre */
  // La caja se calcula SÓLO con las estructuras de este atlas. El pack es el
  // mismo para los dos, así que si se midiera el cuerpo entero el atlas
  // maxilofacial abriría con la cabeza del tamaño de una moneda.
  const caja = new THREE.Box3();
  const punto = new THREE.Vector3();
  for (const p of partes) {
    if (enfoque && !enfoque.has(p.indiceGlobal)) continue;
    caja.expandByPoint(punto.fromArray(p.bounds[0]));
    caja.expandByPoint(punto.fromArray(p.bounds[1]));
  }
  const centro = caja.getCenter(new THREE.Vector3());
  const diagonal = caja.getSize(new THREE.Vector3()).length() || 1;

  // Caja envolvente por estructura, para el descarte rápido del rayo.
  const cajas = partes.map((p) => new THREE.Box3(
    new THREE.Vector3().fromArray(p.bounds[0]),
    new THREE.Vector3().fromArray(p.bounds[1])
  ));

  // El estado de la cámara vive fuera, en un módulo sin WebGL, para que se
  // pueda leer y comprobar sin montar una escena. Ver `lib/atlas/camara.js`.
  const orbita = crearCamara({ centro, diagonal, fov: camara.fov });

  let sucio = true;
  const marcar = () => { sucio = true; };

  const mira = new THREE.Vector3();

  /** Lleva el estado de la órbita a la cámara de Three. Nada más. */
  function colocarCamara() {
    const { posicion, objetivo } = orbita.estado();
    camara.position.set(posicion.x, posicion.y, posicion.z);
    camara.lookAt(mira.set(objetivo.x, objetivo.y, objetivo.z));
    camara.updateMatrixWorld();
  }

  /* ------------------------------------------------------------- dimensiones */
  function redimensionar() {
    const w = contenedor.clientWidth || 1;
    const h = contenedor.clientHeight || 1;
    renderer.setSize(w, h, false);
    camara.aspect = w / h;
    camara.updateProjectionMatrix();
    marcar();
  }

  const observador = new ResizeObserver(redimensionar);
  observador.observe(contenedor);
  redimensionar();

  /* ==========================================================================
     SELECCIÓN POR RAYO

     Tres pasos, y el tercero casi nunca llega lejos:

       1. Cajas envolventes de las estructuras VISIBLES que el rayo atraviesa,
          con la distancia a la que entra en cada una.
       2. Se ordenan por esa distancia.
       3. Se prueban los triángulos en ese orden y se para en cuanto la
          siguiente caja está más lejos que el mejor impacto ya encontrado:
          nada de lo que queda puede ganar.
     ========================================================================== */
  const rayo = new THREE.Raycaster();
  const puntero = new THREE.Vector2();
  const vA = new THREE.Vector3();
  const vB = new THREE.Vector3();
  const vC = new THREE.Vector3();
  const impacto = new THREE.Vector3();
  const candidatas = [];

  /** Visibilidad según la textura de estados: lo oculto no se puede tocar. */
  const esVisible = (i) => datos[i * 4 + 3] > 0.5;

  function estructuraEn(clienteX, clienteY) {
    const marco = lienzo.getBoundingClientRect();
    if (!marco.width || !marco.height) return null;

    puntero.x = ((clienteX - marco.left) / marco.width) * 2 - 1;
    puntero.y = -((clienteY - marco.top) / marco.height) * 2 + 1;
    if (puntero.x < -1 || puntero.x > 1 || puntero.y < -1 || puntero.y > 1) return null;

    rayo.setFromCamera(puntero, camara);

    candidatas.length = 0;
    for (let i = 0; i < partes.length; i += 1) {
      if (!esVisible(i)) continue;
      if (enfoque && !enfoque.has(i)) continue;
      const c = cajas[i];
      if (!rayo.ray.intersectsBox(c)) continue;
      // Distancia a la que el rayo entra en la caja. Si el origen está dentro,
      // `intersectBox` devuelve null y se trata como distancia cero.
      const entrada = rayo.ray.intersectBox(c, impacto);
      candidatas.push({ i, d: entrada ? rayo.ray.origin.distanceTo(impacto) : 0 });
    }
    if (!candidatas.length) return null;
    candidatas.sort((a, b) => a.d - b.d);

    let mejor = null;
    let mejorDistancia = Infinity;

    for (const { i, d } of candidatas) {
      // Ninguna caja pendiente puede contener un impacto más cercano.
      if (d > mejorDistancia) break;

      const u = ubicacion.get(i);
      if (!u) continue;
      const { posiciones, indices, desde, cuantos } = u;

      for (let k = 0; k < cuantos; k += 3) {
        vA.fromArray(posiciones, indices[desde + k] * 3);
        vB.fromArray(posiciones, indices[desde + k + 1] * 3);
        vC.fromArray(posiciones, indices[desde + k + 2] * 3);
        // Sin descartar caras traseras: el material dibuja las dos, y muchas
        // mallas de BodyParts3D tienen las normales invertidas.
        if (!rayo.ray.intersectTriangle(vA, vB, vC, false, impacto)) continue;
        const distancia = rayo.ray.origin.distanceTo(impacto);
        if (distancia < mejorDistancia) { mejorDistancia = distancia; mejor = i; }
      }
    }
    return mejor;
  }

  /* ------------------------------------------------------------- interacción */
  const punteros = new Map();
  let inicioToque = null;
  let pinchaPrevia = 0;
  let centroPrevio = null;
  let senalada = null;
  let senaladoPendiente = null;

  function onDown(e) {
    lienzo.setPointerCapture?.(e.pointerId);
    punteros.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (punteros.size === 1) {
      inicioToque = { x: e.clientX, y: e.clientY };
    } else {
      inicioToque = null;   // dos dedos nunca es una selección
      pinchaPrevia = 0;
      centroPrevio = null;
    }
  }

  function onMove(e) {
    const previo = punteros.get(e.pointerId);

    if (!previo) {
      // Nadie está arrastrando: es el ratón paseando por encima.
      if (haySenalado) senaladoPendiente = { x: e.clientX, y: e.clientY };
      return;
    }

    const dx = e.clientX - previo.x;
    const dy = e.clientY - previo.y;
    punteros.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (punteros.size === 1) {
      orbita.orbitar(dx * 0.006, dy * 0.006);
      colocarCamara();
      marcar();
      return;
    }

    // Dos dedos: pellizcar acerca, arrastrar desplaza el punto de mira.
    const [a, b] = [...punteros.values()];
    const distancia = Math.hypot(a.x - b.x, a.y - b.y);
    const centro2 = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };

    if (pinchaPrevia > 0 && distancia > 0) orbita.zoom(pinchaPrevia / distancia);
    if (centroPrevio) desplazar(centro2.x - centroPrevio.x, centro2.y - centroPrevio.y);
    pinchaPrevia = distancia;
    centroPrevio = centro2;
    colocarCamara();
    marcar();
  }

  function onUp(e) {
    lienzo.releasePointerCapture?.(e.pointerId);
    punteros.delete(e.pointerId);
    if (punteros.size < 2) { pinchaPrevia = 0; centroPrevio = null; }

    if (inicioToque && punteros.size === 0) {
      const movido = Math.hypot(e.clientX - inicioToque.x, e.clientY - inicioToque.y);
      if (movido <= TOLERANCIA_TOQUE) alSeleccionar?.(estructuraEn(e.clientX, e.clientY));
    }
    inicioToque = null;
  }

  function onCancel(e) {
    punteros.delete(e.pointerId);
    inicioToque = null;
    pinchaPrevia = 0;
    centroPrevio = null;
  }

  function onSalir() {
    senaladoPendiente = null;
    if (senalada !== null) { senalada = null; alSenalar?.(null); lienzo.style.cursor = "grab"; }
  }

  function onWheel(e) {
    e.preventDefault();
    orbita.zoom(1 + Math.sign(e.deltaY) * 0.12);
    colocarCamara();
    marcar();
  }

  // Los ejes de la cámara sólo se conocen aquí; la suma la hace la órbita.
  const ejeDerecha = new THREE.Vector3();
  const ejeArriba = new THREE.Vector3();

  /** Mueve el punto de mira por el plano de la cámara. */
  function desplazar(dx, dy) {
    ejeDerecha.setFromMatrixColumn(camara.matrix, 0);
    ejeArriba.setFromMatrixColumn(camara.matrix, 1);
    orbita.desplazar(dx, dy, ejeDerecha, ejeArriba);
  }

  // El teclado mueve el modelo sin ratón: sin esto, quien navegue con teclado
  // sólo podría mirarlo de frente.
  function onKey(e) {
    const paso = e.shiftKey ? 0.25 : 0.09;
    switch (e.key) {
      case "ArrowLeft": orbita.orbitar(-paso, 0); break;
      case "ArrowRight": orbita.orbitar(paso, 0); break;
      case "ArrowUp": orbita.orbitar(0, paso); break;
      case "ArrowDown": orbita.orbitar(0, -paso); break;
      case "+": case "=": orbita.zoom(0.85); break;
      case "-": case "_": orbita.zoom(1.18); break;
      default: return;
    }
    e.preventDefault();
    colocarCamara();
    marcar();
  }

  lienzo.style.cursor = "grab";
  lienzo.addEventListener("pointerdown", onDown);
  lienzo.addEventListener("pointermove", onMove);
  lienzo.addEventListener("pointerup", onUp);
  lienzo.addEventListener("pointercancel", onCancel);
  lienzo.addEventListener("pointerleave", onSalir);
  lienzo.addEventListener("wheel", onWheel, { passive: false });
  lienzo.addEventListener("keydown", onKey);

  /* ------------------------------------------------------------ bucle */
  let animando = true;
  let cuadro = 0;

  function resolverSenalado() {
    if (!senaladoPendiente) return;
    const { x, y } = senaladoPendiente;
    senaladoPendiente = null;
    // Una sola vez por fotograma. `pointermove` dispara mucho más a menudo, y
    // lanzar un rayo por cada evento sí se notaría.
    const encontrada = punteros.size ? null : estructuraEn(x, y);
    if (encontrada === senalada) return;
    senalada = encontrada;
    lienzo.style.cursor = encontrada === null ? "grab" : "pointer";
    alSenalar?.(encontrada);
  }

  function bucle() {
    if (!animando) return;
    cuadro = requestAnimationFrame(bucle);
    resolverSenalado();
    if (!sucio) return;         // sólo se dibuja cuando algo cambió
    sucio = false;
    renderer.render(escena, camara);
  }

  colocarCamara();
  bucle();

  /* ------------------------------------------------------------------ API */
  return {
    /** Escribe el estado de cada estructura en la textura. */
    aplicar({ visibles, seleccion, senalado = null }) {
      for (let i = 0; i < partes.length; i += 1) {
        let estado = ESTADO_OCULTA;
        if (!visibles || visibles.has(i)) {
          estado = i === seleccion ? ESTADO_SELECCIONADA
            : i === senalado ? ESTADO_SENALADA
              : ESTADO_VISIBLE;
        }
        datos[i * 4 + 3] = estado;
      }
      textura.needsUpdate = true;
      marcar();
    },

    /* ======================================================================
       LO QUE MUEVE LA CÁMARA

       Estas cinco, y sólo estas cinco. `aplicar()` —que es lo que corre al
       seleccionar, ocultar o aislar— no toca ni una de ellas: era el fallo
       que se veía en producción, donde tocar un músculo tras hacer zoom
       devolvía la vista al cuerpo completo.
       ====================================================================== */
    restablecer() { orbita.restablecer(); colocarCamara(); marcar(); },

    centrar() { orbita.centrar(); colocarCamara(); marcar(); },

    /** Encuadra una estructura concreta. Conserva el ángulo actual. */
    enfocar(indice) {
      const p = partes[indice];
      if (!p) return;
      orbita.enfocarCaja(p.bounds[0], p.bounds[1]);
      colocarCamara();
      marcar();
    },

    zoom(factor) { orbita.zoom(factor); colocarCamara(); marcar(); },

    vista(nombre) {
      if (!orbita.vista(nombre)) return;
      colocarCamara();
      marcar();
    },

    /** Estado de la cámara, para poder comprobarlo desde fuera. */
    camara() { return orbita.estado(); },

    redimensionar,

    /** Devuelve el foco al lienzo, p. ej. tras cerrar un panel con Escape. */
    enfocarLienzo() { lienzo.focus?.({ preventScroll: true }); },

    sinMovimiento,

    /**
     * Suelta todo. Sin esto, entrar y salir del atlas cinco veces deja cinco
     * contextos WebGL vivos y el navegador acaba descartando el primero.
     */
    destruir() {
      animando = false;
      cancelAnimationFrame(cuadro);
      observador.disconnect();
      lienzo.removeEventListener("pointerdown", onDown);
      lienzo.removeEventListener("pointermove", onMove);
      lienzo.removeEventListener("pointerup", onUp);
      lienzo.removeEventListener("pointercancel", onCancel);
      lienzo.removeEventListener("pointerleave", onSalir);
      lienzo.removeEventListener("wheel", onWheel);
      lienzo.removeEventListener("keydown", onKey);
      for (const g of geometrias) g.dispose();
      material.dispose();
      textura.dispose();
      renderer.dispose();
      renderer.forceContextLoss?.();
      if (lienzo.parentNode === contenedor) contenedor.removeChild(lienzo);
    },
  };
}

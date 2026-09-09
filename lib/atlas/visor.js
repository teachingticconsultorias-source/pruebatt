// lib/atlas/visor.js
//
// EL MOTOR 3D. Three.js puro, sin React.
//
// POR QUÉ ESTÁ SEPARADO DE REACT
// ------------------------------
// Un bucle de render a 60 fps y un árbol de componentes que se vuelve a
// pintar en cada `setState` no se llevan bien. Aquí dentro no hay estado de
// React: el componente crea el visor una vez, le manda órdenes y escucha
// selecciones. Así el panel de información se puede abrir y cerrar sin que
// la escena se entere.
//
// CÓMO SE MUESTRAN 2.234 ESTRUCTURAS
// ----------------------------------
// Fusionadas en 15 mallas (ver `carga.js`) y con el estado de cada
// estructura en una textura de un píxel de alto:
//
//   rgb → color del sistema al que pertenece
//   a   → 0 oculta · 1 visible · 2 seleccionada
//
// Mostrar, ocultar y aislar son entonces escrituras en un array de floats y
// un `needsUpdate = true`. No se recorre la geometría, no se reconstruye
// nada y no importa que sean cinco estructuras o dos mil.
//
// CÓMO SE SABE DÓNDE TOCÓ LA DOCENTE
// ----------------------------------
// Lanzar un rayo contra 2,29 millones de triángulos tarda cientos de
// milisegundos. En vez de eso se dibuja UN píxel —el que hay bajo el dedo—
// con un material que pinta el número de la estructura en lugar de su color,
// y se lee ese píxel. Cuesta lo mismo con dos mil estructuras que con diez.

import * as THREE from "three";

/** Límite de píxeles por punto. Más allá se calienta el móvil sin verse mejor. */
const DPR_MOVIL = 1.5;
const DPR_ESCRITORIO = 2;

/** Un toque que se mueve más que esto es un giro, no una selección. */
const TOLERANCIA_TOQUE = 6;

const ESTADO_OCULTA = 0;
const ESTADO_VISIBLE = 1;
const ESTADO_SELECCIONADA = 2;

const VERTEX = /* glsl */ `
  attribute float indiceDeParte;
  uniform sampler2D estados;
  uniform float anchoEstados;
  varying vec3 vColor;
  varying vec3 vNormal;
  varying float vSeleccion;

  void main() {
    vec4 st = texture2D(estados, vec2((indiceDeParte + 0.5) / anchoEstados, 0.5));

    if (st.a < 0.5) {
      // Oculta: fuera del volumen de recorte. Sale más barato que descartarla
      // en el fragmento porque ni siquiera se llega a rasterizar.
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      return;
    }

    vColor = st.rgb;
    vSeleccion = step(1.5, st.a);
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT = /* glsl */ `
  precision mediump float;
  uniform vec3 colorSeleccion;
  varying vec3 vColor;
  varying vec3 vNormal;
  varying float vSeleccion;

  void main() {
    vec3 n = normalize(vNormal);

    // Luz hemisférica: claro arriba, rebote tenue abajo. Sin fuentes de luz
    // reales, que en un modelo de dos millones de triángulos no compensan.
    float h = n.y * 0.5 + 0.5;
    vec3 luz = mix(vec3(0.40, 0.45, 0.47), vec3(1.02, 1.00, 0.97), h);

    // Realce de silueta: sin él, estructuras del mismo color se funden.
    float borde = pow(1.0 - abs(n.z), 3.0) * 0.30;

    vec3 color = vColor * luz + borde;
    color = mix(color, colorSeleccion, vSeleccion * 0.65);
    gl_FragColor = vec4(color, 1.0);
  }
`;

const VERTEX_SELECCION = /* glsl */ `
  attribute float indiceDeParte;
  uniform sampler2D estados;
  uniform float anchoEstados;
  varying float vIndice;

  void main() {
    vec4 st = texture2D(estados, vec2((indiceDeParte + 0.5) / anchoEstados, 0.5));
    if (st.a < 0.5) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      return;
    }
    vIndice = indiceDeParte;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// El índice va en dos bytes: hasta 65.535 estructuras. Se suma uno para que
// el fondo, que queda en cero, no se confunda con la primera estructura.
const FRAGMENT_SELECCION = /* glsl */ `
  precision mediump float;
  varying float vIndice;

  void main() {
    float id = vIndice + 1.0;
    float alto = floor(id / 256.0);
    float bajo = id - alto * 256.0;
    gl_FragColor = vec4(bajo / 255.0, alto / 255.0, 0.0, 1.0);
  }
`;

/**
 * ¿Se puede crear un contexto WebGL? Se comprueba antes de montar nada.
 *
 * Sin DOM —renderizado en servidor, o una prueba— la respuesta es que no:
 * es la única contestación honesta, y hace que el armazón enseñe el aviso
 * en vez de reventar buscando `document`.
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
 * @param {Set<number>} [config.enfoque]  estructuras de este atlas, para encuadrar
 * @param {(indice:number|null)=>void} config.alSeleccionar
 */
export function crearVisor({ contenedor, bloques, partes, colores, enfoque, alSeleccionar }) {
  const esMovil = window.matchMedia("(pointer: coarse)").matches;
  const sinMovimiento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ----------------------------------------------------------- renderizador */
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      antialias: !esMovil,
      powerPreference: "high-performance",
    });
  } catch (error) {
    throw new Error("WEBGL_NO_DISPONIBLE", { cause: error });
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, esMovil ? DPR_MOVIL : DPR_ESCRITORIO));
  renderer.setClearColor(0x0f2e2c, 1);
  renderer.domElement.style.display = "block";
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
  renderer.domElement.style.touchAction = "none";
  renderer.domElement.setAttribute("tabindex", "0");
  contenedor.appendChild(renderer.domElement);

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

  const uniforms = {
    estados: { value: textura },
    anchoEstados: { value: ancho },
    colorSeleccion: { value: new THREE.Color(0x2bafa9) },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    side: THREE.DoubleSide,
  });

  const materialSeleccion = new THREE.ShaderMaterial({
    uniforms: { estados: uniforms.estados, anchoEstados: uniforms.anchoEstados },
    vertexShader: VERTEX_SELECCION,
    fragmentShader: FRAGMENT_SELECCION,
    side: THREE.DoubleSide,
  });

  /* -------------------------------------------------------------- geometría */
  const geometrias = [];
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

  const objetivo = centro.clone();
  const inicio = { theta: 0, phi: Math.PI / 2, radio: diagonal * 1.15 };
  let theta = inicio.theta;
  let phi = inicio.phi;
  let radio = inicio.radio;

  const RADIO_MIN = diagonal * 0.08;
  const RADIO_MAX = diagonal * 3;

  let sucio = true;
  const marcar = () => { sucio = true; };

  function colocarCamara() {
    phi = THREE.MathUtils.clamp(phi, 0.02, Math.PI - 0.02);
    radio = THREE.MathUtils.clamp(radio, RADIO_MIN, RADIO_MAX);
    camara.position.set(
      objetivo.x + radio * Math.sin(phi) * Math.sin(theta),
      objetivo.y + radio * Math.cos(phi),
      objetivo.z + radio * Math.sin(phi) * Math.cos(theta)
    );
    camara.lookAt(objetivo);
  }

  /* ------------------------------------------------------------- dimensiones */
  function redimensionar() {
    const ancho2 = contenedor.clientWidth || 1;
    const alto2 = contenedor.clientHeight || 1;
    renderer.setSize(ancho2, alto2, false);
    camara.aspect = ancho2 / alto2;
    camara.updateProjectionMatrix();
    marcar();
  }

  const observador = new ResizeObserver(redimensionar);
  observador.observe(contenedor);
  redimensionar();

  /* ------------------------------------------------------- selección por GPU */
  const destinoSeleccion = new THREE.WebGLRenderTarget(1, 1, {
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType,
  });
  const pixel = new Uint8Array(4);

  function estructuraEn(clienteX, clienteY) {
    const caja2 = renderer.domElement.getBoundingClientRect();
    const x = Math.floor((clienteX - caja2.left) * renderer.getPixelRatio());
    const y = Math.floor((clienteY - caja2.top) * renderer.getPixelRatio());
    const w = Math.floor(caja2.width * renderer.getPixelRatio());
    const h = Math.floor(caja2.height * renderer.getPixelRatio());
    if (x < 0 || y < 0 || x >= w || y >= h) return null;

    // Se dibuja únicamente el píxel que hay bajo el dedo.
    camara.setViewOffset(w, h, x, y, 1, 1);
    escena.overrideMaterial = materialSeleccion;
    const fondoPrevio = renderer.getClearColor(new THREE.Color());
    renderer.setClearColor(0x000000, 1);
    renderer.setRenderTarget(destinoSeleccion);
    renderer.clear();
    renderer.render(escena, camara);
    renderer.readRenderTargetPixels(destinoSeleccion, 0, 0, 1, 1, pixel);
    renderer.setRenderTarget(null);
    renderer.setClearColor(fondoPrevio, 1);
    escena.overrideMaterial = null;
    camara.clearViewOffset();
    marcar();

    const id = pixel[0] + pixel[1] * 256 - 1;
    return id >= 0 && id < partes.length ? id : null;
  }

  /* ------------------------------------------------------------- interacción */
  const punteros = new Map();
  let inicioToque = null;
  let pinchaPrevia = 0;
  let centroPrevio = null;

  const lienzo = renderer.domElement;

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
    if (!previo) return;
    const dx = e.clientX - previo.x;
    const dy = e.clientY - previo.y;
    punteros.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (punteros.size === 1) {
      theta -= dx * 0.006;
      phi -= dy * 0.006;
      colocarCamara();
      marcar();
      return;
    }

    // Dos dedos: pellizcar acerca, arrastrar desplaza el punto de mira.
    const [a, b] = [...punteros.values()];
    const distancia = Math.hypot(a.x - b.x, a.y - b.y);
    const centro2 = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };

    if (pinchaPrevia > 0 && distancia > 0) {
      radio *= pinchaPrevia / distancia;
    }
    if (centroPrevio) {
      desplazar(centro2.x - centroPrevio.x, centro2.y - centroPrevio.y);
    }
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

  function onWheel(e) {
    e.preventDefault();
    radio *= 1 + Math.sign(e.deltaY) * 0.12;
    colocarCamara();
    marcar();
  }

  /** Mueve el punto de mira por el plano de la cámara. */
  function desplazar(dx, dy) {
    const escala = (radio * 0.0022) / Math.max(renderer.getPixelRatio(), 1);
    const derecha = new THREE.Vector3().setFromMatrixColumn(camara.matrix, 0);
    const arriba = new THREE.Vector3().setFromMatrixColumn(camara.matrix, 1);
    objetivo.addScaledVector(derecha, -dx * escala);
    objetivo.addScaledVector(arriba, dy * escala);
  }

  // El teclado mueve el modelo sin ratón: sin esto, quien navegue con
  // teclado sólo podría mirarlo de frente.
  function onKey(e) {
    const paso = e.shiftKey ? 0.25 : 0.09;
    switch (e.key) {
      case "ArrowLeft": theta += paso; break;
      case "ArrowRight": theta -= paso; break;
      case "ArrowUp": phi -= paso; break;
      case "ArrowDown": phi += paso; break;
      case "+": case "=": radio *= 0.85; break;
      case "-": case "_": radio *= 1.18; break;
      default: return;
    }
    e.preventDefault();
    colocarCamara();
    marcar();
  }

  lienzo.addEventListener("pointerdown", onDown);
  lienzo.addEventListener("pointermove", onMove);
  lienzo.addEventListener("pointerup", onUp);
  lienzo.addEventListener("pointercancel", onCancel);
  lienzo.addEventListener("wheel", onWheel, { passive: false });
  lienzo.addEventListener("keydown", onKey);

  /* ------------------------------------------------------------ bucle */
  let animando = true;
  let cuadro = 0;

  function bucle() {
    if (!animando) return;
    cuadro = requestAnimationFrame(bucle);
    if (!sucio) return;         // sólo se dibuja cuando algo cambió
    sucio = false;
    renderer.render(escena, camara);
  }

  colocarCamara();
  bucle();

  /* ------------------------------------------------------------------ API */
  return {
    /** Escribe el estado de cada estructura en la textura. */
    aplicar({ visibles, seleccion }) {
      for (let i = 0; i < partes.length; i += 1) {
        const estado = !visibles || visibles.has(i)
          ? (i === seleccion ? ESTADO_SELECCIONADA : ESTADO_VISIBLE)
          : ESTADO_OCULTA;
        datos[i * 4 + 3] = estado;
      }
      textura.needsUpdate = true;
      marcar();
    },

    restablecer() {
      theta = inicio.theta;
      phi = inicio.phi;
      radio = inicio.radio;
      objetivo.copy(centro);
      colocarCamara();
      marcar();
    },

    centrar() {
      objetivo.copy(centro);
      colocarCamara();
      marcar();
    },

    /** Encuadra una estructura concreta. Se usa al elegirla en la búsqueda. */
    enfocar(indice) {
      const p = partes[indice];
      if (!p) return;
      const min = new THREE.Vector3(...p.bounds[0]);
      const max = new THREE.Vector3(...p.bounds[1]);
      objetivo.copy(min).add(max).multiplyScalar(0.5);
      radio = Math.max(min.distanceTo(max) * 2.6, RADIO_MIN * 2);
      colocarCamara();
      marcar();
    },

    zoom(factor) {
      radio *= factor;
      colocarCamara();
      marcar();
    },

    vista(nombre) {
      const angulos = {
        anterior: [0, Math.PI / 2],
        posterior: [Math.PI, Math.PI / 2],
        izquierda: [Math.PI / 2, Math.PI / 2],
        derecha: [-Math.PI / 2, Math.PI / 2],
        superior: [0, 0.08],
      };
      const a = angulos[nombre];
      if (!a) return;
      [theta, phi] = a;
      colocarCamara();
      marcar();
    },

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
      lienzo.removeEventListener("wheel", onWheel);
      lienzo.removeEventListener("keydown", onKey);
      for (const g of geometrias) g.dispose();
      material.dispose();
      materialSeleccion.dispose();
      textura.dispose();
      destinoSeleccion.dispose();
      renderer.dispose();
      renderer.forceContextLoss?.();
      if (lienzo.parentNode === contenedor) contenedor.removeChild(lienzo);
    },
  };
}

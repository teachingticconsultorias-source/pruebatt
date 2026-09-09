// lib/atlas/camara.js
//
// LA CÁMARA ORBITAL DEL ATLAS, SIN WEBGL.
//
// POR QUÉ ESTÁ FUERA DEL VISOR
// ----------------------------
// Producción tenía este fallo: la docente hacía zoom sobre el abdomen, tocaba
// un músculo y la cámara volvía al cuerpo completo. La causa estaba en el
// puente con React (ver `AtlasCanvas.jsx`), pero descubrirla costó porque el
// estado de la cámara vivía enredado con el contexto WebGL: no había forma de
// preguntarle «¿dónde estás?» sin montar una escena.
//
// Aquí la cámara es cuatro números y un punto:
//
//     theta    giro alrededor del eje vertical
//     phi      inclinación
//     radio    distancia al punto de mira
//     objetivo el punto al que mira
//
// Eso se puede leer, comparar y probar. El test de regresión de este bloque
// —«zoom a B, seleccionar, sigue en B»— es posible justo porque el estado se
// puede leer sin GPU.
//
// LA REGLA QUE ESTABA ROTA
// ------------------------
// NADA mueve la cámara salvo que alguien lo pida. Seleccionar una estructura
// no la mueve. Ocultar no la mueve. Aislar no la mueve. Sólo `restablecer`,
// `centrar`, `enfocar`, `vista`, `zoom`, `orbitar` y `desplazar`, y las siete
// existen porque el usuario las invoca.

import * as THREE from "three";

/**
 * Crea el estado de cámara para un modelo de tamaño `diagonal`.
 *
 * @param {object} config
 * @param {{x:number,y:number,z:number}} config.centro  centro del modelo
 * @param {number} config.diagonal                      tamaño del modelo
 * @param {number} [config.fov]                         campo de visión, en grados
 */
export function crearCamara({ centro, diagonal, fov = 42 }) {
  const inicial = {
    theta: 0,
    phi: Math.PI / 2,
    radio: diagonal * 1.15,
  };

  // El punto de mira es lo único que se copia: el resto son escalares.
  const objetivo = { x: centro.x, y: centro.y, z: centro.z };
  let { theta, phi, radio } = inicial;

  const RADIO_MIN = diagonal * 0.02;
  const RADIO_MAX = diagonal * 3;

  const limitar = () => {
    phi = Math.min(Math.max(phi, 0.02), Math.PI - 0.02);
    radio = Math.min(Math.max(radio, RADIO_MIN), RADIO_MAX);
  };

  /** Posición cartesiana desde los ángulos. `theta = 0` mira desde delante. */
  function posicion() {
    return {
      x: objetivo.x + radio * Math.sin(phi) * Math.sin(theta),
      y: objetivo.y + radio * Math.cos(phi),
      z: objetivo.z + radio * Math.sin(phi) * Math.cos(theta),
    };
  }

  const VISTAS = {
    anterior: [0, Math.PI / 2],
    posterior: [Math.PI, Math.PI / 2],
    izquierda: [Math.PI / 2, Math.PI / 2],
    derecha: [-Math.PI / 2, Math.PI / 2],
    superior: [0, 0.08],
  };

  return {
    /** Copia del estado. Se devuelve copiado para que nadie lo mute por fuera. */
    estado() {
      return { theta, phi, radio, objetivo: { ...objetivo }, posicion: posicion() };
    },

    /** ¿Está donde empezó? Sirve para detectar un reencuadre indeseado. */
    esInicial() {
      return theta === inicial.theta
        && phi === inicial.phi
        && radio === inicial.radio
        && objetivo.x === centro.x && objetivo.y === centro.y && objetivo.z === centro.z;
    },

    /* ------------------------------------------------- lo que mueve la cámara */
    orbitar(dTheta, dPhi) {
      theta -= dTheta;
      phi -= dPhi;
      limitar();
    },

    zoom(factor) {
      radio *= factor;
      limitar();
    },

    /**
     * Desplaza el punto de mira por el plano de la cámara.
     *
     * `derecha` y `arriba` son los ejes de la cámara, que sólo el visor
     * conoce: se los pasa él, y aquí sólo se hace la suma.
     */
    desplazar(dx, dy, derecha, arriba) {
      const escala = radio * 0.0022;
      objetivo.x += (-dx * derecha.x + dy * arriba.x) * escala;
      objetivo.y += (-dx * derecha.y + dy * arriba.y) * escala;
      objetivo.z += (-dx * derecha.z + dy * arriba.z) * escala;
    },

    restablecer() {
      theta = inicial.theta;
      phi = inicial.phi;
      radio = inicial.radio;
      objetivo.x = centro.x;
      objetivo.y = centro.y;
      objetivo.z = centro.z;
    },

    /** Encuadre general, conservando el ángulo actual. */
    centrar() {
      objetivo.x = centro.x;
      objetivo.y = centro.y;
      objetivo.z = centro.z;
      radio = inicial.radio;
    },

    vista(nombre) {
      const angulos = VISTAS[nombre];
      if (!angulos) return false;
      [theta, phi] = angulos;
      limitar();
      return true;
    },

    /**
     * Encuadra una caja concreta.
     *
     * La distancia sale del tamaño de LA CAJA y del campo de visión, no de un
     * número fijo: un nervio nasociliar y un fémur no se ven bien desde la
     * misma distancia. Se conserva el ángulo para no desorientar.
     */
    enfocarCaja(min, max) {
      objetivo.x = (min[0] + max[0]) / 2;
      objetivo.y = (min[1] + max[1]) / 2;
      objetivo.z = (min[2] + max[2]) / 2;

      const mayor = Math.max(
        max[0] - min[0], max[1] - min[1], max[2] - min[2],
        diagonal * 0.004
      );
      // El 2,1 deja aire alrededor: pegarse al borde impide ver con qué se
      // relaciona la estructura, que es medio motivo para mirarla.
      const radianes = THREE.MathUtils.degToRad(fov);
      radio = (mayor * 2.1) / (2 * Math.tan(radianes / 2));
      limitar();
    },
  };
}

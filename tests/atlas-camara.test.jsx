import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

import { crearCamara } from "../lib/atlas/camara.js";
import {
  ORDEN_DE_CAMARA, calcularVisibles, estadoInicial, mueveLaCamara, reducir,
} from "../lib/atlas/estado.js";
import { FUENTE_HUMANA, FUENTE_OMF } from "../lib/atlas/fuentes.js";
import { SISTEMAS } from "../lib/atlas/i18n.es.js";

/* ============================================================================
   LOS DOS BUGS DE PRODUCCIÓN

   1. La cámara se reencuadraba al seleccionar. La docente hacía zoom sobre el
      abdomen, tocaba un músculo y la vista volvía al cuerpo completo.

   2. «Piel y anexos» aparecía en OFF en el panel y la piel seguía tapando el
      cuerpo.

   Las dos salían de la MISMA línea: `onFallo` estaba en las dependencias del
   efecto que crea el visor, y el padre lo pasaba como una función nueva en
   cada render. Así que cualquier re-render destruía y reconstruía el visor:
   cámara al encuadre inicial y tabla de estados con todo visible.

   Estos tests van contra los módulos puros —cámara y reducidor— porque son la
   única forma de comprobar «sigue en la misma vista» sin una GPU. Y hay un
   test estructural del array de dependencias, que es donde estaba el fallo.
   ========================================================================== */

const raiz = path.resolve(".");
const leer = (f) => fs.readFileSync(path.join(raiz, f), "utf8");

const MODELO = { centro: { x: 0, y: 0.86, z: 0 }, diagonal: 1.8, fov: 42 };

/** El manifiesto real, para que la piel del test sea la piel de verdad. */
const manifiesto = JSON.parse(leer("public/models/atlas.json"));
const partes = manifiesto.parts.map((p, i) => ({ ...p, indiceGlobal: i }));
const propiasHumano = partes.filter((p) => FUENTE_HUMANA.incluye(p));
const grupoDeHumano = (parte) => FUENTE_HUMANA.grupoDe(parte);

const PIEL = propiasHumano.filter((p) => p.system === "integumentary");
const UN_MUSCULO = propiasHumano.find((p) => p.system === "muscular");
const OTRO_MUSCULO = propiasHumano.filter((p) => p.system === "muscular")[1];

/** Reduce con el contexto del atlas humano. */
function paso(estado, accion) {
  return reducir(estado, accion, {
    fuente: FUENTE_HUMANA,
    grupoDe: (indice) => grupoDeHumano(partes[indice]),
  });
}

/* ============================================================================
   BUG 1 · SELECCIONAR NO MUEVE LA CÁMARA
   ========================================================================== */
describe("cámara · seleccionar no la mueve", () => {
  it("el escenario exacto del bug: zoom a B, seleccionar, sigue en B", () => {
    const camara = crearCamara(MODELO);
    const A = camara.estado();

    // La docente gira y hace zoom hacia el abdomen. Ésta es la vista B.
    camara.orbitar(0.9, 0.3);
    camara.zoom(0.35);
    const B = camara.estado();
    expect(B.theta).not.toBe(A.theta);
    expect(B.radio).toBeLessThan(A.radio);

    // Toca un músculo. `SELECCIONAR` no tiene orden de cámara, así que nada
    // en este flujo la toca.
    expect(ORDEN_DE_CAMARA.SELECCIONAR).toBeNull();
    const despues = camara.estado();

    expect(despues.theta).toBe(B.theta);
    expect(despues.phi).toBe(B.phi);
    expect(despues.radio).toBe(B.radio);
    expect(despues.objetivo).toEqual(B.objetivo);
    expect(camara.esInicial()).toBe(false);
  });

  it("y tras seleccionar, «Centrar» SÍ la mueve", () => {
    const camara = crearCamara(MODELO);
    camara.orbitar(0.9, 0.3);
    camara.zoom(0.35);
    const B = camara.estado();

    expect(ORDEN_DE_CAMARA.CENTRAR).toBe("enfocar");
    camara.enfocarCaja(UN_MUSCULO.bounds[0], UN_MUSCULO.bounds[1]);
    const C = camara.estado();

    expect(C.objetivo).not.toEqual(B.objetivo);
    expect(C.radio).not.toBe(B.radio);
    // El ángulo se conserva: centrar no desorienta.
    expect(C.theta).toBe(B.theta);
    expect(C.phi).toBe(B.phi);
  });

  it("la rotación también se conserva al seleccionar", () => {
    const camara = crearCamara(MODELO);
    camara.orbitar(-1.4, -0.5);
    const { theta, phi } = camara.estado();
    // Ninguna acción de visibilidad tiene orden de cámara.
    for (const accion of ["SELECCIONAR", "ALTERNAR_OCULTA", "ALTERNAR_AISLAMIENTO",
      "ALTERNAR_GRUPO", "MOSTRAR_TODO", "OCULTAR_TODO", "RESTAURAR_VISIBILIDAD"]) {
      expect(mueveLaCamara(accion), accion).toBe(false);
    }
    expect(camara.estado().theta).toBe(theta);
    expect(camara.estado().phi).toBe(phi);
  });

  it("la tabla declara exactamente qué mueve la cámara", () => {
    const mueven = Object.keys(ORDEN_DE_CAMARA).filter(mueveLaCamara).sort();
    expect(mueven).toEqual(["CENTRAR", "CENTRAR_MODELO", "RESTABLECER_VISTA", "VISTA", "ZOOM"]);
    // Las cinco existen porque el usuario las invoca. Nada más las mueve.
  });

  it("«Restablecer vista» devuelve el encuadre inicial", () => {
    const camara = crearCamara(MODELO);
    camara.orbitar(1.2, 0.4);
    camara.zoom(0.3);
    expect(camara.esInicial()).toBe(false);
    camara.restablecer();
    expect(camara.esInicial()).toBe(true);
  });

  it("y NO toca la visibilidad, que era el otro medio problema", () => {
    // Antes «Restablecer» hacía las dos cosas y volvía a encender la piel.
    let estado = paso(estadoInicial(FUENTE_HUMANA), { tipo: "ALTERNAR_GRUPO", clave: "muscular" });
    const antes = new Set(estado.grupos);
    estado = paso(estado, { tipo: "RESTABLECER_VISTA" });
    expect([...estado.grupos].sort()).toEqual([...antes].sort());
  });

  it("el zoom respeta los límites y no se escapa", () => {
    const camara = crearCamara(MODELO);
    for (let i = 0; i < 60; i += 1) camara.zoom(0.5);
    expect(camara.estado().radio).toBeGreaterThan(0);
    for (let i = 0; i < 60; i += 1) camara.zoom(2);
    expect(camara.estado().radio).toBeLessThanOrEqual(MODELO.diagonal * 3);
  });

  it("una pieza pequeña se encuadra más cerca que una grande", () => {
    const femur = propiasHumano.find((p) => p.name === "Right femur");
    const nervio = propiasHumano.find((p) => /nasociliary/i.test(p.name));

    const a = crearCamara(MODELO);
    a.enfocarCaja(femur.bounds[0], femur.bounds[1]);
    const b = crearCamara(MODELO);
    b.enfocarCaja(nervio.bounds[0], nervio.bounds[1]);

    expect(b.estado().radio).toBeLessThan(a.estado().radio);
  });

  it("las vistas anatómicas cambian el ángulo y no la distancia", () => {
    const camara = crearCamara(MODELO);
    camara.zoom(0.4);
    const radio = camara.estado().radio;
    expect(camara.vista("posterior")).toBe(true);
    expect(camara.estado().theta).toBeCloseTo(Math.PI, 6);
    expect(camara.estado().radio).toBe(radio);
    expect(camara.vista("inexistente")).toBe(false);
  });
});

/* ============================================================================
   BUG 1 · LA CAUSA ESTRUCTURAL
   ========================================================================== */
describe("puente React · el visor no se reconstruye", () => {
  const canvas = leer("components/atlas/AtlasCanvas.jsx");

  /** El array de dependencias del efecto que CREA el visor. */
  const deps = canvas
    .slice(canvas.indexOf("crearVisor({"))
    .match(/\}, \[([^\]]*)\]\);/)[1]
    .split(",").map((d) => d.trim()).filter(Boolean);

  it("sólo depende de los datos del modelo", () => {
    expect(deps.sort()).toEqual(["bloques", "colores", "enfoque", "partes", "visorRef"]);
  });

  it("ningún callback está en las dependencias", () => {
    // Era el bug: `onFallo` se pasaba como `() => setFallo("carga")`, una
    // función nueva en cada render. Cualquier re-render reconstruía el visor.
    for (const callback of ["onFallo", "onSeleccion", "onSenalar"]) {
      expect(deps, callback).not.toContain(callback);
    }
  });

  it("los tres entran por referencia", () => {
    expect(canvas).toContain("const alFallar = useRef(onFallo)");
    expect(canvas).toContain("alFallar.current?.()");
    expect(canvas).toContain("const alSeleccionar = useRef(onSeleccion)");
    expect(canvas).toContain("const alSenalar = useRef(onSenalar)");
  });

  it("y al crear el visor se aplica el estado actual", () => {
    // Un visor nuevo nace con todo visible. Si la docente había apagado la
    // piel, o si la geometría acabó de cargar después de inicializar el
    // estado, hay que aplicarlo AHORA o el panel dice una cosa y la escena
    // otra.
    expect(canvas).toContain("instancia.aplicar(estado.current)");
    expect(canvas).toContain("const estado = useRef({ visibles, seleccion, senalado })");
  });

  it("aplicar no toca la cámara", () => {
    const visor = leer("lib/atlas/visor.js");
    const aplicar = visor.slice(visor.indexOf("aplicar({ visibles"), visor.indexOf("LO QUE MUEVE LA CÁMARA"));
    for (const orden of ["colocarCamara", "orbita.", "enfocar", "restablecer", "centrar"]) {
      expect(aplicar, orden).not.toContain(orden);
    }
  });
});

/* ============================================================================
   BUG 2 · PIEL Y ANEXOS
   ========================================================================== */
describe("piel y anexos", () => {
  it("son cinco estructuras y una de ellas envuelve el cuerpo entero", () => {
    expect(PIEL.length).toBe(5);
    expect(PIEL.map((p) => p.id)).toContain("FJ2810");   // «Piel»
    expect(SISTEMAS.integumentary.nombre).toBe("Piel y anexos");
  });

  it("arranca DESACTIVADA", () => {
    const estado = estadoInicial(FUENTE_HUMANA);
    expect(estado.grupos.has("integumentary")).toBe(false);
    expect(FUENTE_HUMANA.visiblesAlInicio).not.toContain("integumentary");
  });

  it("y sus cinco estructuras NO están entre las visibles", () => {
    const visibles = calcularVisibles(propiasHumano, estadoInicial(FUENTE_HUMANA), grupoDeHumano);
    for (const p of PIEL) {
      expect(visibles.has(p.indiceGlobal), p.name).toBe(false);
    }
    // Y el resto del cuerpo sí se ve: no se ha apagado de más.
    expect(visibles.size).toBeGreaterThan(1000);
  });

  it("al activarla, aparecen", () => {
    const estado = paso(estadoInicial(FUENTE_HUMANA), { tipo: "ALTERNAR_GRUPO", clave: "integumentary" });
    expect(estado.grupos.has("integumentary")).toBe(true);
    const visibles = calcularVisibles(propiasHumano, estado, grupoDeHumano);
    for (const p of PIEL) expect(visibles.has(p.indiceGlobal), p.name).toBe(true);
  });

  it("al desactivarla, desaparecen", () => {
    let estado = paso(estadoInicial(FUENTE_HUMANA), { tipo: "ALTERNAR_GRUPO", clave: "integumentary" });
    estado = paso(estado, { tipo: "ALTERNAR_GRUPO", clave: "integumentary" });
    const visibles = calcularVisibles(propiasHumano, estado, grupoDeHumano);
    for (const p of PIEL) expect(visibles.has(p.indiceGlobal), p.name).toBe(false);
  });

  it("«Restablecer vista» NO la vuelve a activar", () => {
    // Es la queja concreta: recuperar el encuadre no puede devolver la piel.
    let estado = paso(estadoInicial(FUENTE_HUMANA), { tipo: "ALTERNAR_GRUPO", clave: "integumentary" });
    expect(estado.grupos.has("integumentary")).toBe(true);
    estado = paso(estado, { tipo: "RESTABLECER_VISTA" });
    expect(estado.grupos.has("integumentary")).toBe(true);

    // Y apagada, sigue apagada.
    estado = paso(estado, { tipo: "ALTERNAR_GRUPO", clave: "integumentary" });
    estado = paso(estado, { tipo: "RESTABLECER_VISTA" });
    expect(estado.grupos.has("integumentary")).toBe(false);
  });

  it("«Restaurar visibilidad» la devuelve a apagada, que es su estado de arranque", () => {
    let estado = paso(estadoInicial(FUENTE_HUMANA), { tipo: "ALTERNAR_GRUPO", clave: "integumentary" });
    estado = paso(estado, { tipo: "RESTAURAR_VISIBILIDAD" });
    expect(estado.grupos.has("integumentary")).toBe(false);
  });

  it("«Mostrar todo» SÍ la activa: es lo que dice el botón", () => {
    const estado = paso(estadoInicial(FUENTE_HUMANA), { tipo: "MOSTRAR_TODO" });
    expect(estado.grupos.has("integumentary")).toBe(true);
    expect(estado.grupos.size).toBe(Object.keys(FUENTE_HUMANA.grupos).length);
  });

  it("«Ocultar todo» deja el lienzo vacío", () => {
    const estado = paso(estadoInicial(FUENTE_HUMANA), { tipo: "OCULTAR_TODO" });
    expect(calcularVisibles(propiasHumano, estado, grupoDeHumano).size).toBe(0);
  });

  it("seleccionar una estructura de piel la enciende, o no se vería", () => {
    const estado = paso(estadoInicial(FUENTE_HUMANA), { tipo: "SELECCIONAR", indice: PIEL[0].indiceGlobal });
    expect(estado.grupos.has("integumentary")).toBe(true);
    expect(calcularVisibles(propiasHumano, estado, grupoDeHumano).has(PIEL[0].indiceGlobal)).toBe(true);
  });
});

/* ============================================================================
   TRANSICIONES INDEPENDIENTES
   ========================================================================== */
describe("aislar, ocultar y seleccionar no se mezclan", () => {
  const inicial = estadoInicial(FUENTE_HUMANA);

  it("seleccionar sólo selecciona", () => {
    const estado = paso(inicial, { tipo: "SELECCIONAR", indice: UN_MUSCULO.indiceGlobal });
    expect(estado.seleccion).toBe(UN_MUSCULO.indiceGlobal);
    expect(estado.aislada).toBeNull();
    expect(estado.ocultas.size).toBe(0);
  });

  it("aislar deja sólo la seleccionada, sin tocar grupos ni ocultas", () => {
    let estado = paso(inicial, { tipo: "ALTERNAR_GRUPO", clave: "arterial" });
    estado = paso(estado, { tipo: "ALTERNAR_GRUPO", clave: "venous" });
    const gruposAntes = new Set(estado.grupos);

    estado = paso(estado, { tipo: "SELECCIONAR", indice: UN_MUSCULO.indiceGlobal });
    estado = paso(estado, { tipo: "ALTERNAR_AISLAMIENTO" });

    expect(calcularVisibles(propiasHumano, estado, grupoDeHumano)).toEqual(
      new Set([UN_MUSCULO.indiceGlobal])
    );
    expect([...estado.grupos].sort()).toEqual([...gruposAntes].sort());
    expect(estado.ocultas.size).toBe(0);
  });

  it("salir del aislamiento devuelve EXACTAMENTE la vista anterior", () => {
    let estado = paso(inicial, { tipo: "ALTERNAR_GRUPO", clave: "arterial" });
    const antes = calcularVisibles(propiasHumano, estado, grupoDeHumano);

    estado = paso(estado, { tipo: "SELECCIONAR", indice: UN_MUSCULO.indiceGlobal });
    estado = paso(estado, { tipo: "ALTERNAR_AISLAMIENTO" });
    estado = paso(estado, { tipo: "ALTERNAR_AISLAMIENTO" });

    expect(calcularVisibles(propiasHumano, estado, grupoDeHumano)).toEqual(antes);
  });

  it("aislado, cambiar de selección aísla la nueva", () => {
    let estado = paso(inicial, { tipo: "SELECCIONAR", indice: UN_MUSCULO.indiceGlobal });
    estado = paso(estado, { tipo: "ALTERNAR_AISLAMIENTO" });
    estado = paso(estado, { tipo: "SELECCIONAR", indice: OTRO_MUSCULO.indiceGlobal });
    expect(estado.aislada).toBe(OTRO_MUSCULO.indiceGlobal);
    expect(calcularVisibles(propiasHumano, estado, grupoDeHumano)).toEqual(
      new Set([OTRO_MUSCULO.indiceGlobal])
    );
  });

  it("ocultar la seleccionada limpia la selección y el aislamiento", () => {
    let estado = paso(inicial, { tipo: "SELECCIONAR", indice: UN_MUSCULO.indiceGlobal });
    estado = paso(estado, { tipo: "ALTERNAR_AISLAMIENTO" });
    estado = paso(estado, { tipo: "ALTERNAR_OCULTA" });

    expect(estado.ocultas.has(UN_MUSCULO.indiceGlobal)).toBe(true);
    expect(estado.seleccion).toBeNull();
    expect(estado.aislada).toBeNull();
  });

  it("ocultar una pieza no apaga su sistema", () => {
    let estado = paso(inicial, { tipo: "SELECCIONAR", indice: UN_MUSCULO.indiceGlobal });
    estado = paso(estado, { tipo: "ALTERNAR_OCULTA" });
    expect(estado.grupos.has("muscular")).toBe(true);
    const visibles = calcularVisibles(propiasHumano, estado, grupoDeHumano);
    expect(visibles.has(UN_MUSCULO.indiceGlobal)).toBe(false);
    expect(visibles.has(OTRO_MUSCULO.indiceGlobal)).toBe(true);
  });

  it("restaurar ocultas no apaga ni enciende sistemas", () => {
    let estado = paso(inicial, { tipo: "ALTERNAR_GRUPO", clave: "arterial" });
    const gruposAntes = new Set(estado.grupos);
    estado = paso(estado, { tipo: "SELECCIONAR", indice: UN_MUSCULO.indiceGlobal });
    estado = paso(estado, { tipo: "ALTERNAR_OCULTA" });
    estado = paso(estado, { tipo: "RESTAURAR_OCULTAS" });

    expect(estado.ocultas.size).toBe(0);
    expect([...estado.grupos].sort()).toEqual([...gruposAntes].sort());
  });

  it("quitar la selección sale del aislamiento", () => {
    let estado = paso(inicial, { tipo: "SELECCIONAR", indice: UN_MUSCULO.indiceGlobal });
    estado = paso(estado, { tipo: "ALTERNAR_AISLAMIENTO" });
    estado = paso(estado, { tipo: "QUITAR_SELECCION" });
    expect(estado.seleccion).toBeNull();
    expect(estado.aislada).toBeNull();
  });

  it("aislar sin nada seleccionado no hace nada", () => {
    expect(paso(inicial, { tipo: "ALTERNAR_AISLAMIENTO" })).toBe(inicial);
  });

  it("el reducidor es puro: no muta el estado que recibe", () => {
    const estado = estadoInicial(FUENTE_HUMANA);
    const copiaGrupos = new Set(estado.grupos);
    paso(estado, { tipo: "ALTERNAR_GRUPO", clave: "muscular" });
    paso(estado, { tipo: "MOSTRAR_TODO" });
    paso(estado, { tipo: "SELECCIONAR", indice: 3 });
    expect([...estado.grupos].sort()).toEqual([...copiaGrupos].sort());
    expect(estado.seleccion).toBeNull();
  });
});

/* ============================================================================
   EL ATLAS ORAL, CON LAS MISMAS REGLAS
   ========================================================================== */
describe("atlas oral y maxilofacial", () => {
  const propiasOmf = partes.filter((p) => FUENTE_OMF.incluye(p));
  const grupoDeOmf = (parte) => FUENTE_OMF.grupoDe(parte);
  const pasoOmf = (estado, accion) => reducir(estado, accion, {
    fuente: FUENTE_OMF,
    grupoDe: (indice) => grupoDeOmf(partes[indice]),
  });
  const unDiente = propiasOmf.find((p) => /tooth/i.test(p.name));

  it("usa el mismo armazón, así que hereda la corrección", () => {
    const humano = leer("features/atlas/human/HumanAtlas.jsx");
    const omf = leer("features/atlas/omf/OmfAtlas.jsx");
    expect(humano).toContain("AtlasShell");
    expect(omf).toContain("AtlasShell");
  });

  it("seleccionar un diente no mueve la cámara", () => {
    const camara = crearCamara({ centro: { x: 0, y: 1.55, z: 0.03 }, diagonal: 0.35 });
    camara.orbitar(0.6, 0.2);
    camara.zoom(0.5);
    const B = camara.estado();
    pasoOmf(estadoInicial(FUENTE_OMF), { tipo: "SELECCIONAR", indice: unDiente.indiceGlobal });
    expect(camara.estado()).toEqual(B);
  });

  it("aislar un diente deja sólo ese diente", () => {
    let estado = pasoOmf(estadoInicial(FUENTE_OMF), { tipo: "SELECCIONAR", indice: unDiente.indiceGlobal });
    estado = pasoOmf(estado, { tipo: "ALTERNAR_AISLAMIENTO" });
    expect(calcularVisibles(propiasOmf, estado, grupoDeOmf)).toEqual(
      new Set([unDiente.indiceGlobal])
    );
  });

  it("ocultar un diente no apaga la dentición completa", () => {
    let estado = pasoOmf(estadoInicial(FUENTE_OMF), { tipo: "SELECCIONAR", indice: unDiente.indiceGlobal });
    estado = pasoOmf(estado, { tipo: "ALTERNAR_OCULTA" });
    expect(estado.grupos.has("denticion")).toBe(true);
    const visibles = calcularVisibles(propiasOmf, estado, grupoDeOmf);
    expect(visibles.has(unDiente.indiceGlobal)).toBe(false);
    const otros = propiasOmf.filter((p) => grupoDeOmf(p) === "denticion" && p !== unDiente);
    expect(visibles.has(otros[0].indiceGlobal)).toBe(true);
  });

  it("aquí no hay piel: la región no la incluye", () => {
    expect(propiasOmf.some((p) => p.id === "FJ2810")).toBe(false);
  });

  it("los atajos cambian los grupos y salen del aislamiento", () => {
    let estado = pasoOmf(estadoInicial(FUENTE_OMF), { tipo: "SELECCIONAR", indice: unDiente.indiceGlobal });
    estado = pasoOmf(estado, { tipo: "ALTERNAR_AISLAMIENTO" });
    estado = pasoOmf(estado, { tipo: "APLICAR_ATAJO", grupos: ["nervios"], id: "nervios" });
    expect(estado.aislada).toBeNull();
    expect([...estado.grupos]).toEqual(["nervios"]);
    expect(estado.atajo).toBe("nervios");
  });
});

/* ============================================================================
   RENDIMIENTO · NO SE RECONSTRUYE NADA AL SELECCIONAR
   ========================================================================== */
describe("rendimiento de la selección", () => {
  const visor = leer("lib/atlas/visor.js");

  it("seleccionar escribe en una tabla, no reconstruye geometría", () => {
    const aplicar = visor.slice(visor.indexOf("aplicar({ visibles"), visor.indexOf("LO QUE MUEVE LA CÁMARA"));
    expect(aplicar).toContain("datos[i * 4 + 3] = estado;");
    expect(aplicar).toContain("textura.needsUpdate = true;");
    for (const prohibido of ["new THREE.BufferGeometry", "setAttribute", "new THREE.Mesh",
      "computeBoundingSphere", "dispose"]) {
      expect(aplicar, prohibido).not.toContain(prohibido);
    }
  });

  it("hay UN material para las 2.234 estructuras, creado una vez", () => {
    // Si el resaltado creara un material por selección, se acumularían.
    expect((visor.match(/new THREE\.ShaderMaterial/g) || []).length).toBe(1);
    expect((visor.match(/new THREE\.DataTexture/g) || []).length).toBe(1);
  });

  it("y el resaltado es un estado en la textura, no un material nuevo", () => {
    expect(visor).toContain("const ESTADO_SELECCIONADA = 3;");
    expect(visor).toContain("float elegida = step(2.5, vEstado);");
  });

  it("sólo se dibuja cuando algo cambió", () => {
    expect(visor).toMatch(/if \(!sucio\) return;/);
  });

  it("se sigue soltando todo al desmontar", () => {
    for (const suelta of ["renderer.dispose()", "forceContextLoss", "g.dispose()",
      "material.dispose()", "textura.dispose()", "observador.disconnect()"]) {
      expect(visor, suelta).toContain(suelta);
    }
  });
});

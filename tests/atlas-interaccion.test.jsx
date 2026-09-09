import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import AtlasInfoPanel from "../components/atlas/AtlasInfoPanel.jsx";
import AtlasMobileSheet from "../components/atlas/AtlasMobileSheet.jsx";
import AtlasSystemsPanel from "../components/atlas/AtlasSystemsPanel.jsx";
import { crearIndice, crearIndiceDeBusqueda, fichaDe, numeroFdi, sinTildes } from "../lib/atlas/metadatos.js";
import { ATAJOS_OMF, FUENTE_HUMANA, FUENTE_OMF } from "../lib/atlas/fuentes.js";
import { CATEGORIAS_OMF } from "../lib/atlas/fuentes.js";
import { DESCRIPCION_DE_ORGANO, FUNCION_DE_SISTEMA, TEMAS } from "../lib/atlas/textos-anatomia.es.js";
import { T } from "../lib/atlas/i18n.es.js";

/* ============================================================================
   SELECCIÓN E INFORMACIÓN ANATÓMICA

   Este fichero vigila la promesa del bloque: que al tocar una estructura
   aparezca información REAL y que no aparezca ninguna inventada.

   Casi todo se prueba contra el manifiesto de verdad —2.234 estructuras y
   3.432 conceptos FMA— y no contra datos de mentira. La razón es que el
   riesgo aquí no es que el código falle: es que el código funcione y enseñe
   una descripción que nadie escribió.
   ========================================================================== */

const raiz = path.resolve(".");
const leer = (f) => fs.readFileSync(path.join(raiz, f), "utf8");

const manifiesto = JSON.parse(leer("public/models/atlas.json"));
const nombres = JSON.parse(leer("public/models/atlas-es.json"));
const partes = manifiesto.parts.map((p, i) => ({ ...p, indiceGlobal: i }));
const grafo = crearIndice(manifiesto);
const DATOS = { manifiesto, partes, nombres, indice: grafo };

const indiceDe = (nombreOriginal) => partes.findIndex((p) => p.name === nombreOriginal);
const enfoqueDe = (fuente) =>
  new Set(partes.filter((p) => fuente.incluye(p)).map((p) => p.indiceGlobal));

const ENFOQUE_OMF = enfoqueDe(FUENTE_OMF);
const ficha = (nombre, fuente = FUENTE_HUMANA, enfoque = null) =>
  fichaDe(indiceDe(nombre), DATOS, fuente, enfoque);

/* ============================================================================
   LA FICHA SE ARMA CON DATOS DEL PROPIO MANIFIESTO
   ========================================================================== */
describe("ficha · lo que sabe de una estructura", () => {
  it("nombre en español, sistema e identificador FMA", () => {
    const f = ficha("Mandible", FUENTE_OMF, ENFOQUE_OMF);
    expect(f.nombre).toBe("Mandíbula");
    expect(f.nombreOriginal).toBe("Mandible");
    expect(f.sistema).toBe("Huesos y referencias anatómicas");
    expect(f.fma).toBe("FMA52748");
    expect(f.sinTraducir).toBe(false);
  });

  it("localización sacada de los conceptos de región, de lo general a lo concreto", () => {
    const f = ficha("Mandible", FUENTE_OMF, ENFOQUE_OMF);
    const ruta = f.regiones.map((r) => r.nombre);
    expect(ruta).toContain("Cabeza");
    expect(ruta).toContain("Boca");
    // El orden importa: primero dónde, luego dónde exactamente.
    expect(ruta.indexOf("Cabeza")).toBeLessThan(ruta.indexOf("Boca"));
  });

  it("grupos anatómicos, del más específico al más amplio", () => {
    const f = ficha("Mandible", FUENTE_OMF, ENFOQUE_OMF);
    const nombresGrupo = f.grupos.map((g) => g.nombre);
    expect(nombresGrupo).toContain("Maxilar inferior");
    expect(f.grupos[0].cuantas).toBeLessThanOrEqual(f.grupos[f.grupos.length - 1].cuantas);
  });

  it("no cuela las clases de la ontología como si fueran anatomía", () => {
    // «Órgano con cavidad» es cierto y no le dice nada a nadie.
    const f = ficha("Left upper secondary canine tooth", FUENTE_OMF, ENFOQUE_OMF);
    for (const g of f.grupos) {
      expect(g.nombre, g.nombre).not.toMatch(/órgano|entidad|componente/i);
    }
  });

  it("estructuras relacionadas: hermanas del grupo más específico", () => {
    const f = ficha("Right common carotid artery");
    expect(f.relacionadas.length).toBeGreaterThan(0);
    expect(f.relacionadas.map((r) => r.nombre)).toContain("Arteria carótida común izquierda");
    // Se dice de dónde sale la relación, para que no parezca una opinión.
    expect(f.origenRelacion?.nombre).toBeTruthy();
  });

  it("las relacionadas nunca salen del atlas que se está mirando", () => {
    const f = ficha("Mandible", FUENTE_OMF, ENFOQUE_OMF);
    for (const r of f.relacionadas) {
      expect(ENFOQUE_OMF.has(r.indice), r.nombre).toBe(true);
    }
  });

  it("un diente trae su número FDI", () => {
    expect(ficha("Left upper secondary canine tooth", FUENTE_OMF, ENFOQUE_OMF).fdi).toBe(23);
    expect(ficha("Right lower first secondary molar tooth", FUENTE_OMF, ENFOQUE_OMF).fdi).toBe(46);
    // Y lo que no es diente, no.
    expect(ficha("Mandible", FUENTE_OMF, ENFOQUE_OMF).fdi).toBeNull();
  });

  it("la notación FDI sigue la regla, no una tabla escrita a mano", () => {
    expect(numeroFdi("Right upper central secondary incisor tooth")).toBe(11);
    expect(numeroFdi("Left lower first secondary molar tooth")).toBe(36);
    expect(numeroFdi("Mandible")).toBeNull();
    expect(numeroFdi("Left maxilla")).toBeNull();
  });

  it("las cinco estructuras de la región oral con tema propio lo traen", () => {
    expect(ficha("Mandible", FUENTE_OMF, ENFOQUE_OMF).tema?.id).toBe("mandibula");
    expect(ficha("Left maxilla", FUENTE_OMF, ENFOQUE_OMF).tema?.id).toBe("maxilar");
    expect(ficha("Tongue", FUENTE_OMF, ENFOQUE_OMF).tema?.id).toBe("suelo-boca");
  });
});

/* ============================================================================
   LO QUE NO EXISTE NO SE INVENTA
   ========================================================================== */
describe("ficha · honestidad de los datos", () => {
  it("sólo tienen descripción propia los órganos que la tienen en la fuente", () => {
    let conDescripcion = 0;
    for (let i = 0; i < partes.length; i += 1) {
      if (fichaDe(i, DATOS, FUENTE_HUMANA, null).descripcion) conDescripcion += 1;
    }
    // Human Atlas documenta nueve órganos; seis existen como malla en este
    // pack. Si este número sube sin que se añada una fuente, es que alguien
    // se puso a escribir descripciones.
    expect(conDescripcion).toBe(6);
  });

  it("las descripciones que hay son las traducidas de la fuente, sin añadidos", () => {
    const f = ficha("Trachea");
    expect(f.descripcion).toBe(DESCRIPCION_DE_ORGANO.Trachea);
    expect(f.descripcion).toContain("laringe");
  });

  it("una estructura sin descripción devuelve null, no una frase de relleno", () => {
    const f = ficha("Right femur");
    expect(f.descripcion).toBeNull();
    // Lo que sí tiene es la función de SU sistema, y va rotulada como tal.
    expect(f.funcion).toBe(FUNCION_DE_SISTEMA.skeletal);
  });

  it("la función es del sistema y el rótulo lo dice", () => {
    expect(T.funcionDelSistema).toBe("Función del sistema");
    for (const clave of Object.keys(FUNCION_DE_SISTEMA)) {
      expect(FUNCION_DE_SISTEMA[clave].length).toBeGreaterThan(40);
    }
  });

  it("ninguna ficha produce «undefined» ni «[object Object]»", () => {
    // Se recorren TODAS: el riesgo de un campo vacío es que aparezca en la
    // única estructura que nadie probó a mano.
    for (let i = 0; i < partes.length; i += 1) {
      const f = fichaDe(i, DATOS, FUENTE_HUMANA, null);
      const texto = JSON.stringify(f);
      expect(texto, partes[i].name).not.toContain("undefined");
      expect(texto, partes[i].name).not.toContain("[object Object]");
      expect(f.nombre, partes[i].name).toBeTruthy();
      expect(f.sistema, partes[i].name).toBeTruthy();
    }
  });

  it("cuando falta traducción se enseña el original y se marca para revisión", () => {
    // Hoy están las 2.234, pero el respaldo tiene que seguir existiendo: el
    // día que se añada un modelo nuevo, no puede salir un hueco.
    const sinNombres = { ...DATOS, nombres: { partes: {}, conceptos: {} } };
    const f = fichaDe(indiceDe("Mandible"), sinNombres, FUENTE_OMF, ENFOQUE_OMF);
    expect(f.nombre).toBe("Mandible");
    expect(f.sinTraducir).toBe(true);
  });

  it("los textos reutilizados dicen de dónde vienen", () => {
    const src = leer("lib/atlas/textos-anatomia.es.js");
    expect(src).toContain("human-atlas");
    expect(src).toContain("MIT");
    expect(src).toContain("ashemag");
    expect(src).toContain("Ahmad Sofi-Mahmudi");
    // Y los temas conservan la referencia bibliográfica del original.
    for (const tema of TEMAS) expect(tema.fuente.url).toMatch(/^https:\/\/www\.ncbi\.nlm\.nih\.gov\//);
  });

  it("la nota de aula se distingue del dato anatómico", () => {
    const src = leer("lib/atlas/textos-anatomia.es.js");
    expect(src).toContain("NO es un dato anatómico");
    expect(T.importanciaEducativa).toBe("Para el aula");
  });
});

/* ============================================================================
   BÚSQUEDA · español, original y FMA
   ========================================================================== */
describe("búsqueda", () => {
  const propias = partes.filter((p) => FUENTE_HUMANA.incluye(p));
  const indice = crearIndiceDeBusqueda(propias, partes, nombres);

  const buscar = (q) => {
    const n = sinTildes(q.trim());
    return indice.filter((e) => e.texto.includes(n));
  };

  it("encuentra por el nombre en español, con o sin tildes", () => {
    expect(buscar("tráquea").map((r) => r.nombre)).toContain("Tráquea");
    expect(buscar("traquea").map((r) => r.nombre)).toContain("Tráquea");
    expect(buscar("mandibula").map((r) => r.nombre)).toContain("Mandíbula");
  });

  it("encuentra por el nombre original en inglés", () => {
    // El material de consulta de fuera de SciVerse está casi todo en inglés.
    expect(buscar("trachea").map((r) => r.nombre)).toContain("Tráquea");
    expect(buscar("mandible").map((r) => r.nombre)).toContain("Mandíbula");
    expect(buscar("stomach").map((r) => r.nombre)).toContain("Estómago");
  });

  it("encuentra por identificador FMA", () => {
    expect(buscar("FMA7394").map((r) => r.nombre)).toContain("Tráquea");
    expect(buscar("fma52748").map((r) => r.nombre)).toContain("Mandíbula");
  });

  it("el índice se construye una vez y trae las tres formas juntas", () => {
    const traquea = indice.find((e) => e.nombre === "Tráquea");
    expect(traquea.texto).toContain("traquea");
    expect(traquea.texto).toContain("trachea");
    expect(traquea.texto).toContain("fma7394");
  });

  it("el atlas oral sólo busca dentro de su región", () => {
    const oral = crearIndiceDeBusqueda(
      partes.filter((p) => FUENTE_OMF.incluye(p)), partes, nombres
    );
    const n = (q) => oral.filter((e) => e.texto.includes(sinTildes(q))).length;
    expect(n("mandibula")).toBeGreaterThan(0);
    expect(n("femur")).toBe(0);
  });
});

/* ============================================================================
   PANEL DE INFORMACIÓN
   ========================================================================== */
describe("panel de información", () => {
  function pintar(f, extra = {}) {
    return renderToStaticMarkup(
      <AtlasInfoPanel
        ficha={f}
        aislado={false}
        oculta={false}
        minimizado={false}
        onOcultar={() => {}}
        onAislar={() => {}}
        onCentrar={() => {}}
        onQuitar={() => {}}
        onIrA={() => {}}
        onMinimizar={() => {}}
        {...extra}
      />
    );
  }

  const MANDIBULA = ficha("Mandible", FUENTE_OMF, ENFOQUE_OMF);
  const DIENTE = ficha("Left upper secondary canine tooth", FUENTE_OMF, ENFOQUE_OMF);
  const FEMUR = ficha("Right femur");

  it("al seleccionar, la ficha muestra nombre, sistema y FMA", () => {
    const html = pintar(MANDIBULA);
    expect(html).toContain("Mandíbula");
    expect(html).toContain("Huesos y referencias anatómicas");
    expect(html).toContain("FMA52748");
  });

  it("y las cuatro acciones sobre la estructura", () => {
    const html = pintar(MANDIBULA);
    for (const accion of ["Centrar modelo", "Aislar", "Ocultar", "Quitar la selección"]) {
      expect(html, accion).toContain(accion);
    }
  });

  it("aislada, el botón ofrece salir en vez de repetir la acción", () => {
    expect(pintar(MANDIBULA, { aislado: true })).toContain("Dejar de aislar");
    expect(pintar(MANDIBULA, { aislado: true })).toContain('aria-pressed="true"');
  });

  it("oculta, lo dice y ofrece volver a mostrarla", () => {
    const html = pintar(MANDIBULA, { oculta: true });
    expect(html).toContain("Esta estructura está oculta.");
    expect(html).toContain("Mostrar");
  });

  it("enseña localización y grupos cuando el manifiesto los tiene", () => {
    const html = pintar(MANDIBULA);
    expect(html).toContain("Localización");
    expect(html).toContain("Cabeza");
    expect(html).toContain("Grupos anatómicos");
    expect(html).toContain("Maxilar inferior");
  });

  it("ofrece las estructuras relacionadas como botones", () => {
    const html = pintar(ficha("Right common carotid artery"));
    expect(html).toContain("Explorar estructuras relacionadas");
    expect(html).toContain("Arteria carótida común izquierda");
  });

  it("NO dibuja las secciones que no tienen contenido", () => {
    // Una estructura sin descripción propia y sin región concreta no puede
    // enseñar un apartado «Descripción» vacío: parecería que falta el dato
    // por un error, y no es eso.
    const html = pintar({
      ...FEMUR, descripcion: null, regiones: [], grupos: [], relacionadas: [],
      tema: null, notaDocente: null, funcion: null,
    });
    expect(html).not.toContain("Descripción");
    expect(html).not.toContain("Localización");
    expect(html).not.toContain("Grupos anatómicos");
    expect(html).not.toContain("Explorar estructuras relacionadas");
    // Lo que sí existe sigue estando.
    expect(html).toContain("Fémur derecho");
  });

  it("un diente enseña su FDI y explica la notación", () => {
    const html = pintar(DIENTE);
    expect(html).toContain("Número FDI");
    expect(html).toContain(">23<");
    expect(html).toContain("desde el punto de vista del paciente");
  });

  it("sin selección invita a tocar el modelo, sin secciones sueltas", () => {
    const html = pintar(null);
    expect(html).toContain("Toca una estructura del modelo");
    expect(html).not.toContain("Grupos anatómicos");
  });

  it("los créditos de licencia van siempre, con y sin selección", () => {
    for (const html of [pintar(null), pintar(MANDIBULA)]) {
      expect(html).toContain("BodyParts3D 4.0");
      expect(html).toContain("creativecommons.org/licenses/by/4.0");
      expect(html).toContain("MIT");
    }
  });

  it("ninguna ficha real produce basura en el HTML", () => {
    for (const f of [MANDIBULA, DIENTE, FEMUR, ficha("Trachea"), ficha("Tongue", FUENTE_OMF, ENFOQUE_OMF)]) {
      const html = pintar(f);
      for (const basura of ["undefined", "[object Object]", "NaN", "null"]) {
        expect(html, `${f.nombre} · ${basura}`).not.toContain(basura);
      }
    }
  });
});

/* ============================================================================
   PANEL DE SISTEMAS · contador, ocultas y atajos
   ========================================================================== */
describe("panel de sistemas", () => {
  const GRUPOS = CATEGORIAS_OMF;
  const CONTEOS = { huesos: 83, denticion: 30, musculos: 102, nervios: 139 };

  function pintar(extra = {}) {
    return renderToStaticMarkup(
      <AtlasSystemsPanel
        grupos={GRUPOS}
        conteos={CONTEOS}
        activos={new Set(["huesos", "denticion"])}
        atajos={ATAJOS_OMF}
        atajoActivo="todas"
        etiquetaGrupos="categorías"
        busqueda=""
        resultados={[]}
        totalVisible={113}
        ocultas={0}
        minimizado={false}
        onBuscar={() => {}}
        onAlternar={() => {}}
        onAtajo={() => {}}
        onTodo={() => {}}
        onNada={() => {}}
        onElegir={() => {}}
        onRestaurarOcultas={() => {}}
        onMinimizar={() => {}}
        {...extra}
      />
    );
  }

  it("cuenta cuántas estructuras se están viendo", () => {
    expect(pintar()).toContain("113 estructuras visibles");
  });

  it("ofrece restaurar las ocultas sólo cuando hay alguna", () => {
    expect(pintar()).not.toContain("Restaurar ocultas");
    const html = pintar({ ocultas: 4 });
    expect(html).toContain("Restaurar ocultas");
    expect(html).toContain("(4)");
  });

  it("el atlas oral trae los atajos por tipo de estructura", () => {
    const html = pintar();
    for (const nombre of ["Todas", "Esqueleto", "Dentición", "Músculos", "Nervios", "Vasos"]) {
      expect(html, nombre).toContain(nombre);
    }
    expect(html).toContain('aria-pressed="true"');
  });

  it("el atlas del cuerpo humano no los tiene: sus 15 sistemas ya son el filtro", () => {
    expect(FUENTE_HUMANA.atajos).toBeUndefined();
    expect(pintar({ atajos: undefined })).not.toContain("Vistas rápidas");
  });

  it("los resultados de búsqueda enseñan el FMA junto al nombre", () => {
    const html = pintar({
      busqueda: "mandi",
      resultados: [{ indice: 1, nombre: "Mandíbula", fma: "FMA52748" }],
    });
    expect(html).toContain("Mandíbula");
    expect(html).toContain("FMA52748");
    expect(html).toContain("1 estructura");
  });
});

/* ============================================================================
   MÓVIL · la ficha inferior
   ========================================================================== */
describe("móvil", () => {
  const RESUMEN = (
    <>
      <p className="atlas-resumen__nombre">Mandíbula</p>
      <p className="atlas-resumen__sistema">Huesos y referencias anatómicas</p>
    </>
  );

  function pintar(extra = {}) {
    return renderToStaticMarkup(
      <AtlasMobileSheet
        abierta
        titulo="Información"
        minimizada={false}
        resumen={RESUMEN}
        onMinimizar={() => {}}
        onCerrar={() => {}}
        {...extra}
      >
        <p>Cuerpo largo de la ficha</p>
      </AtlasMobileSheet>
    );
  }

  it("al tocar una estructura se abre una hoja inferior", () => {
    const html = pintar();
    expect(html).toContain("atlas-hoja");
    expect(html).toContain('role="dialog"');
  });

  it("plegada sigue enseñando nombre y categoría", () => {
    // Es la condición para que el modelo conserve la pantalla: si al plegar
    // desapareciera el nombre, habría que desplegarla para saber qué se tocó.
    const html = pintar({ minimizada: true });
    expect(html).toContain("Mandíbula");
    expect(html).toContain("Huesos y referencias anatómicas");
    expect(html).not.toContain("Cuerpo largo de la ficha");
  });

  it("desplegada añade el cuerpo completo", () => {
    expect(pintar()).toContain("Cuerpo largo de la ficha");
  });

  it("tiene botón de cerrar y de plegar, y no atrapa el foco", () => {
    const html = pintar();
    expect(html).toContain('aria-label="Cerrar"');
    expect(html).toContain('aria-label="Minimizar"');
    // Sin `aria-modal`: el modelo de detrás se sigue pudiendo girar.
    expect(html).not.toMatch(/aria-modal\s*=/);
  });

  it("el armazón abre la ficha plegada al seleccionar en móvil", () => {
    const src = leer("components/atlas/AtlasShell.jsx");
    expect(src).toMatch(/if \(movil\) \{ setPanelGrupos\(false\); setPanelInfo\(true\); setHojaMin\(true\); \}/);
  });

  it("y las acciones del resumen son grandes", () => {
    const css = leer("components/atlas/atlas.css");
    expect(css).toMatch(/\.atlas-resumen__acciones button \{[^}]*min-height: 52px/);
  });
});

/* ============================================================================
   SELECCIÓN, AISLAMIENTO Y OCULTOS EN EL ARMAZÓN
   ========================================================================== */
describe("armazón · estados de la vista", () => {
  const shell = leer("components/atlas/AtlasShell.jsx");

  it("aislar es una capa: no toca sistemas ni ocultas", () => {
    // Si aislar modificara `gruposActivos`, salir del aislamiento no podría
    // devolver la vista anterior sin guardar una copia.
    expect(shell).toMatch(/if \(aislado && seleccion != null\) \{\s*set\.add\(seleccion\);\s*return set;/);
  });

  it("salir del aislamiento está a la vista mientras dura", () => {
    expect(shell).toContain("aislamientoActivo");
    expect(shell).toContain("salirDelAislamiento");
    expect(T.salirDelAislamiento).toBe("Salir del aislamiento");
  });

  it("ocultar una pieza no reinicia los sistemas", () => {
    expect(shell).toMatch(/const alternarOculta[\s\S]{0,400}setOcultas/);
    const cuerpo = shell.slice(shell.indexOf("const alternarOculta"), shell.indexOf("const restablecer"));
    expect(cuerpo).not.toContain("setGruposActivos");
  });

  it("restaurar ocultas tampoco", () => {
    expect(shell).toContain("onRestaurarOcultas={() => setOcultas(new Set())}");
  });

  it("elegir desde la búsqueda o desde una relacionada centra la cámara", () => {
    expect(shell).toMatch(/const irA = useCallback\(\(indice\) => \{\s*elegir\(indice, \{ centrar: true \}\)/);
  });

  it("y enciende su sistema si estaba apagado, o no se vería nada", () => {
    const cuerpo = shell.slice(shell.indexOf("const elegir"), shell.indexOf("const irA"));
    expect(cuerpo).toContain("setGruposActivos");
    expect(cuerpo).toContain("setOcultas");
  });

  it("Escape deshace un paso cada vez, del más superficial al más profundo", () => {
    const cuerpo = shell.slice(shell.indexOf("const onKey"), shell.indexOf("document.addEventListener(\"keydown\", onKey)"));
    expect(cuerpo.indexOf("inmersivo")).toBeLessThan(cuerpo.indexOf("aislado"));
    expect(cuerpo.indexOf("aislado")).toBeLessThan(cuerpo.indexOf("setSeleccion(null)"));
  });

  it("limpiar la selección también quita el aislamiento", () => {
    expect(shell).toContain('onQuitar={() => { setSeleccion(null); setAislado(false); }}');
  });
});

/* ============================================================================
   MOTOR · rayo real, encuadre y calidad de imagen
   ========================================================================== */
describe("motor 3D", () => {
  const visor = leer("lib/atlas/visor.js");

  it("selecciona con un rayo contra los triángulos, no con posiciones fijas", () => {
    expect(visor).toContain("THREE.Raycaster");
    expect(visor).toContain("rayo.ray.intersectTriangle");
    expect(visor).toContain("rayo.setFromCamera");
    // Nada de cajas como respuesta final: la caja sólo descarta.
    expect(visor).toContain("rayo.ray.intersectsBox");
  });

  it("descarta por caja y se para cuando ninguna pendiente puede ganar", () => {
    // Sin este corte, cada clic recorrería 2,29 millones de triángulos.
    expect(visor).toContain("candidatas.sort((a, b) => a.d - b.d)");
    expect(visor).toMatch(/if \(d > mejorDistancia\) break;/);
  });

  it("lo oculto no se puede seleccionar", () => {
    expect(visor).toMatch(/if \(!esVisible\(i\)\) continue;/);
  });

  it("el encuadre sale del tamaño de la estructura, no de un zoom fijo", () => {
    const enfocar = visor.slice(visor.indexOf("enfocar(indice)"), visor.indexOf("zoom(factor)"));
    expect(enfocar).toContain("camara.fov");
    expect(enfocar).toContain("Math.tan");
    expect(enfocar).toMatch(/Math\.max\(tamano\.x, tamano\.y, tamano\.z/);
  });

  it("el resaltado al pasar el ratón se resuelve una vez por fotograma", () => {
    expect(visor).toContain("senaladoPendiente");
    expect(visor).toContain("resolverSenalado()");
    // Y sólo donde hay ratón: en táctil no existe el «pasar por encima».
    expect(visor).toContain('matchMedia("(hover: hover)")');
  });

  it("hay cuatro estados y el seleccionado no es un color estridente", () => {
    expect(visor).toContain("ESTADO_SENALADA");
    expect(visor).toContain("ESTADO_SELECCIONADA");
    // Verde azulado de SciVerse, mezclado al 55 %: destaca sin competir.
    expect(visor).toMatch(/colorSeleccion.*Vector3\(0\.09, 0\.46, 0\.44\)/);
  });

  it("la iluminación tiene tres aportes y curva de exposición", () => {
    expect(visor).toContain("luzPrincipal");
    expect(visor).toContain("luzRelleno");
    expect(visor).toContain("ambiente");
    expect(visor).toContain("vec3 aces(");
    // Y el color se linealiza antes de iluminar, o los medios tonos se ensucian.
    expect(visor).toContain("pow(st.rgb, vec3(2.2))");
  });

  it("el rendimiento en móvil no se toca", () => {
    expect(visor).toContain("DPR_MOVIL");
    expect(visor).toMatch(/setPixelRatio\(Math\.min\(/);
    expect(visor).toMatch(/if \(!sucio\) return;/);
    for (const suelta of ["renderer.dispose()", "forceContextLoss", "g.dispose()",
      "material.dispose()", "textura.dispose()", "observador.disconnect()"]) {
      expect(visor, suelta).toContain(suelta);
    }
  });

  it("el cursor dice si hay algo debajo", () => {
    expect(visor).toContain('lienzo.style.cursor = "grab"');
    expect(visor).toMatch(/cursor = encontrada === null \? "grab" : "pointer"/);
  });
});

/* ============================================================================
   LÍMITES DEL BLOQUE · lo que NO debía tocarse
   ========================================================================== */
describe("límites", () => {
  const FICHEROS_ATLAS = [
    "lib/atlas/visor.js", "lib/atlas/carga.js", "lib/atlas/metadatos.js",
    "lib/atlas/fuentes.js", "lib/atlas/i18n.es.js", "lib/atlas/textos-anatomia.es.js",
    "components/atlas/AtlasShell.jsx", "components/atlas/AtlasInfoPanel.jsx",
    "components/atlas/AtlasSystemsPanel.jsx", "components/atlas/AtlasCanvas.jsx",
    "components/atlas/AtlasMobileSheet.jsx", "components/atlas/AtlasToolbar.jsx",
    "features/atlas/index.jsx",
  ];

  it("el atlas no usa IA ni consume créditos", () => {
    for (const f of FICHEROS_ATLAS) {
      const src = leer(f);
      expect(src, f).not.toMatch(/gemini|generateJson|consume_ai_credit|withCredit/i);
    }
  });

  it("no llama a ninguna API de SciVerse: todo es estático", () => {
    for (const f of FICHEROS_ATLAS) {
      expect(leer(f), f).not.toMatch(/fetch\(\s*["'`]\/api\//);
    }
  });

  it("no se crearon Serverless Functions nuevas", () => {
    const funciones = fs.readdirSync(path.join(raiz, "api"), { recursive: true })
      .map((f) => String(f).replace(/\\/g, "/"))
      .filter((f) => /\.(js|ts)$/.test(f) && !f.includes("_"));
    expect(funciones.length).toBeLessThanOrEqual(8);
  });

  it("sigue sin haber iframe ni enlaces a los atlas originales", () => {
    for (const f of FICHEROS_ATLAS) {
      const src = leer(f);
      expect(src, f).not.toMatch(/<iframe/i);
      expect(src, f).not.toMatch(/human-atlas-seven|omfatlas\.xera\.ac/);
    }
  });

  it("y no se traduce en caliente", () => {
    for (const f of FICHEROS_ATLAS) {
      expect(leer(f), f).not.toMatch(/translate\.google|googleapis\.com\/language|new Intl\.DisplayNames/i);
    }
  });
});

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import AppShell from "../components/layout/AppShell.jsx";
import AtlasInfoPanel from "../components/atlas/AtlasInfoPanel.jsx";
import AtlasSystemsPanel from "../components/atlas/AtlasSystemsPanel.jsx";
import AtlasToolbar from "../components/atlas/AtlasToolbar.jsx";
import { AtlasCargando, AtlasFalloDeCarga, AtlasSinWebgl } from "../components/atlas/AtlasLoading.jsx";
import { fusionarBloque } from "../lib/atlas/carga.js";
import { CATEGORIAS_OMF, FUENTE_HUMANA, FUENTE_OMF, categoriaOmf } from "../lib/atlas/fuentes.js";
import { SISTEMAS, T, nombreDeSistema } from "../lib/atlas/i18n.es.js";
import { hayWebgl } from "../lib/atlas/visor.js";

/* ============================================================================
   ATLAS 3D

   Qué vigila este fichero, por orden de lo que más caro sale si se rompe:

     1. Que abrir Inicio no descargue Three.js. Es un `lazy()` de una línea y
        basta un import estático despistado para anularlo sin que nadie lo
        note: el build sigue pasando y la aplicación sigue funcionando, sólo
        que medio mega más lenta para todo el mundo.
     2. Que no entre en el repositorio ningún modelo con licencia
        incompatible. Los datasets descartados tienen nombre conocido y aquí
        se comprueba que no están.
     3. Que la interfaz siga en español y sin `iframe`.
   ========================================================================== */

const raiz = path.resolve(".");
const leer = (f) => fs.readFileSync(path.join(raiz, f), "utf8");

/* ============================================================================
   NAVEGACIÓN
   ========================================================================== */
function pintarShell(seccion) {
  return renderToStaticMarkup(
    <AppShell
      profile={{ nombres: "Ana", apellidos: "Quispe", correo: "a@x.pe" }}
      plan="Gratuito"
      activeSection={seccion}
      onNavigate={() => {}}
      onOpenAccount={() => {}}
      onLogout={() => {}}
    >
      <div />
    </AppShell>
  );
}

describe("atlas · navegación desde el panel", () => {
  it("la barra lateral ofrece las dos opciones bajo «Explorar en 3D»", () => {
    const html = pintarShell("inicio");
    expect(html).toContain("Explorar en 3D");
    expect(html).toContain("Atlas del cuerpo humano");
    expect(html).toContain("Atlas oral y maxilofacial");
  });

  it("el grupo va entre Retos grupales y Organizar, como se pidió", () => {
    const html = pintarShell("inicio");
    expect(html.indexOf("Retos grupales")).toBeLessThan(html.indexOf("Explorar en 3D"));
    expect(html.indexOf("Explorar en 3D")).toBeLessThan(html.indexOf("Organizar"));
  });

  it("abrir el atlas del cuerpo humano marca su entrada y su título", () => {
    const html = pintarShell("atlas-humano");
    expect(html).toContain('aria-current="page"');
    // El rótulo de la barra superior sale del mismo mapa que la navegación.
    expect(html.match(/Atlas del cuerpo humano/g).length).toBeGreaterThanOrEqual(2);
  });

  it("abrir el atlas oral y maxilofacial hace lo propio", () => {
    const html = pintarShell("atlas-omf");
    expect(html).toContain('aria-current="page"');
    expect(html.match(/Atlas oral y maxilofacial/g).length).toBeGreaterThanOrEqual(2);
  });

  it("App.jsx encamina las dos secciones a sus vistas internas", () => {
    const src = leer("App.jsx");
    expect(src).toMatch(/activeSection === "atlas-humano"[\s\S]{0,120}<AtlasCuerpoHumano/);
    expect(src).toMatch(/activeSection === "atlas-omf"[\s\S]{0,120}<AtlasOralMaxilofacial/);
  });

  it("y las dos saben volver al panel sin salir de SciVerse", () => {
    const src = leer("App.jsx");
    const usos = src.match(/onVolver=\{\(\) => setActiveSection\("inicio"\)\}/g) || [];
    expect(usos.length).toBe(2);
  });

  it("en móvil se llega por la hoja «Más», que es donde queda sitio", () => {
    const src = leer("components/layout/AppShell.jsx");
    expect(src).toMatch(/go\("atlas-humano"\)/);
    expect(src).toMatch(/go\("atlas-omf"\)/);
  });
});

/* ============================================================================
   CARGA DIFERIDA · lo que impide que Inicio pague por el atlas
   ========================================================================== */
describe("atlas · carga diferida real", () => {
  /** Sigue los imports ESTÁTICOS desde un fichero y devuelve lo alcanzable. */
  function grafoEstatico(entrada) {
    const vistos = new Set();
    const paquetes = new Set();
    const cola = [path.resolve(raiz, entrada)];

    while (cola.length) {
      const fichero = cola.pop();
      if (vistos.has(fichero)) continue;
      vistos.add(fichero);
      if (!fs.existsSync(fichero)) continue;

      const src = fs.readFileSync(fichero, "utf8");
      // `import x from "y"` y `export … from "y"`. `import("y")` NO: eso es
      // justo lo diferido, y contarlo haría inútil la comprobación.
      const re = /(?:^|\n)\s*(?:import|export)[^;\n]*?from\s*["']([^"']+)["']/g;
      let m;
      while ((m = re.exec(src))) {
        const destino = m[1];
        if (!destino.startsWith(".")) { paquetes.add(destino); continue; }

        const base = path.resolve(path.dirname(fichero), destino);
        const candidatos = [base, `${base}.js`, `${base}.jsx`,
          path.join(base, "index.js"), path.join(base, "index.jsx")];
        const real = candidatos.find((c) => fs.existsSync(c) && fs.statSync(c).isFile());
        if (real) cola.push(real);
      }
    }
    return { ficheros: vistos, paquetes };
  }

  it("abrir la aplicación no arrastra Three.js", () => {
    const { paquetes } = grafoEstatico("App.jsx");
    // Si esto falla, alguien cambió un `import()` por un import normal y el
    // bundle principal acaba de engordar medio mega para todo el mundo.
    expect([...paquetes].filter((p) => p === "three" || p.startsWith("three/")))
      .toEqual([]);
  });

  it("ni el motor 3D ni el armazón del atlas", () => {
    const { ficheros } = grafoEstatico("App.jsx");
    const alcanzables = [...ficheros].map((f) => path.relative(raiz, f).replace(/\\/g, "/"));
    expect(alcanzables).not.toContain("lib/atlas/visor.js");
    expect(alcanzables).not.toContain("components/atlas/AtlasShell.jsx");
    expect(alcanzables).not.toContain("components/atlas/AtlasCanvas.jsx");
  });

  it("los dos atlas entran por `lazy` + `import()`", () => {
    const src = leer("features/atlas/index.jsx");
    expect(src).toMatch(/lazy\(\(\) => import\("\.\/human\/HumanAtlas\.jsx"\)\)/);
    expect(src).toMatch(/lazy\(\(\) => import\("\.\/omf\/OmfAtlas\.jsx"\)\)/);
    expect(src).toContain("<Suspense");
  });

  it("lo único que sí se carga de entrada es la pantalla de espera", () => {
    // Tiene que estar disponible ANTES del trozo diferido: si también fuera
    // diferida, el primer instante sería una pantalla en blanco.
    const { ficheros } = grafoEstatico("App.jsx");
    const alcanzables = [...ficheros].map((f) => path.relative(raiz, f).replace(/\\/g, "/"));
    expect(alcanzables).toContain("components/atlas/AtlasLoading.jsx");
    expect(alcanzables).toContain("components/atlas/AtlasErrorBoundary.jsx");
  });
});

/* ============================================================================
   ESPAÑOL Y NADA DE IFRAME
   ========================================================================== */
describe("atlas · español e integración nativa", () => {
  const FUENTES_DEL_ATLAS = [
    "components/atlas/AtlasShell.jsx",
    "components/atlas/AtlasCanvas.jsx",
    "components/atlas/AtlasToolbar.jsx",
    "components/atlas/AtlasSystemsPanel.jsx",
    "components/atlas/AtlasInfoPanel.jsx",
    "components/atlas/AtlasMobileSheet.jsx",
    "components/atlas/AtlasLoading.jsx",
    "components/atlas/AtlasErrorBoundary.jsx",
    "features/atlas/index.jsx",
    "features/atlas/human/HumanAtlas.jsx",
    "features/atlas/omf/OmfAtlas.jsx",
  ];

  it("los títulos y subtítulos son los del encargo", () => {
    expect(T.humano.titulo).toBe("Atlas del cuerpo humano");
    expect(T.humano.subtitulo)
      .toBe("Explora los sistemas y estructuras del cuerpo humano en 3D.");
    expect(T.omf.titulo).toBe("Atlas oral y maxilofacial");
    expect(T.omf.subtitulo).toBe(
      "Explora estructuras de cabeza, cuello, cavidad oral y región maxilofacial en 3D."
    );
  });

  it("el glosario pedido está traducido", () => {
    expect(nombreDeSistema("skeletal")).toBe("Esqueleto");
    expect(nombreDeSistema("muscular")).toBe("Músculos");
    expect(nombreDeSistema("cardiac")).toBe("Corazón");
    expect(nombreDeSistema("arterial")).toBe("Arterias");
    expect(nombreDeSistema("venous")).toBe("Venas");
    expect(nombreDeSistema("respiratory")).toBe("Sistema respiratorio");
    expect(nombreDeSistema("digestive")).toBe("Sistema digestivo");
    expect(nombreDeSistema("nervous")).toBe("Sistema nervioso");
    expect(T.buscar).toBe("Buscar una estructura");
    expect(T.ocultar).toBe("Ocultar");
    expect(T.aislar).toBe("Aislar");
    expect(T.restablecer).toBe("Restablecer");
    expect(T.informacion).toBe("Información");
    expect(T.anterior).toBe("Anterior");
    expect(T.posterior).toBe("Posterior");
    expect(T.izquierda).toBe("Izquierda");
    expect(T.derecha).toBe("Derecha");
  });

  it("no queda inglés suelto en los textos de interfaz", () => {
    const ingles = /\b(Systems|Skeleton|Muscles|Heart|Arteries|Veins|Hide|Isolate|Reset|Details|Search|Loading|Fullscreen)\b/;
    const textos = [
      ...Object.values(T).filter((v) => typeof v === "string"),
      ...Object.values(SISTEMAS).map((s) => s.nombre),
      ...Object.values(CATEGORIAS_OMF).map((c) => c.nombre),
    ];
    for (const texto of textos) expect(texto, texto).not.toMatch(ingles);
  });

  it("no se traduce en caliente: los nombres vienen de un fichero generado", () => {
    const src = leer("lib/atlas/carga.js");
    expect(src).toContain("/models/atlas-es.json");
    for (const f of FUENTES_DEL_ATLAS) {
      expect(leer(f), f).not.toMatch(/translate|Translator|googleapis\.com\/language/i);
    }
  });

  it("no hay ni un iframe, ni enlaces a los sitios originales como experiencia", () => {
    for (const f of FUENTES_DEL_ATLAS) {
      const src = leer(f);
      expect(src, `${f} usa iframe`).not.toMatch(/<iframe/i);
      expect(src, `${f} apunta al sitio externo`).not.toMatch(/human-atlas-seven|omfatlas\.xera\.ac/);
    }
  });

  it("el atlas se dibuja con Three.js sobre un lienzo propio", () => {
    expect(leer("lib/atlas/visor.js")).toContain('from "three"');
    expect(leer("components/atlas/AtlasCanvas.jsx")).toContain("crearVisor");
  });
});

/* ============================================================================
   PANELES · abrir, cerrar, minimizar
   ========================================================================== */
describe("atlas · paneles", () => {
  const GRUPOS = { skeletal: SISTEMAS.skeletal, muscular: SISTEMAS.muscular };
  const CONTEOS = { skeletal: 296, muscular: 402 };

  function pintarSistemas(minimizado) {
    return renderToStaticMarkup(
      <AtlasSystemsPanel
        grupos={GRUPOS}
        conteos={CONTEOS}
        activos={new Set(["skeletal"])}
        etiquetaGrupos="sistemas"
        busqueda=""
        resultados={[]}
        nombreDe={() => ""}
        minimizado={minimizado}
        onBuscar={() => {}}
        onAlternar={() => {}}
        onTodo={() => {}}
        onNada={() => {}}
        onElegir={() => {}}
        onMinimizar={() => {}}
      />
    );
  }

  it("el panel de sistemas abierto muestra búsqueda y lista", () => {
    const html = pintarSistemas(false);
    expect(html).toContain("Buscar una estructura");
    expect(html).toContain("Esqueleto");
    expect(html).toContain("Músculos");
    expect(html).toContain("296");
    expect(html).toContain('aria-expanded="true"');
  });

  it("minimizado esconde el cuerpo pero deja cómo volver a abrirlo", () => {
    const html = pintarSistemas(true);
    expect(html).not.toContain("Buscar una estructura");
    expect(html).not.toContain("Esqueleto");
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain("Maximizar");
  });

  it("un sistema apagado se distingue sin depender del color", () => {
    const html = pintarSistemas(false);
    expect(html).toContain('aria-pressed="true"');    // esqueleto encendido
    expect(html).toContain('aria-pressed="false"');   // músculos apagados
  });

  it("la búsqueda enseña resultados y su cuenta", () => {
    const html = renderToStaticMarkup(
      <AtlasSystemsPanel
        grupos={GRUPOS}
        conteos={CONTEOS}
        activos={new Set()}
        etiquetaGrupos="sistemas"
        busqueda="fémur"
        resultados={[7, 9]}
        nombreDe={(i) => (i === 7 ? "Fémur derecho" : "Fémur izquierdo")}
        minimizado={false}
        onBuscar={() => {}}
        onAlternar={() => {}}
        onTodo={() => {}}
        onNada={() => {}}
        onElegir={() => {}}
        onMinimizar={() => {}}
      />
    );
    expect(html).toContain("2 estructuras");
    expect(html).toContain("Fémur derecho");
    expect(html).toContain("Fémur izquierdo");
  });

  function pintarInfo(estructura, minimizado = false) {
    return renderToStaticMarkup(
      <AtlasInfoPanel
        estructura={estructura}
        aislado={false}
        oculta={false}
        minimizado={minimizado}
        onOcultar={() => {}}
        onAislar={() => {}}
        onQuitar={() => {}}
        onMinimizar={() => {}}
      />
    );
  }

  it("sin selección, el panel de información invita a tocar el modelo", () => {
    expect(pintarInfo(null)).toContain("Toca una estructura del modelo");
  });

  it("con selección muestra nombre, sistema y las acciones", () => {
    const html = pintarInfo({
      nombre: "Arteria carótida común derecha",
      id: "FJ0001", conceptId: "FMA3939",
      grupo: "Arterias", color: "#D9421F",
    });
    expect(html).toContain("Arteria carótida común derecha");
    expect(html).toContain("Arterias");
    expect(html).toContain("FMA3939");
    expect(html).toContain("Ocultar");
    expect(html).toContain("Aislar");
  });

  it("minimizado, el panel de información también se pliega", () => {
    const html = pintarInfo({ nombre: "X", id: "a", grupo: "b", color: "#fff" }, true);
    expect(html).not.toContain("Aislar");
    expect(html).toContain('aria-expanded="false"');
  });

  it("la ficha lleva siempre la atribución de BodyParts3D", () => {
    const html = pintarInfo(null);
    expect(html).toContain("BodyParts3D 4.0");
    expect(html).toContain("Database Center for Life Science");
    expect(html).toContain("creativecommons.org/licenses/by/4.0");
  });
});

/* ============================================================================
   BARRA DE ACCIONES Y MÓVIL
   ========================================================================== */
describe("atlas · controles", () => {
  function pintarBarra(movil, extra = {}) {
    return renderToStaticMarkup(
      <AtlasToolbar
        movil={movil}
        etiquetaGrupos="sistemas"
        panelGruposAbierto={false}
        panelInfoAbierto={false}
        pantallaCompleta={false}
        onRestablecer={() => {}}
        onCentrar={() => {}}
        onZoom={() => {}}
        onGrupos={() => {}}
        onInfo={() => {}}
        onPantallaCompleta={() => {}}
        {...extra}
      />
    );
  }

  it("están las siete acciones pedidas, con rótulo accesible", () => {
    const html = pintarBarra(false);
    for (const rotulo of ["Restablecer", "Centrar modelo", "Acercar", "Alejar",
      "Sistemas", "Información", "Pantalla completa"]) {
      expect(html, rotulo).toContain(`aria-label="${rotulo}"`);
    }
  });

  it("en escritorio hay tooltip; en móvil no, porque taparía el botón", () => {
    expect(pintarBarra(false)).toContain('title="Restablecer"');
    expect(pintarBarra(true)).not.toContain('title="Restablecer"');
  });

  it("en móvil la barra cambia de forma, no sólo de tamaño", () => {
    const html = pintarBarra(true);
    expect(html).toContain("atlas-toolbar--movil");
    expect(html).toContain('role="toolbar"');
  });

  it("el atlas maxilofacial rotula el panel como Categorías", () => {
    const html = renderToStaticMarkup(
      <AtlasToolbar
        movil={false}
        etiquetaGrupos="categorías"
        panelGruposAbierto={false}
        panelInfoAbierto={false}
        pantallaCompleta={false}
        onRestablecer={() => {}} onCentrar={() => {}} onZoom={() => {}}
        onGrupos={() => {}} onInfo={() => {}} onPantallaCompleta={() => {}}
      />
    );
    expect(html).toContain('aria-label="Categorías"');
  });

  it("en pantalla completa el botón ofrece salir", () => {
    expect(pintarBarra(false, { pantallaCompleta: true }))
      .toContain('aria-label="Salir de pantalla completa"');
  });

  it("el móvil respeta el área segura y no provoca scroll horizontal", () => {
    const css = leer("components/atlas/atlas.css");
    expect(css).toContain("env(safe-area-inset-bottom");
    expect(css).toContain("100dvh");             // no `vh`: la barra del navegador
    expect(css).toContain("max-width: 100%");
    // Objetivos táctiles de 44 px en la hoja y en la barra de móvil.
    expect(css).toMatch(/width: 44px; height: 44px/);
  });

  it("la hoja de móvil deja seguir girando el modelo detrás", () => {
    const src = leer("components/atlas/AtlasMobileSheet.jsx");
    // Sin velo y sin `aria-modal`: si atrapara el foco, mentiría sobre lo que
    // hace. Se busca el atributo, no la palabra, que sí sale en el comentario.
    expect(src).not.toMatch(/aria-modal\s*=/);
    expect(src).toContain('role="dialog"');
    expect(src).toContain("Escape");
  });
});

/* ============================================================================
   ESTADOS DE CARGA Y ERROR
   ========================================================================== */
describe("atlas · qué se ve mientras carga y cuando falla", () => {
  it("primero «Preparando», después «Cargando estructuras»", () => {
    expect(renderToStaticMarkup(<AtlasCargando progreso={0} fase="manifiesto" />))
      .toContain("Preparando el atlas 3D…");
    expect(renderToStaticMarkup(<AtlasCargando progreso={40} fase="estructuras" />))
      .toContain("Cargando estructuras anatómicas…");
  });

  it("el progreso es real y está anunciado", () => {
    const html = renderToStaticMarkup(<AtlasCargando progreso={62} fase="estructuras" />);
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-valuenow="62"');
    expect(html).toContain("62%");
  });

  it("nunca hay pantalla en blanco: siempre hay Kantu y un mensaje", () => {
    const html = renderToStaticMarkup(<AtlasCargando progreso={0} fase="manifiesto" />);
    expect(html).toContain("/mascot/kantu-session.webp");
    expect(html).toContain('role="status"');
  });

  it("sin WebGL se dice lo que pasa, sin ofrecer un reintento inútil", () => {
    const html = renderToStaticMarkup(<AtlasSinWebgl onVolver={() => {}} />);
    expect(html).toContain("Tu dispositivo o navegador no pudo iniciar la visualización 3D.");
    expect(html).toContain("Volver al panel");
    expect(html).not.toContain("Recargar la vista");
  });

  it("si falla la descarga sí se puede reintentar", () => {
    const html = renderToStaticMarkup(<AtlasFalloDeCarga onReintentar={() => {}} onVolver={() => {}} />);
    expect(html).toContain("No pudimos cargar el atlas 3D.");
    expect(html).toContain("Intenta recargar la vista.");
    expect(html).toContain("Recargar la vista");
  });

  it("ningún estado enseña jerga ni restos de un error técnico", () => {
    const vistas = [
      renderToStaticMarkup(<AtlasCargando progreso={10} fase="estructuras" />),
      renderToStaticMarkup(<AtlasSinWebgl onVolver={() => {}} />),
      renderToStaticMarkup(<AtlasFalloDeCarga onReintentar={() => {}} onVolver={() => {}} />),
    ];
    for (const html of vistas) {
      for (const basura of ["undefined", "[object Object]", "TypeError", "at Object.",
        "WebGLRenderer", "NaN"]) {
        expect(html, basura).not.toContain(basura);
      }
    }
  });

  it("sin DOM, `hayWebgl` contesta que no en vez de reventar", () => {
    expect(hayWebgl()).toBe(false);
  });

  it("el fallo de render tiene su propia red de seguridad", () => {
    const src = leer("components/atlas/AtlasErrorBoundary.jsx");
    expect(src).toContain("getDerivedStateFromError");
    expect(src).toContain("componentDidCatch");
    // El detalle técnico va a consola, nunca a la pantalla de la docente.
    expect(src).toContain("console.error");
    expect(src).not.toMatch(/\{\s*error(\?\.)?\.message\s*\}/);
  });
});

/* ============================================================================
   PANTALLA COMPLETA
   ========================================================================== */
describe("atlas · pantalla completa", () => {
  const shell = leer("components/atlas/AtlasShell.jsx");

  it("usa la API del navegador cuando existe", () => {
    expect(shell).toContain("requestFullscreen");
    expect(shell).toContain("exitFullscreen");
    expect(shell).toContain("fullscreenchange");
  });

  it("y tiene respaldo cuando el navegador la rechaza", () => {
    // Safari en iPhone no da pantalla completa a un div: sin este respaldo,
    // el botón no haría nada en medio parque de móviles.
    expect(shell).toMatch(/catch[\s\S]{0,200}setInmersivo\(true\)/);
    const css = leer("components/atlas/atlas.css");
    expect(css).toContain(".atlas--inmersivo");
    expect(css).toMatch(/\.atlas--inmersivo\s*\{[^}]*position:\s*fixed/);
  });

  it("se sale con el mismo botón y con Escape, sin romper la navegación", () => {
    expect(shell).toMatch(/if \(inmersivo\) \{ setInmersivo\(false\); return; \}/);
    expect(shell).toContain('e.key !== "Escape"');
  });

  it("al cambiar de tamaño se recalcula el lienzo", () => {
    expect(shell).toContain("redimensionar()");
  });
});

/* ============================================================================
   MINIMIZAR, AISLAR Y LIBERAR RECURSOS
   ========================================================================== */
describe("atlas · gestión de la vista y de la memoria", () => {
  it("los dos paneles se pueden plegar", () => {
    const shell = leer("components/atlas/AtlasShell.jsx");
    expect(shell).toContain("setGruposMin");
    expect(shell).toContain("setInfoMin");
    expect(shell).toContain("setHojaMin");
  });

  it("al desmontar se suelta el contexto WebGL", () => {
    const visor = leer("lib/atlas/visor.js");
    for (const llamada of ["renderer.dispose()", "forceContextLoss", "g.dispose()",
      "material.dispose()", "textura.dispose()", "observador.disconnect()",
      "cancelAnimationFrame"]) {
      expect(visor, llamada).toContain(llamada);
    }
    expect(leer("components/atlas/AtlasCanvas.jsx")).toContain("instancia.destruir()");
  });

  it("sólo se dibuja cuando algo cambió", () => {
    // Un bucle que pinta 60 veces por segundo un modelo quieto funde la
    // batería de un móvil en una clase.
    expect(leer("lib/atlas/visor.js")).toMatch(/if \(!sucio\) return;/);
  });

  it("el móvil limita la densidad de píxeles", () => {
    const visor = leer("lib/atlas/visor.js");
    expect(visor).toContain("DPR_MOVIL");
    expect(visor).toMatch(/setPixelRatio\(Math\.min\(/);
  });

  it("no se vuelve a descargar el pack en la misma sesión", () => {
    const carga = leer("lib/atlas/carga.js");
    expect(carga).toMatch(/if \(cache\)/);
    // Un fallo no se queda cacheado, o no habría forma de reintentar.
    expect(carga).toMatch(/cache\.catch\(\(\) => \{ cache = null; \}\)/);
  });
});

/* ============================================================================
   DATOS · el mismo pack para los dos atlas
   ========================================================================== */
describe("atlas · qué enseña cada uno", () => {
  const manifiesto = JSON.parse(leer("public/models/atlas.json"));
  const nombres = JSON.parse(leer("public/models/atlas-es.json"));
  const partes = manifiesto.parts.map((p, i) => ({ ...p, indiceGlobal: i }));

  it("el manifiesto es el de BodyParts3D 4.0 con sus 2.234 estructuras", () => {
    expect(manifiesto.version).toBe("BodyParts3D 4.0");
    expect(manifiesto.parts.length).toBe(2234);
    expect(manifiesto.chunks.length).toBe(15);
  });

  it("las 2.234 tienen nombre en español", () => {
    expect(Object.keys(nombres).length).toBe(2234);
    for (const p of manifiesto.parts) expect(nombres[p.id], p.name).toBeTruthy();
  });

  it("y están bien traducidas, no transliteradas", () => {
    const porNombre = (n) => nombres[manifiesto.parts.find((p) => p.name === n).id];
    expect(porNombre("Right common carotid artery")).toBe("Arteria carótida común derecha");
    expect(porNombre("Left lower first secondary molar tooth"))
      .toBe("Primer molar permanente inferior izquierdo");
    expect(porNombre("Mandible")).toBe("Mandíbula");
    expect(porNombre("Right gluteus medius")).toBe("Glúteo medio derecho");
    expect(porNombre("Superior vena cava")).toBe("Vena cava superior");
    expect(porNombre("Right tenth rib")).toBe("Décima costilla derecha");
  });

  it("el atlas del cuerpo humano lo enseña todo, por sistemas", () => {
    expect(partes.filter((p) => FUENTE_HUMANA.incluye(p)).length).toBe(2234);
    expect(FUENTE_HUMANA.grupoDe(partes[0])).toBe(partes[0].system);
    expect(Object.keys(FUENTE_HUMANA.grupos)).toHaveLength(15);
  });

  it("el maxilofacial se queda con cabeza y cuello", () => {
    const propias = partes.filter((p) => FUENTE_OMF.incluye(p));
    // El README de OMFAtlas declara 643 mallas de BodyParts3D: el corte por
    // región da 648, que es la misma región.
    expect(propias.length).toBeGreaterThan(600);
    expect(propias.length).toBeLessThan(700);

    const porNombre = (n) => partes.find((p) => p.name === n);
    for (const clave of ["Mandible", "Vomer", "Left maxilla", "Tongue"]) {
      expect(FUENTE_OMF.incluye(porNombre(clave)), clave).toBe(true);
    }
    // Y nada de la mitad inferior del cuerpo.
    expect(FUENTE_OMF.incluye(porNombre("Right femur"))).toBe(false);
  });

  it("incluye la dentición completa y las encías", () => {
    const propias = partes.filter((p) => FUENTE_OMF.incluye(p));
    const denticion = propias.filter((p) => categoriaOmf(p) === "denticion");
    expect(denticion.length).toBe(30);       // 28 piezas + 2 encías
  });

  it("las categorías son las siete pedidas", () => {
    expect(Object.values(CATEGORIAS_OMF).map((c) => c.nombre)).toEqual([
      "Huesos y referencias anatómicas", "Dentición", "Músculos", "Nervios",
      "Vasos", "Articulaciones", "Estructuras relacionadas",
    ]);
  });

  it("y cada estructura cae en una de ellas", () => {
    for (const p of partes.filter((x) => FUENTE_OMF.incluye(x))) {
      expect(CATEGORIAS_OMF[categoriaOmf(p)], p.name).toBeTruthy();
    }
  });

  it("un diente va a Dentición aunque el manifiesto lo llame óseo", () => {
    const diente = partes.find((p) => p.name === "Left upper secondary canine tooth");
    expect(diente.system).toBe("skeletal");
    expect(categoriaOmf(diente)).toBe("denticion");
  });
});

/* ============================================================================
   FORMATO BINARIO
   ========================================================================== */
describe("atlas · armado de la geometría", () => {
  it("fusiona varias estructuras desplazando bien los índices", () => {
    // Dos estructuras de 3 vértices y 3 índices cada una, con la misma
    // disposición que el pack real: Float32 · Int16 · Uint32.
    const buffer = new ArrayBuffer(136);
    const partes = [
      { indiceGlobal: 4, vertexCount: 3, indexCount: 3, positions: 0, normals: 36, indices: 56 },
      { indiceGlobal: 9, vertexCount: 3, indexCount: 3, positions: 68, normals: 104, indices: 124 },
    ];

    new Float32Array(buffer, 0, 9).set([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    new Int16Array(buffer, 36, 9).set([10, 11, 12, 13, 14, 15, 16, 17, 18]);
    new Uint32Array(buffer, 56, 3).set([0, 1, 2]);
    new Float32Array(buffer, 68, 9).set([21, 22, 23, 24, 25, 26, 27, 28, 29]);
    new Int16Array(buffer, 104, 9).set([30, 31, 32, 33, 34, 35, 36, 37, 38]);
    new Uint32Array(buffer, 124, 3).set([0, 1, 2]);

    const r = fusionarBloque(buffer, partes);

    expect(r.cuenta).toBe(6);
    expect([...r.posiciones.slice(0, 3)]).toEqual([1, 2, 3]);
    expect([...r.posiciones.slice(9, 12)]).toEqual([21, 22, 23]);
    // Lo que importa: la segunda estructura apunta a SUS vértices, no a los
    // de la primera. Sin el desplazamiento, saldría un amasijo.
    expect([...r.indices]).toEqual([0, 1, 2, 3, 4, 5]);
    // Y cada vértice sabe a qué estructura pertenece, que es lo que permite
    // seleccionar sobre una malla fusionada.
    expect([...r.indiceDeParte]).toEqual([4, 4, 4, 9, 9, 9]);
  });

  it("las normales viajan en 16 bits, no en coma flotante", () => {
    const buffer = new ArrayBuffer(68);
    const r = fusionarBloque(buffer, [
      { indiceGlobal: 0, vertexCount: 3, indexCount: 3, positions: 0, normals: 36, indices: 56 },
    ]);
    expect(r.normales).toBeInstanceOf(Int16Array);
    expect(r.posiciones).toBeInstanceOf(Float32Array);
    expect(r.indices).toBeInstanceOf(Uint32Array);
  });
});

/* ============================================================================
   LICENCIAS · lo que NO puede entrar

   El repositorio OMFAtlas trae cuatro datasets dentales con licencias
   distintas. Uno de ellos, `open-full-jaw.bin`, es CC BY-NC-SA 4.0 y su
   propio ATTRIBUTION.md avisa de que la restricción NonCommercial se
   transfiere a los derivados. SciVerse cobra un plan Pro, así que no puede
   distribuirlo. Estos tests fallan si alguien lo añade más adelante.
   ========================================================================== */
describe("atlas · licencias de los modelos", () => {
  const ficheros = fs.readdirSync(path.join(raiz, "public", "models"));

  it("sólo está el pack CC BY 4.0 de BodyParts3D", () => {
    const esperados = new Set([
      "atlas.json", "atlas-es.json", "ATRIBUCION.md",
      ...Array.from({ length: 15 }, (_, i) => `body-${i}.bin.gz`),
    ]);
    for (const f of ficheros) expect(esperados.has(f), `sobra ${f}`).toBe(true);
  });

  it("no entró ningún dataset con NonCommercial ni ShareAlike", () => {
    for (const prohibido of ["open-full-jaw.bin", "toothfairy.bin", "facial.bin"]) {
      expect(ficheros, prohibido).not.toContain(prohibido);
    }
  });

  it("la atribución exigida por CC BY 4.0 viaja con los modelos", () => {
    const atribucion = leer("public/models/ATRIBUCION.md");
    expect(atribucion).toContain("BodyParts3D");
    expect(atribucion).toContain("Database Center for Life Science");
    expect(atribucion).toContain("CC BY 4.0");
    expect(atribucion).toContain("https://creativecommons.org/licenses/by/4.0/");
  });

  it("y también se enseña dentro del producto, no sólo en un fichero", () => {
    expect(T.atribucionTexto).toContain("BodyParts3D 4.0");
    expect(T.atribucionTexto).toContain("Database Center for Life Science");
    expect(T.atribucionTexto).toContain("Creative Commons");
  });

  it("la documentación cita las licencias encontradas, sin inventarlas", () => {
    const doc = leer("docs/ATLAS-3D-INTEGRATION.md");
    expect(doc).toContain("CC BY-NC-SA 4.0");
    expect(doc).toContain("CC BY-SA 2.1");
    expect(doc).toContain("MIT");
    expect(doc).toContain("open-full-jaw.bin");
    expect(doc).toContain("https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html");
  });
});

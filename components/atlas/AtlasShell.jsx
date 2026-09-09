import React, {
  useCallback, useEffect, useMemo, useRef, useState,
} from "react";

import AtlasCanvas from "./AtlasCanvas.jsx";
import AtlasInfoPanel from "./AtlasInfoPanel.jsx";
import AtlasMobileSheet from "./AtlasMobileSheet.jsx";
import AtlasSystemsPanel from "./AtlasSystemsPanel.jsx";
import AtlasToolbar from "./AtlasToolbar.jsx";
import { AtlasCargando, AtlasFalloDeCarga, AtlasSinWebgl } from "./AtlasLoading.jsx";
import { cargarAtlas } from "../../lib/atlas/carga.js";
import { hayWebgl } from "../../lib/atlas/visor.js";
import { T } from "../../lib/atlas/i18n.es.js";

/* ==========================================================================
   ARMAZÓN COMÚN DE LOS DOS ATLAS

   Los dos atlas son el mismo programa con distinta selección de estructuras
   y distinta agrupación. Duplicar la interfaz habría significado arreglar
   cada detalle de accesibilidad y de móvil dos veces, y arreglarlo mal la
   segunda. Lo que cambia viene en `fuente` (ver lib/atlas/fuentes.js).

   ESCRITORIO Y MÓVIL NO SON EL MISMO DISEÑO ENCOGIDO
   --------------------------------------------------
   En escritorio hay dos columnas laterales plegables junto al lienzo. En
   móvil no hay columnas: el modelo ocupa la pantalla y los paneles son hojas
   inferiores que se pueden minimizar sin cerrarse, porque el encargo pide
   poder seguir girando el modelo mientras se lee la ficha.
   ========================================================================== */

const LIMITE_RESULTADOS = 40;

const sinTildes = (t) =>
  t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** #RRGGBB → [r, g, b] en 0..1, que es lo que espera el shader. */
function aRgb(hex) {
  const n = parseInt(hex.replace("#", ""), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export default function AtlasShell({ fuente, titulo, subtitulo, onVolver }) {
  /* ------------------------------------------------------------ carga */
  const [datos, setDatos] = useState(null);
  const [progreso, setProgreso] = useState(0);
  const [fase, setFase] = useState("manifiesto");
  const [fallo, setFallo] = useState(null);
  const [intento, setIntento] = useState(0);

  // Se comprueba una sola vez: crear y tirar un contexto WebGL en cada
  // render sería justo lo que agota los contextos del navegador.
  const [soportaWebgl] = useState(() => hayWebgl());

  useEffect(() => {
    if (!soportaWebgl) return undefined;
    let vivo = true;
    setFallo(null);

    cargarAtlas({
      onProgreso: (pct, etapa) => {
        if (!vivo) return;
        setProgreso(pct);
        setFase(etapa);
      },
    })
      .then((r) => { if (vivo) setDatos(r); })
      .catch((error) => {
        if (!vivo) return;
        console.error("[sciverse:atlas]", error?.message || error);
        setFallo("carga");
      });

    return () => { vivo = false; };
  }, [soportaWebgl, intento]);

  /* -------------------------------------------------- estructuras del atlas */
  const { partesDelAtlas, enfoque, conteos, colores, nombreDe } = useMemo(() => {
    if (!datos) {
      return { partesDelAtlas: [], enfoque: null, conteos: {}, colores: [], nombreDe: () => "" };
    }

    const propias = datos.partes.filter((p) => fuente.incluye(p));
    const set = new Set(propias.map((p) => p.indiceGlobal));

    const cuenta = {};
    for (const p of propias) {
      const g = fuente.grupoDe(p);
      cuenta[g] = (cuenta[g] || 0) + 1;
    }

    // Un color por estructura, para toda la tabla del manifiesto: el shader
    // indexa por índice global y no sabe de subconjuntos.
    const paleta = datos.partes.map((p) => {
      const grupo = fuente.grupos[fuente.grupoDe(p)];
      return aRgb(grupo?.color || "#B4C6C4");
    });

    const nombre = (indice) => {
      const p = datos.partes[indice];
      if (!p) return "";
      return datos.nombres[p.id] || p.name;
    };

    return { partesDelAtlas: propias, enfoque: set, conteos: cuenta, colores: paleta, nombreDe: nombre };
  }, [datos, fuente]);

  /* ----------------------------------------------------------- estado de la UI */
  const [gruposActivos, setGruposActivos] = useState(() => new Set(fuente.visiblesAlInicio));
  const [ocultas, setOcultas] = useState(() => new Set());
  const [seleccion, setSeleccion] = useState(null);
  const [aislado, setAislado] = useState(false);
  const [busqueda, setBusqueda] = useState("");

  const [panelGrupos, setPanelGrupos] = useState(true);
  const [panelInfo, setPanelInfo] = useState(true);
  const [gruposMin, setGruposMin] = useState(false);
  const [infoMin, setInfoMin] = useState(false);
  const [hojaMin, setHojaMin] = useState(false);

  const [pantallaCompleta, setPantallaCompleta] = useState(false);
  const [inmersivo, setInmersivo] = useState(false);
  const [movil, setMovil] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 900px)").matches
  );

  const raiz = useRef(null);
  const visor = useRef(null);
  const campoBusqueda = useRef(null);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 900px)");
    const alCambiar = (e) => setMovil(e.matches);
    mq.addEventListener("change", alCambiar);
    return () => mq.removeEventListener("change", alCambiar);
  }, []);

  // En móvil los paneles arrancan cerrados: el modelo es lo que hay que ver.
  useEffect(() => {
    if (movil) { setPanelGrupos(false); setPanelInfo(false); }
  }, [movil]);

  /* --------------------------------------------------------- qué está visible */
  const visibles = useMemo(() => {
    const set = new Set();
    if (!partesDelAtlas.length) return set;

    for (const p of partesDelAtlas) {
      const i = p.indiceGlobal;
      if (aislado) {
        // Aislar enseña sólo la elegida, sin importar su sistema: es la
        // acción de «quítame todo lo demás de encima».
        if (i === seleccion) set.add(i);
        continue;
      }
      if (!gruposActivos.has(fuente.grupoDe(p))) continue;
      if (ocultas.has(i)) continue;
      set.add(i);
    }
    return set;
  }, [partesDelAtlas, gruposActivos, ocultas, aislado, seleccion, fuente]);

  /* ------------------------------------------------------------- búsqueda */
  const resultados = useMemo(() => {
    const q = sinTildes(busqueda.trim());
    if (q.length < 2) return [];
    const salida = [];
    for (const p of partesDelAtlas) {
      if (sinTildes(nombreDe(p.indiceGlobal)).includes(q)) {
        salida.push(p.indiceGlobal);
        if (salida.length >= LIMITE_RESULTADOS) break;
      }
    }
    return salida;
  }, [busqueda, partesDelAtlas, nombreDe]);

  /* ------------------------------------------------------------- acciones */
  const elegir = useCallback((indice) => {
    setSeleccion(indice);
    if (indice != null) {
      visor.current?.enfocar(indice);
      // Al elegir desde la búsqueda, la estructura tiene que verse aunque su
      // sistema estuviera apagado: si no, la docente busca algo, lo pulsa y
      // no pasa nada visible.
      setOcultas((previas) => {
        if (!previas.has(indice)) return previas;
        const copia = new Set(previas);
        copia.delete(indice);
        return copia;
      });
      const parte = datos?.partes[indice];
      if (parte) {
        const grupo = fuente.grupoDe(parte);
        setGruposActivos((previos) => (previos.has(grupo) ? previos : new Set(previos).add(grupo)));
      }
    }
    if (movil) { setPanelInfo(true); setHojaMin(false); }
  }, [datos, fuente, movil]);

  const alternarGrupo = useCallback((clave) => {
    setGruposActivos((previos) => {
      const copia = new Set(previos);
      if (copia.has(clave)) copia.delete(clave); else copia.add(clave);
      return copia;
    });
    setAislado(false);
  }, []);

  const alternarOculta = useCallback(() => {
    if (seleccion == null) return;
    setOcultas((previas) => {
      const copia = new Set(previas);
      if (copia.has(seleccion)) copia.delete(seleccion); else copia.add(seleccion);
      return copia;
    });
  }, [seleccion]);

  const restablecer = useCallback(() => {
    visor.current?.restablecer();
    setOcultas(new Set());
    setAislado(false);
    setGruposActivos(new Set(fuente.visiblesAlInicio));
    setSeleccion(null);
    setBusqueda("");
  }, [fuente]);

  /* --------------------------------------------------------- pantalla completa

     Se intenta la API real. Cuando el navegador la rechaza —Safari en iPhone
     no la da para un div— se cae a un modo inmersivo propio: posición fija
     sobre toda la ventana. No es lo mismo, pero deja el modelo a pantalla
     completa y se sale con el mismo botón y con Escape.                     */
  const alternarPantallaCompleta = useCallback(async () => {
    const nodo = raiz.current;
    if (!nodo) return;

    if (document.fullscreenElement) {
      try { await document.exitFullscreen(); } catch { /* el estado lo fija el evento */ }
      return;
    }
    if (inmersivo) { setInmersivo(false); return; }

    if (nodo.requestFullscreen) {
      try {
        await nodo.requestFullscreen();
        return;
      } catch {
        // Sin ruido: el respaldo de abajo resuelve el caso.
      }
    }
    setInmersivo(true);
  }, [inmersivo]);

  useEffect(() => {
    const alCambiar = () => {
      setPantallaCompleta(Boolean(document.fullscreenElement));
      // El lienzo tiene otro tamaño dentro y fuera: sin esto la imagen sale
      // estirada hasta que el usuario mueva algo.
      requestAnimationFrame(() => visor.current?.redimensionar());
    };
    document.addEventListener("fullscreenchange", alCambiar);
    return () => document.removeEventListener("fullscreenchange", alCambiar);
  }, []);

  useEffect(() => {
    requestAnimationFrame(() => visor.current?.redimensionar());
  }, [inmersivo, panelGrupos, panelInfo, gruposMin, infoMin]);

  /* ------------------------------------------------------------- teclado */
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      // Se cierra lo más superficial primero, que es lo que espera quien
      // pulsa Escape para «deshacer un paso».
      if (inmersivo) { setInmersivo(false); return; }
      if (document.fullscreenElement) { document.exitFullscreen?.(); return; }
      if (movil && (panelGrupos || panelInfo)) {
        setPanelGrupos(false); setPanelInfo(false);
        visor.current?.enfocarLienzo();
        return;
      }
      if (seleccion != null) { setSeleccion(null); setAislado(false); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [inmersivo, movil, panelGrupos, panelInfo, seleccion]);

  /* --------------------------------------------------------------- render */
  if (!soportaWebgl) return <AtlasSinWebgl onVolver={onVolver} />;

  if (fallo === "carga") {
    return (
      <AtlasFalloDeCarga
        onReintentar={() => { setProgreso(0); setFase("manifiesto"); setIntento((n) => n + 1); }}
        onVolver={onVolver}
      />
    );
  }

  if (!datos) {
    return (
      <div className="atlas atlas--cargando">
        <AtlasCargando progreso={progreso} fase={fase} />
      </div>
    );
  }

  const estructura = seleccion != null && datos.partes[seleccion]
    ? {
      nombre: nombreDe(seleccion),
      id: datos.partes[seleccion].id,
      conceptId: datos.partes[seleccion].conceptId,
      grupo: fuente.grupos[fuente.grupoDe(datos.partes[seleccion])]?.nombre || "—",
      color: fuente.grupos[fuente.grupoDe(datos.partes[seleccion])]?.color || "#B4C6C4",
    }
    : null;

  const panelDeSistemas = (
    <AtlasSystemsPanel
      grupos={fuente.grupos}
      conteos={conteos}
      activos={gruposActivos}
      etiquetaGrupos={fuente.etiquetaGrupos}
      busqueda={busqueda}
      resultados={resultados}
      nombreDe={nombreDe}
      minimizado={!movil && gruposMin}
      campoRef={campoBusqueda}
      onBuscar={setBusqueda}
      onAlternar={alternarGrupo}
      onTodo={() => { setGruposActivos(new Set(Object.keys(fuente.grupos))); setAislado(false); }}
      onNada={() => { setGruposActivos(new Set()); setAislado(false); }}
      onElegir={elegir}
      onMinimizar={() => setGruposMin((v) => !v)}
    />
  );

  const panelDeInfo = (
    <AtlasInfoPanel
      estructura={estructura}
      aislado={aislado}
      oculta={seleccion != null && ocultas.has(seleccion)}
      minimizado={!movil && infoMin}
      onOcultar={alternarOculta}
      onAislar={() => setAislado((v) => !v)}
      onQuitar={() => { setSeleccion(null); setAislado(false); }}
      onMinimizar={() => setInfoMin((v) => !v)}
    />
  );

  const clases = [
    "atlas",
    movil ? "atlas--movil" : "atlas--escritorio",
    inmersivo ? "atlas--inmersivo" : "",
    pantallaCompleta ? "atlas--completa" : "",
  ].filter(Boolean).join(" ");

  return (
    <div className={clases} ref={raiz}>
      {!pantallaCompleta && !inmersivo && (
        <header className="atlas__cabecera">
          <h1>{titulo}</h1>
          <p>{subtitulo}</p>
        </header>
      )}

      <div className="atlas__escenario">
        {!movil && panelGrupos && (
          <div className="atlas__columna atlas__columna--izq">{panelDeSistemas}</div>
        )}

        <div className="atlas__centro">
          <AtlasCanvas
            bloques={datos.bloques}
            partes={datos.partes}
            colores={colores}
            enfoque={enfoque}
            visibles={visibles}
            seleccion={seleccion}
            onSeleccion={elegir}
            onFallo={() => setFallo("carga")}
            visorRef={visor}
          />

          <AtlasToolbar
            movil={movil}
            etiquetaGrupos={fuente.etiquetaGrupos}
            panelGruposAbierto={panelGrupos}
            panelInfoAbierto={panelInfo}
            pantallaCompleta={pantallaCompleta || inmersivo}
            onRestablecer={restablecer}
            onCentrar={() => visor.current?.centrar()}
            onZoom={(f) => visor.current?.zoom(f)}
            onGrupos={() => {
              setPanelGrupos((v) => !v);
              if (movil) { setPanelInfo(false); setHojaMin(false); }
            }}
            onInfo={() => {
              setPanelInfo((v) => !v);
              if (movil) { setPanelGrupos(false); setHojaMin(false); }
            }}
            onPantallaCompleta={alternarPantallaCompleta}
          />

          <p className="atlas__ayuda">{movil ? T.ayudaMovil : T.ayudaEscritorio}</p>
        </div>

        {!movil && panelInfo && (
          <div className="atlas__columna atlas__columna--der">{panelDeInfo}</div>
        )}
      </div>

      {/* -------------------------------------------------- hojas de móvil */}
      {movil && (
        <>
          <AtlasMobileSheet
            abierta={panelGrupos}
            titulo={fuente.etiquetaGrupos === "categorías" ? T.categorias : T.sistemas}
            minimizada={hojaMin}
            onMinimizar={() => setHojaMin((v) => !v)}
            onCerrar={() => { setPanelGrupos(false); visor.current?.enfocarLienzo(); }}
          >
            {panelDeSistemas}
          </AtlasMobileSheet>

          <AtlasMobileSheet
            abierta={panelInfo}
            titulo={T.informacion}
            minimizada={hojaMin}
            onMinimizar={() => setHojaMin((v) => !v)}
            onCerrar={() => { setPanelInfo(false); visor.current?.enfocarLienzo(); }}
          >
            {panelDeInfo}
          </AtlasMobileSheet>
        </>
      )}
    </div>
  );
}

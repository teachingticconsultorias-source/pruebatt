import React, {
  useCallback, useEffect, useMemo, useRef, useState,
} from "react";
import { Crosshair, Eye, EyeOff, Focus, X } from "lucide-react";

import AtlasCanvas from "./AtlasCanvas.jsx";
import AtlasInfoPanel from "./AtlasInfoPanel.jsx";
import AtlasMobileSheet from "./AtlasMobileSheet.jsx";
import AtlasSystemsPanel from "./AtlasSystemsPanel.jsx";
import AtlasToolbar from "./AtlasToolbar.jsx";
import { AtlasCargando, AtlasFalloDeCarga, AtlasSinWebgl } from "./AtlasLoading.jsx";
import { cargarAtlas } from "../../lib/atlas/carga.js";
import { crearIndice, crearIndiceDeBusqueda, fichaDe, sinTildes } from "../../lib/atlas/metadatos.js";
import { hayWebgl } from "../../lib/atlas/visor.js";
import { T } from "../../lib/atlas/i18n.es.js";

/* ==========================================================================
   ARMAZÓN COMÚN DE LOS DOS ATLAS

   Los dos atlas son el mismo programa con distinta selección de estructuras y
   distinta agrupación. Duplicar la interfaz habría significado arreglar cada
   detalle de accesibilidad y de móvil dos veces, y arreglarlo mal la segunda.
   Lo que cambia viene en `fuente` (ver lib/atlas/fuentes.js).

   ESCRITORIO Y MÓVIL NO SON EL MISMO DISEÑO ENCOGIDO
   --------------------------------------------------
   En escritorio hay dos columnas laterales plegables junto al lienzo. En
   móvil no hay columnas: el modelo ocupa la pantalla y los paneles son hojas
   inferiores que se pueden minimizar sin cerrarse, porque hay que poder
   seguir girando el modelo mientras se lee la ficha.

   TRES ESTADOS DE VISIBILIDAD, Y NINGUNO PISA A OTRO
   --------------------------------------------------
   · `gruposActivos` — qué sistemas o categorías están encendidos
   · `ocultas`       — estructuras sueltas que la docente quitó de en medio
   · `aislado`       — ver sólo la seleccionada, temporalmente

   Aislar NO toca los otros dos: es una capa que se pone encima y se quita.
   Por eso salir del aislamiento devuelve exactamente la vista anterior sin
   guardar copia de nada. Y ocultar una pieza no reinicia los sistemas: son
   preguntas distintas y mezclarlas obligaba a rehacer la vista entera por
   quitar un hueso de delante.
   ========================================================================== */

const LIMITE_RESULTADOS = 40;

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

  // Se comprueba una sola vez: crear y tirar un contexto WebGL en cada render
  // sería justo lo que agota los contextos del navegador.
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
  const modelo = useMemo(() => {
    if (!datos) return null;

    const propias = datos.partes.filter((p) => fuente.incluye(p));
    const enfoque = new Set(propias.map((p) => p.indiceGlobal));

    const conteos = {};
    for (const p of propias) {
      const g = fuente.grupoDe(p);
      conteos[g] = (conteos[g] || 0) + 1;
    }

    // Un color por estructura, para toda la tabla del manifiesto: el shader
    // indexa por índice global y no sabe de subconjuntos.
    const colores = datos.partes.map((p) => {
      const grupo = fuente.grupos[fuente.grupoDe(p)];
      return aRgb(grupo?.color || "#B4C6C4");
    });

    // El grafo FMA y el índice de búsqueda se arman una vez. Recorrer 3.432
    // conceptos en cada clic, o normalizar 2.234 nombres en cada tecla, se
    // nota en un móvil.
    const grafo = crearIndice(datos.manifiesto);
    const busqueda = crearIndiceDeBusqueda(propias, datos.partes, datos.nombres);

    return { propias, enfoque, conteos, colores, grafo, busqueda };
  }, [datos, fuente]);

  /* ----------------------------------------------------------- estado de la UI */
  const [gruposActivos, setGruposActivos] = useState(() => new Set(fuente.visiblesAlInicio));
  const [ocultas, setOcultas] = useState(() => new Set());
  const [seleccion, setSeleccion] = useState(null);
  const [senalado, setSenalado] = useState(null);
  const [aislado, setAislado] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [atajoActivo, setAtajoActivo] = useState(fuente.atajos ? "todas" : null);

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
    if (!modelo) return set;

    // Aislar es una capa encima, no una modificación: cuando se quita, los
    // sistemas y las ocultas siguen exactamente como estaban.
    if (aislado && seleccion != null) {
      set.add(seleccion);
      return set;
    }

    for (const p of modelo.propias) {
      const i = p.indiceGlobal;
      if (!gruposActivos.has(fuente.grupoDe(p))) continue;
      if (ocultas.has(i)) continue;
      set.add(i);
    }
    return set;
  }, [modelo, gruposActivos, ocultas, aislado, seleccion, fuente]);

  /* ------------------------------------------------------------- búsqueda

     Sobre el índice precalculado, que ya lleva el nombre en español, el
     original en inglés y el identificador FMA en una sola cadena.           */
  const resultados = useMemo(() => {
    if (!modelo) return [];
    const q = sinTildes(busqueda.trim());
    if (q.length < 2) return [];

    const salida = [];
    for (const entrada of modelo.busqueda) {
      if (!entrada.texto.includes(q)) continue;
      salida.push({
        indice: entrada.indice,
        nombre: entrada.nombre,
        fma: datos.partes[entrada.indice]?.conceptId || null,
      });
      if (salida.length >= LIMITE_RESULTADOS) break;
    }
    return salida;
  }, [busqueda, modelo, datos]);

  /* ---------------------------------------------------------------- ficha */
  const ficha = useMemo(() => {
    if (!datos || !modelo || seleccion == null) return null;
    return fichaDe(
      seleccion,
      { manifiesto: datos.manifiesto, partes: datos.partes, nombres: datos.nombres, indice: modelo.grafo },
      fuente,
      modelo.enfoque
    );
  }, [datos, modelo, seleccion, fuente]);

  /* ------------------------------------------------------------- acciones */
  const elegir = useCallback((indice, { centrar = false } = {}) => {
    setSeleccion(indice);
    if (indice == null) { setAislado(false); return; }

    if (centrar) visor.current?.enfocar(indice);

    // Al llegar desde la búsqueda o desde una estructura relacionada, la
    // pieza tiene que verse aunque su sistema estuviera apagado o ella misma
    // oculta: si no, la docente la elige y no pasa nada visible.
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

    if (movil) { setPanelGrupos(false); setPanelInfo(true); setHojaMin(true); }
  }, [datos, fuente, movil]);

  /** Desde la búsqueda o desde «relacionadas»: además de elegir, encuadra. */
  const irA = useCallback((indice) => {
    elegir(indice, { centrar: true });
    setBusqueda("");
  }, [elegir]);

  const alternarGrupo = useCallback((clave) => {
    setGruposActivos((previos) => {
      const copia = new Set(previos);
      if (copia.has(clave)) copia.delete(clave); else copia.add(clave);
      return copia;
    });
    setAtajoActivo(null);
    setAislado(false);
  }, []);

  const aplicarAtajo = useCallback((atajo) => {
    setGruposActivos(new Set(atajo.grupos));
    setAtajoActivo(atajo.id);
    setAislado(false);
  }, []);

  const alternarOculta = useCallback(() => {
    if (seleccion == null) return;
    setOcultas((previas) => {
      const copia = new Set(previas);
      if (copia.has(seleccion)) copia.delete(seleccion); else copia.add(seleccion);
      return copia;
    });
    setAislado(false);
  }, [seleccion]);

  const restablecer = useCallback(() => {
    visor.current?.restablecer();
    setOcultas(new Set());
    setAislado(false);
    setGruposActivos(new Set(fuente.visiblesAlInicio));
    setAtajoActivo(fuente.atajos ? "todas" : null);
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
      if (aislado) { setAislado(false); return; }
      if (movil && (panelGrupos || panelInfo)) {
        setPanelGrupos(false); setPanelInfo(false);
        visor.current?.enfocarLienzo();
        return;
      }
      if (seleccion != null) setSeleccion(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [inmersivo, movil, panelGrupos, panelInfo, seleccion, aislado]);

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

  if (!datos || !modelo) {
    return (
      <div className="atlas atlas--cargando">
        <AtlasCargando progreso={progreso} fase={fase} />
      </div>
    );
  }

  const estaOculta = seleccion != null && ocultas.has(seleccion);

  const panelDeSistemas = (
    <AtlasSystemsPanel
      grupos={fuente.grupos}
      conteos={modelo.conteos}
      activos={gruposActivos}
      atajos={fuente.atajos}
      atajoActivo={atajoActivo}
      etiquetaGrupos={fuente.etiquetaGrupos}
      busqueda={busqueda}
      resultados={resultados}
      totalVisible={visibles.size}
      ocultas={ocultas.size}
      minimizado={!movil && gruposMin}
      campoRef={campoBusqueda}
      onBuscar={setBusqueda}
      onAlternar={alternarGrupo}
      onAtajo={aplicarAtajo}
      onTodo={() => { setGruposActivos(new Set(Object.keys(fuente.grupos))); setAtajoActivo("todas"); setAislado(false); }}
      onNada={() => { setGruposActivos(new Set()); setAtajoActivo(null); setAislado(false); }}
      onElegir={irA}
      onRestaurarOcultas={() => setOcultas(new Set())}
      onMinimizar={() => setGruposMin((v) => !v)}
    />
  );

  const panelDeInfo = (
    <AtlasInfoPanel
      ficha={ficha}
      aislado={aislado}
      oculta={estaOculta}
      minimizado={!movil && infoMin}
      onOcultar={alternarOculta}
      onAislar={() => setAislado((v) => !v)}
      onCentrar={() => seleccion != null && visor.current?.enfocar(seleccion)}
      onQuitar={() => { setSeleccion(null); setAislado(false); }}
      onIrA={irA}
      onMinimizar={() => setInfoMin((v) => !v)}
    />
  );

  /* Resumen de la hoja móvil: se ve también plegada, que es el estado en el
     que se abre al tocar una estructura. */
  const resumenMovil = ficha ? (
    <>
      <p className="atlas-resumen__nombre">{ficha.nombre}</p>
      <p className="atlas-resumen__sistema">
        <span className="atlas-ficha__color" style={{ background: ficha.color }} aria-hidden="true" />
        {ficha.sistema}
        {ficha.fdi != null && <span className="atlas-resumen__fdi">FDI {ficha.fdi}</span>}
      </p>
      <div className="atlas-resumen__acciones">
        <button type="button" onClick={() => visor.current?.enfocar(seleccion)}>
          <Crosshair size={18} aria-hidden="true" /> {T.centrar}
        </button>
        <button
          type="button"
          className={aislado ? "is-activo" : ""}
          aria-pressed={aislado}
          onClick={() => setAislado((v) => !v)}
        >
          <Focus size={18} aria-hidden="true" />
          {aislado ? T.dejarDeAislar : T.aislar}
        </button>
        <button type="button" onClick={alternarOculta}>
          {estaOculta
            ? <><Eye size={18} aria-hidden="true" /> {T.mostrar}</>
            : <><EyeOff size={18} aria-hidden="true" /> {T.ocultar}</>}
        </button>
      </div>
    </>
  ) : null;

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
            colores={modelo.colores}
            enfoque={modelo.enfoque}
            visibles={visibles}
            seleccion={seleccion}
            senalado={senalado}
            onSeleccion={elegir}
            onSenalar={setSenalado}
            onFallo={() => setFallo("carga")}
            visorRef={visor}
          />

          {/* Aviso de aislamiento: sin él, alguien que aísla y luego gira el
              modelo puede pensar que se rompió porque «desapareció todo». */}
          {aislado && (
            <div className="atlas__aviso" role="status">
              <span>{T.aislamientoActivo}</span>
              <button type="button" onClick={() => setAislado(false)}>
                <X size={15} aria-hidden="true" /> {T.salirDelAislamiento}
              </button>
            </div>
          )}

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
            resumen={resumenMovil}
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

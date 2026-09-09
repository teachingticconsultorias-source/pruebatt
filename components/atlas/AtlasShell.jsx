import React, {
  useCallback, useEffect, useMemo, useReducer, useRef, useState,
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
import { calcularVisibles, estadoInicial, reducir } from "../../lib/atlas/estado.js";
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

   CINCO PORCIONES DE ESTADO, Y NINGUNA PISA A OTRA
   ------------------------------------------------
   · `seleccion` — qué estructura está resaltada y descrita
   · `aislada`   — qué estructura se ve sola, temporalmente
   · `ocultas`   — piezas que la docente quitó de en medio, una a una
   · `grupos`    — qué sistemas o categorías están encendidos
   · la CÁMARA   — que NO está aquí: vive en el visor, tras una referencia

   Las cuatro primeras las gobierna un reducidor puro (`lib/atlas/estado.js`).
   La cámara queda fuera del estado de React a propósito: cambia sesenta veces
   por segundo mientras se arrastra el ratón, y meterla en `useState` sería
   repintar el árbol en cada fotograma.

   Aislar NO toca grupos ni ocultas: es una capa que se pone y se quita, y por
   eso salir devuelve la vista anterior sin guardar copia. Ocultar una pieza no
   reinicia los sistemas. Y ninguna acción de visibilidad mueve la cámara —era
   el fallo de producción: hacer zoom, tocar un músculo y volver al cuerpo
   completo.
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

  /* ----------------------------------------------------------- estado de la UI

     Las cinco porciones de estado del atlas —selección, aislamiento, ocultas,
     grupos y búsqueda— pasan por un solo reducidor puro
     (`lib/atlas/estado.js`), y la cámara NO está entre ellas: vive en el
     visor, detrás de una referencia. Así ninguna acción de visibilidad puede
     mover la cámara por accidente, que es lo que pasaba en producción.       */
  const [vista, despachar] = useReducer(
    (estado, accion) => reducir(estado, accion, {
      fuente,
      grupoDe: (indice) => {
        const parte = datos?.partes[indice];
        return parte ? fuente.grupoDe(parte) : null;
      },
    }),
    fuente,
    estadoInicial
  );

  const { seleccion, aislada, ocultas, grupos: gruposActivos, busqueda, atajo: atajoActivo } = vista;

  // El resaltado al pasar el ratón va aparte: cambia decenas de veces por
  // segundo y no es estado del atlas, es estado del puntero.
  const [senalado, setSenalado] = useState(null);

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

  /* --------------------------------------------------------- qué está visible

     Derivado, no almacenado. No hay una lista de visibles que mantener en
     sincronía con las otras porciones: de ahí salía el «panel en OFF pero la
     malla encendida».                                                        */
  const visibles = useMemo(
    () => (modelo ? calcularVisibles(modelo.propias, vista, fuente.grupoDe) : new Set()),
    [modelo, vista, fuente]
  );

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

  /* ------------------------------------------------------------- acciones

     Cada acción hace UNA cosa. Las de visibilidad despachan al reducidor y no
     tocan `visor`; las de cámara llaman al visor y no despachan nada. La tabla
     de qué mueve la cámara está en `lib/atlas/estado.js` y hay un test que la
     comprueba.

     SELECCIONAR no lleva ninguna llamada a la cámara. Ésa es la corrección.  */
  const elegir = useCallback((indice) => {
    despachar({ tipo: "SELECCIONAR", indice });
    if (indice != null && movil) { setPanelGrupos(false); setPanelInfo(true); setHojaMin(true); }
  }, [movil]);

  /**
   * Desde la búsqueda o desde «relacionadas».
   *
   * Aquí SÍ se encuadra, y es la única selección que lo hace: la docente ha
   * elegido una estructura de una lista, sin verla, así que llevarla hasta
   * ella es el punto. Un clic en el modelo es otra cosa —ya la está viendo—
   * y por eso no mueve nada.
   */
  const irA = useCallback((indice) => {
    despachar({ tipo: "SELECCIONAR", indice });
    despachar({ tipo: "BUSCAR", texto: "" });
    if (indice != null) visor.current?.enfocar(indice);
    if (movil) { setPanelGrupos(false); setPanelInfo(true); setHojaMin(true); }
  }, [movil]);

  /* ---- visibilidad: nada de esto toca la cámara ----------------------- */
  const alternarGrupo = useCallback((clave) => despachar({ tipo: "ALTERNAR_GRUPO", clave }), []);
  const aplicarAtajo = useCallback((atajo) => despachar({ tipo: "APLICAR_ATAJO", grupos: atajo.grupos, id: atajo.id }), []);
  const alternarOculta = useCallback(() => despachar({ tipo: "ALTERNAR_OCULTA" }), []);
  const alternarAislamiento = useCallback(() => despachar({ tipo: "ALTERNAR_AISLAMIENTO" }), []);
  const quitarSeleccion = useCallback(() => despachar({ tipo: "QUITAR_SELECCION" }), []);
  const restaurarOcultas = useCallback(() => despachar({ tipo: "RESTAURAR_OCULTAS" }), []);
  const buscar = useCallback((texto) => despachar({ tipo: "BUSCAR", texto }), []);

  /**
   * Devuelve la visibilidad al arranque. NO mueve la cámara.
   *
   * Antes «Restablecer» hacía las dos cosas a la vez, y con ello volvía a
   * encender los sistemas que la docente había apagado —incluida la piel— cada
   * vez que quería recuperar el encuadre. Son dos intenciones distintas y
   * ahora son dos botones distintos.
   */
  const restaurarVisibilidad = useCallback(() => despachar({ tipo: "RESTAURAR_VISIBILIDAD" }), []);

  /* ---- cámara: nada de esto toca la visibilidad ----------------------- */
  const restablecerVista = useCallback(() => visor.current?.restablecer(), []);
  const centrarModelo = useCallback(() => visor.current?.centrar(), []);
  const centrarEstructura = useCallback(() => {
    if (seleccion != null) visor.current?.enfocar(seleccion);
  }, [seleccion]);
  const zoom = useCallback((factor) => visor.current?.zoom(factor), []);

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
      if (aislada != null) { despachar({ tipo: "ALTERNAR_AISLAMIENTO" }); return; }
      if (movil && (panelGrupos || panelInfo)) {
        setPanelGrupos(false); setPanelInfo(false);
        visor.current?.enfocarLienzo();
        return;
      }
      if (seleccion != null) despachar({ tipo: "QUITAR_SELECCION" });
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [inmersivo, movil, panelGrupos, panelInfo, seleccion, aislada]);

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
      onBuscar={buscar}
      onAlternar={alternarGrupo}
      onAtajo={aplicarAtajo}
      onTodo={() => despachar({ tipo: "MOSTRAR_TODO" })}
      onNada={() => despachar({ tipo: "OCULTAR_TODO" })}
      onElegir={irA}
      onRestaurarOcultas={restaurarOcultas}
      onRestaurarVisibilidad={restaurarVisibilidad}
      onMinimizar={() => setGruposMin((v) => !v)}
    />
  );

  const panelDeInfo = (
    <AtlasInfoPanel
      ficha={ficha}
      aislado={aislada != null}
      oculta={estaOculta}
      minimizado={!movil && infoMin}
      onOcultar={alternarOculta}
      onAislar={alternarAislamiento}
      onCentrar={centrarEstructura}
      onQuitar={quitarSeleccion}
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
        <button type="button" onClick={centrarEstructura}>
          <Crosshair size={18} aria-hidden="true" /> {T.centrar}
        </button>
        <button
          type="button"
          className={aislada != null ? "is-activo" : ""}
          aria-pressed={aislada != null}
          onClick={alternarAislamiento}
        >
          <Focus size={18} aria-hidden="true" />
          {aislada != null ? T.dejarDeAislar : T.aislar}
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
          {aislada != null && (
            <div className="atlas__aviso" role="status">
              <span>{T.aislamientoActivo}</span>
              <button type="button" onClick={alternarAislamiento}>
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
            onRestablecer={restablecerVista}
            onCentrar={centrarModelo}
            onZoom={zoom}
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

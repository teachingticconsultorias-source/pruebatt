import React from "react";
import { ChevronDown, Eye, EyeOff, RotateCcw, Search, X } from "lucide-react";

import { T } from "../../lib/atlas/i18n.es.js";

/* ==========================================================================
   SISTEMAS (o CATEGORÍAS), ATAJOS Y BÚSQUEDA

   Van juntos porque son la misma pregunta hecha de dos maneras: «enséñame los
   nervios» y «enséñame el nervio nasociliar». Separarlos en dos paneles
   obligaba a cerrar uno para usar el otro justo cuando se usan a la vez.

   La lista de resultados sale sólo cuando hay algo escrito: con 2.234
   estructuras, una lista permanente es un muro que nadie lee.

   La búsqueda entiende las tres formas de nombrar lo mismo —«corazón»,
   «heart» y «FMA7088»— porque el material de consulta que hay fuera de
   SciVerse está casi todo en inglés y con identificador FMA.
   ========================================================================== */
export default function AtlasSystemsPanel({
  grupos,
  conteos,
  activos,
  atajos,
  atajoActivo,
  etiquetaGrupos,
  busqueda,
  resultados,
  totalVisible,
  ocultas,
  minimizado,
  onBuscar,
  onAlternar,
  onAtajo,
  onTodo,
  onNada,
  onElegir,
  onRestaurarOcultas,
  onRestaurarVisibilidad,
  onMinimizar,
  campoRef,
}) {
  const claves = Object.keys(grupos);
  const titulo = etiquetaGrupos === "categorías" ? T.categorias : T.sistemas;
  const buscando = busqueda.trim().length > 0;

  return (
    <section className="atlas-panel atlas-panel--sistemas" aria-label={titulo}>
      <header className="atlas-panel__cabecera">
        <h2>{titulo}</h2>
        <button
          type="button"
          className="atlas-panel__plegar"
          onClick={onMinimizar}
          aria-expanded={!minimizado}
          aria-label={minimizado ? T.maximizar : T.minimizar}
          title={minimizado ? T.maximizar : T.minimizar}
        >
          <ChevronDown size={18} className={minimizado ? "is-plegado" : ""} aria-hidden="true" />
        </button>
      </header>

      {!minimizado && (
        <div className="atlas-panel__cuerpo">
          {/* ------------------------------------------------------ búsqueda */}
          <div className="atlas-buscador">
            <Search size={16} aria-hidden="true" />
            <input
              ref={campoRef}
              type="search"
              value={busqueda}
              onChange={(e) => onBuscar(e.target.value)}
              placeholder={T.buscar}
              aria-label={T.buscar}
              autoComplete="off"
            />
            {buscando && (
              <button type="button" onClick={() => onBuscar("")} aria-label={T.limpiarBusqueda}>
                <X size={15} aria-hidden="true" />
              </button>
            )}
          </div>

          {buscando ? (
            <div className="atlas-resultados">
              <p className="atlas-resultados__cuenta">
                {resultados.length ? T.resultados(resultados.length) : T.sinResultados}
              </p>
              <ul>
                {resultados.map((r) => (
                  <li key={r.indice}>
                    <button type="button" onClick={() => onElegir(r.indice)}>
                      <span className="atlas-resultados__nombre">{r.nombre}</span>
                      {r.fma && <span className="atlas-resultados__fma">{r.fma}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <>
              {/* --------------------------------------------------- atajos */}
              {atajos && (
                <div className="atlas-atajos" role="group" aria-label="Vistas rápidas">
                  {atajos.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      className={atajoActivo === a.id ? "is-activo" : ""}
                      aria-pressed={atajoActivo === a.id}
                      onClick={() => onAtajo(a)}
                    >
                      {a.nombre}
                    </button>
                  ))}
                </div>
              )}

              <div className="atlas-panel__acciones">
                <button type="button" onClick={onTodo}>{T.mostrarTodo}</button>
                <button type="button" onClick={onNada}>{T.ocultarTodo}</button>
              </div>

              <ul className="atlas-sistemas">
                {claves.map((clave) => {
                  const activo = activos.has(clave);
                  const cuenta = conteos[clave] || 0;
                  if (!cuenta) return null;
                  return (
                    <li key={clave}>
                      <button
                        type="button"
                        className={activo ? "is-activo" : ""}
                        onClick={() => onAlternar(clave)}
                        aria-pressed={activo}
                      >
                        {/* El color acompaña, no informa por sí solo: el estado
                            se lee también en el icono y en aria-pressed. */}
                        <span
                          className="atlas-sistemas__color"
                          style={{ background: grupos[clave].color }}
                          aria-hidden="true"
                        />
                        <span className="atlas-sistemas__nombre">{grupos[clave].nombre}</span>
                        <span className="atlas-sistemas__cuenta">{cuenta}</span>
                        {activo
                          ? <Eye size={16} aria-hidden="true" />
                          : <EyeOff size={16} aria-hidden="true" />}
                      </button>
                    </li>
                  );
                })}
              </ul>

              {/* --------------------------------------------- pie de estado

                  El contador es lo que responde a «¿por qué no veo nada?»
                  cuando alguien ha apagado sistemas sin darse cuenta. Y las
                  ocultas se restauran desde aquí SIN tocar los sistemas:
                  esconder una pieza no puede deshacer el resto de la vista. */}
              <footer className="atlas-panel__pie">
                <span>{T.estructurasVisibles(totalVisible)}</span>
                {ocultas > 0 && (
                  <button type="button" onClick={onRestaurarOcultas}>
                    <RotateCcw size={14} aria-hidden="true" />
                    {T.restaurarOcultas} ({ocultas})
                  </button>
                )}
                {/* Devolver la visibilidad al arranque vive AQUÍ y no en la
                    barra de acciones: es una acción de visibilidad, y en la
                    barra se confundía con «Restablecer vista», que sólo mueve
                    la cámara. Volver a encender la piel al recuperar el
                    encuadre era justo el problema. */}
                {onRestaurarVisibilidad && (
                  <button type="button" onClick={onRestaurarVisibilidad}>
                    <RotateCcw size={14} aria-hidden="true" />
                    {T.restaurarVisibilidad}
                  </button>
                )}
              </footer>
            </>
          )}
        </div>
      )}
    </section>
  );
}

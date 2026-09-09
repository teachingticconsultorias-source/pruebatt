import React from "react";
import { ChevronDown, Eye, EyeOff, Search, X } from "lucide-react";

import { T } from "../../lib/atlas/i18n.es.js";

/* ==========================================================================
   SISTEMAS (o CATEGORÍAS) Y BÚSQUEDA

   Van juntos porque son la misma pregunta hecha de dos maneras: «enséñame
   los músculos» y «enséñame el masetero». Separarlos en dos paneles obligaba
   a cerrar uno para usar el otro justo cuando se usan a la vez.

   La lista de resultados sale sólo cuando hay algo escrito. Con 2.234
   estructuras, una lista permanente es un muro que nadie lee.
   ========================================================================== */
export default function AtlasSystemsPanel({
  grupos,
  conteos,
  activos,
  etiquetaGrupos,
  busqueda,
  resultados,
  nombreDe,
  minimizado,
  onBuscar,
  onAlternar,
  onTodo,
  onNada,
  onElegir,
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
                {resultados.map((indice) => (
                  <li key={indice}>
                    <button type="button" onClick={() => onElegir(indice)}>
                      {nombreDe(indice)}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <>
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
                        {/* El color acompaña, no informa por sí solo: el
                            estado se lee también en el icono y en aria-pressed. */}
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
            </>
          )}
        </div>
      )}
    </section>
  );
}

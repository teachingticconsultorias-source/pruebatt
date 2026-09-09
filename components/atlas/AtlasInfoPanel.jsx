import React from "react";
import { ChevronDown, Eye, EyeOff, Focus, X } from "lucide-react";

import { T } from "../../lib/atlas/i18n.es.js";

/* ==========================================================================
   FICHA DE LA ESTRUCTURA SELECCIONADA

   Ocultar y aislar viven aquí y no en la barra de acciones porque las dos
   necesitan una estructura elegida: en la barra estarían apagadas la mayor
   parte del tiempo, que es la forma más rápida de que nadie las descubra.

   El identificador FMA se enseña porque es lo que permite a un docente
   buscar la estructura en cualquier otra fuente. Es dato, no jerga: va con
   su rótulo en español y sin protagonismo.
   ========================================================================== */
export default function AtlasInfoPanel({
  estructura,
  aislado,
  oculta,
  minimizado,
  onOcultar,
  onAislar,
  onQuitar,
  onMinimizar,
}) {
  return (
    <section className="atlas-panel atlas-panel--info" aria-label={T.informacion}>
      <header className="atlas-panel__cabecera">
        <h2>{T.informacion}</h2>
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
          {!estructura ? (
            <p className="atlas-info__vacio">{T.seleccionaEstructura}</p>
          ) : (
            <>
              <h3 className="atlas-info__nombre">{estructura.nombre}</h3>

              <dl className="atlas-info__datos">
                <div>
                  <dt>{T.perteneceA}</dt>
                  <dd>
                    <span
                      className="atlas-info__color"
                      style={{ background: estructura.color }}
                      aria-hidden="true"
                    />
                    {estructura.grupo}
                  </dd>
                </div>
                <div>
                  <dt>{T.identificador}</dt>
                  <dd className="atlas-info__id">{estructura.conceptId || estructura.id}</dd>
                </div>
              </dl>

              <div className="atlas-info__acciones">
                <button type="button" onClick={onOcultar}>
                  {oculta
                    ? <><Eye size={16} aria-hidden="true" /> {T.mostrar}</>
                    : <><EyeOff size={16} aria-hidden="true" /> {T.ocultar}</>}
                </button>
                <button type="button" className={aislado ? "is-activo" : ""} onClick={onAislar} aria-pressed={aislado}>
                  <Focus size={16} aria-hidden="true" />
                  {aislado ? T.dejarDeAislar : T.aislar}
                </button>
                <button type="button" onClick={onQuitar}>
                  <X size={16} aria-hidden="true" /> {T.quitarSeleccion}
                </button>
              </div>
            </>
          )}

          <p className="atlas-info__creditos">
            {T.atribucionTexto}{" "}
            <a href={T.atribucionUrl} target="_blank" rel="noreferrer noopener">
              {T.atribucionEnlace}
            </a>
          </p>
          <p className="atlas-info__aviso">{T.atribucionAviso}</p>
        </div>
      )}
    </section>
  );
}

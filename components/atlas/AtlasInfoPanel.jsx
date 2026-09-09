import React from "react";
import {
  ArrowRight, ChevronDown, Crosshair, Eye, EyeOff, Focus, Info, X,
} from "lucide-react";

import { T } from "../../lib/atlas/i18n.es.js";
import { CREDITOS_TEXTO } from "../../lib/atlas/textos-anatomia.es.js";

/* ==========================================================================
   FICHA DE LA ESTRUCTURA SELECCIONADA

   REGLA DE ORO: NINGUNA SECCIÓN VACÍA
   -----------------------------------
   BodyParts3D no trae descripción por estructura. Sólo seis órganos del pack
   la tienen en una fuente reutilizable, y ninguna estructura tiene un texto
   de «función» propio. Lo que sí existe para casi todas es el grafo de la FMA
   que trae el manifiesto: región, grupos y estructuras hermanas.

   Así que la ficha se arma con lo que hay y calla lo que no. Un apartado
   «Función» vacío, o relleno con una frase genérica, haría creer a la docente
   que el dato existe. Ver `lib/atlas/metadatos.js`.

   POR QUÉ OCULTAR Y AISLAR VIVEN AQUÍ
   -----------------------------------
   Porque las dos necesitan una estructura elegida. En la barra de acciones
   estarían apagadas la mayor parte del tiempo, que es la forma más rápida de
   que nadie las descubra.
   ========================================================================== */

/** Una sección sólo se dibuja si tiene contenido. */
function Bloque({ titulo, children }) {
  if (!children) return null;
  return (
    <section className="atlas-ficha__bloque">
      <h4>{titulo}</h4>
      {children}
    </section>
  );
}

export default function AtlasInfoPanel({
  ficha,
  aislado,
  oculta,
  minimizado,
  onOcultar,
  onAislar,
  onCentrar,
  onQuitar,
  onIrA,
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
          {!ficha ? (
            <p className="atlas-ficha__vacio">
              <Info size={18} aria-hidden="true" />
              {T.seleccionaEstructura}
            </p>
          ) : (
            <div className="atlas-ficha">
              {/* ------------------------------------------------ identidad */}
              <h3 className="atlas-ficha__nombre">{ficha.nombre}</h3>

              <p className="atlas-ficha__sistema">
                <span
                  className="atlas-ficha__color"
                  style={{ background: ficha.color }}
                  aria-hidden="true"
                />
                {ficha.sistema}
              </p>

              {/* Acciones arriba: son lo que más se usa y no deben quedar al
                  final de una ficha larga. */}
              <div className="atlas-ficha__acciones">
                <button type="button" onClick={onCentrar}>
                  <Crosshair size={15} aria-hidden="true" /> {T.centrar}
                </button>
                <button
                  type="button"
                  className={aislado ? "is-activo" : ""}
                  onClick={onAislar}
                  aria-pressed={aislado}
                >
                  <Focus size={15} aria-hidden="true" />
                  {aislado ? T.dejarDeAislar : T.aislar}
                </button>
                <button type="button" onClick={onOcultar}>
                  {oculta
                    ? <><Eye size={15} aria-hidden="true" /> {T.mostrar}</>
                    : <><EyeOff size={15} aria-hidden="true" /> {T.ocultar}</>}
                </button>
                <button type="button" onClick={onQuitar}>
                  <X size={15} aria-hidden="true" /> {T.quitarSeleccion}
                </button>
              </div>

              {oculta && <p className="atlas-ficha__aviso">{T.estaOculta}</p>}

              {/* ------------------------------------------------ datos duros */}
              <dl className="atlas-ficha__datos">
                {ficha.fma && (
                  <div>
                    <dt>{T.identificador}</dt>
                    <dd className="atlas-ficha__id">{ficha.fma}</dd>
                  </div>
                )}
                {ficha.fdi != null && (
                  <div>
                    <dt>{T.numeroFdi}</dt>
                    <dd className="atlas-ficha__id">{ficha.fdi}</dd>
                  </div>
                )}
                {/* El original se enseña siempre: es lo que permite buscar la
                    estructura en cualquier otra fuente, casi toda en inglés. */}
                <div>
                  <dt>{T.nombreOriginal}</dt>
                  <dd className="atlas-ficha__original">
                    {ficha.nombreOriginal}
                    {ficha.sinTraducir && (
                      <span className="atlas-ficha__marca">{T.sinTraduccion}</span>
                    )}
                  </dd>
                </div>
              </dl>

              {ficha.fdi != null && (
                <p className="atlas-ficha__pie">{T.fdiExplicacion}</p>
              )}

              {/* ------------------------------------------------ textos */}
              <Bloque titulo={T.descripcion}>
                {ficha.descripcion ? <p>{ficha.descripcion}</p> : null}
              </Bloque>

              <Bloque titulo={T.funcionDelSistema}>
                {ficha.funcion ? <p>{ficha.funcion}</p> : null}
              </Bloque>

              <Bloque titulo={T.localizacion}>
                {ficha.regiones.length ? (
                  <ol className="atlas-ficha__ruta">
                    {ficha.regiones.map((r) => <li key={r.id}>{r.nombre}</li>)}
                  </ol>
                ) : null}
              </Bloque>

              <Bloque titulo={T.relaciones}>
                {ficha.grupos.length ? (
                  <ul className="atlas-ficha__grupos">
                    {ficha.grupos.map((g) => (
                      <li key={g.id}>
                        {g.nombre}
                        <span>{T.agrupaEstructuras(g.cuantas)}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </Bloque>

              {/* ------------------------------------- estructuras relacionadas */}
              <Bloque titulo={T.relacionadas}>
                {ficha.relacionadas.length ? (
                  <>
                    {ficha.origenRelacion && (
                      <p className="atlas-ficha__origen">
                        {T.segunElGrupo(ficha.origenRelacion.nombre)}
                      </p>
                    )}
                    <ul className="atlas-ficha__relacionadas">
                      {ficha.relacionadas.map((r) => (
                        <li key={r.indice}>
                          <button type="button" onClick={() => onIrA(r.indice)}>
                            <span>{r.nombre}</span>
                            <ArrowRight size={14} aria-hidden="true" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}
              </Bloque>

              {/* ------------------------------------------------ tema OMF */}
              {ficha.tema && (
                <section className="atlas-ficha__tema">
                  <h4>{ficha.tema.titulo}</h4>
                  <p className="atlas-ficha__temasub">{ficha.tema.subtitulo}</p>
                  <p>{ficha.tema.resumen}</p>
                  <p className="atlas-ficha__aula">{ficha.tema.paraElAula}</p>
                  {ficha.tema.limite && (
                    <p className="atlas-ficha__limite">
                      <strong>{T.notaDelTema}:</strong> {ficha.tema.limite}
                    </p>
                  )}
                  <a href={ficha.tema.fuente.url} target="_blank" rel="noreferrer noopener">
                    {ficha.tema.fuente.titulo}
                  </a>
                </section>
              )}

              {/* ------------------------------------------ nota de SciVerse */}
              {ficha.notaDocente && (
                <section className="atlas-ficha__docente">
                  <h4>{T.importanciaEducativa}</h4>
                  <p>{ficha.notaDocente}</p>
                </section>
              )}
            </div>
          )}

          {/* --------------------------------------------------- créditos --

              Van al final y siempre, con selección o sin ella. La licencia
              CC BY 4.0 obliga a conservar la atribución, y las traducciones
              vienen de dos proyectos MIT que hay que nombrar.              */}
          <footer className="atlas-ficha__creditos">
            <p>
              {T.atribucionTexto}{" "}
              <a href={T.atribucionUrl} target="_blank" rel="noreferrer noopener">
                {T.atribucionEnlace}
              </a>
            </p>
            <p>
              {CREDITOS_TEXTO.sistemas.texto} ({CREDITOS_TEXTO.sistemas.licencia},{" "}
              {CREDITOS_TEXTO.sistemas.autor}) · {CREDITOS_TEXTO.temas.texto} (
              {CREDITOS_TEXTO.temas.licencia}, {CREDITOS_TEXTO.temas.autor}).
            </p>
            <p className="atlas-ficha__disclaimer">{T.atribucionAviso}</p>
          </footer>
        </div>
      )}
    </section>
  );
}

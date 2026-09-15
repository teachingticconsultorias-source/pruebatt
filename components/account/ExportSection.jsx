import React, { useEffect, useState } from "react";
import { Check, Download, FileText, Image as ImageIcon, Loader2, Lock, Palette, Trash2, Upload } from "lucide-react";

import Button from "../ui/Button.jsx";
import { useMarcaExport } from "../../lib/export/useMarcaExport.js";
import { MODOS, POSICIONES, explicarModo } from "../../lib/export/marca.js";
import { MARCADORES } from "../../lib/export/plantilla.js";

/* ==========================================================================
   PERSONALIZAR EXPORT

   Tres tarjetas, de menos a más específica. La docente elige una y esa manda
   sobre todas sus descargas de Word.

   EL CANDADO NO ES EL GATE
   ------------------------
   La tercera tarjeta se ve siempre, con candado si el plan no la incluye:
   esconderla dejaría a una docente Free sin saber que existe. Pero el candado
   es sólo lo que se VE. Quien impide subir es la política de Storage, que
   consulta `puede_plantilla_propia()` en la base (migración 012). Forzar la
   interfaz no sirve de nada: el objeto no entra.
   ========================================================================== */

const TARJETAS = [
  { modo: "estandar", icono: FileText, titulo: "Formato de SciVerse",
    desc: "El diseño que ya conoces: limpio, alineado al CNEB y listo para imprimir." },
  { modo: "colegio", icono: Palette, titulo: "Formato de mi colegio",
    desc: "El mismo diseño con el logo y los colores de tu institución." },
  { modo: "plantilla", icono: Upload, titulo: "Mi plantilla .docx",
    desc: "Tu propio documento de Word. SciVerse coloca el contenido dentro, en negro y sin colores propios: el diseño lo pone tu plantilla.",
    // Es lo primero que hay que saber de esta tarjeta, no una letra pequeña:
    // quien la elige espera que se aplique a todo, y no es así.
    alcance: "Se aplica a Sesión de aprendizaje y Clase completa. El resto de documentos se descargan con el formato de tu colegio." },
];

const NOMBRE_POSICION = { izquierda: "Izquierda", centro: "Centro", derecha: "Derecha" };

const pesoLegible = (bytes) => bytes
  ? bytes > 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`
  : "";

export default function ExportSection() {
  const {
    marca, cargando, ocupado, error, puedePlantilla,
    elegirModo, guardarEstilo, subirLogo, quitarLogo, subirPlantilla, quitarPlantilla,
  } = useMarcaExport();

  // Borrador local del estilo: los colores se escriben y se guardan a la vez,
  // no en cada tecla.
  const [estilo, setEstilo] = useState({ logoPosicion: "izquierda", colorPrimario: "", colorAcento: "" });
  useEffect(() => {
    setEstilo({
      logoPosicion: marca.logoPosicion,
      colorPrimario: marca.colorPrimario ? `#${marca.colorPrimario}` : "#0B2E4F",
      colorAcento: marca.colorAcento ? `#${marca.colorAcento}` : "#1C74BC",
    });
  }, [marca.logoPosicion, marca.colorPrimario, marca.colorAcento]);

  if (cargando) {
    return (
      <div className="acc__loading" role="status" aria-live="polite">
        <Loader2 size={18} className="sv-spin" aria-hidden="true" /> Cargando tu configuración…
      </div>
    );
  }

  const efectivo = explicarModo(marca, { puedePlantilla });

  return (
    <section className="export-branding">
      <p className="export-branding__intro">
        Elige cómo quieres que se vean los documentos que descargas. El formato de SciVerse y el
        de tu colegio se aplican a todas tus exportaciones: sesiones, instrumentos, fichas y
        materiales. La plantilla propia sólo a la sesión y a la clase completa.
      </p>
      <p className="export-branding__estado" role="status">{efectivo}</p>

      {error && <p className="wizard-error" role="alert">{error}</p>}

      <div className="export-branding__cards">
        {TARJETAS.map(({ modo, icono: Icono, titulo, desc, alcance }) => {
          const bloqueada = modo === "plantilla" && !puedePlantilla;
          const activa = marca.modo === modo;
          return (
            <article key={modo} className={`export-card${activa ? " is-active" : ""}${bloqueada ? " is-locked" : ""}`}>
              <header>
                <span className="export-card__icon" aria-hidden="true">
                  {bloqueada ? <Lock size={18} /> : <Icono size={18} />}
                </span>
                <div>
                  <h4>{titulo}</h4>
                  <p>{desc}</p>
                  {alcance && <p className="export-card__alcance">{alcance}</p>}
                </div>
                {activa && <span className="export-card__badge"><Check size={13} aria-hidden="true" /> En uso</span>}
              </header>

              {bloqueada ? (
                <p className="export-card__lock">
                  Disponible con el plan Pro. Tu plan actual puede usar el formato de SciVerse y el de tu colegio.
                </p>
              ) : (
                <Button
                  variant={activa ? "secondary" : "primary"}
                  size="sm"
                  disabled={activa || ocupado === "modo"}
                  loading={ocupado === "modo" && !activa}
                  onClick={() => elegirModo(modo)}
                >
                  {activa ? "Formato en uso" : "Usar este formato"}
                </Button>
              )}

              {/* ---------------------------------------- MODO SIMPLE */}
              {modo === "colegio" && !bloqueada && (
                <div className="export-card__body">
                  <div className="export-field">
                    <span className="export-field__label">Logo del colegio</span>
                    {marca.logoPath ? (
                      <div className="export-file">
                        <ImageIcon size={16} aria-hidden="true" />
                        <span>Logo cargado{marca.logoBytes ? ` · ${pesoLegible(marca.logoBytes)}` : ""}</span>
                        <button type="button" onClick={quitarLogo} disabled={ocupado === "logo"} aria-label="Quitar el logo">
                          {ocupado === "logo" ? <Loader2 size={14} className="sv-spin" /> : <Trash2 size={14} />}
                        </button>
                      </div>
                    ) : (
                      <label className="export-upload">
                        <input type="file" accept="image/png,image/jpeg,image/webp"
                          onChange={(e) => e.target.files?.[0] && subirLogo(e.target.files[0])} />
                        <Upload size={15} aria-hidden="true" /> Subir logo
                      </label>
                    )}
                    <small className="field-help">PNG, JPG o WEBP. Máximo 1 MB.</small>
                  </div>

                  <div className="export-field">
                    <span className="export-field__label">Posición del logo</span>
                    <div className="export-choices" role="radiogroup" aria-label="Posición del logo">
                      {POSICIONES.map((posicion) => (
                        <button key={posicion} type="button" role="radio"
                          aria-checked={estilo.logoPosicion === posicion}
                          className={estilo.logoPosicion === posicion ? "is-active" : ""}
                          onClick={() => setEstilo((e) => ({ ...e, logoPosicion: posicion }))}>
                          {NOMBRE_POSICION[posicion]}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="export-field export-field--colores">
                    <label>
                      <span className="export-field__label">Color principal</span>
                      <input type="color" value={estilo.colorPrimario}
                        onChange={(e) => setEstilo((s) => ({ ...s, colorPrimario: e.target.value }))} />
                    </label>
                    <label>
                      <span className="export-field__label">Color de acento</span>
                      <input type="color" value={estilo.colorAcento}
                        onChange={(e) => setEstilo((s) => ({ ...s, colorAcento: e.target.value }))} />
                    </label>
                  </div>

                  <Button size="sm" variant="secondary" loading={ocupado === "modo"}
                    onClick={() => guardarEstilo(estilo)}>
                    Guardar logo y colores
                  </Button>
                </div>
              )}

              {/* ------------------------------------- MODO AVANZADO */}
              {modo === "plantilla" && !bloqueada && (
                <div className="export-card__body">
                  {marca.plantillaPath ? (
                    <>
                      <div className="export-file">
                        <FileText size={16} aria-hidden="true" />
                        <span>{marca.plantillaNombre || "plantilla.docx"}</span>
                        <button type="button" onClick={quitarPlantilla} disabled={ocupado === "plantilla"}
                          aria-label="Quitar la plantilla">
                          {ocupado === "plantilla" ? <Loader2 size={14} className="sv-spin" /> : <Trash2 size={14} />}
                        </button>
                      </div>
                      {/* No hay vista previa de un .docx sin una dependencia
                          pesada, y con plantillas de colegio sería poco fiel.
                          Se enseña lo que de verdad decide si funcionará: qué
                          marcas encontró SciVerse dentro. */}
                      <details className="export-marcadores">
                        <summary>{marca.plantillaMarcadores.length} marcas reconocidas</summary>
                        <ul>
                          {MARCADORES.map((m) => (
                            <li key={m.clave} className={marca.plantillaMarcadores.includes(m.clave) ? "is-ok" : ""}>
                              {marca.plantillaMarcadores.includes(m.clave) ? <Check size={12} aria-hidden="true" /> : <span aria-hidden="true">·</span>}
                              <code>{`{{${m.clave}}}`}</code> {m.etiqueta}
                            </li>
                          ))}
                        </ul>
                      </details>
                      <label className="export-upload">
                        <input type="file" accept=".docx"
                          onChange={(e) => e.target.files?.[0] && subirPlantilla(e.target.files[0])} />
                        <Upload size={15} aria-hidden="true" /> Reemplazar plantilla
                      </label>
                    </>
                  ) : (
                    <>
                      <p className="export-card__ayuda">
                        Descarga la plantilla base, ponle el membrete y los estilos de tu colegio sin
                        borrar las marcas <code>{"{{...}}"}</code>, y súbela aquí.
                      </p>
                      <Button as="a" size="sm" variant="secondary" icon={Download}
                        href="/plantillas/plantilla-base-sciverse.docx" download>
                        Descargar plantilla base
                      </Button>
                      <label className="export-upload">
                        <input type="file" accept=".docx"
                          onChange={(e) => e.target.files?.[0] && subirPlantilla(e.target.files[0])} />
                        {ocupado === "plantilla"
                          ? <><Loader2 size={15} className="sv-spin" aria-hidden="true" /> Revisando tu plantilla…</>
                          : <><Upload size={15} aria-hidden="true" /> Subir mi plantilla .docx</>}
                      </label>
                      <small className="field-help">Word (.docx). Máximo 5 MB.</small>
                    </>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>

      <p className="export-branding__nota">
        Tu plantilla recibe la sesión y la clase completa, que son los documentos cuyo contenido
        encaja en sus marcas. Un proyecto STEAM o una rúbrica tienen otra estructura: se descargan
        con el logo y los colores de tu colegio sobre el formato de SciVerse.
      </p>
      <p className="export-branding__nota">
        Dentro de tu plantilla, el contenido va en texto negro con tablas de borde simple y sin
        fondos de color. No lleva los colores de SciVerse ni los que hayas elegido más arriba: toda la
        identidad visual la pone tu documento, que para eso es tuyo.
      </p>
      <p className="export-branding__nota">
        Y si tu plantilla deja de estar disponible, tus documentos se seguirán descargando con el
        formato de tu colegio o el de SciVerse. Nunca te quedas sin poder exportar.
      </p>
    </section>
  );
}

export { MODOS };

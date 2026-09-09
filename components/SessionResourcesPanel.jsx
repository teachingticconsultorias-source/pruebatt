// components/SessionResourcesPanel.jsx
import React, { useMemo, useState } from "react";
import {
  FileText,
  ClipboardCheck,
  ListChecks,
  Gauge,
  Sparkles,
  Eye,
  Download,
  X,
  Loader2,
  CheckCircle2
} from "lucide-react";
import { downloadResource as downloadResourceWord } from "../lib/docx/exporters.js";
import { supabase } from "../supabaseClient.js";
import "../session-resources.css";

const resourceMeta = {
  worksheet: {
    label: "Ficha de aprendizaje",
    description: "Una ficha lista para trabajar directamente con tus estudiantes.",
    icon: FileText,
    materialType: "worksheet"
  },
  rubric: {
    label: "Rúbrica",
    description: "Criterios y descriptores progresivos AD, A, B y C.",
    icon: ClipboardCheck,
    materialType: "rubric"
  },
  checklist: {
    label: "Lista de cotejo",
    description: "Criterios observables con Sí, No y Observaciones.",
    icon: ListChecks,
    materialType: "checklist"
  },
  rating_scale: {
    label: "Escala de valoración",
    description: "Valora el desempeño por frecuencia o nivel de logro.",
    icon: Gauge,
    materialType: "rating_scale"
  }
};

function PreviewContent({ type, resource }) {
  if (!resource) return null;

  if (type === "worksheet") {
    return (
      <div className="sr-preview-sheet">
        <span className="sr-preview-kicker">{resource.tipoFicha}</span>
        <h2>{resource.titulo}</h2>
        <p className="sr-preview-purpose">{resource.proposito}</p>

        {(resource.secciones || []).map((section, index) => (
          <section key={`${section.titulo}-${index}`}>
            <h3>{index + 1}. {section.titulo}</h3>
            <p>{section.indicacion}</p>
            {(section.items || []).map((item, itemIndex) => (
              <div className="sr-preview-item" key={itemIndex}>
                {item.texto && <strong>{item.texto}</strong>}
                {(item.opciones || []).length > 0 && (
                  <ul>
                    {item.opciones.map((option, optionIndex) => (
                      <li key={optionIndex}>{option}</li>
                    ))}
                  </ul>
                )}
                {(item.tipo === "pregunta" ||
                  item.tipo === "respuesta_larga") && (
                  <div className="sr-answer-lines">
                    <span />
                    <span />
                    {item.tipo === "respuesta_larga" && <span />}
                  </div>
                )}
                {item.tipo === "tabla" && (item.columnas || []).length > 0 && (
                  <div className="sr-mini-table">
                    <div className="sr-mini-row sr-mini-head">
                      {item.columnas.map((col, colIndex) => (
                        <span key={colIndex}>{col}</span>
                      ))}
                    </div>
                    {(item.filas || [[], [], []]).map((row, rowIndex) => (
                      <div className="sr-mini-row" key={rowIndex}>
                        {item.columnas.map((_, colIndex) => (
                          <span key={colIndex}>{row?.[colIndex] || ""}</span>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </section>
        ))}
      </div>
    );
  }

  const levels =
    type === "rubric"
      ? ["AD", "A", "B", "C"]
      : type === "checklist"
        ? ["Sí", "No", "Observaciones"]
        : resource.niveles || [];

  return (
    <div className="sr-preview-sheet sr-preview-sheet--wide">
      <h2>{resource.titulo}</h2>
      <p><strong>Evidencia:</strong> {resource.evidencia}</p>

      <div className="sr-preview-table">
        <div
          className="sr-preview-tr sr-preview-th"
          style={{
            gridTemplateColumns: `minmax(240px, 2fr) repeat(${levels.length}, minmax(90px, 1fr))`
          }}
        >
          <span>Criterio</span>
          {levels.map(level => <span key={level}>{level}</span>)}
        </div>

        {(resource.criterios || []).map((item, index) => (
          <div
            className="sr-preview-tr"
            key={index}
            style={{
              gridTemplateColumns: `minmax(240px, 2fr) repeat(${levels.length}, minmax(90px, 1fr))`
            }}
          >
            <span>{item.criterio}</span>

            {type === "rubric" ? (
              <>
                <span>{item.destacado}</span>
                <span>{item.esperado}</span>
                <span>{item.proceso}</span>
                <span>{item.inicio}</span>
              </>
            ) : (
              levels.map(level => (
                <span className="sr-mark-cell" key={level}>○</span>
              ))
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SessionResourcesPanel({
  session,
  form = {},
  profile = {},
  onCreditsChange,
  onUpgrade
}) {
  // Clave estable del intento: dos clics comparten la misma.
  const claveOp = useClaveDeOperacion("recurso");
  const [generated, setGenerated] = useState({});
  const [loadingType, setLoadingType] = useState("");
  const [error, setError] = useState("");
  const [previewType, setPreviewType] = useState("");
  const [numberCriteria, setNumberCriteria] = useState(4);
  const [scaleType, setScaleType] = useState("logro");

  const hasSession = useMemo(
    () => Boolean(session && Object.keys(session).length),
    [session]
  );

  if (!hasSession) return null;

  async function saveMaterial(type, resource) {
    if (!supabase) return;

    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) return;

    const meta = resourceMeta[type];

    const { error: saveError } = await supabase
      .from("materiales_docente")
      .insert({
        user_id: user.id,
        tipo: meta.materialType,
        titulo: resource.titulo || meta.label,
        nivel: form.nivel || null,
        grado: form.grado || null,
        area: form.area || null,
        tema: form.tema || session?.titulo || null,
        contenido: {
          resourceType: type,
          resource,
          sourceSessionTitle: session?.titulo || form.tema || ""
        }
      });

    if (saveError) {
      console.error("No se pudo guardar el recurso:", saveError);
      throw new Error(
        "El recurso se generó, pero no se pudo guardar en Mis creaciones."
      );
    }

    window.dispatchEvent(
      new CustomEvent("sciverse:material-created", {
        detail: { type }
      })
    );
  }

  async function generate(type) {
    setError("");
    setLoadingType(type);

    try {
      if (!supabase) {
        throw new Error("Supabase no está configurado.");
      }

      const {
        data: { session: authSession }
      } = await supabase.auth.getSession();

      if (!authSession?.access_token) {
        throw new Error("Inicia sesión para generar el recurso.");
      }

      const response = await fetch("/api/generate-session-resource", {
        method: "POST",
        headers: cabecerasDeGeneracion(authSession.access_token, claveOp.obtener()),
        body: JSON.stringify({
          type,
          session,
          form,
          profile,
          options: {
            numeroCriterios: numberCriteria,
            scaleType
          }
        })
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 429 && onUpgrade) {
          onUpgrade();
        }
        throw new Error(mensajeDeRespuesta(data, "No se pudo generar el recurso."));
      }

      // El intento termino: la proxima generacion sera otra operacion.
      claveOp.renovar();

      setGenerated(current => ({
        ...current,
        [type]: data.resource
      }));

      await saveMaterial(type, data.resource);

      window.dispatchEvent(
        new CustomEvent("sciverse:credit-used", {
          detail: data._credits
        })
      );

      if (onCreditsChange) onCreditsChange(data._credits);
      setPreviewType(type);
    } catch (err) {
      setError(err?.message || "No se pudo generar el recurso.");
    } finally {
      setLoadingType("");
    }
  }

  return (
    <section className="session-resources">
      <div className="sr-heading">
        <div>
          <span className="sr-eyebrow">
            <Sparkles size={15} />
            Recursos de tu sesión
          </span>
          <h2>Crea los materiales que usarás con tus estudiantes</h2>
          <p>
            SciVerse toma la información de la sesión que acabas de generar
            para crear recursos coherentes y listos para descargar.
          </p>
        </div>

        <span className="sr-credit-note">
          Cada generación usa 1 crédito
        </span>
      </div>

      <div className="sr-options">
        <label>
          Criterios de evaluación
          <select
            value={numberCriteria}
            onChange={event => setNumberCriteria(Number(event.target.value))}
          >
            {[3, 4, 5, 6, 7, 8].map(value => (
              <option value={value} key={value}>
                {value}
              </option>
            ))}
          </select>
        </label>

        <label>
          Escala de valoración
          <select
            value={scaleType}
            onChange={event => setScaleType(event.target.value)}
          >
            <option value="logro">Nivel de logro</option>
            <option value="frecuencia">Frecuencia</option>
          </select>
        </label>
      </div>

      {error && <div className="sr-error">{error}</div>}

      <div className="sr-grid">
        {Object.entries(resourceMeta).map(([type, meta]) => {
          const Icon = meta.icon;
          const resource = generated[type];
          const loading = loadingType === type;

          return (
            <article className="sr-card" key={type}>
              <div className="sr-icon">
                <Icon size={23} />
              </div>

              <div className="sr-card-body">
                <div className="sr-title-row">
                  <h3>{meta.label}</h3>
                  {resource && (
                    <span className="sr-created">
                      <CheckCircle2 size={14} />
                      Creado
                    </span>
                  )}
                </div>

                <p>{meta.description}</p>
              </div>

              {!resource ? (
                <button
                  className="sr-primary"
                  type="button"
                  disabled={Boolean(loadingType)}
                  onClick={() => generate(type)}
                >
                  {loading ? (
                    <>
                      <Loader2 className="sr-spin" size={17} />
                      Creando...
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} />
                      Crear {meta.label.toLowerCase()}
                    </>
                  )}
                </button>
              ) : (
                <div className="sr-actions">
                  <button
                    type="button"
                    onClick={() => setPreviewType(type)}
                  >
                    <Eye size={16} />
                    Vista previa
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      downloadResourceWord(type, resource, form, profile)
                    }
                  >
                    <Download size={16} />
                    Word
                  </button>

                  <button
                    className="sr-regenerate"
                    type="button"
                    disabled={Boolean(loadingType)}
                    onClick={() => generate(type)}
                    title="Generar una nueva versión usa 1 crédito"
                  >
                    <Sparkles size={15} />
                    Nueva versión
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </div>

      {previewType && generated[previewType] && (
        <div
          className="sr-modal-backdrop"
          onMouseDown={event => {
            if (event.target === event.currentTarget) setPreviewType("");
          }}
        >
          <div className="sr-modal">
            <div className="sr-modal-head">
              <div>
                <span>Vista previa</span>
                <h3>{resourceMeta[previewType].label}</h3>
              </div>

              <button type="button" onClick={() => setPreviewType("")}>
                <X size={20} />
              </button>
            </div>

            <div className="sr-modal-content">
              <PreviewContent
                type={previewType}
                resource={generated[previewType]}
              />
            </div>

            <div className="sr-modal-footer">
              <button
                type="button"
                className="sr-download"
                onClick={() =>
                  downloadResourceWord(
                    previewType,
                    generated[previewType],
                    form,
                    profile
                  )
                }
              >
                <Download size={17} />
                Descargar Word
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

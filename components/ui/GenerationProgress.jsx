import React from "react";
import { Check, Loader2 } from "lucide-react";

/**
 * Progreso de generación con IA.
 *
 * Antes: un spinner genérico durante 60-120 segundos, sin contexto.
 *
 * Los pasos son REALES: el generador de sesión encadena 4 módulos y ya
 * informa cuál está activo y cuáles terminó. NO se inventan porcentajes ni
 * tiempos exactos — solo se refleja lo que el backend confirma.
 *
 * @param {string[]} steps          claves de los pasos, en orden
 * @param {Record<string,string>} labels  etiqueta legible por paso
 * @param {string|null} active      paso en curso
 * @param {string[]} completed      pasos terminados
 * @param {string} [tip]            consejo pedagógico mostrado durante la espera
 */
export default function GenerationProgress({
  steps = [],
  labels = {},
  active = null,
  completed = [],
  title = "Kantu está creando tu recurso",
  subtitle = "Esto suele tomar entre uno y dos minutos. Puedes quedarte en esta pantalla.",
  tip,
}) {
  const doneCount = completed.length;

  return (
    <section className="sv-genprog" role="status" aria-live="polite">
      <div className="sv-genprog__head">
        <span className="sv-genprog__avatar">
          <img src="/mascot/kantu-session.webp" alt="" loading="lazy" />
        </span>
        <div>
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>
      </div>

      <ol className="sv-genprog__steps">
        {steps.map((step) => {
          const isDone = completed.includes(step);
          const isActive = active === step;
          const state = isDone ? "done" : isActive ? "active" : "pending";
          return (
            <li key={step} className={`sv-genprog__step is-${state}`}>
              <span className="sv-genprog__bullet" aria-hidden="true">
                {isDone ? <Check size={13} /> : isActive ? <Loader2 size={13} className="sv-spin" /> : null}
              </span>
              <span className="sv-genprog__label">{labels[step] || step}</span>
            </li>
          );
        })}
      </ol>

      <div className="sv-genprog__track" aria-hidden="true">
        <i style={{ width: `${(doneCount / Math.max(steps.length, 1)) * 100}%` }} />
      </div>
      <p className="sv-genprog__count">
        {doneCount} de {steps.length} listos
      </p>

      {tip && (
        <p className="sv-genprog__tip">
          <strong>Mientras tanto:</strong> {tip}
        </p>
      )}
    </section>
  );
}

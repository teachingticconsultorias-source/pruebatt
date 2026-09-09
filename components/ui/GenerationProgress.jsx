import React from "react";
import { AlertTriangle, Check, Loader2 } from "lucide-react";

/**
 * Progreso de generación con IA.
 *
 * Antes: un spinner genérico durante 60-120 segundos, sin contexto.
 *
 * Los pasos son REALES: el generador de sesión encadena 4 módulos y ya
 * informa cuál está activo, cuáles terminó y cuál falló. NO se inventan
 * porcentajes ni tiempos exactos — solo se refleja lo que el backend confirma.
 *
 * CUATRO ESTADOS, NO DOS
 * ----------------------
 * Se añadió `fallido` porque «pendiente» y «fallido» no son lo mismo para
 * quien mira la pantalla: uno se resuelve esperando y el otro pidiendo el
 * reintento. Con un solo estado de «no listo», una docente cuya secuencia se
 * truncó veía exactamente lo mismo que si aún estuviera generándose.
 *
 * El componente no sabe qué es un módulo: recibe la lista ya resuelta por
 * `lib/sesion/modulos.js`, que es donde vive esa regla.
 *
 * @param {{clave:string, etiqueta:string, estado:"completed"|"processing"|"failed"|"pending"}[]} pasos
 * @param {string} [resumen]  «1 de 4 partes listas»
 * @param {string} [aviso]    mensaje para la docente cuando algo no terminó
 * @param {React.ReactNode} [accion]  botón de reintento, si procede
 * @param {string} [tip]      consejo pedagógico mostrado durante la espera
 */
export default function GenerationProgress({
  pasos = [],
  resumen = "",
  eyebrow = "",
  title = "Kantu está creando tu recurso",
  subtitle = "Esto suele tomar entre uno y dos minutos. Puedes quedarte en esta pantalla.",
  aviso = null,
  accion = null,
  tip,
}) {
  const listos = pasos.filter((paso) => paso.estado === "completed").length;

  const ICONO = {
    completed: <Check size={13} />,
    processing: <Loader2 size={13} className="sv-spin" />,
    failed: <AlertTriangle size={13} />,
    pending: null,
  };
  const PALABRA = {
    completed: "Listo",
    processing: "En proceso",
    failed: "No se completó",
    pending: "Pendiente",
  };

  return (
    <section className="sv-genprog" role="status" aria-live="polite">
      <div className="sv-genprog__head">
        <span className="sv-genprog__avatar">
          <img src="/mascot/kantu-session.webp" alt="" loading="lazy" />
        </span>
        <div>
          {eyebrow && <p className="sv-genprog__eyebrow">{eyebrow}</p>}
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>
      </div>

      <ol className="sv-genprog__steps">
        {pasos.map((paso) => (
          <li key={paso.clave} className={`sv-genprog__step is-${paso.estado}`}>
            <span className="sv-genprog__bullet" aria-hidden="true">
              {ICONO[paso.estado] || null}
            </span>
            <span className="sv-genprog__label">{paso.etiqueta}</span>
            <span className="sr-only">{PALABRA[paso.estado] || ""}</span>
          </li>
        ))}
      </ol>

      <div className="sv-genprog__track" aria-hidden="true">
        <i style={{ width: `${(listos / Math.max(pasos.length, 1)) * 100}%` }} />
      </div>
      <p className="sv-genprog__count">{resumen || `${listos} de ${pasos.length} partes listas`}</p>

      {aviso && (
        <div className="sv-genprog__aviso">
          <p>{aviso}</p>
          {accion}
        </div>
      )}

      {tip && (
        <p className="sv-genprog__tip">
          <strong>Mientras tanto:</strong> {tip}
        </p>
      )}
    </section>
  );
}

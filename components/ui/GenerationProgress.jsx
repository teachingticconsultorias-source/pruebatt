import React, { useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, Loader2 } from "lucide-react";

import { esperaSegun } from "../../lib/mensajes.js";

/* ==========================================================================
   PROGRESO DE GENERACIÓN

   EL DEFECTO QUE ESTO CORRIGE
   ---------------------------
   Cada módulo se pintaba como una lista con el nombre y, debajo, el estado:

       Alineación curricular
       En proceso
       Secuencia didáctica
       Pendiente

   Cuatro módulos producían ocho renglones desalineados y era imposible leer
   de un vistazo por dónde iba. Ahora cada módulo es UNA fila de tres
   columnas —icono · nombre · estado— con el estado siempre pegado a la
   derecha, en una rejilla de anchos fijos que no depende del largo del
   nombre. Si el nombre no cabe, salta de línea y el estado no se mueve.

   LO QUE NO SE INVENTA
   --------------------
   La barra avanza por MÓDULOS TERMINADOS: 0, 25, 50, 75, 100. No hay
   porcentaje animado que suba solo mientras el servidor no ha contestado; eso
   es mentirle a quien está esperando. Y el aviso de espera no cancela nada:
   sólo cambia el texto para que la pantalla no parezca colgada.
   ========================================================================== */

const ICONO = {
  completed: <Check size={14} />,
  processing: <Loader2 size={14} className="sv-spin" />,
  failed: <AlertTriangle size={14} />,
  pending: null,
};
const PALABRA = {
  completed: "Listo",
  processing: "Preparando",
  failed: "Necesita reintento",
  pending: "Pendiente",
};

/**
 * @param {{clave:string, etiqueta:string, estado:"completed"|"processing"|"failed"|"pending"}[]} pasos
 * @param {string} [resumen]   «2 de 4 partes listas»
 * @param {string} [eyebrow]   «Paso 1 de 3 · Sesión»
 * @param {string} [aviso]     mensaje cuando algo no terminó
 * @param {React.ReactNode} [accion]  botón de reintento
 * @param {boolean} [activo]   hay una operación en curso: cuenta el tiempo
 */
export default function GenerationProgress({
  pasos = [],
  resumen = "",
  eyebrow = "",
  title = "Kantu está preparando tu recurso",
  subtitle = "Esto puede tomar entre uno y dos minutos. Puedes permanecer en esta pantalla.",
  aviso = null,
  accion = null,
  activo = false,
  tip,
}) {
  const listos = pasos.filter((paso) => paso.estado === "completed").length;
  const porcentaje = pasos.length ? Math.round((listos / pasos.length) * 100) : 0;

  // Reloj de espera. Se reinicia en cada operación y se detiene al terminar,
  // para no dejar un intervalo vivo en una pantalla que ya nadie mira.
  const [espera, setEspera] = useState(0);
  const inicio = useRef(0);
  useEffect(() => {
    if (!activo) { setEspera(0); return undefined; }
    inicio.current = Date.now();
    const reloj = window.setInterval(() => setEspera(Date.now() - inicio.current), 1000);
    return () => window.clearInterval(reloj);
  }, [activo]);

  return (
    <section className="sv-genprog" role="status" aria-live="polite" aria-busy={activo || undefined}>
      <header className="sv-genprog__head">
        <span className="sv-genprog__avatar" aria-hidden="true">
          <img src="/mascot/kantu-session.webp" alt="" loading="lazy" />
        </span>
        {eyebrow && <p className="sv-genprog__eyebrow">{eyebrow}</p>}
        <h3>{title}</h3>
        <p className="sv-genprog__sub">{subtitle}</p>
      </header>

      <ol className="sv-genprog__steps">
        {pasos.map((paso) => (
          <li key={paso.clave} className={`sv-genprog__step is-${paso.estado}`}>
            <span className="sv-genprog__bullet" aria-hidden="true">{ICONO[paso.estado] || null}</span>
            <span className="sv-genprog__label">{paso.etiqueta}</span>
            {/* El estado es texto, no sólo un color ni sólo un spinner: con
                lector de pantalla o con daltonismo el icono no basta. */}
            <span className="sv-genprog__state">{PALABRA[paso.estado] || ""}</span>
          </li>
        ))}
      </ol>

      <div className="sv-genprog__bar">
        <div
          className="sv-genprog__track"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={pasos.length}
          aria-valuenow={listos}
          aria-label="Partes generadas"
        >
          <i style={{ width: `${porcentaje}%` }} />
        </div>
        <p className="sv-genprog__count">{resumen || `${listos} de ${pasos.length} partes listas`}</p>
      </div>

      {activo && espera >= 15000 && (
        <p className="sv-genprog__espera">{esperaSegun(espera)}</p>
      )}

      {aviso && (
        <div className="sv-genprog__aviso" role="alert">
          <p>{aviso}</p>
          {accion}
        </div>
      )}

      {tip && !aviso && (
        <p className="sv-genprog__tip">
          <strong>Mientras tanto:</strong> {tip}
        </p>
      )}
    </section>
  );
}

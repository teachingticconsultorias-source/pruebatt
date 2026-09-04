import React, { useEffect, useState } from "react";

/**
 * Pantalla de bienvenida.
 *
 * No introduce ningún retardo artificial: se muestra solo mientras la
 * aplicación resuelve la sesión de Supabase y desaparece con un fundido
 * corto en cuanto está lista.
 */
export default function Splash({ message = "Preparando tu espacio docente…", done = false }) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (!done) return undefined;
    // Espera solo a que termine el fundido de salida.
    const timer = window.setTimeout(() => setHidden(true), 320);
    return () => window.clearTimeout(timer);
  }, [done]);

  if (hidden) return null;

  return (
    <div className={`sv-splash${done ? " is-leaving" : ""}`} role="status" aria-live="polite">
      <div className="sv-splash__mark">
        <img src="/brand/isotipo.svg" alt="" width="72" height="72" />
        <span className="sv-splash__pulse" aria-hidden="true" />
      </div>
      <strong className="sv-splash__word">SciVerse</strong>
      <p className="sv-splash__msg">{message}</p>
      <div className="sv-splash__bar" aria-hidden="true"><i /></div>
    </div>
  );
}

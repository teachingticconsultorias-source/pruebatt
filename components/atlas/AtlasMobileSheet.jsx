import React, { useEffect, useRef } from "react";
import { ChevronDown, X } from "lucide-react";

import { T } from "../../lib/atlas/i18n.es.js";

/* ==========================================================================
   HOJA INFERIOR (MÓVIL)

   POR QUÉ UNA HOJA Y NO UN MODAL
   ------------------------------
   Porque hay que poder seguir moviendo el modelo con la ficha abierta, y un
   modal lo impide por definición: bloquea todo lo de detrás. Aquí no hay
   velo. La hoja ocupa la parte baja, el modelo sigue arriba y se puede girar
   mientras se lee.

   De ahí también que NO lleve `aria-modal` ni atrape el foco: mentiría sobre
   su comportamiento a quien use lector de pantalla. Escape la cierra, el foco
   entra al abrir y vuelve al lienzo al cerrar, que es lo que corresponde a un
   panel no modal.

   MINIMIZADA NO ES CERRADA
   ------------------------
   Al tocar una estructura hay que ver su nombre inmediatamente, sin que la
   ficha entera tape el modelo. Por eso `resumen` se dibuja también cuando la
   hoja está plegada: nombre, categoría y las acciones grandes siguen ahí, y
   el cuerpo largo —descripción, relaciones— se despliega al pedirlo.

   `padding-bottom` sale de `safe-area-inset-bottom`: sin eso, en un iPhone
   los botones quedan bajo la barra de gestos.
   ========================================================================== */
export default function AtlasMobileSheet({
  abierta,
  titulo,
  minimizada,
  resumen = null,
  onMinimizar,
  onCerrar,
  children,
}) {
  const panel = useRef(null);
  const yaEnfocado = useRef(false);

  useEffect(() => {
    if (!abierta) { yaEnfocado.current = false; return undefined; }

    // El foco entra una vez al abrir. Si entrara en cada render, escribir en
    // el buscador devolvería el foco al panel en cada tecla.
    if (!yaEnfocado.current) {
      yaEnfocado.current = true;
      panel.current?.focus({ preventScroll: true });
    }

    const onKey = (e) => {
      if (e.key === "Escape") { e.stopPropagation(); onCerrar(); }
    };
    const nodo = panel.current;
    nodo?.addEventListener("keydown", onKey);
    return () => nodo?.removeEventListener("keydown", onKey);
  }, [abierta, onCerrar]);

  if (!abierta) return null;

  return (
    <div
      ref={panel}
      className={`atlas-hoja${minimizada ? " is-minimizada" : ""}`}
      role="dialog"
      aria-label={titulo}
      tabIndex={-1}
    >
      <div className="atlas-hoja__asa" aria-hidden="true" />
      <header className="atlas-hoja__cabecera">
        <h2>{titulo}</h2>
        <div className="atlas-hoja__botones">
          <button
            type="button"
            onClick={onMinimizar}
            aria-expanded={!minimizada}
            aria-label={minimizada ? T.maximizar : T.minimizar}
          >
            <ChevronDown size={20} className={minimizada ? "is-plegado" : ""} aria-hidden="true" />
          </button>
          <button type="button" onClick={onCerrar} aria-label={T.cerrar}>
            <X size={20} aria-hidden="true" />
          </button>
        </div>
      </header>

      {/* Visible siempre: es lo que hace útil la hoja plegada. */}
      {resumen && <div className="atlas-hoja__resumen">{resumen}</div>}

      {!minimizada && <div className="atlas-hoja__cuerpo">{children}</div>}
    </div>
  );
}

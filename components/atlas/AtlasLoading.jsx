import React from "react";
import { MonitorX, RotateCcw } from "lucide-react";

import Button from "../ui/Button.jsx";
import { T } from "../../lib/atlas/i18n.es.js";

/* ==========================================================================
   MIENTRAS LLEGA EL MODELO

   Son 33 MB. En una conexión de aula eso puede ser medio minuto, y medio
   minuto de pantalla blanca se lee como «se colgó». Por eso hay dos frases
   distintas —preparar y cargar— y una barra de progreso real: el que baja
   quince bloques sabe cuántos lleva, así que no hay que inventarse la cifra.
   ========================================================================== */
export function AtlasCargando({ progreso = 0, fase = "manifiesto" }) {
  const mensaje = fase === "manifiesto" ? T.preparando
    : progreso >= 92 ? T.casiListo
      : T.cargandoEstructuras;

  return (
    <div className="atlas-cargando" role="status" aria-live="polite">
      <img
        className="atlas-cargando__kantu"
        src="/mascot/kantu-session.webp"
        alt=""
        width="132"
        height="132"
      />
      <p className="atlas-cargando__mensaje">{mensaje}</p>

      <div
        className="atlas-cargando__barra"
        role="progressbar"
        aria-valuenow={progreso}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={T.cargandoEstructuras}
      >
        <span style={{ width: `${Math.max(progreso, 4)}%` }} />
      </div>
      <small className="atlas-cargando__pct">{T.progreso(progreso)}</small>
    </div>
  );
}

/* ==========================================================================
   CUANDO EL DISPOSITIVO NO PUEDE

   Distinto del error genérico a propósito: aquí no hay nada que recargar
   —el equipo no tiene WebGL— y ofrecer «reintentar» sería mandar a la
   docente a chocar contra la misma pared.
   ========================================================================== */
export function AtlasSinWebgl({ onVolver }) {
  return (
    <div className="atlas-error" role="alert">
      <MonitorX size={40} aria-hidden="true" />
      <h2>{T.errorWebgl}</h2>
      <p>{T.errorDetalle}</p>
      {onVolver && (
        <div className="atlas-error__acciones">
          <Button variant="outline" onClick={onVolver}>{T.errorVolver}</Button>
        </div>
      )}
    </div>
  );
}

/** Fallo de descarga: aquí sí tiene sentido reintentar. */
export function AtlasFalloDeCarga({ onReintentar, onVolver }) {
  return (
    <div className="atlas-error" role="alert">
      <MonitorX size={40} aria-hidden="true" />
      <h2>{T.errorTitulo}</h2>
      <p>{T.errorReintento}</p>
      <div className="atlas-error__acciones">
        <Button icon={RotateCcw} onClick={onReintentar}>{T.errorAccion}</Button>
        {onVolver && (
          <Button variant="outline" onClick={onVolver}>{T.errorVolver}</Button>
        )}
      </div>
    </div>
  );
}

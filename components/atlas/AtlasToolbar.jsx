import React from "react";
import {
  Info, Layers, Maximize2, Minimize2, RotateCcw, Crosshair, ZoomIn, ZoomOut,
} from "lucide-react";

import { T } from "../../lib/atlas/i18n.es.js";

/* ==========================================================================
   BARRA DE ACCIONES

   Siete acciones y ni una más. Cada una que se añade quita sitio al modelo,
   que es lo único que la docente vino a ver.

   En escritorio flota a la izquierda del lienzo, en vertical. En móvil pasa
   a una fila sobre la ficha inferior, con objetivos de 44 px —el mínimo para
   un dedo— en vez de encoger los mismos iconos hasta que fallen.

   Los rótulos van en `aria-label` siempre y en `title` sólo en escritorio:
   un tooltip que aparece al tocar tapa justo el botón que se acaba de pulsar.
   ========================================================================== */
function Accion({ icono: Icono, rotulo, activo, onClick, movil }) {
  return (
    <button
      type="button"
      className={`atlas-tool${activo ? " is-active" : ""}`}
      onClick={onClick}
      aria-label={rotulo}
      aria-pressed={activo === undefined ? undefined : activo}
      title={movil ? undefined : rotulo}
    >
      <Icono size={movil ? 20 : 18} aria-hidden="true" />
      <span className="atlas-tool__texto">{rotulo}</span>
    </button>
  );
}

export default function AtlasToolbar({
  movil = false,
  etiquetaGrupos,
  panelGruposAbierto,
  panelInfoAbierto,
  pantallaCompleta,
  onRestablecer,
  onCentrar,
  onZoom,
  onGrupos,
  onInfo,
  onPantallaCompleta,
}) {
  const rotuloGrupos = etiquetaGrupos === "categorías" ? T.categorias : T.sistemas;

  return (
    <div
      className={`atlas-toolbar${movil ? " atlas-toolbar--movil" : ""}`}
      role="toolbar"
      aria-label="Controles del modelo 3D"
    >
      <Accion movil={movil} icono={RotateCcw} rotulo={T.restablecer} onClick={onRestablecer} />
      <Accion movil={movil} icono={Crosshair} rotulo={T.centrar} onClick={onCentrar} />
      <Accion movil={movil} icono={ZoomIn} rotulo={T.acercar} onClick={() => onZoom(0.8)} />
      <Accion movil={movil} icono={ZoomOut} rotulo={T.alejar} onClick={() => onZoom(1.25)} />

      <span className="atlas-toolbar__sep" aria-hidden="true" />

      <Accion
        movil={movil}
        icono={Layers}
        rotulo={rotuloGrupos}
        activo={panelGruposAbierto}
        onClick={onGrupos}
      />
      <Accion
        movil={movil}
        icono={Info}
        rotulo={T.informacion}
        activo={panelInfoAbierto}
        onClick={onInfo}
      />
      <Accion
        movil={movil}
        icono={pantallaCompleta ? Minimize2 : Maximize2}
        rotulo={pantallaCompleta ? T.salirPantallaCompleta : T.pantallaCompleta}
        activo={pantallaCompleta}
        onClick={onPantallaCompleta}
      />
    </div>
  );
}

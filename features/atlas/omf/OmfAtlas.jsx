import React from "react";

import AtlasShell from "../../../components/atlas/AtlasShell.jsx";
import { FUENTE_OMF } from "../../../lib/atlas/fuentes.js";
import { T } from "../../../lib/atlas/i18n.es.js";

/* ==========================================================================
   ATLAS ORAL Y MAXILOFACIAL

   Las 648 estructuras de cabeza y cuello del mismo pack, reagrupadas en las
   siete categorías con las que se estudia la región: huesos, dentición,
   músculos, nervios, vasos, articulaciones y estructuras relacionadas.

   Comparte pack con el atlas del cuerpo humano, así que pasar de uno a otro
   no descarga nada: la geometría ya está en memoria.
   ========================================================================== */
export default function OmfAtlas({ onVolver }) {
  return (
    <AtlasShell
      fuente={FUENTE_OMF}
      titulo={T.omf.titulo}
      subtitulo={T.omf.subtitulo}
      onVolver={onVolver}
    />
  );
}

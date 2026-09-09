import React from "react";

import AtlasShell from "../../../components/atlas/AtlasShell.jsx";
import { FUENTE_HUMANA } from "../../../lib/atlas/fuentes.js";
import { T } from "../../../lib/atlas/i18n.es.js";

/* ==========================================================================
   ATLAS DEL CUERPO HUMANO

   2.234 estructuras de BodyParts3D 4.0 agrupadas en 15 sistemas. Todo lo
   que hace falta para montarlo está en el armazón común; aquí sólo se dice
   qué se enseña y cómo se llama.
   ========================================================================== */
export default function HumanAtlas({ onVolver }) {
  return (
    <AtlasShell
      fuente={FUENTE_HUMANA}
      titulo={T.humano.titulo}
      subtitulo={T.humano.subtitulo}
      onVolver={onVolver}
    />
  );
}

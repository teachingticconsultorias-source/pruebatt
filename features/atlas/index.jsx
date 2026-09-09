import React, { Suspense, lazy } from "react";

import AtlasErrorBoundary from "../../components/atlas/AtlasErrorBoundary.jsx";
import { AtlasCargando } from "../../components/atlas/AtlasLoading.jsx";
import "../../components/atlas/atlas.css";

/* ==========================================================================
   PUERTA DE ENTRADA A LOS ATLAS

   POR QUÉ `lazy` Y NO UN IMPORT NORMAL
   ------------------------------------
   Three.js son unas 500 KB minimizadas. El bundle principal de SciVerse ya
   ronda 1,1 MB, y la inmensa mayoría de las docentes entra a crear una
   sesión, no a mirar un fémur. Con `lazy`, quien abre Inicio no descarga ni
   un byte de 3D: el trozo se pide la primera vez que se toca «Atlas del
   cuerpo humano», y el pack de 32 MB sólo cuando ese componente se monta.

   Los dos atlas comparten el mismo trozo —`webpackChunkName` no aplica aquí,
   pero Rollup agrupa por grafo— porque comparten armazón, motor y datos:
   separarlos duplicaría Three.js en dos descargas.
   ========================================================================== */

const HumanAtlas = lazy(() => import("./human/HumanAtlas.jsx"));
const OmfAtlas = lazy(() => import("./omf/OmfAtlas.jsx"));

/** Envoltura común: mismo respaldo de carga y misma red de seguridad. */
function ConRespaldo({ children, onVolver, clave }) {
  return (
    <AtlasErrorBoundary
      key={clave}
      onVolver={onVolver}
      onReintentar={() => window.location.reload()}
    >
      <Suspense fallback={<div className="atlas atlas--cargando"><AtlasCargando /></div>}>
        {children}
      </Suspense>
    </AtlasErrorBoundary>
  );
}

export function AtlasCuerpoHumano({ onVolver }) {
  return (
    <ConRespaldo onVolver={onVolver} clave="humano">
      <HumanAtlas onVolver={onVolver} />
    </ConRespaldo>
  );
}

export function AtlasOralMaxilofacial({ onVolver }) {
  return (
    <ConRespaldo onVolver={onVolver} clave="omf">
      <OmfAtlas onVolver={onVolver} />
    </ConRespaldo>
  );
}

/** Identificadores de sección, para que el shell y App.jsx no los repitan. */
export const SECCIONES_ATLAS = {
  humano: "atlas-humano",
  omf: "atlas-omf",
};

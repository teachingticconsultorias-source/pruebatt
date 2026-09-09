import React, { useEffect, useRef } from "react";

import { crearVisor } from "../../lib/atlas/visor.js";
import { T } from "../../lib/atlas/i18n.es.js";

/* ==========================================================================
   PUENTE ENTRE REACT Y EL MOTOR 3D

   El visor se crea UNA vez y sobrevive a todos los re-renders. Lo único que
   cruza la frontera después son órdenes: «este conjunto visible, ésta
   seleccionada». Si el visor se recreara al cambiar de sistema, cada clic en
   la lista costaría un contexto WebGL nuevo y medio segundo de negro.

   Por eso `alSeleccionar` se guarda en una referencia: el motor llama
   siempre a la misma función, y esa función mira cuál es el callback actual.
   Pasarlo directo obligaría a recrear el visor cada vez que el padre se
   vuelve a pintar.
   ========================================================================== */
export default function AtlasCanvas({
  bloques,
  partes,
  colores,
  enfoque,
  visibles,
  seleccion,
  senalado,
  onSeleccion,
  onSenalar,
  onFallo,
  visorRef,
}) {
  const contenedor = useRef(null);
  const visor = useRef(null);
  const alSeleccionar = useRef(onSeleccion);
  alSeleccionar.current = onSeleccion;
  const alSenalar = useRef(onSenalar);
  alSenalar.current = onSenalar;

  useEffect(() => {
    const nodo = contenedor.current;
    if (!nodo) return undefined;

    let instancia = null;
    try {
      instancia = crearVisor({
        contenedor: nodo,
        bloques,
        partes,
        colores,
        enfoque,
        alSeleccionar: (indice) => alSeleccionar.current?.(indice),
        alSenalar: (indice) => alSenalar.current?.(indice),
      });
    } catch (error) {
      console.error("[sciverse:atlas]", error?.message || error);
      onFallo?.();
      return undefined;
    }

    visor.current = instancia;
    if (visorRef) visorRef.current = instancia;

    return () => {
      // Soltar el contexto WebGL es obligatorio: el navegador sólo permite un
      // puñado a la vez y entrar y salir del atlas los agota enseguida.
      instancia.destruir();
      visor.current = null;
      if (visorRef) visorRef.current = null;
    };
    // Las dependencias son los datos del modelo, que en la práctica no
    // cambian: el pack se carga una vez por sesión.
  }, [bloques, partes, colores, enfoque, onFallo, visorRef]);

  useEffect(() => {
    visor.current?.aplicar({ visibles, seleccion, senalado });
  }, [visibles, seleccion, senalado]);

  return (
    <div
      ref={contenedor}
      className="atlas-lienzo"
      role="img"
      aria-label={T.lienzoEtiqueta}
    />
  );
}

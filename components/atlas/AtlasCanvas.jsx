import React, { useEffect, useRef } from "react";

import { crearVisor } from "../../lib/atlas/visor.js";
import { T } from "../../lib/atlas/i18n.es.js";

/* ==========================================================================
   PUENTE ENTRE REACT Y EL MOTOR 3D

   EL FALLO QUE ESTE FICHERO CAUSABA
   ---------------------------------
   Producción: la docente hacía zoom sobre el abdomen, tocaba un músculo y la
   cámara volvía al cuerpo completo. Y si había apagado «Piel y anexos», la
   piel reaparecía con el interruptor todavía en OFF.

   Las dos cosas salían de la misma línea: `onFallo` estaba en el array de
   dependencias del efecto que CREA el visor, y en el padre se pasaba como
   `onFallo={() => setFallo("carga")}` — una función nueva en cada render.
   Así que cualquier re-render (seleccionar, abrir un panel, pasar el ratón)
   cambiaba la identidad de la dependencia, React ejecutaba la limpieza y el
   efecto otra vez, y el visor se destruía y se volvía a construir:

     · cámara de vuelta al encuadre inicial;
     · las 15 geometrías y el contexto WebGL, rehechos;
     · la tabla de estados reinicializada con TODO visible.

   Lo tercero era el «panel OFF pero malla ON»: la visibilidad sólo se
   reaplicaba si además cambiaba `visibles`, y abrir un panel no la cambia.

   CÓMO SE EVITA AHORA, Y NO SÓLO SE ARREGLA
   -----------------------------------------
   Las dependencias son EXCLUSIVAMENTE los datos del modelo, que se cargan una
   vez por sesión. Todo callback entra por una referencia, así que su
   identidad no puede volver a disparar la reconstrucción. Y justo después de
   crear el visor se aplica el estado actual, para que un visor nuevo nunca
   nazca mostrando lo que la docente había apagado.
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

  /* ---- todo lo que cambia de identidad, por referencia ------------------

     Estas cuatro NO pueden estar en las dependencias del efecto de abajo:
     cambian en cada render del padre y reconstruirían la escena.            */
  const alSeleccionar = useRef(onSeleccion);
  alSeleccionar.current = onSeleccion;
  const alSenalar = useRef(onSenalar);
  alSenalar.current = onSenalar;
  const alFallar = useRef(onFallo);
  alFallar.current = onFallo;

  // El estado más reciente, para poder aplicarlo en cuanto exista el visor.
  const estado = useRef({ visibles, seleccion, senalado });
  estado.current = { visibles, seleccion, senalado };

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
      alFallar.current?.();
      return undefined;
    }

    visor.current = instancia;
    if (visorRef) visorRef.current = instancia;

    // El visor nace con todo visible. Si la docente ya había apagado un
    // sistema —o si la geometría acabó de cargar después de que el estado se
    // inicializara—, hay que aplicarlo AHORA. Sin esto, un visor recién
    // creado contradice al panel.
    instancia.aplicar(estado.current);

    return () => {
      // Soltar el contexto WebGL es obligatorio: el navegador sólo permite un
      // puñado a la vez y entrar y salir del atlas los agota enseguida.
      instancia.destruir();
      visor.current = null;
      if (visorRef) visorRef.current = null;
    };
    // SÓLO los datos del modelo. Añadir aquí cualquier cosa que cambie de
    // identidad en un render devuelve los dos bugs de arriba.
  }, [bloques, partes, colores, enfoque, visorRef]);

  /* ---- órdenes al visor ------------------------------------------------

     Esto es lo único que cruza la frontera cuando la docente selecciona,
     oculta o aísla: una escritura en la tabla de estados. No se reconstruye
     geometría y NO se toca la cámara.                                       */
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

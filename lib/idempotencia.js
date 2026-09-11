// lib/idempotencia.js
//
// LA CLAVE QUE HACE QUE DOS CLICS SEAN UNA SOLA GENERACIÓN.
//
// POR QUÉ TIENE QUE NACER AQUÍ Y NO EN EL SERVIDOR
// ------------------------------------------------
// El servidor no puede saber si dos peticiones son «la misma acción» o dos
// acciones seguidas: le llegan idénticas. Sólo el navegador sabe que ambas
// salieron del mismo clic. Por eso la clave la genera el cliente y la repite
// mientras el intento siga vivo.
//
// Una clave generada en el servidor —como hacía el respaldo `srv-*`— es
// distinta en cada petición y por tanto no identifica nada: crea filas en
// `ai_operations` y no impide un solo cobro doble. Era idempotencia de
// adorno, y peor que no tenerla, porque parecía que sí.
//
// LA REGLA
// --------
// Una clave por INTENTO, no por petición:
//   · se crea al empezar la generación
//   · se repite si se reintenta por red o por un segundo clic
//   · se renueva sólo cuando la docente empieza una generación nueva
//
// `obtener()` es idempotente a propósito: si ya hay clave, la devuelve. Así
// da igual cuántas veces se ejecute la función que genera — todas las
// ejecuciones de un mismo intento comparten clave.

import { useMemo, useRef } from "react";

/** UUID v4. `crypto.randomUUID` existe en todo navegador con HTTPS. */
function uuid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  // Respaldo para contextos sin `randomUUID` (http en local, navegadores viejos).
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** Cabecera que espera el servidor. Un solo sitio donde se escribe el nombre. */
export const CABECERA_IDEMPOTENCIA = "Idempotency-Key";

/**
 * Clave estable para el intento de generación en curso.
 *
 * @param {string} prefijo  identifica la herramienta en los logs del servidor
 * @returns {{obtener: () => string, renovar: () => void}}
 */
export function useClaveDeOperacion(prefijo = "gen") {
  const clave = useRef(null);

  return useMemo(() => ({
    /** La clave del intento. La crea si es el primero; si no, la reutiliza. */
    obtener() {
      if (!clave.current) clave.current = `${prefijo}-${uuid()}`;
      return clave.current;
    },
    /** Cierra el intento: la próxima generación empezará con una clave nueva. */
    renovar() {
      clave.current = null;
    },
  }), [prefijo]);
}

/**
 * Cabeceras de una petición de generación.
 *
 * Se construyen aquí para que no se olvide la clave en ningún sitio: si una
 * llamada usa este helper, la lleva.
 */
export function cabecerasDeGeneracion(token, clave) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token || ""}`,
    [CABECERA_IDEMPOTENCIA]: clave,
  };
}

/* --------------------------------------------------------------------------
   Los mensajes visibles viven en lib/mensajes.js: hay uno solo para toda la
   aplicación y cubre también lo que el servidor no puede traducir —red caída,
   navegador sin conexión—. Se reexportan desde aquí porque media aplicación ya
   los importaba de este módulo.
   -------------------------------------------------------------------------- */
export { CODIGOS_DUPLICADO, esDuplicado, mensajeDeCodigo, mensajeDeError,
  mensajeDeRespuesta, sinConexion } from "./mensajes.js";

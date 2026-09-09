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

/** Códigos con los que el servidor dice «esto ya está hecho o en marcha». */
export const CODIGOS_DUPLICADO = new Set([
  "AI_OPERATION_IN_PROGRESS",
  "AI_OPERATION_ALREADY_COMPLETED",
  "DUPLICATE_OPERATION",
]);

/**
 * Traduce la respuesta del servidor a algo que una docente entienda.
 *
 * Un duplicado NO es un error suyo: es la aplicación protegiéndola de un
 * cobro doble. El texto lo trata así, sin alarma y sin jerga.
 */
export function mensajeDeRespuesta(data, porDefecto = "No pudimos completar la generación.") {
  const codigo = data?.code;
  if (codigo === "AI_OPERATION_IN_PROGRESS") {
    return "Esta generación ya se está procesando. Espera unos segundos.";
  }
  if (codigo === "AI_OPERATION_ALREADY_COMPLETED") {
    return "Esta generación ya fue procesada. Revisa el resultado o tu biblioteca.";
  }
  if (codigo === "DUPLICATE_OPERATION") {
    return "Esta creación ya se está procesando. Espera unos segundos antes de volver a intentarlo.";
  }
  if (codigo === "IDEMPOTENCY_KEY_REQUIRED") {
    return "Tu sesión quedó desactualizada. Recarga la página y vuelve a intentarlo.";
  }
  return data?.error || porDefecto;
}

/** ¿La respuesta dice que la operación ya existía? */
export function esDuplicado(data) {
  return CODIGOS_DUPLICADO.has(data?.code);
}

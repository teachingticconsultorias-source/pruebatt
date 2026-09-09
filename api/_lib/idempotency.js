// api/_lib/idempotency.js
//
// UNA GENERACIÓN LÓGICA, UNA SOLA VEZ.
//
// EL PROBLEMA QUE RESUELVE
// ------------------------
// `disabled={loading}` en el navegador no basta. Un doble clic rapidísimo,
// un reintento del navegador tras una conexión mala, o la propia docente
// recargando porque «no pasaba nada», pueden mandar dos peticiones idénticas.
// El resultado sería dos créditos, dos llamadas a Gemini y, con suerte, dos
// filas en la biblioteca.
//
// POR QUÉ NO VALE UN MAPA EN MEMORIA
// ----------------------------------
// Porque Vercel ejecuta varias instancias a la vez. Dos peticiones simultáneas
// pueden caer en procesos distintos que no comparten memoria, que es
// exactamente el caso que hay que cubrir. La garantía tiene que estar donde
// hay un único árbitro: Postgres.
//
// LA GARANTÍA ES UNA CLAVE PRIMARIA
// ---------------------------------
// `begin_ai_operation` hace `insert ... on conflict do nothing`. Si dos
// procesos insertan la misma clave en el mismo milisegundo, Postgres deja
// pasar a uno. No hace falta bloqueo, ni cola, ni Redis: la unicidad ya es
// atómica.
//
// SI LA TABLA NO EXISTE TODAVÍA
// -----------------------------
// La migración 010 no está aplicada. Mientras no lo esté, `begin` devuelve
// `sin_soporte` y la generación sigue su curso: nadie se queda sin poder
// trabajar porque falte una protección que antes tampoco existía. Queda
// registrado para que se note.

import { randomUUID } from "node:crypto";

import { callRpc } from "./supabase.js";
import { Errors } from "./errors.js";

/** Formato aceptado: algo estable, corto y sin datos personales dentro. */
const CLAVE_VALIDA = /^[A-Za-z0-9._:-]{8,120}$/;

/**
 * Clave de la operación.
 *
 * La envía el cliente en `Idempotency-Key` o en el cuerpo. Si no llega una
 * válida se genera una: la petición funciona igual, pero sin protección
 * frente a duplicados — y el log lo dice, que es la única manera de saber
 * que un cliente dejó de mandarla.
 */
export function claveDeOperacion(req) {
  const cruda =
    req?.headers?.["idempotency-key"] ||
    req?.headers?.["x-idempotency-key"] ||
    req?.body?.idempotencyKey;

  const texto = String(cruda ?? "").trim();
  if (CLAVE_VALIDA.test(texto)) return { clave: texto, delCliente: true };

  // RESPALDO, NO PROTECCIÓN.
  //
  // Una clave generada aquí es distinta en cada petición, así que no
  // identifica nada: dos clics producirían dos claves y dos cobros. Se
  // conserva sólo para que una ruta sin crédito no se rompa, y se registra
  // para que nunca se confunda con idempotencia efectiva.
  console.warn("[sciverse:idempotencia]", JSON.stringify({
    estado: "sin_clave_del_cliente",
    detalle: "peticion sin Idempotency-Key; el respaldo NO protege de duplicados",
  }));
  return { clave: `srv-${randomUUID()}`, delCliente: false };
}

/**
 * Clave OBLIGATORIA para las generaciones que cobran.
 *
 * DECISIÓN: aquí no vale el respaldo. Sin clave del cliente no hay forma de
 * saber que dos peticiones son el mismo intento, así que la protección
 * simplemente no existiría — y existiendo a medias es peor, porque los logs
 * dirían que sí. Antes que cobrar dos veces en silencio, se rechaza con un
 * mensaje que la docente puede resolver recargando.
 *
 * El coste conocido es una pestaña abierta desde antes del despliegue: su
 * primera generación fallará con este error. Es un fallo visible y
 * reversible, frente a un cobro doble que nadie detectaría.
 *
 * @throws AppError 400 IDEMPOTENCY_KEY_REQUIRED
 */
export function claveObligatoria(req) {
  const { clave, delCliente } = claveDeOperacion(req);
  if (!delCliente) throw Errors.idempotencyKeyRequired();
  return clave;
}

/**
 * Reserva la operación.
 *
 * @returns {Promise<{estado:"nueva"|"duplicada"|"sin_soporte", detalle?:object}>}
 *   · nueva        → se puede generar y cobrar
 *   · duplicada    → ya hay una igual en curso o terminada; NO cobrar
 *   · sin_soporte  → la migración no está aplicada; seguir sin protección
 */
export async function reservarOperacion({ token, url, key, clave, tool }) {
  try {
    const r = await callRpc({
      name: "begin_ai_operation",
      token, url, key,
      body: { p_key: clave, p_tool: tool || "desconocida" },
    });
    if (r?.status === "started") {
      return { estado: "nueva", reintento: r?.reintento === true };
    }
    // `processing` y `completed` son duplicados distintos para quien espera:
    // uno significa «aguanta» y el otro «ya está hecho».
    return { estado: "duplicada", previo: r?.estado_previo || "processing" };
  } catch (error) {
    const mensaje = String(error?.details || error?.message || "");
    // La función aún no existe: se sigue sin protección, avisando.
    if (/begin_ai_operation|PGRST202|does not exist|404/i.test(mensaje)) {
      console.warn("[sciverse:idempotencia]",
        JSON.stringify({ tool, estado: "sin_soporte", detalle: "010 no aplicada" }));
      return { estado: "sin_soporte" };
    }
    // Cualquier otro fallo tampoco puede impedir que la docente trabaje.
    console.warn("[sciverse:idempotencia]",
      JSON.stringify({ tool, estado: "error", detalle: mensaje.slice(0, 120) }));
    return { estado: "sin_soporte" };
  }
}

/**
 * Cierra la operación. Nunca lanza: es contabilidad, no el trabajo.
 *
 * `finish_ai_operation` devuelve `{ok:false, reason:"not_found"}` cuando no
 * tocó ninguna fila. No se ignora: significa que se está cerrando una clave
 * que no existe o que es de otra cuenta, y eso sólo puede venir de un fallo
 * de programación. Queda registrado para poder encontrarlo.
 */
export async function cerrarOperacion({ token, url, key, clave, estado }) {
  if (!clave) return false;
  try {
    const r = await callRpc({
      name: "finish_ai_operation",
      token, url, key,
      body: { p_key: clave, p_status: estado },
    });
    if (r?.ok === false) {
      console.warn("[sciverse:idempotencia]",
        JSON.stringify({ estado: "cierre_sin_fila", motivo: r?.reason || null }));
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

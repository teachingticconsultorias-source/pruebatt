// api/_lib/credits.js
//
// Consumo y devolución de créditos de IA.
//
// Se apoya en las funciones RPC ya existentes en Supabase, que NO se
// reescriben: `consume_ai_credit()` usa `SELECT ... FOR UPDATE` para evitar
// el doble consumo concurrente y esa garantía debe conservarse.
//
// UNIDAD DE COBRO
// ---------------
//   1 resultado entregado al docente = 1 crédito
//
// Una sesión de aprendizaje son 4 llamadas a Gemini (alignment, sequence,
// assessment, annexes) pero UNA sola creación para la docente. Por eso solo
// el primer módulo (`alignment`) consume crédito; los tres siguientes no.
// Ver `chargesCreditForModule()`.

import { callRpc } from "./supabase.js";
import { Errors } from "./errors.js";

/**
 * Consume 1 crédito. Lanza `creditsExhausted` si no quedan.
 * @returns {Promise<object>} estado de créditos tras el consumo
 */
export async function consumeCredit({ token, url, key }) {
  const quota = await callRpc({ name: "consume_ai_credit", token, url, key });
  if (!quota?.ok) throw Errors.creditsExhausted(quota || null);
  return quota;
}

/**
 * Devuelve 1 crédito. No lanza nunca: un fallo aquí no debe ocultar
 * el error original que provocó la devolución, pero SÍ queda registrado
 * para poder compensar manualmente al docente.
 */
export async function refundCredit({ token, url, key, reason = "unknown" }) {
  try {
    await callRpc({ name: "refund_ai_credit", token, url, key });
    return true;
  } catch (error) {
    console.error(
      "[sciverse:credit-refund-failed]",
      JSON.stringify({ reason, detail: error?.message })
    );
    return false;
  }
}

/** Estado actual de créditos del usuario autenticado. */
export async function getCreditStatus({ token, url, key }) {
  return callRpc({ name: "get_ai_credit_status", token, url, key });
}

/**
 * ¿Este módulo de la sesión debe cobrar crédito?
 *
 * Solo el primero. Así una sesión completa cuesta 1 crédito y nunca 4.
 */
export function chargesCreditForModule(moduleName) {
  return moduleName === "alignment";
}

/**
 * Envuelve una operación cobrando 1 crédito y devolviéndolo si falla.
 *
 * El consumo y la devolución ocurren íntegramente en el servidor: el cliente
 * no puede saltarse el cobro ni provocar una devolución indebida.
 *
 * @param {{token:string,url:string,key:string,reason?:string}} auth
 * @param {() => Promise<T>} operation
 * @returns {Promise<{ result: T, credits: object }>}
 * @template T
 */
export async function withCredit(auth, operation) {
  const credits = await consumeCredit(auth);
  try {
    const result = await operation();
    return { result, credits };
  } catch (error) {
    // La generación no entregó nada: el crédito se devuelve.
    await refundCredit({ ...auth, reason: auth.reason || "generation_failed" });
    throw error;
  }
}

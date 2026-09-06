// api/admin/actions.js — acciones administrativas sobre un docente.
//
// Todas las mutaciones pasan por aquí y por una RPC transaccional. El
// navegador NUNCA escribe directamente en plans, subscriptions, admin_users,
// ai_usage_counters, ai_generations ni admin_audit_log: 002, 003 y 005 les
// revocaron los privilegios y estas funciones son SECURITY DEFINER.
//
// La autorización se comprueba DOS veces a propósito: aquí, con el JWT del
// administrador, y otra vez dentro de la RPC contra admin_users. Si un fallo
// en este archivo dejara pasar a alguien, la base seguiría rechazándolo.

import { sendError, Errors } from "../_lib/errors.js";
import { requireAdmin, callAdminRpc } from "../_lib/admin.js";
import { clientKey, enforceRateLimit, RateLimits } from "../_lib/rate-limit.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REASON_MAX = 300;
const MESES_MIN = 1;
const MESES_MAX = 36;

/**
 * Traduce lo que lanzan las funciones de Postgres a algo que un
 * administrador pueda entender. El texto crudo se queda en el log.
 */
const MENSAJES = [
  [/ADMIN_REQUIRED/i,           403, "Tu cuenta ya no tiene permisos de administración."],
  [/ADMIN_ROLE_INSUFFICIENT/i,  403, "Tu rol no permite realizar esta acción."],
  [/TARGET_REQUIRED|TARGET_NOT_FOUND/i, 404, "No encontramos a ese docente."],
  [/PLAN_NOT_FOUND/i,           400, "Ese plan no existe o está desactivado."],
  [/DURATION_OUT_OF_RANGE/i,    400, `La duración debe estar entre ${MESES_MIN} y ${MESES_MAX} meses.`],
  [/NO_ACTIVE_SUBSCRIPTION/i,   409, "Este docente no tiene una suscripción activa que extender."],
  [/PLAN_HAS_NO_EXPIRY/i,       409, "El plan actual no tiene vencimiento, así que no hay nada que extender."],
  [/CONCURRENT_CHANGE/i,        409, "Otro administrador acaba de cambiar este plan. Vuelve a cargar la ficha."],
];

function traducir(error) {
  const crudo = `${error?.details ?? ""} ${error?.message ?? ""}`;
  for (const [re, status, mensaje] of MENSAJES) {
    if (re.test(crudo)) {
      const e = new Error(mensaje);
      e.status = status;
      e.code = "ADMIN_ACTION_REJECTED";
      return e;
    }
  }
  return error;
}

function meses(valor) {
  const n = Number.parseInt(valor, 10);
  if (!Number.isFinite(n)) return null;
  return Math.min(MESES_MAX, Math.max(MESES_MIN, n));
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") throw Errors.methodNotAllowed();

    enforceRateLimit({ key: clientKey(req), bucket: "admin-write", ...RateLimits.adminRead });

    // `support` es de solo lectura: no llega aquí.
    const admin = await requireAdmin(req, { minRole: "admin" });

    const { action, userId, plan, months, reason } = req.body || {};

    if (!UUID_RE.test(String(userId ?? ""))) {
      throw Errors.badRequest("Identificador de docente no válido.");
    }
    const motivo = String(reason ?? "").trim().slice(0, REASON_MAX) || null;

    const comun = { url: admin.url, serviceKey: admin.serviceKey };
    let data;

    switch (action) {
      case "suspend":
      case "reactivate":
        data = await callAdminRpc({
          name: "admin_set_account_status",
          ...comun,
          body: {
            p_actor: admin.user.id,
            p_target: userId,
            p_active: action === "reactivate",
            p_reason: motivo,
          },
        });
        break;

      case "change_plan": {
        if (!plan || typeof plan !== "string") {
          throw Errors.badRequest("Elige un plan para continuar.");
        }
        data = await callAdminRpc({
          name: "admin_change_plan",
          ...comun,
          body: {
            p_actor: admin.user.id,
            p_target: userId,
            p_plan: plan,
            p_months: months == null || months === "" ? null : meses(months),
            p_reason: motivo,
          },
        });
        break;
      }

      case "extend_plan": {
        const m = meses(months);
        if (m == null) throw Errors.badRequest("Indica cuántos meses quieres añadir.");
        data = await callAdminRpc({
          name: "admin_extend_plan",
          ...comun,
          body: { p_actor: admin.user.id, p_target: userId, p_months: m, p_reason: motivo },
        });
        break;
      }

      default:
        throw Errors.badRequest("Acción no reconocida.");
    }

    return res.status(200).json({ ...data, action });
  } catch (error) {
    return sendError(res, traducir(error), { endpoint: "admin/actions" });
  }
}

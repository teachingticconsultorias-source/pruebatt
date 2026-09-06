// api/admin/payment-actions.js — aprobar o rechazar una solicitud de pago.
//
// `support` NO llega aquí: las mutaciones exigen rol `admin`, y la propia RPC
// lo vuelve a comprobar contra admin_users. Aprobar es una sola transacción:
// marca el pago, cierra la suscripción anterior, crea la nueva y audita.

import { sendError, Errors } from "../../_lib/errors.js";
import { requireAdmin, callAdminRpc } from "../../_lib/admin.js";
import { clientKey, enforceRateLimit, RateLimits } from "../../_lib/rate-limit.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NOTAS_MAX = 300;

const MENSAJES = [
  [/ADMIN_REQUIRED/i,          403, "Tu cuenta ya no tiene permisos de administración."],
  [/ADMIN_ROLE_INSUFFICIENT/i, 403, "Tu rol no permite aprobar ni rechazar pagos."],
  [/REQUEST_REQUIRED|REQUEST_NOT_FOUND/i, 404, "No encontramos esa solicitud."],
  [/REQUEST_NOT_PENDING/i,     409, "Esta solicitud ya fue revisada. Vuelve a cargar la bandeja."],
  [/REASON_REQUIRED/i,         400, "Escribe el motivo del rechazo."],
  [/PLAN_NOT_FOUND/i,          409, "El plan de esta solicitud ya no existe en el catálogo."],
  [/CONCURRENT_CHANGE/i,       409, "Otro administrador acaba de actuar sobre este docente. Vuelve a cargar."],
];

function traducir(error) {
  const crudo = `${error?.details ?? ""} ${error?.message ?? ""}`;
  for (const [re, status, mensaje] of MENSAJES) {
    if (re.test(crudo)) {
      const e = new Error(mensaje);
      e.status = status;
      e.code = "PAYMENT_ACTION_REJECTED";
      return e;
    }
  }
  return error;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") throw Errors.methodNotAllowed();
    enforceRateLimit({ key: clientKey(req), bucket: "admin-write", ...RateLimits.adminRead });

    const admin = await requireAdmin(req, { minRole: "admin" });
    const { action, requestId, notes } = req.body || {};

    if (!UUID_RE.test(String(requestId ?? ""))) {
      throw Errors.badRequest("Identificador de solicitud no válido.");
    }
    const texto = String(notes ?? "").trim().slice(0, NOTAS_MAX) || null;

    const comun = { url: admin.url, serviceKey: admin.serviceKey };
    let data;

    if (action === "approve") {
      data = await callAdminRpc({
        name: "admin_approve_payment",
        ...comun,
        body: { p_actor: admin.user.id, p_request: requestId, p_notes: texto },
      });
    } else if (action === "reject") {
      // El motivo es obligatorio: rechazar sin explicación deja a la docente
      // sin saber qué corregir.
      if (!texto) throw Errors.badRequest("Escribe el motivo del rechazo.");
      data = await callAdminRpc({
        name: "admin_reject_payment",
        ...comun,
        body: { p_actor: admin.user.id, p_request: requestId, p_reason: texto },
      });
    } else {
      throw Errors.badRequest("Acción no reconocida.");
    }

    return res.status(200).json({ ...data, action });
  } catch (error) {
    return sendError(res, traducir(error), { endpoint: "admin/payment-actions" });
  }
}

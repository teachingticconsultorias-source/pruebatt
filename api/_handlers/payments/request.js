// api/payments/request.js — el docente solicita un plan de pago.
//
// El navegador envía SOLO el código del plan. El importe, la moneda y la
// duración los lee `request_plan` desde `public.plans` dentro de la propia
// transacción, así que manipular la petición no abarata nada.

import { sendError, Errors } from "../../_lib/errors.js";
import { requireUser, callRpc } from "../../_lib/supabase.js";
import { clientKey, enforceRateLimit, RateLimits } from "../../_lib/rate-limit.js";

const METODOS = ["yape", "plin", "transferencia", "efectivo", "otro"];
const REF_MAX = 80;

const MENSAJES = [
  [/PLAN_NOT_FOUND/i,          404, "Ese plan no está disponible."],
  [/PLAN_NOT_PURCHASABLE/i,    400, "El plan gratuito no necesita solicitud: ya lo tienes."],
  [/PLAN_ALREADY_ACTIVE/i,     409, "Ya tienes este plan activo. Escríbenos si quieres renovarlo."],
  [/REQUEST_ALREADY_PENDING/i, 409, "Ya tienes una solicitud en revisión para este plan. Te avisaremos apenas la revisemos."],
  [/PROFILE_NOT_FOUND/i,       409, "Tu perfil no terminó de crearse. Escríbenos y lo activamos."],
  [/PAYMENTS_CLOSED/i,         409, "Ahora mismo no estamos aceptando solicitudes de plan. Vuelve a intentarlo más tarde."],
  [/METHOD_NOT_AVAILABLE/i,    409, "Ese método de pago ya no está disponible. Elige otro."],
];

function traducir(error) {
  const crudo = `${error?.details ?? ""} ${error?.message ?? ""}`;
  for (const [re, status, mensaje] of MENSAJES) {
    if (re.test(crudo)) {
      const e = new Error(mensaje);
      e.status = status;
      e.code = "PAYMENT_REQUEST_REJECTED";
      return e;
    }
  }
  return error;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") throw Errors.methodNotAllowed();

    // Dos vueltas: por IP antes de identificar (frena un script anónimo) y por
    // usuario después (un colegio entero comparte salida a internet y no debe
    // penalizarse entre sí). La protección de verdad contra duplicados sigue
    // siendo el índice único parcial de la base, no esto.
    enforceRateLimit({ key: clientKey(req), bucket: "payment-request-ip", ...RateLimits.paymentRequest });

    const auth = await requireUser(req);
    enforceRateLimit({
      key: clientKey(req, auth.user.id),
      bucket: "payment-request",
      ...RateLimits.paymentRequest,
    });

    const { plan, method, reference } = req.body || {};

    if (!plan || typeof plan !== "string") {
      throw Errors.badRequest("Elige un plan para continuar.");
    }
    const metodo = METODOS.includes(method) ? method : "yape";
    const ref = String(reference ?? "").trim().slice(0, REF_MAX) || null;

    const data = await callRpc({
      name: "request_plan",
      ...auth,
      body: { p_plan: plan, p_method: metodo, p_reference: ref },
    });

    return res.status(201).json(data);
  } catch (error) {
    return sendError(res, traducir(error), { endpoint: "payments/request" });
  }
}

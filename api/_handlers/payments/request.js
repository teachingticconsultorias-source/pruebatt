// api/payments/request.js — el docente solicita un plan de pago.
//
// El navegador envía SOLO el código del plan. El importe, la moneda y la
// duración los lee `request_plan` desde `public.plans` dentro de la propia
// transacción, así que manipular la petición no abarata nada.
//
// ORDEN DE LAS OPERACIONES, QUE AQUÍ IMPORTA
// ------------------------------------------
//   1. validar
//   2. crear la solicitud  ← lo único que puede hacer fallar la petición
//   3. intentar el aviso al equipo
//   4. responder 201
//
// El aviso va DESPUÉS de que la solicitud esté guardada y ENVUELTO en un
// try/catch que no puede lanzar: si el correo falla, la solicitud sigue
// existiendo y la docente ve su confirmación igual. Nunca al revés.
//
// Por qué el aviso se espera en vez de dispararlo y responder antes: en
// Vercel la función se congela en cuanto se cierra la respuesta, así que un
// envío «en segundo plano» se perdería en silencio la mayoría de las veces.
// Se espera, con tope de tiempo, y el resultado no cambia la respuesta.

import { sendError, Errors } from "../../_lib/errors.js";
import { requireUser, callRpc } from "../../_lib/supabase.js";
import { clientKey, enforceRateLimit, RateLimits } from "../../_lib/rate-limit.js";
import { notifyNewPaymentRequest } from "../../_lib/notifications.js";

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

/**
 * Nombre de la docente para el aviso. Se lee EN EL SERVIDOR con su propio
 * token en vez de aceptarlo del navegador: un nombre enviado por el cliente
 * es texto sin verificar, y acabaría impreso en el correo del equipo.
 *
 * Si falla, el aviso sale igual sin nombre. Nunca lanza.
 */
async function nombreDeLaDocente({ url, key, token, userId }) {
  try {
    const res = await fetch(
      `${url}/rest/v1/docentes?user_id=eq.${encodeURIComponent(userId)}&select=nombres,apellidos&limit=1`,
      {
        headers: { apikey: key, Authorization: `Bearer ${token}`, Accept: "application/json" },
        signal: AbortSignal.timeout(5_000),
      }
    );
    if (!res.ok) return null;
    const filas = await res.json().catch(() => null);
    const d = Array.isArray(filas) ? filas[0] : null;
    const nombre = [d?.nombres, d?.apellidos].filter(Boolean).join(" ").trim();
    return nombre || null;
  } catch {
    return null;
  }
}

/**
 * Avisa al equipo de que hay algo que verificar.
 *
 * Envuelto entero: ni un fallo de red, ni una configuración a medias, ni un
 * error inesperado pueden llegar al `catch` del manejador. La solicitud ya
 * está guardada y la docente tiene derecho a su confirmación.
 */
async function avisarAlEquipo({ auth, data, metodo, ref }) {
  try {
    const nombre = await nombreDeLaDocente({
      url: auth.url, key: auth.key, token: auth.token, userId: auth.user.id,
    });

    const resultado = await notifyNewPaymentRequest({
      nombre,
      email: auth.user.email,
      plan: data?.plan_nombre || data?.plan || "Pro",
      montoCentimos: data?.monto_centimos,
      moneda: data?.moneda,
      metodo,
      referencia: ref,
      fecha: new Date(),
    });

    if (!resultado?.sent) {
      // Ya está registrado en el log del propio mailer con su motivo; esta
      // línea ata el aviso perdido a la solicitud concreta, sin datos
      // personales, para poder rastrearlo después.
      console.warn("[sciverse:payment-notify-skipped]",
        JSON.stringify({ solicitud: data?.id ?? null, reason: resultado?.reason ?? "unknown" }));
    }
  } catch (error) {
    console.error("[sciverse:payment-notify-failed]",
      JSON.stringify({ detail: String(error?.message || error).slice(0, 200) }));
  }
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

    // ---- 2 · la solicitud. A partir de aquí ya existe en la base. --------
    const data = await callRpc({
      name: "request_plan",
      ...auth,
      body: { p_plan: plan, p_method: metodo, p_reference: ref },
    });

    // ---- 3 · aviso al equipo. Incapaz de romper nada. --------------------
    await avisarAlEquipo({ auth, data, metodo, ref });

    // ---- 4 · confirmación a la docente ----------------------------------
    return res.status(201).json(data);
  } catch (error) {
    return sendError(res, traducir(error), { endpoint: "payments/request" });
  }
}

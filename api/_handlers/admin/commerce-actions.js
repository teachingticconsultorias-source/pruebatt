// api/admin/commerce-actions.js — cambiar precios, límites y datos de pago.
//
// `support` NO llega aquí: exige rol `admin`, y las RPC lo vuelven a
// comprobar contra `admin_users`. Si un fallo en este fichero dejara pasar a
// alguien, la base seguiría rechazándolo.
//
// El parche viaja como objeto con lista blanca EN LOS DOS LADOS: aquí para
// dar un error legible, y otra vez en Postgres para que sea de verdad.
// Una clave no reconocida se rechaza; no se ignora en silencio, porque un
// campo ignorado parece guardado y no lo está.

import { sendError, Errors } from "../../_lib/errors.js";
import { requireAdmin, callAdminRpc } from "../../_lib/admin.js";
import { clientKey, enforceRateLimit, RateLimits } from "../../_lib/rate-limit.js";

const REASON_MAX = 300;

const CAMPOS_PLAN = new Set([
  "name", "description", "benefits", "price_cents", "currency",
  "billing_period_months", "ai_weekly_limit", "is_active", "sort_order",
]);

const CAMPOS_AJUSTES = new Set([
  "instructions", "whatsapp", "manual_payments_enabled", "is_configured",
]);

const CAMPOS_METODO = new Set([
  "label", "receiver_name", "account_number", "instructions",
  "is_enabled", "sort_order",
]);

const MENSAJES = [
  [/ADMIN_REQUIRED/i,               403, "Tu cuenta ya no tiene permisos de administración."],
  [/ADMIN_ROLE_INSUFFICIENT/i,      403, "Tu rol permite consultar la configuración, no cambiarla."],
  [/PLAN_NOT_FOUND/i,               404, "Ese plan ya no existe en el catálogo."],
  [/METHOD_NOT_FOUND/i,             404, "Ese método de pago no existe."],
  [/SETTINGS_NOT_FOUND/i,           404, "No encontramos la configuración de pagos."],
  [/UNKNOWN_FIELD|PATCH_INVALID/i,  400, "Hay un campo que no reconocemos. Vuelve a cargar la página."],
  [/NAME_INVALID/i,                 400, "El nombre del plan es obligatorio y no puede pasar de 60 caracteres."],
  [/LABEL_INVALID/i,                400, "El nombre del método es obligatorio y no puede pasar de 40 caracteres."],
  [/DESCRIPTION_TOO_LONG/i,         400, "La descripción no puede pasar de 240 caracteres."],
  [/INSTRUCTIONS_TOO_LONG/i,        400, "Las instrucciones son demasiado largas."],
  [/INSTRUCTIONS_REQUIRED/i,        400, "Escribe las instrucciones de pago antes de marcarlas como configuradas."],
  [/BENEFITS_TOO_MANY/i,            400, "Como máximo 8 beneficios por plan."],
  [/BENEFITS_INVALID/i,             400, "Los beneficios deben ser una lista."],
  [/PRICE_OUT_OF_RANGE/i,           400, "El precio debe estar entre S/ 0 y S/ 10 000."],
  [/CURRENCY_INVALID/i,             400, "La moneda debe ser PEN o USD."],
  [/DURATION_OUT_OF_RANGE/i,        400, "La duración debe estar entre 1 y 36 meses."],
  [/LIMIT_OUT_OF_RANGE/i,           400, "El límite semanal debe estar entre 0 y 10 000."],
  [/SORT_OUT_OF_RANGE/i,            400, "El orden debe estar entre 0 y 999."],
  [/PAID_PLAN_NEEDS_DURATION/i,     400, "Un plan con precio necesita una duración en meses."],
  [/FREE_PLAN_REQUIRED/i,           409, "El plan gratuito no se puede desactivar: es al que vuelve todo el mundo si algo falla."],
  [/FREE_PLAN_MUST_BE_FREE/i,       409, "El plan gratuito no puede tener precio."],
  [/PLAN_HAS_ACTIVE_SUBSCRIBERS/i,  409, "No puedes desactivar un plan que tiene docentes dentro: perderían lo que pagaron. Cámbialas de plan primero."],
  [/METHOD_INCOMPLETE/i,            400, "Para habilitar un método hace falta el nombre del receptor y el número."],
  [/ACCOUNT_INVALID/i,              400, "El número solo puede tener dígitos, espacios, guiones o paréntesis."],
  [/WHATSAPP_INVALID/i,             400, "El WhatsApp solo puede tener dígitos, espacios, guiones o paréntesis."],
  [/RECEIVER_TOO_LONG/i,            400, "El nombre del receptor es demasiado largo."],
  [/QR_PATH_INVALID/i,              400, "No pudimos registrar esa imagen. Vuelve a subirla."],
];

function traducir(error) {
  const crudo = `${error?.details ?? ""} ${error?.message ?? ""}`;
  for (const [re, status, mensaje] of MENSAJES) {
    if (re.test(crudo)) {
      const e = new Error(mensaje);
      e.status = status;
      e.code = "COMMERCE_ACTION_REJECTED";
      return e;
    }
  }
  return error;
}

/** Deja pasar sólo las claves permitidas, y rechaza si hay alguna de más. */
function limpiarParche(patch, permitidas) {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
    throw Errors.badRequest("No recibimos ningún cambio que guardar.");
  }
  const claves = Object.keys(patch);
  if (claves.length === 0) {
    throw Errors.badRequest("No recibimos ningún cambio que guardar.");
  }
  for (const clave of claves) {
    if (!permitidas.has(clave)) {
      throw Errors.badRequest("Hay un campo que no reconocemos. Vuelve a cargar la página.");
    }
  }
  return patch;
}

function codigo(valor) {
  const texto = String(valor ?? "").trim();
  if (!/^[a-z][a-z0-9_]{1,30}$/.test(texto)) {
    throw Errors.badRequest("Identificador no válido.");
  }
  return texto;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") throw Errors.methodNotAllowed();
    enforceRateLimit({ key: clientKey(req), bucket: "commerce-write", ...RateLimits.adminWrite });

    const admin = await requireAdmin(req, { minRole: "admin" });
    const { action, patch, reason } = req.body || {};
    const motivo = String(reason ?? "").trim().slice(0, REASON_MAX) || null;
    const comun = { url: admin.url, serviceKey: admin.serviceKey };

    let data;

    if (action === "update_plan") {
      data = await callAdminRpc({
        name: "admin_update_plan",
        ...comun,
        body: {
          p_actor: admin.user.id,
          p_code: codigo(req.body?.code),
          p_patch: limpiarParche(patch, CAMPOS_PLAN),
          p_reason: motivo,
        },
      });
    } else if (action === "update_settings") {
      data = await callAdminRpc({
        name: "admin_update_payment_settings",
        ...comun,
        body: {
          p_actor: admin.user.id,
          p_patch: limpiarParche(patch, CAMPOS_AJUSTES),
          p_reason: motivo,
        },
      });
    } else if (action === "update_method") {
      data = await callAdminRpc({
        name: "admin_update_payment_method",
        ...comun,
        body: {
          p_actor: admin.user.id,
          p_code: codigo(req.body?.code),
          p_patch: limpiarParche(patch, CAMPOS_METODO),
          p_reason: motivo,
        },
      });
    } else {
      throw Errors.badRequest("Acción no reconocida.");
    }

    return res.status(200).json({ ...data, action });
  } catch (error) {
    return sendError(res, traducir(error), { endpoint: "admin/commerce-actions" });
  }
}

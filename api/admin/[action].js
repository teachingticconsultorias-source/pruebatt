// api/admin/[action].js
//
// UNA SOLA FUNCIÓN PARA TODO EL PANEL DE ADMINISTRACIÓN
//
// POR QUÉ EXISTE ESTE FICHERO
// ---------------------------
// Vercel Hobby permite 12 Serverless Functions y cada fichero suelto bajo
// `/api` cuenta como una. Con Admin 3 y el bloque comercial pasamos de 12 a
// 19: el build terminaba bien y el deployment fallaba justo después.
//
// Una ruta dinámica agrupa los diez endpoints de administración en una sola
// función SIN cambiar ni una URL. `/api/admin/summary` sigue siendo
// `/api/admin/summary`; no hace falta `vercel.json`, ni rewrites, ni tocar el
// frontend, ni tocar los tests de contrato.
//
// LO QUE ESTE FICHERO NO HACE
// ---------------------------
// No autoriza, no valida y no toca la base. Cada manejador conserva su
// `requireAdmin`, su rate limit, su traducción de errores y su rol mínimo,
// exactamente como antes. Aquí sólo se decide a cuál llamar.
//
// El mapa es explícito a propósito: nada de resolver el nombre del módulo a
// partir de la URL. Si la ruta no está en esta lista, no existe.

import { sendError, Errors } from "../_lib/errors.js";

import summary        from "../_handlers/admin/summary.js";
import docentes       from "../_handlers/admin/docentes.js";
import docente        from "../_handlers/admin/docente.js";
import audit          from "../_handlers/admin/audit.js";
import payments       from "../_handlers/admin/payments.js";
import commerce       from "../_handlers/admin/commerce.js";
import actions        from "../_handlers/admin/actions.js";
import paymentActions from "../_handlers/admin/payment-actions.js";
import commerceActions from "../_handlers/admin/commerce-actions.js";
import paymentQr      from "../_handlers/admin/payment-qr.js";

/** URL pública → manejador. El nombre de la ruta es el de siempre. */
const RUTAS = {
  // lectura
  "summary":          summary,
  "docentes":         docentes,
  "docente":          docente,
  "audit":            audit,
  "payments":         payments,
  "commerce":         commerce,
  // escritura
  "actions":          actions,
  "payment-actions":  paymentActions,
  "commerce-actions": commerceActions,
  "payment-qr":       paymentQr,
};

export default async function handler(req, res) {
  const accion = String(req.query?.action ?? "");
  const destino = Object.prototype.hasOwnProperty.call(RUTAS, accion)
    ? RUTAS[accion]
    : null;

  if (!destino) {
    return sendError(res, Errors.notFound(), { endpoint: `admin/${accion}` });
  }

  // El manejador comprueba el método por su cuenta, igual que cuando era un
  // fichero suelto: un GET a una ruta de escritura sigue devolviendo 405.
  return destino(req, res);
}

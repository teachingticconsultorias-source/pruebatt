// api/admin/audit.js — historial administrativo de un docente. SOLO LECTURA.

import { sendError, Errors } from "../_lib/errors.js";
import { requireAdmin, callAdminRpc } from "../_lib/admin.js";
import { clientKey, enforceRateLimit, RateLimits } from "../_lib/rate-limit.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") throw Errors.methodNotAllowed();
    enforceRateLimit({ key: clientKey(req), bucket: "admin-read", ...RateLimits.adminRead });

    // La auditoría también la puede leer soporte: sirve para entender qué
    // pasó con una cuenta antes de responder a una consulta.
    const admin = await requireAdmin(req, { minRole: "support" });

    const userId = String(req.query?.userId ?? "").trim();
    if (userId && !UUID_RE.test(userId)) {
      throw Errors.badRequest("Identificador de docente no válido.");
    }

    const items = await callAdminRpc({
      name: "admin_audit_recent",
      url: admin.url,
      serviceKey: admin.serviceKey,
      body: { p_target: userId || null, p_limit: 20 },
    });

    return res.status(200).json({ items: items || [] });
  } catch (error) {
    return sendError(res, error, { endpoint: "admin/audit" });
  }
}

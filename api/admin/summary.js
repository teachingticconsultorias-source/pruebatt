// api/admin/summary.js — resumen del panel. SOLO LECTURA.
//
// Autorización por identidad real: sesión de Supabase + fila en
// sciverse_private.admin_users. Sin ADMIN_SECRET, sin claves en la URL.

import { sendError, Errors } from "../_lib/errors.js";
import { requireAdmin, callAdminRpc } from "../_lib/admin.js";
import { clientKey, enforceRateLimit, RateLimits } from "../_lib/rate-limit.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") throw Errors.methodNotAllowed();

    enforceRateLimit({ key: clientKey(req), bucket: "admin-read", ...RateLimits.adminRead });

    const admin = await requireAdmin(req, { minRole: "support" });
    const data = await callAdminRpc({
      name: "admin_summary",
      url: admin.url,
      serviceKey: admin.serviceKey,
    });

    return res.status(200).json({ summary: data, role: admin.role });
  } catch (error) {
    return sendError(res, error, { endpoint: "admin/summary" });
  }
}

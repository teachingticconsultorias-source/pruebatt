// api/admin/docente.js — ficha de un docente. SOLO LECTURA.

import { sendError, Errors } from "../../_lib/errors.js";
import { requireAdmin, callAdminRpc, scopeForRole } from "../../_lib/admin.js";
import { clientKey, enforceRateLimit, RateLimits } from "../../_lib/rate-limit.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") throw Errors.methodNotAllowed();

    enforceRateLimit({ key: clientKey(req), bucket: "admin-read", ...RateLimits.adminRead });

    const admin = await requireAdmin(req, { minRole: "support" });

    const userId = String(req.query?.userId ?? "").trim();
    if (!UUID_RE.test(userId)) throw Errors.badRequest("Identificador de docente no válido.");

    const data = await callAdminRpc({
      name: "admin_docente_detail",
      url: admin.url,
      serviceKey: admin.serviceKey,
      body: { p_user_id: userId },
    });

    if (data?.error === "NOT_FOUND") throw Errors.notFound("No encontramos a ese docente.");

    return res.status(200).json({ ...scopeForRole(data, admin.role), role: admin.role });
  } catch (error) {
    return sendError(res, error, { endpoint: "admin/docente" });
  }
}

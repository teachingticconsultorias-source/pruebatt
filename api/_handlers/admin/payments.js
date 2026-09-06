// api/admin/payments.js — bandeja de solicitudes. SOLO LECTURA.
// `support` puede verla: sirve para responder consultas sin poder aprobar.

import { sendError, Errors } from "../../_lib/errors.js";
import { requireAdmin, callAdminRpc } from "../../_lib/admin.js";
import { clientKey, enforceRateLimit, RateLimits } from "../../_lib/rate-limit.js";

const ESTADOS = ["pending", "approved", "rejected", "cancelled"];
const PAGE_SIZE_MAX = 100;
const SEARCH_MAX = 80;

function entero(valor, porDefecto, { min, max }) {
  const n = Number.parseInt(valor, 10);
  if (!Number.isFinite(n)) return porDefecto;
  return Math.min(max, Math.max(min, n));
}

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") throw Errors.methodNotAllowed();
    enforceRateLimit({ key: clientKey(req), bucket: "admin-read", ...RateLimits.adminRead });

    const admin = await requireAdmin(req, { minRole: "support" });

    const estado = ESTADOS.includes(req.query?.status) ? req.query.status : null;
    const page = entero(req.query?.page, 1, { min: 1, max: 10_000 });
    const pageSize = entero(req.query?.pageSize, 25, { min: 1, max: PAGE_SIZE_MAX });
    const search = String(req.query?.search ?? "").trim().slice(0, SEARCH_MAX) || null;

    const data = await callAdminRpc({
      name: "admin_list_payments",
      url: admin.url,
      serviceKey: admin.serviceKey,
      body: { p_status: estado, p_search: search, p_page: page, p_page_size: pageSize },
    });

    return res.status(200).json({ ...data, role: admin.role });
  } catch (error) {
    return sendError(res, error, { endpoint: "admin/payments" });
  }
}

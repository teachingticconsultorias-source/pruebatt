// api/admin/docentes.js — listado paginado y buscable. SOLO LECTURA.
//
// La paginación se resuelve en el servidor: el navegador nunca recibe la
// tabla entera. El tamaño de página se acota aquí Y en la función SQL, para
// que ninguna de las dos capas dependa de la otra.

import { sendError, Errors } from "../_lib/errors.js";
import { requireAdmin, callAdminRpc, scopeForRole } from "../_lib/admin.js";
import { clientKey, enforceRateLimit, RateLimits } from "../_lib/rate-limit.js";

const PAGE_SIZE_DEFAULT = 25;
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

    const page = entero(req.query?.page, 1, { min: 1, max: 10_000 });
    const pageSize = entero(req.query?.pageSize, PAGE_SIZE_DEFAULT, { min: 1, max: PAGE_SIZE_MAX });
    const search = String(req.query?.search ?? "").trim().slice(0, SEARCH_MAX) || null;

    const data = await callAdminRpc({
      name: "admin_list_docentes",
      url: admin.url,
      serviceKey: admin.serviceKey,
      body: { p_search: search, p_page: page, p_page_size: pageSize },
    });

    return res.status(200).json({ ...scopeForRole(data, admin.role), role: admin.role });
  } catch (error) {
    return sendError(res, error, { endpoint: "admin/docentes" });
  }
}

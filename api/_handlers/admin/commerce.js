// api/admin/commerce.js — catálogo de planes y configuración de pagos.
// SOLO LECTURA. `support` puede verlo: sirve para responder consultas sin
// poder cambiar un precio.
//
// Devuelve también los planes INACTIVOS, que la política de `plans` esconde
// al navegador: sin ellos no habría forma de volver a encender uno.

import { sendError, Errors } from "../../_lib/errors.js";
import { requireAdmin, callAdminRpc } from "../../_lib/admin.js";
import { clientKey, enforceRateLimit, RateLimits } from "../../_lib/rate-limit.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") throw Errors.methodNotAllowed();
    enforceRateLimit({ key: clientKey(req), bucket: "admin-read", ...RateLimits.adminRead });

    const admin = await requireAdmin(req, { minRole: "support" });
    const comun = { url: admin.url, serviceKey: admin.serviceKey };

    const [planes, pagos] = await Promise.all([
      callAdminRpc({ name: "admin_list_plans", ...comun, body: { p_actor: admin.user.id } }),
      callAdminRpc({ name: "admin_payment_config", ...comun, body: { p_actor: admin.user.id } }),
    ]);

    return res.status(200).json({
      role: admin.role,
      // `puedeEditar` es una comodidad para la interfaz, NO un permiso: quien
      // decide es el backend, y la propia RPC lo vuelve a comprobar.
      puedeEditar: admin.role === "admin" || admin.role === "superadmin",
      plans: planes?.items || [],
      settings: pagos?.settings || null,
      methods: pagos?.methods || [],
    });
  } catch (error) {
    return sendError(res, error, { endpoint: "admin/commerce" });
  }
}

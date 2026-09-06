// api/payments/mine.js — historial de solicitudes del propio docente.
// Nunca incluye las notas internas del administrador.

import { sendError, Errors } from "../../_lib/errors.js";
import { requireUser, callRpc } from "../../_lib/supabase.js";
import { clientKey, enforceRateLimit, RateLimits } from "../../_lib/rate-limit.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") throw Errors.methodNotAllowed();
    enforceRateLimit({ key: clientKey(req), bucket: "payment-mine", ...RateLimits.readOwn });

    const auth = await requireUser(req);
    const items = await callRpc({ name: "my_payment_requests", ...auth });

    return res.status(200).json({ items: items || [] });
  } catch (error) {
    return sendError(res, error, { endpoint: "payments/mine" });
  }
}

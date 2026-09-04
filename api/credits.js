// api/credits.js
//
// Estado semanal de créditos de IA del docente autenticado.
//
// Este endpoint existía desde hace tiempo pero estaba HUÉRFANO: su único
// consumidor (`components/CreditsIndicator.jsx`) nunca se importaba, así que
// la docente no tenía forma de saber cuántas creaciones le quedaban.
// Desde el Bloque B, `CreditsIndicator` está conectado en la barra lateral.

import { Errors, sendError } from "./_lib/errors.js";
import { requireUser } from "./_lib/supabase.js";
import { getCreditStatus } from "./_lib/credits.js";
import { clientKey, enforceRateLimit, RateLimits } from "./_lib/rate-limit.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") throw Errors.methodNotAllowed();

    const auth = await requireUser(req);
    enforceRateLimit({
      key: clientKey(req, auth.user.id),
      bucket: "credits",
      ...RateLimits.readOwn,
    });

    const status = await getCreditStatus({
      token: auth.token,
      url: auth.url,
      key: auth.key,
    });

    return res.status(200).json(status);
  } catch (error) {
    return sendError(res, error, { endpoint: "credits" });
  }
}

// api/payments/[action].js
//
// Los dos endpoints del docente en una sola función, por el límite de 12
// Serverless Functions de Vercel Hobby. Ver la explicación larga en
// `api/admin/[action].js`.
//
// Las URL no cambian: `/api/payments/request` y `/api/payments/mine` siguen
// respondiendo igual, con el mismo método, el mismo rate limit y los mismos
// mensajes. Aquí sólo se elige el manejador.

import { sendError, Errors } from "../_lib/errors.js";

import request from "../_handlers/payments/request.js";
import mine    from "../_handlers/payments/mine.js";

const RUTAS = {
  "request": request,
  "mine":    mine,
};

export default async function handler(req, res) {
  const accion = String(req.query?.action ?? "");
  const destino = Object.prototype.hasOwnProperty.call(RUTAS, accion)
    ? RUTAS[accion]
    : null;

  if (!destino) {
    return sendError(res, Errors.notFound(), { endpoint: `payments/${accion}` });
  }

  return destino(req, res);
}

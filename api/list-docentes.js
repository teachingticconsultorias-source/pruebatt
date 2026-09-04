// api/list-docentes.js
//
// Listado de docentes para el panel de administración.
//
// Usa la clave `service_role` (secreta, solo del lado servidor) porque RLS
// bloquea la lectura cruzada entre docentes.
//
// CAMBIOS DE SEGURIDAD (Bloque B)
// -------------------------------
//   • El secreto viaja en la cabecera `Authorization: Bearer`, NUNCA en la
//     query string. Antes quedaba registrado en los logs de acceso de Vercel,
//     en el historial del navegador y podía filtrarse por `Referer`.
//   • Comparación en tiempo constante (`crypto.timingSafeEqual`).
//   • Columnas explícitas en vez de `select("*")`.
//   • `celular` (dato personal sensible) NO se devuelve salvo petición
//     explícita con `?includePhone=1`, y ese acceso queda registrado.
//   • Paginación obligatoria con tope máximo.
//   • Limitación de intentos para frenar fuerza bruta ingenua.
//
// NOTA: esto sigue siendo un secreto compartido, sin identidad ni roles.
// La sustitución por roles reales es Admin V2 (docs/audit/13-ADMIN-AUDIT.md).

import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { Errors, sendError } from "./_lib/errors.js";
import { clientKey, enforceRateLimit, RateLimits } from "./_lib/rate-limit.js";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

/** Columnas seguras por defecto: sin `celular` y sin columnas internas. */
const SAFE_COLUMNS = [
  "id",
  "nombres",
  "apellidos",
  "ie",
  "correo",
  "nivel",
  "plan",
  "activo",
  "created_at",
].join(",");

const COLUMNS_WITH_PHONE = `${SAFE_COLUMNS},celular`;

/** Comparación en tiempo constante, resistente a distinta longitud. */
function secretMatches(provided, expected) {
  if (!expected || !provided) return false;
  const a = Buffer.from(String(provided));
  const b = Buffer.from(String(expected));
  // timingSafeEqual exige la misma longitud: comparamos hashes de tamaño fijo.
  const ha = crypto.createHash("sha256").update(a).digest();
  const hb = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function readAdminSecret(req) {
  const header = req.headers?.authorization || "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match ? match[1].trim() : null;
}

function parseIntParam(value, fallback, { min, max }) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

export default async function handler(req, res) {
  const key = clientKey(req);

  try {
    if (req.method !== "GET") throw Errors.methodNotAllowed();

    // Frena la fuerza bruta antes de tocar nada más.
    enforceRateLimit({ key, bucket: "admin-auth", ...RateLimits.adminAuth });

    const expected = process.env.ADMIN_SECRET;
    if (!expected) throw Errors.misconfigured("ADMIN_SECRET no está definida");

    // El secreto por query string ya NO se acepta: si alguien lo envía así,
    // se rechaza y se avisa (sin registrar nunca el valor).
    if (req.query?.secret) {
      console.warn(
        "[sciverse:admin] intento de autenticación por query string rechazado"
      );
      throw Errors.notAuthorized();
    }

    const provided = readAdminSecret(req);
    if (!secretMatches(provided, expected)) throw Errors.notAuthorized();

    // Autenticado: aplicamos el límite de lectura, más holgado.
    enforceRateLimit({ key, bucket: "admin-read", ...RateLimits.adminRead });

    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) {
      throw Errors.misconfigured("Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
    }

    const limit = parseIntParam(req.query?.limit, DEFAULT_LIMIT, { min: 1, max: MAX_LIMIT });
    const page = parseIntParam(req.query?.page, 0, { min: 0, max: 100_000 });
    const includePhone = req.query?.includePhone === "1";
    const search = typeof req.query?.search === "string" ? req.query.search.trim().slice(0, 120) : "";

    if (includePhone) {
      // Acceso a dato personal sensible: queda constancia en el log.
      console.warn(
        "[sciverse:admin] listado solicitado CON celular",
        JSON.stringify({ page, limit, at: new Date().toISOString() })
      );
    }

    const supabaseAdmin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    let query = supabaseAdmin
      .from("docentes")
      .select(includePhone ? COLUMNS_WITH_PHONE : SAFE_COLUMNS, { count: "exact" })
      .order("created_at", { ascending: false })
      .range(page * limit, page * limit + limit - 1);

    if (search) {
      const safe = search.replace(/[,()]/g, " ");
      query = query.or(
        `nombres.ilike.%${safe}%,apellidos.ilike.%${safe}%,correo.ilike.%${safe}%,ie.ilike.%${safe}%`
      );
    }

    const { data, error, count } = await query;
    if (error) throw Errors.internal(`consulta docentes: ${error.message}`);

    const total = count ?? 0;
    return res.status(200).json({
      docentes: data || [],
      page,
      limit,
      total,
      hasMore: (page + 1) * limit < total,
    });
  } catch (error) {
    return sendError(res, error, { endpoint: "list-docentes" });
  }
}

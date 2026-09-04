// api/_lib/rate-limit.js
//
// ⚠️ LIMITACIÓN IMPORTANTE — LEER ANTES DE CONFIAR EN ESTO
// ---------------------------------------------------------
// Esto es un limitador EN MEMORIA y POR INSTANCIA. No es rate limiting
// distribuido.
//
// En Vercel cada función serverless puede ejecutarse en varias instancias
// simultáneas y cada una arranca con su propio contador; además, las
// instancias se reciclan y el contador se pierde. En la práctica esto
// significa que el límite efectivo puede ser N veces el configurado,
// siendo N el número de instancias activas.
//
// Qué SÍ consigue:
//   • frena ráfagas rápidas desde un mismo origen contra una misma instancia
//     (el caso típico de un script de fuerza bruta ingenuo)
//   • pone un techo por proceso al abuso accidental
//
// Qué NO consigue:
//   • un límite global y exacto por usuario o IP
//   • protección frente a un atacante distribuido o paciente
//
// Para límites reales hace falta un almacén compartido (Upstash Redis,
// Vercel KV o una tabla en Supabase). Registrado como trabajo pendiente en
// docs/audit/19-IMPROVEMENT-BACKLOG.md (B-032).
//
// La defensa real del gasto en IA no es esto, sino el consumo de créditos
// (api/_lib/credits.js), que sí es atómico y persistente en Postgres.

import { Errors } from "./errors.js";

/** Map<clave, number[]> con las marcas de tiempo de las peticiones recientes. */
const hits = new Map();

/** Evita que el Map crezca sin límite en instancias de larga vida. */
const MAX_TRACKED_KEYS = 5_000;

function pruneIfNeeded(now, windowMs) {
  if (hits.size <= MAX_TRACKED_KEYS) return;
  for (const [key, timestamps] of hits) {
    const alive = timestamps.filter((t) => now - t < windowMs);
    if (alive.length === 0) hits.delete(key);
    else hits.set(key, alive);
  }
}

/** Identificador del cliente: usuario autenticado si lo hay, si no la IP. */
export function clientKey(req, userId = null) {
  if (userId) return `u:${userId}`;
  const forwarded = req.headers?.["x-forwarded-for"];
  const ip =
    (typeof forwarded === "string" ? forwarded.split(",")[0] : forwarded?.[0]) ||
    req.headers?.["x-real-ip"] ||
    req.socket?.remoteAddress ||
    "unknown";
  return `ip:${String(ip).trim()}`;
}

/**
 * Aplica el límite. Lanza `Errors.rateLimited()` si se supera.
 *
 * @param {object} options
 * @param {string} options.key       identificador del cliente
 * @param {string} options.bucket    nombre del endpoint protegido
 * @param {number} options.limit     peticiones permitidas por ventana
 * @param {number} options.windowMs  tamaño de la ventana
 */
export function enforceRateLimit({ key, bucket, limit, windowMs }) {
  const now = Date.now();
  const mapKey = `${bucket}:${key}`;

  const previous = hits.get(mapKey) || [];
  const recent = previous.filter((timestamp) => now - timestamp < windowMs);

  if (recent.length >= limit) {
    const oldest = recent[0];
    const retryAfter = Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000));
    hits.set(mapKey, recent);
    throw Errors.rateLimited(retryAfter);
  }

  recent.push(now);
  hits.set(mapKey, recent);
  pruneIfNeeded(now, windowMs);
}

/** Presets por tipo de endpoint. */
export const RateLimits = {
  /** Generación con IA: cara. El crédito es el límite real; esto frena ráfagas. */
  aiGeneration: { limit: 30, windowMs: 60_000 },
  /** Sugerencias de campo: baratas pero no gratis. */
  aiSuggestion: { limit: 60, windowMs: 60_000 },
  /** Listado de administración: protege el secreto frente a fuerza bruta ingenua. */
  adminRead: { limit: 20, windowMs: 60_000 },
  /** Intentos fallidos de autenticación de administración. */
  adminAuth: { limit: 8, windowMs: 300_000 },
  /** Consultas de solo lectura del propio usuario. */
  readOwn: { limit: 120, windowMs: 60_000 },
};

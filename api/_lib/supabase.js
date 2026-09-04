// api/_lib/supabase.js
//
// Configuración y autenticación de Supabase para las funciones serverless.
// Antes esta lógica estaba repetida (con variantes incoherentes) en 5 endpoints:
// `generate-session.js` era el único SIN respaldo a SUPABASE_URL, lo que provocaba
// un 401 inexplicable si solo esa variable estaba definida.

import { Errors } from "./errors.js";

/** URL y clave pública de Supabase, con los mismos respaldos en todos los endpoints. */
export function getSupabaseConfig() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key =
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw Errors.misconfigured("Faltan VITE_SUPABASE_URL / clave pública de Supabase");
  }
  return { url, key };
}

/** Extrae el token Bearer de la cabecera Authorization. */
export function getBearerToken(req) {
  const header = req.headers?.authorization || "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match ? match[1].trim() : null;
}

/**
 * Verifica el token contra Supabase Auth y devuelve el usuario.
 * @returns {Promise<{ user: object, token: string, url: string, key: string }>}
 */
export async function requireUser(req) {
  const token = getBearerToken(req);
  if (!token) throw Errors.authRequired();

  const { url, key } = getSupabaseConfig();

  let response;
  try {
    response = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: key, Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    throw Errors.internal(`fallo verificando sesión: ${error?.message}`);
  }

  if (!response.ok) throw Errors.sessionExpired();

  const user = await response.json().catch(() => null);
  if (!user?.id) throw Errors.sessionExpired();

  return { user, token, url, key };
}

/**
 * Llama a una función RPC de Postgres con el token del usuario,
 * de modo que RLS y `auth.uid()` siguen aplicando.
 */
export async function callRpc({ name, token, url, key, body = {} }) {
  let response;
  try {
    response = await fetch(`${url}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: key,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    throw Errors.internal(`RPC ${name} no respondió: ${error?.message}`);
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const raw = data?.message || `HTTP ${response.status}`;
    // Traducimos los errores conocidos que lanzan las funciones de créditos.
    if (/AUTH_REQUIRED/i.test(raw)) throw Errors.sessionExpired();
    if (/PROFILE_NOT_FOUND/i.test(raw)) throw Errors.profileNotFound();
    if (/ACCOUNT_INACTIVE/i.test(raw)) throw Errors.accountInactive();
    throw Errors.internal(`RPC ${name}: ${raw}`);
  }

  return data;
}

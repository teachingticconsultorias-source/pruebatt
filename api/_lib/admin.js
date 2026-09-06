// api/_lib/admin.js
//
// Autorización administrativa.
//
// CÓMO FUNCIONA
// -------------
//   navegador → JWT normal de Supabase
//      ↓
//   requireUser()            valida el token contra Auth
//      ↓
//   public.current_admin()   se llama CON EL TOKEN DEL USUARIO
//      ↓                     (por eso no sirve de nada falsificar nada)
//   si es admin → las funciones de datos se llaman con SERVICE ROLE
//
// El frontend no decide nada: puede ocultar botones por comodidad, pero si
// alguien llama al endpoint a mano recibe el mismo 403.
//
// No usa ADMIN_SECRET. El secreto compartido sigue vivo sólo en
// `api/list-docentes.js` hasta que este panel esté validado en producción.

import { Errors } from "./errors.js";
import { requireUser, callRpc } from "./supabase.js";

/** Jerarquía. Un rol cubre a los de menor nivel. */
const RANK = { support: 1, admin: 2, superadmin: 3 };

export const ADMIN_ROLES = Object.keys(RANK);

/** Clave de servicio. Sólo existe en el servidor. */
export function getServiceKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || null;
}

/**
 * Valida la sesión y comprueba que sea administrador.
 *
 * @param {object} req
 * @param {{minRole?: 'support'|'admin'|'superadmin'}} opciones
 * @returns {Promise<{user:object, token:string, url:string, key:string, role:string, serviceKey:string}>}
 * @throws AppError 401 sin sesión · 403 si no es admin o no alcanza el rol
 */
export async function requireAdmin(req, { minRole = "support" } = {}) {
  const auth = await requireUser(req); // 401 si el token no vale

  const serviceKey = getServiceKey();
  if (!serviceKey) throw Errors.misconfigured("SUPABASE_SERVICE_ROLE_KEY no está definida");

  // Se pregunta CON EL TOKEN DEL USUARIO: la función lee auth.uid().
  let estado;
  try {
    estado = await callRpc({ name: "current_admin", ...auth });
  } catch (error) {
    // Si la función aún no existe, el panel simplemente no está disponible.
    throw Errors.misconfigured(`current_admin no disponible: ${error?.message}`);
  }

  if (!estado?.is_admin) {
    throw Errors.forbidden("Esta sección es solo para el equipo de SciVerse.");
  }

  const role = estado.role;
  if ((RANK[role] || 0) < (RANK[minRole] || 0)) {
    throw Errors.forbidden("Tu rol no tiene acceso a esta sección.");
  }

  return { ...auth, role, serviceKey };
}

/**
 * Llama a una función de datos administrativa con la clave de servicio.
 * Sólo debe usarse DESPUÉS de `requireAdmin`.
 */
export function callAdminRpc({ name, url, serviceKey, body = {} }) {
  return callRpc({ name, token: serviceKey, url, key: serviceKey, body });
}

/**
 * Recorta lo que ve cada rol.
 *
 * `support` atiende consultas; no necesita el teléfono de nadie para eso.
 * La decisión se toma en el servidor: el rol no viaja al navegador como
 * permiso, sólo como etiqueta.
 */
export function scopeForRole(payload, role) {
  if (role !== "support") return payload;

  const copia = JSON.parse(JSON.stringify(payload ?? {}));
  if (copia?.perfil) delete copia.perfil.celular;
  if (Array.isArray(copia?.items)) {
    for (const it of copia.items) delete it.celular;
  }
  return copia;
}

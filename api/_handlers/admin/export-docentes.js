// api/admin/export-docentes.js — la lista completa, para bajarla a Excel.
//
// POR QUÉ NO ES UNA FUNCIÓN NUEVA DE VERCEL
// -----------------------------------------
// Entra por `api/admin/[action].js`, la ruta agrupada que ya reúne los diez
// endpoints del panel. Seguimos en 8 de 12.
//
// POR QUÉ EL .XLSX SE ARMA EN EL NAVEGADOR Y NO AQUÍ
// -------------------------------------------------
// El servidor decide QUÉ FILAS salen —el gate, los filtros y el recorte por
// rol— y deja la huella. Convertirlas a Excel es presentación, y hacerlo aquí
// obligaría a subir ExcelJS al bundle de la función sin ganar nada: los datos
// viajan al panel de todas formas.
//
// EL RECORTE POR ROL SE APLICA DOS VECES, A PROPÓSITO
// ---------------------------------------------------
// `admin_export_docentes` ya devuelve `celular` en null para `support`, y aquí
// pasa además por `scopeForRole`. Es el dato más sensible de la tabla: no debe
// depender de que una sola capa se acuerde.

import { sendError, Errors } from "../../_lib/errors.js";
import { requireAdmin, callAdminRpc, scopeForRole } from "../../_lib/admin.js";
import { clientKey, enforceRateLimit, RateLimits } from "../../_lib/rate-limit.js";

const SEARCH_MAX = 80;
const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;
const NIVELES = new Set(["primaria", "secundaria"]);

/** `"true"` / `"false"` / ausente → true / false / null (no filtrar). */
function terciario(valor) {
  if (valor === "true" || valor === true) return true;
  if (valor === "false" || valor === false) return false;
  return null;
}

/** Una fecha `YYYY-MM-DD`, o null. No se «corrige» lo que llegue mal. */
function fecha(valor) {
  const t = String(valor ?? "").trim();
  return FECHA_RE.test(t) ? t : null;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") throw Errors.methodNotAllowed();

    // Mismo cubo que el resto de lecturas del panel: un export es caro, pero
    // no más caro que pasar veinte páginas del listado.
    enforceRateLimit({ key: clientKey(req), bucket: "admin-read", ...RateLimits.adminRead });

    // `support` puede exportar: es el mismo dato que ya ve en pantalla, y la
    // función le quita el teléfono.
    const admin = await requireAdmin(req, { minRole: "support" });

    const nivel = String(req.query?.nivel ?? "").trim().toLowerCase();
    const plan = String(req.query?.plan ?? "").trim().toLowerCase();

    const filtros = {
      p_actor: admin.user.id,
      p_search: String(req.query?.search ?? "").trim().slice(0, SEARCH_MAX) || null,
      // El plan se acota a lo que la interfaz ofrece: cualquier otra cosa se
      // ignora en vez de viajar a la consulta.
      p_plan: plan === "free" || plan === "pro" ? plan : null,
      p_desde: fecha(req.query?.desde),
      p_hasta: fecha(req.query?.hasta),
      p_nivel: NIVELES.has(nivel) ? nivel : null,
      p_confirmado: terciario(req.query?.confirmado),
      p_activo: terciario(req.query?.activo),
    };

    const data = await callAdminRpc({
      name: "admin_export_docentes",
      url: admin.url,
      serviceKey: admin.serviceKey,
      body: filtros,
    });

    // `scopeForRole` recorta `items[].celular`; la función ya lo devolvía en
    // null para support, así que esto es el segundo cerrojo.
    return res.status(200).json({ ...scopeForRole(data, admin.role), role: admin.role });
  } catch (error) {
    return sendError(res, error, { endpoint: "admin/export-docentes" });
  }
}

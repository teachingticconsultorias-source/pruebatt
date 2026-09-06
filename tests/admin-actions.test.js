import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { requireAdmin } from "../api/_lib/admin.js";

/* ============================================================================
   ADMIN 2 · MUTACIONES

   La regla del bloque: ninguna acción se decide en el navegador. Aquí se
   comprueba la primera de las DOS barreras —la de la API—; la segunda vive
   dentro de cada RPC, que vuelve a mirar admin_users. Esa redundancia es
   deliberada: si esta capa fallara, la base seguiría rechazando.
   ========================================================================== */

function mockAuth({ userOk = true, admin = null }) {
  global.fetch = vi.fn(async (url) => {
    const u = String(url);
    if (u.includes("/auth/v1/user")) {
      return userOk
        ? { ok: true, status: 200, json: async () => ({ id: "actor-1", email: "a@x.pe" }) }
        : { ok: false, status: 401, json: async () => ({ message: "invalid" }) };
    }
    if (u.includes("current_admin")) {
      return { ok: true, status: 200, json: async () => admin ?? { is_admin: false, role: null } };
    }
    return { ok: true, status: 200, json: async () => ({ ok: true }) };
  });
}

const req = { headers: { authorization: "Bearer token-de-prueba" } };

describe("admin 2 · quién puede mutar", () => {
  beforeEach(() => {
    process.env.VITE_SUPABASE_URL = "https://proyecto.supabase.co";
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY = "clave-publica";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "clave-de-servicio-de-prueba";
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it("sin JWT no se puede mutar", async () => {
    mockAuth({ userOk: true });
    await expect(requireAdmin({ headers: {} }, { minRole: "admin" }))
      .rejects.toMatchObject({ status: 401 });
  });

  it("JWT inválido no se puede mutar", async () => {
    mockAuth({ userOk: false });
    await expect(requireAdmin(req, { minRole: "admin" }))
      .rejects.toMatchObject({ status: 401 });
  });

  it("un docente normal NO puede mutar", async () => {
    mockAuth({ userOk: true, admin: { is_admin: false, role: null } });
    await expect(requireAdmin(req, { minRole: "admin" }))
      .rejects.toMatchObject({ status: 403 });
  });

  it("support NO puede mutar, aunque sí lea", async () => {
    mockAuth({ userOk: true, admin: { is_admin: true, role: "support" } });
    // Lee sin problema…
    expect((await requireAdmin(req, { minRole: "support" })).role).toBe("support");
    // …pero las mutaciones exigen admin.
    await expect(requireAdmin(req, { minRole: "admin" }))
      .rejects.toMatchObject({ status: 403 });
  });

  it("admin SÍ puede mutar", async () => {
    mockAuth({ userOk: true, admin: { is_admin: true, role: "admin" } });
    const r = await requireAdmin(req, { minRole: "admin" });
    expect(r.role).toBe("admin");
    expect(r.user.id).toBe("actor-1");   // el actor que se registra en auditoría
  });

  it("superadmin SÍ puede mutar", async () => {
    mockAuth({ userOk: true, admin: { is_admin: true, role: "superadmin" } });
    expect((await requireAdmin(req, { minRole: "admin" })).role).toBe("superadmin");
  });
});

/* ============================================================================
   TRADUCCIÓN DE ERRORES
   Lo que lanza Postgres no puede llegar a la pantalla de un administrador.
   ========================================================================== */
describe("admin 2 · errores para el administrador", () => {
  // Misma tabla que api/_handlers/admin/actions.js.
  const MENSAJES = [
    [/ADMIN_REQUIRED/i, 403, "Tu cuenta ya no tiene permisos de administración."],
    [/ADMIN_ROLE_INSUFFICIENT/i, 403, "Tu rol no permite realizar esta acción."],
    [/TARGET_REQUIRED|TARGET_NOT_FOUND/i, 404, "No encontramos a ese docente."],
    [/PLAN_NOT_FOUND/i, 400, "Ese plan no existe o está desactivado."],
    [/DURATION_OUT_OF_RANGE/i, 400, "La duración debe estar entre 1 y 36 meses."],
    [/NO_ACTIVE_SUBSCRIPTION/i, 409, "Este docente no tiene una suscripción activa que extender."],
    [/PLAN_HAS_NO_EXPIRY/i, 409, "El plan actual no tiene vencimiento, así que no hay nada que extender."],
    [/CONCURRENT_CHANGE/i, 409, "Otro administrador acaba de cambiar este plan. Vuelve a cargar la ficha."],
  ];

  function traducir(error) {
    const crudo = `${error?.details ?? ""} ${error?.message ?? ""}`;
    for (const [re, status, mensaje] of MENSAJES) {
      if (re.test(crudo)) {
        const e = new Error(mensaje);
        e.status = status;
        return e;
      }
    }
    return error;
  }

  it("cada excepción de la base tiene su mensaje humano", () => {
    const casos = [
      ["ADMIN_REQUIRED", 403], ["ADMIN_ROLE_INSUFFICIENT", 403],
      ["TARGET_NOT_FOUND", 404], ["PLAN_NOT_FOUND", 400],
      ["DURATION_OUT_OF_RANGE", 400], ["NO_ACTIVE_SUBSCRIPTION", 409],
      ["PLAN_HAS_NO_EXPIRY", 409], ["CONCURRENT_CHANGE", 409],
    ];
    for (const [crudo, status] of casos) {
      const t = traducir(Object.assign(new Error("x"), { details: `RPC foo: ${crudo}` }));
      expect(t.status, crudo).toBe(status);
      expect(t.message, crudo).not.toMatch(/PGRST|postgres|RPC|SQL|_[A-Z]{3,}/);
    }
  });

  it("el choque de dos administradores tiene mensaje propio y accionable", () => {
    const t = traducir(Object.assign(new Error("x"), { details: "RPC admin_change_plan: CONCURRENT_CHANGE" }));
    expect(t.message).toContain("Otro administrador");
    expect(t.message).toContain("Vuelve a cargar");
  });

  it("un error desconocido no se disfraza: sigue siendo genérico", () => {
    const original = Object.assign(new Error("boom"), { details: "algo raro" });
    expect(traducir(original)).toBe(original);
  });
});

/* ============================================================================
   CONTRATO DE LA MIGRACIÓN 006
   No se puede ejecutar SQL aquí, así que se comprueba sobre el fichero que
   las garantías prometidas están realmente escritas.
   ========================================================================== */
describe("admin 2 · garantías de la migración", () => {
  const fs = require("node:fs");
  const sql = fs.readFileSync("supabase/migrations/006_admin_actions.sql", "utf8");
  const activo = sql.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");

  it("es transaccional", () => {
    expect(activo).toMatch(/^begin;/m);
    expect(activo).toMatch(/^commit;/m);
  });

  it("no borra datos", () => {
    expect(activo).not.toMatch(/drop table|delete from|truncate|drop column/i);
  });

  it("las cuatro acciones vuelven a comprobar el rol del actor", () => {
    for (const fn of ["admin_set_account_status", "admin_change_plan", "admin_extend_plan"]) {
      const cuerpo = activo.slice(activo.indexOf(`function public.${fn}`));
      expect(cuerpo.slice(0, 900), fn).toContain("require_admin_role");
    }
  });

  it("cambiar de plan conserva el historial en vez de sobrescribirlo", () => {
    const cuerpo = activo.slice(activo.indexOf("function public.admin_change_plan"));
    expect(cuerpo).toContain("status = 'cancelled'");   // cierra la anterior
    expect(cuerpo).toContain("insert into public.subscriptions"); // crea una nueva
    expect(cuerpo).not.toMatch(/update public\.subscriptions\s+set plan_code/);
  });

  it("bloquea filas antes de modificarlas", () => {
    expect((activo.match(/for update/g) || []).length).toBeGreaterThanOrEqual(3);
  });

  it("trata el choque concurrente de forma explícita", () => {
    expect(activo).toContain("unique_violation");
    expect(activo).toContain("CONCURRENT_CHANGE");
  });

  it("las cuatro acciones escriben auditoría", () => {
    const inserts = (activo.match(/insert into sciverse_private\.admin_audit_log/g) || []).length;
    expect(inserts).toBe(3); // suspender/reactivar comparten función
    for (const accion of ["ADMIN_SUSPENDED_USER", "ADMIN_REACTIVATED_USER",
                          "ADMIN_CHANGED_PLAN", "ADMIN_EXTENDED_PLAN"]) {
      expect(activo, accion).toContain(accion);
    }
  });

  it("la auditoría no guarda secretos", () => {
    const auditoria = activo.match(/insert into sciverse_private\.admin_audit_log[\s\S]{0,900}?\);/g) || [];
    for (const bloque of auditoria) {
      expect(bloque).not.toMatch(/token|jwt|password|contrasen|service_role|prompt/i);
    }
  });

  it("ninguna función queda ejecutable por anon o authenticated", () => {
    for (const fn of ["admin_set_account_status", "admin_change_plan",
                      "admin_extend_plan", "admin_audit_recent"]) {
      const revoke = new RegExp(`revoke all on function public\\.${fn}[^;]*from public, anon, authenticated`);
      expect(activo, fn).toMatch(revoke);
      const grant = new RegExp(`grant execute on function public\\.${fn}[^;]*to service_role`);
      expect(activo, fn).toMatch(grant);
    }
  });

  it("todas las funciones fijan search_path y son SECURITY DEFINER", () => {
    const definers = (activo.match(/security definer/g) || []).length;
    const paths = (activo.match(/set search_path = ''/g) || []).length;
    expect(definers).toBe(paths);
    expect(definers).toBeGreaterThanOrEqual(5);
  });

  it("NO siembra planes de pago: los nombres y precios los decide el equipo", () => {
    expect(activo).not.toMatch(/insert into public\.plans/);
  });
});

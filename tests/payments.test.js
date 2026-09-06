import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import { requireAdmin } from "../api/_lib/admin.js";

const SQL = fs.readFileSync("supabase/migrations/007_payments.sql", "utf8");
const ACTIVO = SQL.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");

/* ============================================================================
   EL PRECIO NUNCA VIENE DEL NAVEGADOR

   Es la regla más importante del bloque: si el cliente pudiera enviar el
   importe, cualquiera compraría el plan Pro por un sol.
   ========================================================================== */
describe("pagos · el importe lo fija el servidor", () => {
  it("request_plan solo acepta plan, método y referencia", () => {
    const firma = ACTIVO.slice(ACTIVO.indexOf("function public.request_plan"));
    const params = firma.slice(0, firma.indexOf(")"));
    expect(params).toContain("p_plan");
    expect(params).toContain("p_method");
    expect(params).toContain("p_reference");
    // Nada que huela a dinero o a derechos.
    for (const prohibido of ["p_amount", "p_price", "p_cents", "p_limit",
                             "p_duration", "p_months", "p_features"]) {
      expect(params, prohibido).not.toContain(prohibido);
    }
  });

  it("el importe se lee de public.plans dentro de la función", () => {
    const cuerpo = ACTIVO.slice(ACTIVO.indexOf("function public.request_plan"));
    expect(cuerpo).toContain("from public.plans where code = p_plan");
    expect(cuerpo).toContain("v_plan.price_cents");
  });

  it("la solicitud guarda una instantánea del catálogo", () => {
    const cuerpo = ACTIVO.slice(ACTIVO.indexOf("function public.request_plan"));
    for (const campo of ["amount_cents", "currency", "plan_name", "billing_period_months"]) {
      expect(cuerpo, campo).toContain(campo);
    }
  });

  it("aprobar usa el periodo guardado, no el catálogo de hoy", () => {
    const cuerpo = ACTIVO.slice(ACTIVO.indexOf("function public.admin_approve_payment"));
    expect(cuerpo).toContain("v_req.billing_period_months");
  });

  it("el endpoint del docente no reenvía ningún importe", () => {
    const js = fs.readFileSync("api/_handlers/payments/request.js", "utf8");
    const cuerpo = js.slice(js.indexOf("callRpc"));
    expect(cuerpo).toContain("p_plan");
    expect(cuerpo).not.toMatch(/amount|price|cents|p_months/i);
  });
});

/* ============================================================================
   DUPLICADOS Y PLAN YA ACTIVO
   ========================================================================== */
describe("pagos · solicitudes repetidas", () => {
  it("la BASE impide dos pendientes del mismo plan", () => {
    expect(ACTIVO).toMatch(/create unique index[^;]*payment_requests_one_pending[\s\S]*?where status = 'pending'/);
  });

  it("la función traduce el choque a un error propio", () => {
    const cuerpo = ACTIVO.slice(ACTIVO.indexOf("function public.request_plan"));
    expect(cuerpo).toContain("unique_violation");
    expect(cuerpo).toContain("REQUEST_ALREADY_PENDING");
  });

  it("no se puede solicitar el plan que ya se tiene activo", () => {
    const cuerpo = ACTIVO.slice(ACTIVO.indexOf("function public.request_plan"));
    expect(cuerpo).toContain("PLAN_ALREADY_ACTIVE");
    expect(cuerpo).toContain("effective_plan");
  });

  it("el gratuito no se solicita", () => {
    expect(ACTIVO).toContain("PLAN_NOT_PURCHASABLE");
  });
});

/* ============================================================================
   QUIÉN PUEDE APROBAR
   ========================================================================== */
describe("pagos · autorización", () => {
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
  const req = { headers: { authorization: "Bearer t" } };

  beforeEach(() => {
    process.env.VITE_SUPABASE_URL = "https://p.supabase.co";
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY = "clave";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "servicio";
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it("sin JWT no se aprueba", async () => {
    mockAuth({});
    await expect(requireAdmin({ headers: {} }, { minRole: "admin" }))
      .rejects.toMatchObject({ status: 401 });
  });

  it("un docente normal NO aprueba", async () => {
    mockAuth({ admin: { is_admin: false, role: null } });
    await expect(requireAdmin(req, { minRole: "admin" }))
      .rejects.toMatchObject({ status: 403 });
  });

  it("support ve la bandeja pero NO aprueba", async () => {
    mockAuth({ admin: { is_admin: true, role: "support" } });
    expect((await requireAdmin(req, { minRole: "support" })).role).toBe("support");
    await expect(requireAdmin(req, { minRole: "admin" }))
      .rejects.toMatchObject({ status: 403 });
  });

  it("admin y superadmin sí aprueban", async () => {
    mockAuth({ admin: { is_admin: true, role: "admin" } });
    expect((await requireAdmin(req, { minRole: "admin" })).role).toBe("admin");
    mockAuth({ admin: { is_admin: true, role: "superadmin" } });
    expect((await requireAdmin(req, { minRole: "admin" })).role).toBe("superadmin");
  });

  it("las funciones de administración solo las ejecuta service_role", () => {
    for (const fn of ["admin_list_payments", "admin_approve_payment", "admin_reject_payment"]) {
      expect(ACTIVO, fn).toMatch(
        new RegExp(`revoke all on function public\\.${fn}[^;]*from public, anon, authenticated`));
      expect(ACTIVO, fn).toMatch(
        new RegExp(`grant execute on function public\\.${fn}[^;]*to service_role`));
    }
  });

  it("el docente sí puede pedir y ver lo suyo", () => {
    expect(ACTIVO).toMatch(/grant execute on function public\.request_plan[^;]*to authenticated/);
    expect(ACTIVO).toMatch(/grant execute on function public\.my_payment_requests\(\)[^;]*to authenticated/);
  });

  it("la tabla de solicitudes no es accesible directamente por el cliente", () => {
    expect(ACTIVO).toMatch(/revoke all on public\.payment_requests from anon, authenticated/);
    expect(ACTIVO).not.toMatch(/grant (select|insert|update)[^;]*on public\.payment_requests to (anon|authenticated)/);
  });
});

/* ============================================================================
   APROBACIÓN ATÓMICA
   ========================================================================== */
describe("pagos · aprobación", () => {
  const cuerpo = ACTIVO.slice(
    ACTIVO.indexOf("function public.admin_approve_payment"),
    ACTIVO.indexOf("function public.admin_reject_payment"));

  it("vuelve a comprobar el rol en la propia base", () => {
    expect(cuerpo).toContain("require_admin_role");
  });

  it("bloquea la solicitud antes de tocarla", () => {
    expect(cuerpo).toMatch(/from public\.payment_requests where id = p_request for update/);
  });

  it("una doble aprobación no crea dos suscripciones", () => {
    // El segundo en llegar encuentra que ya no está pendiente.
    expect(cuerpo).toContain("REQUEST_NOT_PENDING");
    expect(cuerpo).toMatch(/if v_req\.status <> 'pending'/);
  });

  it("cierra la suscripción anterior y crea una nueva", () => {
    expect(cuerpo).toContain("status = 'cancelled'");
    expect(cuerpo).toContain("insert into public.subscriptions");
  });

  it("enlaza el pago con la suscripción creada", () => {
    expect(cuerpo).toContain("subscription_id = v_nueva.id");
  });

  it("escribe auditoría con el plan resultante", () => {
    expect(cuerpo).toContain("PAYMENT_APPROVED");
    expect(cuerpo).toContain("'suscripcion', v_nueva.id");
  });

  it("todo va dentro de la misma transacción de la migración", () => {
    expect(ACTIVO).toMatch(/^begin;/m);
    expect(ACTIVO).toMatch(/^commit;/m);
  });
});

/* ============================================================================
   RECHAZO
   ========================================================================== */
describe("pagos · rechazo", () => {
  const cuerpo = ACTIVO.slice(ACTIVO.indexOf("function public.admin_reject_payment"));

  it("exige motivo en la base, no solo en la interfaz", () => {
    expect(cuerpo).toContain("REASON_REQUIRED");
    expect(ACTIVO).toContain("payment_requests_rechazo_con_motivo");
  });

  it("NO toca la suscripción del docente", () => {
    const hastaAudit = cuerpo.slice(0, cuerpo.indexOf("admin_audit_log"));
    expect(hastaAudit).not.toContain("public.subscriptions");
  });

  it("la API también lo exige antes de llamar", () => {
    const js = fs.readFileSync("api/_handlers/admin/payment-actions.js", "utf8");
    expect(js).toContain("Escribe el motivo del rechazo.");
  });

  it("deja constancia en auditoría", () => {
    expect(cuerpo).toContain("PAYMENT_REJECTED");
  });
});

/* ============================================================================
   PRIVACIDAD E HIGIENE
   ========================================================================== */
describe("pagos · privacidad", () => {
  it("el historial del docente NO incluye las notas del administrador", () => {
    const cuerpo = ACTIVO.slice(
      ACTIVO.indexOf("function public.my_payment_requests"),
      ACTIVO.indexOf("function public.admin_list_payments"));
    expect(cuerpo).not.toContain("review_notes");
    expect(cuerpo).toContain("'estado'");
  });

  it("la bandeja del administrador sí las incluye", () => {
    const cuerpo = ACTIVO.slice(ACTIVO.indexOf("function public.admin_list_payments"));
    expect(cuerpo).toContain("review_notes");
  });

  it("la auditoría no guarda secretos", () => {
    const bloques = ACTIVO.match(/insert into sciverse_private\.admin_audit_log[\s\S]{0,1100}?\);/g) || [];
    expect(bloques.length).toBeGreaterThanOrEqual(3);
    for (const b of bloques) {
      expect(b).not.toMatch(/token|jwt|password|contrase|service_role|bearer/i);
    }
  });

  it("no se inventan datos de pago: se siembra SIN configurar", () => {
    expect(ACTIVO).toMatch(/insert into public\.payment_settings \(id, is_configured\) values \(1, false\)/);
    expect(ACTIVO).not.toMatch(/yape.*\d{9}|\d{9}.*yape/i);
  });

  it("el plan Pro se siembra INACTIVO y con valores marcados como pendientes", () => {
    const semilla = ACTIVO.slice(ACTIVO.indexOf("insert into public.plans"));
    expect(semilla).toContain("'PEN', 1, 10, false");   // is_active = false
    expect(SQL).toContain("CONFIGURACIÓN PENDIENTE");
  });
});

/* ============================================================================
   ERRORES QUE VE LA PERSONA
   ========================================================================== */
describe("pagos · mensajes", () => {
  it("ningún mensaje del docente filtra detalle técnico", () => {
    const js = fs.readFileSync("api/_handlers/payments/request.js", "utf8");
    const mensajes = [...js.matchAll(/\d{3},\s*"([^"]+)"/g)].map((m) => m[1]);
    expect(mensajes.length).toBeGreaterThan(0);
    for (const m of mensajes) {
      expect(m).not.toMatch(/PGRST|postgres|SQL|constraint|supabase|uuid|RPC|_[A-Z]{3,}/i);
    }
  });

  it("ningún mensaje del administrador filtra detalle técnico", () => {
    const js = fs.readFileSync("api/_handlers/admin/payment-actions.js", "utf8");
    const mensajes = [...js.matchAll(/\d{3},\s*"([^"]+)"/g)].map((m) => m[1]);
    for (const m of mensajes) {
      expect(m).not.toMatch(/PGRST|postgres|SQL|constraint|supabase|uuid|RPC|_[A-Z]{3,}/i);
    }
  });

  it("cada excepción de la base tiene traducción", () => {
    const js = fs.readFileSync("api/_handlers/admin/payment-actions.js", "utf8");
    for (const codigo of ["REQUEST_NOT_PENDING", "REQUEST_NOT_FOUND",
                          "REASON_REQUIRED", "CONCURRENT_CHANGE"]) {
      expect(js, codigo).toContain(codigo);
    }
  });
});

/* ============================================================================
   GARANTÍAS DE LA MIGRACIÓN
   ========================================================================== */
describe("pagos · migración", () => {
  it("no borra datos", () => {
    expect(ACTIVO).not.toMatch(/drop table|delete from|truncate|drop column/i);
  });

  it("todas las funciones son SECURITY DEFINER con search_path fijado", () => {
    const definers = (ACTIVO.match(/security definer/g) || []).length;
    const paths = (ACTIVO.match(/set search_path = ''/g) || []).length;
    expect(definers).toBe(paths);
    expect(definers).toBe(5);
  });

  it("los estados son texto con CHECK, no booleanos", () => {
    expect(ACTIVO).toContain("status in ('pending', 'approved', 'rejected', 'cancelled')");
  });

  it("tiene índices para la bandeja y para el historial", () => {
    expect(ACTIVO).toContain("payment_requests_bandeja_idx");
    expect(ACTIVO).toContain("payment_requests_user_idx");
  });
});

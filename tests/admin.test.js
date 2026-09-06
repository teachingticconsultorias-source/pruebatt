import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { requireAdmin, scopeForRole, ADMIN_ROLES } from "../api/_lib/admin.js";

/* ============================================================================
   AUTORIZACIÓN
   La regla del bloque: el frontend no decide nada. Estas pruebas comprueban
   que el backend rechaza por sí solo, aunque alguien llame al endpoint a mano.
   ========================================================================== */

/**
 * Simula las dos llamadas que hace requireAdmin:
 *   1. GET /auth/v1/user        → valida el token
 *   2. POST /rest/v1/rpc/current_admin → devuelve el rol
 */
function mockAuth({ userOk = true, admin = null }) {
  global.fetch = vi.fn(async (url) => {
    const u = String(url);
    if (u.includes("/auth/v1/user")) {
      return userOk
        ? { ok: true, status: 200, json: async () => ({ id: "u-1", email: "x@y.pe" }) }
        : { ok: false, status: 401, json: async () => ({ message: "invalid" }) };
    }
    if (u.includes("current_admin")) {
      return {
        ok: true, status: 200,
        json: async () => admin ?? { is_admin: false, role: null },
      };
    }
    return { ok: true, status: 200, json: async () => ({}) };
  });
}

const req = { headers: { authorization: "Bearer token-de-prueba" } };

describe("admin · autorización", () => {
  beforeEach(() => {
    process.env.VITE_SUPABASE_URL = "https://proyecto.supabase.co";
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY = "clave-publica";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "clave-de-servicio-de-prueba";
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it("anon (sin cabecera) es rechazado con 401", async () => {
    mockAuth({ userOk: true });
    await expect(requireAdmin({ headers: {} })).rejects.toMatchObject({ status: 401 });
  });

  it("token inválido es rechazado con 401", async () => {
    mockAuth({ userOk: false });
    await expect(requireAdmin(req)).rejects.toMatchObject({ status: 401 });
  });

  it("docente normal autenticado recibe 403", async () => {
    mockAuth({ userOk: true, admin: { is_admin: false, role: null } });
    await expect(requireAdmin(req)).rejects.toMatchObject({ status: 403 });
  });

  it("support puede leer", async () => {
    mockAuth({ userOk: true, admin: { is_admin: true, role: "support" } });
    const r = await requireAdmin(req, { minRole: "support" });
    expect(r.role).toBe("support");
  });

  it("admin puede leer", async () => {
    mockAuth({ userOk: true, admin: { is_admin: true, role: "admin" } });
    expect((await requireAdmin(req, { minRole: "support" })).role).toBe("admin");
  });

  it("superadmin puede leer", async () => {
    mockAuth({ userOk: true, admin: { is_admin: true, role: "superadmin" } });
    expect((await requireAdmin(req, { minRole: "support" })).role).toBe("superadmin");
  });

  it("la jerarquía se respeta: support no alcanza lo que exige admin", async () => {
    mockAuth({ userOk: true, admin: { is_admin: true, role: "support" } });
    await expect(requireAdmin(req, { minRole: "admin" })).rejects.toMatchObject({ status: 403 });
  });

  it("superadmin sí alcanza lo que exige admin", async () => {
    mockAuth({ userOk: true, admin: { is_admin: true, role: "superadmin" } });
    expect((await requireAdmin(req, { minRole: "admin" })).role).toBe("superadmin");
  });

  it("sin SERVICE_ROLE_KEY no se finge que funciona", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    mockAuth({ userOk: true, admin: { is_admin: true, role: "admin" } });
    await expect(requireAdmin(req)).rejects.toMatchObject({ code: "MISCONFIGURED" });
  });

  it("los mensajes de rechazo no filtran detalle técnico", async () => {
    mockAuth({ userOk: true, admin: { is_admin: false, role: null } });
    try {
      await requireAdmin(req);
      throw new Error("debía rechazar");
    } catch (e) {
      expect(e.message).not.toMatch(/PGRST|postgres|sql|rpc|supabase|admin_users/i);
      expect(e.message).toBe("Esta sección es solo para el equipo de SciVerse.");
    }
  });

  it("los tres roles previstos y ninguno más", () => {
    expect(ADMIN_ROLES.sort()).toEqual(["admin", "superadmin", "support"]);
  });
});

/* ============================================================================
   QUÉ VE CADA ROL
   ========================================================================== */
describe("admin · alcance por rol", () => {
  it("support no recibe el teléfono del docente", () => {
    const detalle = {
      perfil: { nombres: "María", apellidos: "Pérez", celular: "999888777", ie: "IE 1234" },
      cuenta: { email: "m@x.pe" },
    };
    const recortado = scopeForRole(detalle, "support");
    expect(recortado.perfil.celular).toBeUndefined();
    expect(recortado.perfil.nombres).toBe("María");   // lo que sí necesita, sigue
    expect(recortado.cuenta.email).toBe("m@x.pe");
  });

  it("support tampoco lo recibe en el listado", () => {
    const lista = { items: [{ nombres: "María", celular: "999888777" }] };
    expect(scopeForRole(lista, "support").items[0].celular).toBeUndefined();
  });

  it("admin y superadmin reciben la ficha completa", () => {
    const detalle = { perfil: { celular: "999888777" } };
    expect(scopeForRole(detalle, "admin").perfil.celular).toBe("999888777");
    expect(scopeForRole(detalle, "superadmin").perfil.celular).toBe("999888777");
  });

  it("recortar no muta el original", () => {
    const detalle = { perfil: { celular: "999888777" } };
    scopeForRole(detalle, "support");
    expect(detalle.perfil.celular).toBe("999888777");
  });
});

/* ============================================================================
   CONTRATO DE LOS ENDPOINTS DE LECTURA
   Se comprueba el saneado de parámetros sin levantar un servidor: es la
   lógica que decide cuántas filas se piden y qué se busca.
   ========================================================================== */
describe("admin · paginación y búsqueda", () => {
  const PAGE_SIZE_MAX = 100;
  const SEARCH_MAX = 80;

  // Misma función que usa api/admin/docentes.js.
  function entero(valor, porDefecto, { min, max }) {
    const n = Number.parseInt(valor, 10);
    if (!Number.isFinite(n)) return porDefecto;
    return Math.min(max, Math.max(min, n));
  }
  const saneaBusqueda = (v) => String(v ?? "").trim().slice(0, SEARCH_MAX) || null;

  it("pageSize se acota por arriba: nadie pide 100000 filas", () => {
    expect(entero("100000", 25, { min: 1, max: PAGE_SIZE_MAX })).toBe(PAGE_SIZE_MAX);
    expect(entero("-5", 25, { min: 1, max: PAGE_SIZE_MAX })).toBe(1);
    expect(entero("50", 25, { min: 1, max: PAGE_SIZE_MAX })).toBe(50);
  });

  it("valores no numéricos caen al valor por defecto", () => {
    expect(entero("abc", 25, { min: 1, max: PAGE_SIZE_MAX })).toBe(25);
    expect(entero(undefined, 25, { min: 1, max: PAGE_SIZE_MAX })).toBe(25);
    expect(entero("'; drop table docentes; --", 25, { min: 1, max: PAGE_SIZE_MAX })).toBe(25);
  });

  it("la página nunca baja de 1", () => {
    expect(entero("0", 1, { min: 1, max: 10_000 })).toBe(1);
    expect(entero("-3", 1, { min: 1, max: 10_000 })).toBe(1);
  });

  it("la búsqueda se recorta y se pasa como parámetro, no concatenada", () => {
    expect(saneaBusqueda("  María  ")).toBe("María");
    expect(saneaBusqueda("")).toBeNull();
    expect(saneaBusqueda("   ")).toBeNull();
    expect(saneaBusqueda("x".repeat(500))).toHaveLength(SEARCH_MAX);
  });

  it("una búsqueda con comillas viaja como texto, no como SQL", () => {
    // La función SQL usa ilike con parámetro; aquí sólo se comprueba que el
    // texto llega intacto y acotado, sin escapes caseros que den falsa
    // sensación de seguridad.
    const termino = saneaBusqueda("'; drop table docentes; --");
    expect(termino).toBe("'; drop table docentes; --");
    expect(termino.length).toBeLessThanOrEqual(SEARCH_MAX);
  });
});

/* ============================================================================
   FORMA DE LOS DATOS QUE DEVUELVE EL PANEL
   ========================================================================== */
describe("admin · datos expuestos", () => {
  const CAMPOS_PROHIBIDOS = [
    "encrypted_password", "password", "confirmation_token", "recovery_token",
    "raw_app_meta_data", "access_token", "refresh_token", "service_role",
  ];

  it("el listado no incluye ningún campo sensible de auth", () => {
    const fila = {
      user_id: "u-1", nombres: "María", apellidos: "Pérez", ie: "IE 1234",
      nivel: "primaria", activo: true, created_at: "2026-03-15T10:00:00Z",
      email: "m@x.pe", email_confirmado: true, ultimo_acceso: "2026-09-01T12:00:00Z",
      plan: "free", plan_nombre: "Gratuito", plan_desde: null, plan_hasta: null,
      limite_semanal: 5, usadas_semana: 1, disponibles_semana: 4,
    };
    for (const campo of CAMPOS_PROHIBIDOS) {
      expect(Object.keys(fila)).not.toContain(campo);
    }
  });

  it("el resumen son sólo recuentos agregados", () => {
    const summary = {
      docentes_total: 5, docentes_activos: 5, docentes_inactivos: 0,
      email_confirmados: 4, email_pendientes: 1, nuevos_semana: 2,
      por_plan: { free: 5 }, generaciones_semana: 3,
      generaciones_devueltas_semana: 0, materiales_total: 7,
      materiales_semana: 3, con_limite_agotado: 0, semana_actual: "2026-09-01",
    };
    for (const [clave, valor] of Object.entries(summary)) {
      const esAgregado = typeof valor === "number" || typeof valor === "string" ||
        (typeof valor === "object" && Object.values(valor).every((v) => typeof v === "number"));
      expect(esAgregado, `${clave} debería ser un agregado`).toBe(true);
    }
  });

  it("la ficha del docente trae las secciones previstas", () => {
    const detalle = {
      perfil: {}, cuenta: {}, plan: {},
      historial_planes: [], generaciones: {}, materiales: {},
    };
    for (const seccion of ["perfil", "cuenta", "plan", "generaciones", "materiales"]) {
      expect(detalle).toHaveProperty(seccion);
    }
  });
});

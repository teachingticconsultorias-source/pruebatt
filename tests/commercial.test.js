import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";

import { requireAdmin } from "../api/_lib/admin.js";
import { decodeQrUpload, sniffImage, qrObjectPath, MAX_QR_BYTES } from "../api/_lib/image.js";

const SQL = fs.readFileSync("supabase/migrations/008_commercial_settings.sql", "utf8");
/** Sólo el SQL efectivo: los comentarios no configuran nada. */
const ACTIVO = SQL.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");

/** Cuerpo de una función concreta, desde su cabecera hasta la siguiente. */
function cuerpo(nombre) {
  const i = ACTIVO.indexOf(`function public.${nombre}(`);
  if (i < 0) throw new Error(`no existe ${nombre} en 008`);
  const j = ACTIVO.indexOf("create or replace function", i + 10);
  return ACTIVO.slice(i, j < 0 ? undefined : j);
}

/* ============================================================================
   LA CONFIGURACIÓN COMERCIAL DECIDIDA

   Se comprueba contra el SQL porque es la única fuente: si alguien cambiara
   estos números en el código de React, el test no lo vería — y ése es
   justamente el fallo que hay que impedir.
   ========================================================================== */
describe("comercial · plan Pro", () => {
  const siembra = ACTIVO.slice(ACTIVO.indexOf("update public.plans"));

  it("Pro cuesta 2000 céntimos, es decir S/ 20.00", () => {
    expect(siembra).toContain("price_cents           = 2000");
  });

  it("Pro da 100 creaciones por semana", () => {
    expect(siembra).toContain("ai_weekly_limit       = 100");
  });

  it("Pro dura un mes y queda activo", () => {
    expect(siembra).toContain("billing_period_months = 1");
    expect(siembra).toContain("is_active             = true");
  });

  it("no se vende como ilimitado en ningún texto sembrado", () => {
    const textos = ACTIVO.slice(ACTIVO.indexOf("update public.plans"));
    expect(textos).not.toMatch(/ilimitad/i);
  });

  it("la siembra NO pisa un precio ya cambiado desde el panel", () => {
    // Sin esta condición, reejecutar la migración devolvería el precio a 20
    // aunque administración lo hubiese subido. El bloque entero perdería
    // sentido: los precios viven en el panel, no en el fichero.
    expect(siembra).toMatch(/where code = 'pro'[\s\S]*?price_cents = 0[\s\S]*?not is_active/);
  });

  it("el gratuito sigue en 5 y no se toca su límite", () => {
    // 008 sólo le escribe viñetas; el límite lo puso 002 y sigue ahí.
    const free = ACTIVO.slice(ACTIVO.indexOf("where code = 'free'") - 700);
    expect(free).not.toMatch(/ai_weekly_limit\s*=\s*\d+[\s\S]{0,200}where code = 'free'/);
    expect(ACTIVO).toContain("'5 creaciones con IA por semana'");
  });
});

/* ============================================================================
   EL PRECIO Y EL LÍMITE NO LOS DECIDE EL CLIENTE
   ========================================================================== */
describe("comercial · el navegador no fija precios", () => {
  it("las funciones de escritura no llegan al navegador", () => {
    const permisos = ACTIVO.slice(ACTIVO.indexOf("revoke all on function public.admin_list_plans"));
    for (const f of ["admin_update_plan", "admin_update_payment_settings",
                     "admin_update_payment_method", "admin_set_payment_qr"]) {
      expect(permisos, f).toMatch(
        new RegExp(`grant execute on function public\\.${f}[^;]*to service_role;`));
      expect(permisos, f).not.toMatch(
        new RegExp(`grant execute on function public\\.${f}[^;]*authenticated`));
    }
  });

  it("todas las nuevas se revocan de anon y authenticated antes de conceder", () => {
    const permisos = ACTIVO.slice(ACTIVO.indexOf("revoke all on function public.admin_list_plans"));
    for (const f of ["admin_list_plans", "admin_update_plan", "admin_payment_config",
                     "admin_update_payment_settings", "admin_update_payment_method",
                     "admin_set_payment_qr"]) {
      expect(permisos, f).toMatch(
        new RegExp(`revoke all on function public\\.${f}[^;]*from public, anon, authenticated`));
    }
  });

  it("el cliente no recibe INSERT ni UPDATE sobre payment_methods", () => {
    const bloque = ACTIVO.slice(ACTIVO.indexOf("create table if not exists public.payment_methods"));
    expect(bloque).toContain("revoke all on public.payment_methods from anon, authenticated");
    expect(bloque).toContain("grant select on public.payment_methods to authenticated");
    expect(bloque).not.toMatch(/grant (insert|update|delete)[^;]*payment_methods[^;]*authenticated/i);
  });

  it("request_plan sigue tomando el precio del servidor tras redefinirse", () => {
    const c = cuerpo("request_plan");
    expect(c).toContain("from public.plans where code = p_plan and is_active");
    expect(c).toContain("v_plan.price_cents");
    // Su firma no admite nada que huela a dinero ni a derechos.
    const params = c.slice(0, c.indexOf(")"));
    for (const prohibido of ["p_amount", "p_price", "p_cents", "p_limit",
                             "p_duration", "p_months", "p_features"]) {
      expect(params, prohibido).not.toContain(prohibido);
    }
  });

  it("apagar los pagos manuales lo impone la BASE, no sólo la interfaz", () => {
    const c = cuerpo("request_plan");
    expect(c).toContain("PAYMENTS_CLOSED");
    expect(c).toContain("manual_payments_enabled");
    expect(c).toContain("METHOD_NOT_AVAILABLE");
    // Y la API lo traduce a algo legible.
    expect(fs.readFileSync("api/payments/request.js", "utf8")).toContain("PAYMENTS_CLOSED");
  });

  it("la solicitud sigue guardando la instantánea del catálogo", () => {
    const c = cuerpo("request_plan");
    for (const campo of ["amount_cents", "currency", "plan_name", "billing_period_months"]) {
      expect(c, campo).toContain(campo);
    }
  });

  it("el endpoint del docente no reenvía importes", () => {
    const js = fs.readFileSync("api/payments/request.js", "utf8");
    const llamada = js.slice(js.indexOf("callRpc"));
    expect(llamada).toContain("p_plan");
    expect(llamada).not.toMatch(/amount|price|cents|p_months|p_limit/i);
  });

  it("el frontend del docente no lleva ningún precio ni número escrito a mano", () => {
    const jsx = fs.readFileSync("components/account/PlanSection.jsx", "utf8");
    expect(jsx).not.toContain("931582435");
    expect(jsx).not.toMatch(/Keytlin/);
    expect(jsx).not.toMatch(/S\/\s*20/);
    expect(jsx).not.toMatch(/100 creaciones/);
    // El único número del fichero es el retardo del aviso "Copiado".
    expect(jsx).not.toMatch(/price_cents\s*[:=]\s*\d/);
  });

  it("el panel comercial tampoco los lleva escritos", () => {
    const jsx = fs.readFileSync("components/admin/Comercial.jsx", "utf8");
    expect(jsx).not.toContain("931582435");
    expect(jsx).not.toMatch(/Keytlin/);
  });
});

/* ============================================================================
   LISTA BLANCA DE CAMPOS
   ========================================================================== */
describe("comercial · sólo se pueden cambiar los campos previstos", () => {
  it("admin_update_plan rechaza cualquier clave no reconocida", () => {
    const c = cuerpo("admin_update_plan");
    expect(c).toContain("UNKNOWN_FIELD");
    for (const campo of ["name", "description", "benefits", "price_cents", "currency",
                         "billing_period_months", "ai_weekly_limit", "is_active", "sort_order"]) {
      expect(c, campo).toContain(`'${campo}'`);
    }
  });

  it("el código del plan NO está entre los campos editables", () => {
    const c = cuerpo("admin_update_plan");
    const listaBlanca = c.slice(c.indexOf("if v_clave not in"), c.indexOf("UNKNOWN_FIELD"));
    expect(listaBlanca).not.toContain("'code'");
    expect(listaBlanca).not.toContain("'features'");
  });

  it("la API repite la lista blanca antes de llegar a Postgres", () => {
    const js = fs.readFileSync("api/admin/commerce-actions.js", "utf8");
    expect(js).toContain("CAMPOS_PLAN");
    expect(js).toContain("limpiarParche");
    // Una clave de más se rechaza, no se ignora: un campo ignorado parece
    // guardado y no lo está.
    expect(js).toMatch(/if \(!permitidas\.has\(clave\)\)/);
  });

  it("los rangos se validan en la base, no sólo en el formulario", () => {
    const c = cuerpo("admin_update_plan");
    expect(c).toContain("PRICE_OUT_OF_RANGE");
    expect(c).toContain("LIMIT_OUT_OF_RANGE");
    expect(c).toContain("DURATION_OUT_OF_RANGE");
    expect(c).toContain("CURRENCY_INVALID");
  });

  it("un plan de pago no puede quedarse sin duración", () => {
    expect(cuerpo("admin_update_plan")).toContain("PAID_PLAN_NEEDS_DURATION");
  });
});

/* ============================================================================
   EL PLAN GRATUITO ES LA RED DE SEGURIDAD
   ========================================================================== */
describe("comercial · protecciones del catálogo", () => {
  it("el gratuito no se puede desactivar ni cobrar", () => {
    const c = cuerpo("admin_update_plan");
    expect(c).toContain("FREE_PLAN_REQUIRED");
    expect(c).toContain("FREE_PLAN_MUST_BE_FREE");
  });

  it("no se apaga un plan que tiene docentes dentro", () => {
    // effective_plan trata un plan inactivo como inexistente y cae al
    // gratuito: apagar Pro degradaría en silencio a quien pagó.
    const c = cuerpo("admin_update_plan");
    expect(c).toContain("PLAN_HAS_ACTIVE_SUBSCRIBERS");
    expect(c).toContain("from public.subscriptions");
  });
});

/* ============================================================================
   AUTORIZACIÓN: SUPPORT MIRA, ADMIN CAMBIA
   ========================================================================== */
describe("comercial · quién puede cambiar la configuración", () => {
  it("las lecturas admiten support", () => {
    for (const f of ["admin_list_plans", "admin_payment_config"]) {
      expect(cuerpo(f), f).toContain("require_admin_role(p_actor, 'support')");
    }
  });

  it("las escrituras exigen admin", () => {
    for (const f of ["admin_update_plan", "admin_update_payment_settings",
                     "admin_update_payment_method", "admin_set_payment_qr"]) {
      expect(cuerpo(f), f).toContain("require_admin_role(p_actor, 'admin')");
    }
  });

  it("la API de escritura pide minRole admin", () => {
    const js = fs.readFileSync("api/admin/commerce-actions.js", "utf8");
    expect(js).toContain('requireAdmin(req, { minRole: "admin" })');
  });

  it("la API de lectura acepta support", () => {
    const js = fs.readFileSync("api/admin/commerce.js", "utf8");
    expect(js).toContain('requireAdmin(req, { minRole: "support" })');
  });

  it("la subida del QR exige admin", () => {
    const js = fs.readFileSync("api/admin/payment-qr.js", "utf8");
    expect(js).toContain('requireAdmin(req, { minRole: "admin" })');
  });
});

describe("comercial · autorización en tiempo real", () => {
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

  it("una docente no cambia precios", async () => {
    mockAuth({ admin: { is_admin: false, role: null } });
    await expect(requireAdmin(req, { minRole: "admin" }))
      .rejects.toMatchObject({ status: 403 });
  });

  it("support puede leer la configuración", async () => {
    mockAuth({ admin: { is_admin: true, role: "support" } });
    expect((await requireAdmin(req, { minRole: "support" })).role).toBe("support");
  });

  it("support NO puede editarla", async () => {
    mockAuth({ admin: { is_admin: true, role: "support" } });
    await expect(requireAdmin(req, { minRole: "admin" }))
      .rejects.toMatchObject({ status: 403 });
  });

  it("admin sí puede editarla", async () => {
    mockAuth({ admin: { is_admin: true, role: "admin" } });
    expect((await requireAdmin(req, { minRole: "admin" })).role).toBe("admin");
  });

  it("superadmin también", async () => {
    mockAuth({ admin: { is_admin: true, role: "superadmin" } });
    expect((await requireAdmin(req, { minRole: "admin" })).role).toBe("superadmin");
  });

  it("sin sesión no se llega a ninguna parte", async () => {
    mockAuth({});
    await expect(requireAdmin({ headers: {} }, { minRole: "admin" }))
      .rejects.toMatchObject({ status: 401 });
  });
});

/* ============================================================================
   YAPE Y PLIN
   ========================================================================== */
describe("comercial · métodos de pago", () => {
  it("la configuración es relacional: una fila por método", () => {
    expect(ACTIVO).toContain("create table if not exists public.payment_methods");
    expect(ACTIVO).toMatch(/code\s+text\s+primary key/);
  });

  it("Yape y Plin se siembran habilitados con receptor y número", () => {
    const siembra = ACTIVO.slice(ACTIVO.indexOf("update public.payment_methods"));
    expect(siembra).toContain("'Keytlin'");
    expect(siembra).toContain("'931582435'");
    expect(siembra).toContain("is_enabled     = true");
    expect(siembra).toMatch(/where code in \('yape', 'plin'\)/);
  });

  it("cada método puede tener receptor, número y QR propios", () => {
    const tabla = ACTIVO.slice(ACTIVO.indexOf("create table if not exists public.payment_methods"));
    for (const col of ["receiver_name", "account_number", "qr_path", "instructions"]) {
      expect(tabla, col).toContain(col);
    }
  });

  it("no se puede habilitar un método sin datos que enseñar", () => {
    expect(ACTIVO).toContain("payment_methods_completo");
    expect(cuerpo("admin_update_payment_method")).toContain("METHOD_INCOMPLETE");
  });

  it("la docente sólo ve los métodos habilitados", () => {
    expect(ACTIVO).toMatch(/create policy "Metodos de pago habilitados"[\s\S]*?using \(is_enabled\)/);
  });

  it("funciona sin WhatsApp: el vacío es un estado válido", () => {
    const c = cuerpo("admin_update_payment_settings");
    // Se acepta null, y sólo se valida el formato cuando hay algo escrito.
    expect(c).toMatch(/v_cfg\.whatsapp := nullif\(btrim/);
    expect(c).toMatch(/if v_cfg\.whatsapp is not null and/);
    // Y la migración no inventa ninguno.
    const siembra = ACTIVO.slice(ACTIVO.indexOf("   set instructions = 'Realiza el pago"));
    expect(siembra.slice(0, siembra.indexOf(";"))).not.toContain("whatsapp");
  });

  it("el interruptor general apaga los pagos sin borrar nada", () => {
    expect(ACTIVO).toContain("manual_payments_enabled");
    expect(cuerpo("admin_update_payment_settings")).toContain("'manual_payments_enabled'");
  });
});

/* ============================================================================
   QR
   ========================================================================== */
describe("comercial · QR", () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
  const jpg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(20)]);
  const webp = Buffer.concat([
    Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBP"), Buffer.alloc(20),
  ]);

  it("acepta PNG, JPG y WEBP", () => {
    expect(sniffImage(png)?.ext).toBe("png");
    expect(sniffImage(jpg)?.ext).toBe("jpg");
    expect(sniffImage(webp)?.ext).toBe("webp");
  });

  it("rechaza un fichero que NO es una imagen aunque diga que lo es", () => {
    // Un ejecutable renombrado a .png llega con content-type image/png si el
    // cliente lo dice. Se miran los bytes, no la cabecera.
    const falso = Buffer.from("MZ\x90\x00 esto es un ejecutable");
    expect(sniffImage(falso)).toBeNull();
    expect(() => decodeQrUpload(falso.toString("base64")))
      .toThrowError(/PNG, JPG o WEBP/);
  });

  it("rechaza un SVG, que puede llevar script dentro", () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    expect(sniffImage(svg)).toBeNull();
  });

  it("rechaza lo que pase de 2 MB", () => {
    const grande = Buffer.concat([png, Buffer.alloc(MAX_QR_BYTES)]);
    expect(() => decodeQrUpload(grande.toString("base64")))
      .toThrowError(/2 MB/);
  });

  it("acepta justo por debajo del límite", () => {
    const casi = Buffer.concat([png, Buffer.alloc(MAX_QR_BYTES - png.length - 10)]);
    expect(decodeQrUpload(casi.toString("base64")).mime).toBe("image/png");
  });

  it("admite el prefijo data: que envía el navegador", () => {
    const r = decodeQrUpload("data:image/png;base64," + png.toString("base64"));
    expect(r.mime).toBe("image/png");
    expect(r.size).toBe(png.length);
  });

  it("rechaza el vacío", () => {
    expect(() => decodeQrUpload("")).toThrowError(/Elige una imagen/);
    expect(() => decodeQrUpload(null)).toThrowError(/Elige una imagen/);
  });

  it("la ruta sigue un patrón fijo que la BASE vuelve a exigir", () => {
    const path = qrObjectPath("yape", "png", "11111111-2222-3333-4444-555555555555");
    expect(path).toBe("qr/yape/11111111-2222-3333-4444-555555555555.png");
    expect(ACTIVO).toContain("payment_methods_qr_path_valid");
    expect(cuerpo("admin_set_payment_qr")).toContain("QR_PATH_INVALID");
  });

  it("el bucket es privado, con tope de 2 MB y sólo imágenes", () => {
    const bloque = ACTIVO.slice(ACTIVO.indexOf("storage.buckets"));
    expect(bloque).toContain("'payment-assets', 'payment-assets', false");
    expect(bloque).toContain("2097152");
    expect(bloque).toContain("array['image/png', 'image/jpeg', 'image/webp']");
  });

  it("una docente no puede subir nada al bucket", () => {
    // Sólo hay política de SELECT. Sin políticas de escritura, únicamente
    // service_role —que salta RLS y vive en el servidor— puede escribir.
    const bloque = ACTIVO.slice(ACTIVO.indexOf("storage.objects"));
    expect(bloque).toContain("for select to authenticated");
    expect(bloque).not.toMatch(/on storage\.objects for (insert|update|delete|all)/i);
  });

  it("al reemplazar, el fichero anterior se borra DESPUÉS de guardarlo", () => {
    const js = fs.readFileSync("api/admin/payment-qr.js", "utf8");
    const iSubir = js.indexOf("await uploadObject");
    const iRegistrar = js.indexOf("admin_set_payment_qr", iSubir);
    const iBorrar = js.indexOf("registro?.anterior");
    expect(iSubir).toBeGreaterThan(0);
    expect(iRegistrar).toBeGreaterThan(iSubir);
    expect(iBorrar).toBeGreaterThan(iRegistrar);
    // Y la RPC devuelve la ruta anterior para poder hacerlo.
    expect(cuerpo("admin_set_payment_qr")).toContain("'anterior', v_previa");
  });

  it("si la base rechaza la ruta, el fichero recién subido no queda huérfano", () => {
    const js = fs.readFileSync("api/admin/payment-qr.js", "utf8");
    expect(js).toMatch(/catch \(error\) \{[\s\S]*?deleteObjectQuietly[\s\S]*?throw error;/);
  });
});

/* ============================================================================
   APROBAR: DOS EVENTOS
   ========================================================================== */
describe("comercial · auditoría de la activación", () => {
  it("aprobar emite PAYMENT_APPROVED y SUBSCRIPTION_ACTIVATED por separado", () => {
    const c = cuerpo("admin_approve_payment");
    expect(c).toContain("'PAYMENT_APPROVED'");
    expect(c).toContain("'SUBSCRIPTION_ACTIVATED'");
    expect(c.indexOf("'PAYMENT_APPROVED'")).toBeLessThan(c.indexOf("'SUBSCRIPTION_ACTIVATED'"));
  });

  it("SUBSCRIPTION_ACTIVATED registra el plan, la vigencia y el límite", () => {
    const c = cuerpo("admin_approve_payment");
    const evento = c.slice(c.indexOf("'SUBSCRIPTION_ACTIVATED'"));
    expect(evento).toContain("v_nueva.plan_code");
    expect(evento).toContain("v_nueva.starts_at");
    expect(evento).toContain("v_nueva.ends_at");
    expect(evento).toContain("v_plan.ai_weekly_limit");
  });

  it("todo ocurre en la misma transacción, con la solicitud bloqueada", () => {
    const c = cuerpo("admin_approve_payment");
    expect(c).toContain("where id = p_request for update");
    expect(c).toContain("REQUEST_NOT_PENDING");
  });

  it("cada cambio comercial deja rastro con actor, rol y valores", () => {
    for (const [f, accion] of [
      ["admin_update_plan", "PLAN_UPDATED"],
      ["admin_update_payment_settings", "PAYMENT_SETTINGS_UPDATED"],
      ["admin_update_payment_method", "PAYMENT_METHOD_UPDATED"],
      ["admin_set_payment_qr", "PAYMENT_QR_UPDATED"],
    ]) {
      const c = cuerpo(f);
      expect(c, f).toContain(`'${accion}'`);
      expect(c, f).toContain("admin_user_id, admin_role, action");
      expect(c, f).toContain("p_actor, v_role");
    }
  });

  it("las tres primeras guardan el antes y el después", () => {
    for (const f of ["admin_update_plan", "admin_update_payment_settings",
                     "admin_update_payment_method"]) {
      const c = cuerpo(f);
      expect(c, f).toContain("v_antes");
      expect(c, f).toContain("v_desp");
    }
  });

  it("la auditoría no guarda secretos", () => {
    expect(ACTIVO).not.toMatch(/service_role_key|jwt|bearer|password/i);
  });
});

/* ============================================================================
   DOBLE CLIC Y CONCURRENCIA
   ========================================================================== */
describe("comercial · idempotencia", () => {
  it("guardar dos veces lo mismo no escribe ni audita dos veces", () => {
    for (const f of ["admin_update_plan", "admin_update_payment_settings",
                     "admin_update_payment_method"]) {
      expect(cuerpo(f), f).toContain("'sin_cambios', true");
    }
  });

  it("poner el mismo QR otra vez tampoco hace nada", () => {
    expect(cuerpo("admin_set_payment_qr")).toContain("v_previa is not distinct from v_nueva");
  });

  it("cada fila se bloquea antes de tocarla", () => {
    expect(cuerpo("admin_update_plan")).toContain("where code = p_code for update");
    expect(cuerpo("admin_update_payment_settings")).toContain("where id = 1 for update");
    expect(cuerpo("admin_update_payment_method")).toContain("where code = p_code for update");
  });

  it("la solicitud duplicada la sigue impidiendo la base", () => {
    const s007 = fs.readFileSync("supabase/migrations/007_payments.sql", "utf8");
    expect(s007).toMatch(/create unique index[^;]*payment_requests_one_pending[\s\S]*?where status = 'pending'/);
    // Y 008 no la quita.
    expect(ACTIVO).not.toMatch(/drop index[^;]*payment_requests_one_pending/);
  });
});

/* ============================================================================
   ERRORES QUE NO CUENTAN DE MÁS
   ========================================================================== */
describe("comercial · lo que ve quien se equivoca", () => {
  const actions = fs.readFileSync("api/admin/commerce-actions.js", "utf8");

  it("los errores de Postgres se traducen antes de salir", () => {
    expect(actions).toContain("function traducir");
    expect(actions).toContain("sendError");
  });

  it("ningún mensaje al cliente menciona detalles técnicos", () => {
    const mensajes = actions.slice(actions.indexOf("const MENSAJES"), actions.indexOf("function traducir"));
    const textos = [...mensajes.matchAll(/,\s*"([^"]{10,})"\]/g)].map((m) => m[1]);
    expect(textos.length).toBeGreaterThan(10);
    for (const t of textos) {
      expect(t, t).not.toMatch(/postgres|sql|rpc|jsonb|constraint|supabase|null|undefined|http/i);
    }
  });

  it("no se filtra el texto crudo del error", () => {
    expect(actions).not.toMatch(/error:\s*error\.message/);
    expect(actions).not.toMatch(/json\(\{[^}]*detail/i);
  });
});

/* ============================================================================
   LÍMITES DE PETICIONES
   ========================================================================== */
describe("comercial · rate limit", () => {
  it("solicitar un plan tiene su propio presupuesto, por IP y por usuario", () => {
    const js = fs.readFileSync("api/payments/request.js", "utf8");
    expect(js).toContain("RateLimits.paymentRequest");
    expect(js).toContain("clientKey(req, auth.user.id)");
    expect(js).not.toContain("RateLimits.readOwn");
  });

  it("las escrituras comerciales y la subida del QR tienen cubos propios", () => {
    expect(fs.readFileSync("api/admin/commerce-actions.js", "utf8"))
      .toContain("RateLimits.adminWrite");
    expect(fs.readFileSync("api/admin/payment-qr.js", "utf8"))
      .toContain("RateLimits.adminUpload");
  });
});

/* ============================================================================
   LA MIGRACIÓN NO DESTRUYE NADA
   ========================================================================== */
describe("comercial · 008 evoluciona 007 sin romperla", () => {
  it("no borra solicitudes, suscripciones, planes ni usuarios", () => {
    expect(ACTIVO).not.toMatch(/\bdelete from\b/i);
    expect(ACTIVO).not.toMatch(/\btruncate\b/i);
    expect(ACTIVO).not.toMatch(/drop table/i);
    expect(ACTIVO).not.toMatch(/drop column/i);
  });

  it("va en una sola transacción", () => {
    expect(ACTIVO.trimStart().startsWith("begin;")).toBe(true);
    expect(ACTIVO).toContain("commit;");
  });

  it("aborta si falta alguna migración previa", () => {
    const pre = ACTIVO.slice(0, ACTIVO.indexOf("alter table public.plans"));
    expect(pre).toContain("ABORTA: falta 007_payments.sql");
    expect(pre).toContain("ABORTA: falta 006_admin_actions.sql");
  });

  it("las columnas jubiladas se conservan y se marcan", () => {
    expect(ACTIVO).toContain("comment on column public.payment_settings.method is");
    expect(ACTIVO).toMatch(/JUBILADA en 008/);
  });

  it("existe el verificador de solo lectura", () => {
    const insp = fs.readFileSync("supabase/inspect/011_verify_commercial_settings.sql", "utf8");
    const sinComentarios = insp.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
    for (const peligro of ["insert ", "update ", "delete ", "alter ", "drop ", "grant ", "revoke "]) {
      expect(sinComentarios.toLowerCase(), peligro).not.toContain(peligro);
    }
  });
});

/* ============================================================================
   EL CONTROL DE CRÉDITOS SIGUE SIENDO UNO SOLO
   ========================================================================== */
describe("comercial · créditos", () => {
  it("008 no crea una segunda lógica de consumo", () => {
    expect(ACTIVO).not.toContain("function public.consume_ai_credit");
    expect(ACTIVO).not.toContain("ai_usage_counters");
  });

  it("el límite sigue saliendo del plan efectivo", () => {
    const s003 = fs.readFileSync("supabase/migrations/003_secure_ai_credits.sql", "utf8");
    const consumo = s003.slice(s003.indexOf("function public.consume_ai_credit"));
    expect(consumo).toContain("sciverse_private.effective_plan(v_uid)");
    expect(consumo).toContain("v_counter.used >= v_plan.ai_weekly_limit");
  });

  it("cambiar de plan no borra el historial de generaciones", () => {
    // Aprobar toca payment_requests y subscriptions; nunca los contadores.
    const c = cuerpo("admin_approve_payment");
    expect(c).not.toContain("ai_usage_counters");
    expect(c).not.toContain("ai_generations");
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";

import { sendMail, getMailConfig, mailUnavailableReason, getAdminUrl } from "../api/_lib/mailer.js";
import { notifyNewPaymentRequest, fechaPeru } from "../api/_lib/notifications.js";
import {
  construirAvisoWhatsApp, enlaceAvisoWhatsApp, normalizarNumero,
} from "../components/account/avisoWhatsApp.js";

const HANDLER = fs.readFileSync("api/_handlers/payments/request.js", "utf8");
const PLANSEC = fs.readFileSync("components/account/PlanSection.jsx", "utf8");

const ENV = [
  "SCIVERSE_MAIL_PROVIDER", "SCIVERSE_MAIL_FROM", "SCIVERSE_ADMIN_EMAILS",
  "RESEND_API_KEY", "SCIVERSE_MAIL_WEBHOOK_URL", "SCIVERSE_APP_URL",
];

function limpiarEnv() {
  for (const k of ENV) delete process.env[k];
}

/* ============================================================================
   EL ORDEN: PRIMERO LA SOLICITUD, LUEGO EL AVISO

   La regla del bloque es que WhatsApp y el correo son alertas, nunca el
   canal. Si el aviso pudiera ejecutarse antes —o romper lo de después— una
   docente podría acabar avisando de un pago que no quedó registrado.
   ========================================================================== */
describe("avisos · la solicitud se crea antes que cualquier aviso", () => {
  it("el correo se intenta DESPUÉS de crear la solicitud", () => {
    const crear = HANDLER.indexOf('name: "request_plan"');
    const avisar = HANDLER.indexOf("await avisarAlEquipo");
    const responder = HANDLER.indexOf("res.status(201)");
    expect(crear).toBeGreaterThan(0);
    expect(avisar).toBeGreaterThan(crear);
    expect(responder).toBeGreaterThan(avisar);
  });

  it("el aviso está envuelto para que no pueda tumbar la petición", () => {
    const fn = HANDLER.slice(HANDLER.indexOf("async function avisarAlEquipo"));
    expect(fn).toContain("try {");
    expect(fn).toContain("catch (error)");
    // Ni un `throw` dentro del aviso.
    const cuerpo = fn.slice(0, fn.indexOf("export default"));
    expect(cuerpo).not.toMatch(/\bthrow\b/);
  });

  it("un fallo del correo NO revierte ni borra la solicitud", () => {
    const fn = HANDLER.slice(HANDLER.indexOf("async function avisarAlEquipo"),
                             HANDLER.indexOf("export default"));
    for (const peligro of ["delete", "rollback", "cancel", "revert", "DELETE"]) {
      expect(fn, peligro).not.toContain(peligro);
    }
  });

  it("el nombre lo lee el servidor, no lo acepta del navegador", () => {
    // Un nombre enviado por el cliente es texto sin verificar que acabaría
    // impreso en el correo del equipo.
    expect(HANDLER).toContain("async function nombreDeLaDocente");
    const destructuring = HANDLER.slice(HANDLER.indexOf("const { plan, method, reference }"));
    expect(destructuring.slice(0, 80)).not.toMatch(/nombre|name|email/);
  });

  it("abrir la pantalla no manda correos: sólo los manda el POST", () => {
    expect(HANDLER).toContain('if (req.method !== "POST") throw Errors.methodNotAllowed();');
    const mine = fs.readFileSync("api/_handlers/payments/mine.js", "utf8");
    expect(mine).not.toContain("notify");
    expect(mine).not.toContain("mailer");
  });
});

/* ============================================================================
   EL TRANSPORTE
   ========================================================================== */
describe("avisos · correo al equipo", () => {
  beforeEach(() => { limpiarEnv(); });
  afterEach(() => { vi.restoreAllMocks(); limpiarEnv(); });

  it("sin proveedor configurado no manda nada, y lo dice", async () => {
    global.fetch = vi.fn();
    const r = await sendMail({ subject: "x", text: "y" });
    expect(r.sent).toBe(false);
    expect(r.reason).toBe("not_configured");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("nunca lanza aunque el transporte se caiga", async () => {
    process.env.SCIVERSE_MAIL_PROVIDER = "resend";
    process.env.RESEND_API_KEY = "clave";
    process.env.SCIVERSE_MAIL_FROM = "SciVerse <avisos@ejemplo.pe>";
    global.fetch = vi.fn(async () => { throw new Error("ECONNRESET"); });

    const r = await sendMail({ subject: "x", text: "y" });
    expect(r.sent).toBe(false);
    expect(r.reason).toBe("transport_error");
  });

  it("un 4xx del proveedor tampoco lanza", async () => {
    process.env.SCIVERSE_MAIL_PROVIDER = "resend";
    process.env.RESEND_API_KEY = "clave";
    process.env.SCIVERSE_MAIL_FROM = "SciVerse <avisos@ejemplo.pe>";
    global.fetch = vi.fn(async () => ({ ok: false, status: 422, text: async () => "bad from" }));

    const r = await sendMail({ subject: "x", text: "y" });
    expect(r.sent).toBe(false);
    expect(r.reason).toBe("http_422");
  });

  it("con Resend configurado envía y no filtra la clave en el cuerpo", async () => {
    process.env.SCIVERSE_MAIL_PROVIDER = "resend";
    process.env.RESEND_API_KEY = "clave-secreta";
    process.env.SCIVERSE_MAIL_FROM = "SciVerse <avisos@ejemplo.pe>";
    process.env.SCIVERSE_ADMIN_EMAILS = "equipo@ejemplo.pe";

    let capturado = null;
    global.fetch = vi.fn(async (_u, opts) => { capturado = opts; return { ok: true, status: 200 }; });

    const r = await sendMail({ subject: "Asunto", text: "Cuerpo" });
    expect(r.sent).toBe(true);
    expect(JSON.parse(capturado.body).to).toEqual(["equipo@ejemplo.pe"]);
    expect(capturado.body).not.toContain("clave-secreta");
  });

  it("el proveedor se puede cambiar sin tocar código", async () => {
    process.env.SCIVERSE_MAIL_PROVIDER = "webhook";
    process.env.SCIVERSE_MAIL_WEBHOOK_URL = "https://hook.ejemplo.pe/x";
    global.fetch = vi.fn(async () => ({ ok: true, status: 200 }));

    const r = await sendMail({ subject: "Asunto", text: "Cuerpo" });
    expect(r.sent).toBe(true);
    expect(r.provider).toBe("webhook");
  });

  it("dice exactamente qué falta cuando falta algo", () => {
    process.env.SCIVERSE_MAIL_PROVIDER = "resend";
    expect(mailUnavailableReason()).toBe("missing_resend_key");
    process.env.RESEND_API_KEY = "k";
    expect(mailUnavailableReason()).toBe("missing_from");
    process.env.SCIVERSE_MAIL_FROM = "a@b.pe";
    expect(mailUnavailableReason()).toBeNull();
  });

  it("el destinatario sale de la configuración, no está fijado en el código", () => {
    process.env.SCIVERSE_ADMIN_EMAILS = "uno@x.pe, dos@x.pe";
    expect(getMailConfig().to).toEqual(["uno@x.pe", "dos@x.pe"]);
  });

  it("la configuración nunca devuelve secretos", () => {
    process.env.RESEND_API_KEY = "clave-secreta";
    const cfg = getMailConfig();
    expect(JSON.stringify(cfg)).not.toContain("clave-secreta");
    expect(cfg.hasResendKey).toBe(true);
  });
});

describe("avisos · contenido del correo", () => {
  beforeEach(() => {
    limpiarEnv();
    process.env.SCIVERSE_MAIL_PROVIDER = "webhook";
    process.env.SCIVERSE_MAIL_WEBHOOK_URL = "https://hook.ejemplo.pe/x";
  });
  afterEach(() => { vi.restoreAllMocks(); limpiarEnv(); });

  async function capturar(datos) {
    let cuerpo = null;
    global.fetch = vi.fn(async (_u, opts) => { cuerpo = JSON.parse(opts.body); return { ok: true, status: 200 }; });
    await notifyNewPaymentRequest(datos);
    return cuerpo;
  }

  const BASE = {
    nombre: "Ana Quispe", email: "ana@ejemplo.pe", plan: "Pro",
    montoCentimos: 2000, moneda: "PEN", metodo: "Yape",
    referencia: "00123456", fecha: new Date("2026-09-06T15:00:00Z"),
  };

  it("lleva el asunto acordado", async () => {
    const c = await capturar(BASE);
    expect(c.subject).toBe("🔔 Nuevo pago por verificar — SciVerse Pro");
  });

  it("lleva docente, correo, plan, monto, método, referencia, estado y fecha", async () => {
    const c = await capturar(BASE);
    for (const trozo of ["Ana Quispe", "ana@ejemplo.pe", "Pro", "S/20.00",
                         "Yape", "00123456", "Pendiente"]) {
      expect(c.text, trozo).toContain(trozo);
    }
    expect(c.text).toMatch(/Fecha: .*2026/);
  });

  it("sin referencia dice «No indicada» en vez de dejarlo en blanco", async () => {
    const c = await capturar({ ...BASE, referencia: null });
    expect(c.text).toContain("Referencia: No indicada");
  });

  it("el enlace lleva al panel, sección Pagos", async () => {
    const c = await capturar(BASE);
    expect(c.text).toContain("?admin=1&seccion=pagos");
    expect(c.html).toContain("Revisar pago en SciVerse");
  });

  it("deja claro que el correo no autoriza nada", async () => {
    const c = await capturar(BASE);
    expect(c.text).toContain("La activación sólo ocurre cuando alguien pulsa Aprobar");
  });

  it("no viaja ningún identificador interno ni secreto", async () => {
    const c = await capturar(BASE);
    const todo = `${c.text}${c.html}`;
    for (const prohibido of ["service_role", "Bearer", "token", "apikey", "user_id"]) {
      expect(todo, prohibido).not.toContain(prohibido);
    }
  });

  it("aguanta un nombre con HTML sin romper el correo", async () => {
    const c = await capturar({ ...BASE, nombre: '<script>alert(1)</script>' });
    expect(c.html).not.toContain("<script>");
    expect(c.html).toContain("&lt;script&gt;");
  });

  it("la fecha se da en hora de Perú", () => {
    const f = fechaPeru(new Date("2026-09-06T15:00:00Z"));
    expect(f).toMatch(/2026/);
    expect(f).toMatch(/10:00|10.00/); // 15:00 UTC = 10:00 en Lima
  });

  it("el panel se puede reapuntar sin tocar código", () => {
    process.env.SCIVERSE_APP_URL = "https://sciverse.pe/";
    expect(getAdminUrl()).toBe("https://sciverse.pe/?admin=1&seccion=pagos");
  });
});

/* ============================================================================
   WHATSAPP
   ========================================================================== */
describe("avisos · WhatsApp del docente", () => {
  const DATOS = {
    plan: "Pro", montoCentimos: 2000, moneda: "PEN",
    metodo: "yape", referencia: "00123456",
  };

  it("el número sale de la configuración, no del código", () => {
    const fuente = fs.readFileSync("components/account/avisoWhatsApp.js", "utf8");
    expect(fuente).not.toMatch(/\d{9,}/);          // ningún teléfono escrito
    expect(PLANSEC).toContain("ajustes?.whatsapp"); // sale de payment_settings
  });

  it("sin WhatsApp configurado no hay enlace, y por tanto no hay botón", () => {
    for (const vacio of [null, undefined, "", "   ", "123"]) {
      expect(enlaceAvisoWhatsApp(vacio, DATOS), String(vacio)).toBeNull();
    }
    expect(PLANSEC).toContain("if (!enlace) return null;");
  });

  it("con número configurado construye el enlace de wa.me", () => {
    const enlace = enlaceAvisoWhatsApp("+51 931 582 435", DATOS);
    expect(enlace).toContain("https://wa.me/51931582435?text=");
  });

  it("normaliza cualquier formato razonable de número", () => {
    expect(normalizarNumero("+51 931-582-435")).toBe("51931582435");
    expect(normalizarNumero("(931) 582 435")).toBe("931582435");
    expect(normalizarNumero("abc")).toBeNull();
  });

  it("el mensaje lleva plan, monto y método", () => {
    const m = construirAvisoWhatsApp(DATOS);
    expect(m).toContain("SciVerse Pro");
    expect(m).toContain("S/20.00");
    expect(m).toContain("Yape");
  });

  it("dice que la solicitud YA está registrada", () => {
    const m = construirAvisoWhatsApp(DATOS);
    expect(m).toContain("Mi solicitud ya está registrada en la plataforma.");
  });

  it("incluye la referencia sólo si existe", () => {
    expect(construirAvisoWhatsApp(DATOS)).toContain("00123456");
    expect(construirAvisoWhatsApp({ ...DATOS, referencia: "" }))
      .not.toContain("Número de operación");
  });

  it("no lleva información sensible innecesaria", () => {
    const m = construirAvisoWhatsApp({ ...DATOS, referencia: "00123456" });
    for (const prohibido of ["@", "user_id", "token", "id:"]) {
      expect(m, prohibido).not.toContain(prohibido);
    }
  });

  it("usa la etiqueta del método tal como la configuró el equipo", () => {
    const m = construirAvisoWhatsApp({ ...DATOS, metodo: "plin", metodoEtiqueta: "Plin BCP" });
    expect(m).toContain("Plin BCP");
  });
});

/* ============================================================================
   LA PANTALLA DEL DOCENTE
   ========================================================================== */
describe("avisos · el botón sólo aparece cuando ya hay solicitud", () => {
  it("la pantalla de éxito depende de que el servidor haya confirmado", () => {
    // `creada` sólo se rellena tras un 2xx de /api/payments/request.
    expect(PLANSEC).toContain("setCreada(data);");
    // El orden importa: si la respuesta no es correcta se lanza, y `setCreada`
    // queda por debajo, fuera de alcance.
    const corta = PLANSEC.indexOf("if (!res.ok) throw new Error");
    const marca = PLANSEC.indexOf("setCreada(data);");
    expect(corta).toBeGreaterThan(0);
    expect(marca).toBeGreaterThan(corta);
    expect(PLANSEC).toContain("if (creada) {");
  });

  it("en la pantalla de datos de pago NO hay botón de WhatsApp", () => {
    const pantalla1 = PLANSEC.slice(PLANSEC.indexOf("PANTALLA 1"));
    expect(pantalla1).not.toContain("BotonWhatsApp");
  });

  it("el botón principal deja claro el orden: primero pagar, luego avisar", () => {
    expect(PLANSEC).toContain("Ya pagué · Enviar solicitud");
    expect(PLANSEC).toContain("Pago registrado para verificación");
    expect(PLANSEC).toContain("puedes avisarnos por WhatsApp");
  });

  it("con solicitud pendiente se puede avisar de nuevo SIN crear otra", () => {
    const bloque = PLANSEC.slice(PLANSEC.indexOf("SOLICITUD ABIERTA"),
                                 PLANSEC.indexOf("MEJORAR PLAN"));
    expect(bloque).toContain("Avisar nuevamente por WhatsApp");
    expect(bloque).toContain("Tu solicitud está en revisión");
    // Ese bloque no llama a la API: sólo enlaza.
    expect(bloque).not.toContain("/api/payments/request");
  });

  it("con solicitud pendiente no se ofrece volver a solicitar", () => {
    expect(PLANSEC).toContain("const sePuedeMejorar = pagosAbiertos && mejorables.length > 0 && !pendiente;");
  });

  it("nunca se muestran las notas internas al docente", () => {
    expect(PLANSEC).not.toContain("review_notes");
    // Ni se lee el campo desde ninguna respuesta: `.notas` no aparece.
    expect(PLANSEC).not.toMatch(/\.\s*notas/);
  });

  it("no hay ninguna activación directa desde el lado del docente", () => {
    for (const prohibido of ["admin_approve_payment", "admin_change_plan",
                             "subscriptions", "payment-actions"]) {
      expect(PLANSEC, prohibido).not.toContain(prohibido);
    }
  });
});

/* ============================================================================
   COPY DEL PLAN
   ========================================================================== */
describe("avisos · el escaparate no promete lo que el backend no da", () => {
  const fallback = fs.readFileSync("config/plans.js", "utf8");
  /** Sólo el código: un comentario que explica el arreglo no es una promesa. */
  const activo = fallback
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");

  it("ya no queda ningún «ilimitado» en el catálogo de respaldo", () => {
    expect(activo).not.toMatch(/ilimitad/i);
  });

  it("el respaldo dice lo mismo que la base: Pro · 20 · 1 mes · 100", () => {
    expect(activo).toContain('price: "20"');
    expect(activo).toContain('period: "por 1 mes"');
    expect(activo).toContain("100 creaciones con IA por semana");
  });

  it("las tarjetas de precios leen el catálogo real", () => {
    for (const f of ["App.jsx", "components/landing/Landing.jsx"]) {
      const src = fs.readFileSync(f, "utf8");
      expect(src, f).toContain("usePlanCatalog");
      expect(src, f).toContain("planes.map");
    }
  });

  it("el reclamo del plan se deriva del límite, no es un adjetivo", () => {
    const hook = fs.readFileSync("components/usePlanCatalog.js", "utf8");
    expect(hook).toContain("${fila.ai_weekly_limit} creaciones con IA por semana");
    expect(hook).toContain("benefits");
  });
});

/* ============================================================================
   PRESUPUESTO DE FUNCTIONS
   ========================================================================== */
describe("avisos · no se creó ninguna Function nueva", () => {
  function entrypoints(dir = "api", base = "") {
    const out = [];
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name.startsWith("_")) continue;
      const ruta = `${dir}/${e.name}`;
      if (e.isDirectory()) out.push(...entrypoints(ruta, `${base}${e.name}/`));
      else if (e.name.endsWith(".js")) out.push(`${base}${e.name}`);
    }
    return out;
  }

  it("seguimos en 8, muy por debajo de 10", () => {
    expect(entrypoints().length).toBeLessThanOrEqual(10);
  });

  it("el correo vive en la Function de pagos que ya existía", () => {
    expect(fs.existsSync("api/_lib/mailer.js")).toBe(true);
    expect(fs.existsSync("api/_lib/notifications.js")).toBe(true);
    expect(entrypoints().some((r) => /mail|notif/i.test(r))).toBe(false);
    expect(HANDLER).toContain('from "../../_lib/notifications.js"');
  });
});

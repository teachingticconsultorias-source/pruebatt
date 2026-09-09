import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";

import { generateJson, esperaDeReintento } from "../api/_lib/gemini.js";
import { withCredit } from "../api/_lib/credits.js";
import {
  CAPACIDADES_POR_DEFECTO, cantidadPermitida, capacidadesDe, mensajeDeLimite,
  permiteQuitarMarca, planEfectivo,
} from "../api/_lib/entitlements.js";
import { cerrarOperacion, claveDeOperacion } from "../api/_lib/idempotency.js";

/* ============================================================================
   PICOS DE CONCURRENCIA Y AUTORIDAD DEL SERVIDOR

   Dos cosas distintas que este bloque tenía que dejar resueltas:

   1. Que un 429 momentáneo de Gemini no se convierta en un error para la
      docente si el segundo intento habría funcionado.
   2. Que ninguna manipulación del navegador consiga más de lo que da el plan.

   Nada aquí llama a Gemini ni a Supabase: se sustituye `fetch`.
   ========================================================================== */

const LLAMADA = {
  prompt: "Genera una ficha de trabajo.",
  responseSchema: { type: "object", properties: { titulo: { type: "string" } } },
  maxOutputTokens: 4000,
  tool: "prueba",
};

/** Respuesta correcta de Gemini. */
const OK = {
  ok: true, status: 200,
  json: async () => ({
    candidates: [{ finishReason: "STOP", content: { parts: [{ text: '{"titulo":"Lista"}' }] } }],
    usageMetadata: { promptTokenCount: 50, candidatesTokenCount: 20, thoughtsTokenCount: 5, totalTokenCount: 75 },
  }),
};

const fallo = (status, mensaje = "error") => ({
  ok: false, status, json: async () => ({ error: { message: mensaje } }),
});

let logs;

beforeEach(() => {
  process.env.GEMINI_API_KEY = "clave-de-prueba";
  process.env.GEMINI_MAIN_MODEL = "modelo-de-prueba";
  logs = [];
  vi.spyOn(console, "log").mockImplementation((...a) => logs.push(a.join(" ")));
  vi.spyOn(console, "warn").mockImplementation((...a) => logs.push(a.join(" ")));
  vi.spyOn(console, "error").mockImplementation((...a) => logs.push(a.join(" ")));
  // El backoff real dormiría segundos: se sustituye para que los tests
  // sigan comprobando la política sin tardar.
  vi.spyOn(global, "setTimeout").mockImplementation((fn) => { fn(); return 0; });
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_MAIN_MODEL;
});

/* ========================================================================== */
describe("resiliencia · qué se reintenta y qué no", () => {
  it("A · un 429 se reintenta y el segundo intento sirve", async () => {
    let n = 0;
    global.fetch = vi.fn(async () => (++n === 1 ? fallo(429, "rate limit") : OK));
    const { data } = await generateJson(LLAMADA);
    expect(data.titulo).toBe("Lista");
    expect(n).toBe(2);
  });

  it("B · un 503 se reintenta y el segundo intento sirve", async () => {
    let n = 0;
    global.fetch = vi.fn(async () => (++n === 1 ? fallo(503) : OK));
    await expect(generateJson(LLAMADA)).resolves.toBeTruthy();
    expect(n).toBe(2);
  });

  it("500, 502 y 504 también se reintentan", async () => {
    for (const status of [500, 502, 504]) {
      let n = 0;
      global.fetch = vi.fn(async () => (++n === 1 ? fallo(status) : OK));
      await expect(generateJson(LLAMADA), String(status)).resolves.toBeTruthy();
      expect(n, String(status)).toBe(2);
    }
  });

  it("C · un 400 NO se reintenta: daría lo mismo tres veces", async () => {
    let n = 0;
    global.fetch = vi.fn(async () => { n += 1; return fallo(400, "invalid argument"); });
    await expect(generateJson(LLAMADA)).rejects.toBeTruthy();
    expect(n).toBe(1);
  });

  it("401 y 403 tampoco: son de configuración, no de carga", async () => {
    for (const status of [401, 403]) {
      let n = 0;
      global.fetch = vi.fn(async () => { n += 1; return fallo(status); });
      await expect(generateJson(LLAMADA), String(status)).rejects.toBeTruthy();
      expect(n, String(status)).toBe(1);
    }
  });

  it("D · un bloqueo de seguridad NO se reintenta", async () => {
    let n = 0;
    global.fetch = vi.fn(async () => {
      n += 1;
      return { ok: true, status: 200, json: async () => ({
        candidates: [{ finishReason: "SAFETY", content: { parts: [] } }],
        usageMetadata: {},
      }) };
    });
    const error = await generateJson(LLAMADA).catch((e) => e);
    expect(error.code).toBe("AI_BLOCKED");
    expect(n).toBe(1);
  });

  it("un JSON inválido tampoco se reintenta desde aquí", async () => {
    let n = 0;
    global.fetch = vi.fn(async () => {
      n += 1;
      return { ok: true, status: 200, json: async () => ({
        candidates: [{ finishReason: "STOP", content: { parts: [{ text: "no soy json" }] } }],
        usageMetadata: {},
      }) };
    });
    await expect(generateJson(LLAMADA)).rejects.toMatchObject({ code: "AI_INCOMPLETE" });
    expect(n).toBe(1);
  });

  it("E · nunca pasa de tres intentos", async () => {
    let n = 0;
    global.fetch = vi.fn(async () => { n += 1; return fallo(503); });
    await expect(generateJson(LLAMADA)).rejects.toBeTruthy();
    expect(n).toBe(3);
  });

  it("agotar los reintentos por 429 da un mensaje propio, no el genérico", async () => {
    global.fetch = vi.fn(async () => fallo(429));
    const error = await generateJson(LLAMADA).catch((e) => e);
    expect(error.code).toBe("AI_BUSY");
    expect(error.message).toContain("muchas solicitudes");
    expect(error.message).not.toMatch(/429|quota|rate limit/i);
  });

  it("F · la espera crece y lleva dispersión", () => {
    // Sin dispersión, cien docentes que reciben 429 a la vez reintentarían
    // todas en el mismo milisegundo y volverían a chocar.
    expect(esperaDeReintento(1, () => 0)).toBe(500);
    expect(esperaDeReintento(1, () => 1)).toBe(1200);
    expect(esperaDeReintento(2, () => 0)).toBe(1500);
    expect(esperaDeReintento(2, () => 1)).toBe(3000);
    const a = esperaDeReintento(1, () => 0.2);
    const b = esperaDeReintento(1, () => 0.8);
    expect(a).not.toBe(b);
  });

  it("cada intento deja su propia línea de log", async () => {
    let n = 0;
    global.fetch = vi.fn(async () => (++n < 3 ? fallo(503) : OK));
    await generateJson(LLAMADA);

    const lineas = logs.filter((l) => l.includes("[sciverse:gemini]"))
      .map((l) => JSON.parse(l.slice(l.indexOf("{"))));
    expect(lineas.length).toBeGreaterThanOrEqual(3);
    const conEspera = lineas.filter((x) => typeof x.retryDelayMs === "number" && x.retryDelayMs > 0);
    expect(conEspera.length).toBe(2);
    for (const l of conEspera) {
      expect(l.requestId).toMatch(/^[0-9a-f]{8}$/);
      expect(l.tool).toBe("prueba");
      expect(typeof l.intento).toBe("number");
      expect(typeof l.durationMs).toBe("number");
    }
    // El intento final registra cuántos hubo.
    expect(lineas[lineas.length - 1].intentos).toBe(3);
  });

  it("los logs no llevan clave, prompt ni datos del aula", async () => {
    global.fetch = vi.fn(async () => fallo(503));
    await generateJson({ ...LLAMADA, prompt: "Mis estudiantes de 4.º B y la niña Ana Quispe" })
      .catch(() => {});
    const todo = logs.join("\n");
    expect(todo).not.toContain("clave-de-prueba");
    expect(todo).not.toContain("Ana Quispe");
    expect(todo).not.toContain("4.º B");
  });
});

/* ========================================================================== */
describe("resiliencia · el reintento no cuesta un crédito más", () => {
  function mockCreditos() {
    const llamadas = [];
    let geminis = 0;
    global.fetch = vi.fn(async (url) => {
      const u = String(url);
      if (u.includes("/rpc/")) {
        llamadas.push(u.split("/rpc/")[1]);
        if (u.includes("consume_ai_credit")) {
          return { ok: true, status: 200,
                   json: async () => ({ ok: true, consumption_id: "vale-1", remaining: 4 }) };
        }
        return { ok: true, status: 200, json: async () => ({ ok: true }) };
      }
      geminis += 1;
      return geminis < 3 ? fallo(503) : OK;
    });
    return { llamadas, geminis: () => geminis };
  }

  const auth = { token: "t", url: "https://p.supabase.co", key: "k", reason: "prueba" };

  it("G · dos reintentos internos, un solo consumo", async () => {
    const m = mockCreditos();
    await withCredit(auth, () => generateJson(LLAMADA));

    const consumos = m.llamadas.filter((c) => c.includes("consume_ai_credit"));
    expect(consumos).toHaveLength(1);
    expect(m.geminis()).toBe(3);          // tres intentos a Gemini
    expect(m.llamadas.some((c) => c.includes("refund"))).toBe(false);
  });

  it("H · si se agotan los intentos, el crédito se devuelve una sola vez", async () => {
    const llamadas = [];
    global.fetch = vi.fn(async (url) => {
      const u = String(url);
      if (u.includes("/rpc/")) {
        llamadas.push(u.split("/rpc/")[1]);
        if (u.includes("consume_ai_credit")) {
          return { ok: true, status: 200,
                   json: async () => ({ ok: true, consumption_id: "vale-1" }) };
        }
        return { ok: true, status: 200, json: async () => ({ ok: true }) };
      }
      return fallo(503);
    });

    await expect(withCredit(auth, () => generateJson(LLAMADA))).rejects.toBeTruthy();
    expect(llamadas.filter((c) => c.includes("consume_ai_credit"))).toHaveLength(1);
    expect(llamadas.filter((c) => c.includes("refund_ai_credit"))).toHaveLength(1);
  });

  it("la devolución va siempre atada a su vale", () => {
    const src = fs.readFileSync("api/_lib/credits.js", "utf8");
    expect(src).toContain("consumptionId: credits?.consumption_id");
    expect(src).toContain("if (!consumptionId)");
  });
});

/* ========================================================================== */
describe("entitlements · una sola fuente de capacidades", () => {
  it("los valores acordados están donde se dijo", () => {
    expect(CAPACIDADES_POR_DEFECTO.free).toMatchObject({
      weekly_ai_credits: 5, worksheet_max_questions: 10, reading_max_questions: 10,
      rubric_max_criteria: 5, checklist_max_criteria: 8, rating_scale_max_criteria: 8,
      steam_max_weeks: 2, docx_remove_watermark: false,
    });
    expect(CAPACIDADES_POR_DEFECTO.pro).toMatchObject({
      weekly_ai_credits: 100, worksheet_max_questions: 20, reading_max_questions: 20,
      rubric_max_criteria: 10, checklist_max_criteria: 15, rating_scale_max_criteria: 15,
      steam_max_weeks: 4, docx_remove_watermark: true,
    });
  });

  it("la base puede cambiarlos sin desplegar", () => {
    const c = capacidadesDe("free", { worksheet_max_questions: 12 });
    expect(c.worksheet_max_questions).toBe(12);
    expect(c.steam_max_weeks).toBe(2);   // lo no tocado conserva el respaldo
  });

  it("pero no puede saltarse el techo absoluto", () => {
    const c = capacidadesDe("free", { worksheet_max_questions: 9999, steam_max_weeks: 40 });
    expect(c.worksheet_max_questions).toBe(30);
    expect(c.steam_max_weeks).toBe(4);
  });

  it("un plan desconocido cae en Free, nunca en Pro", () => {
    expect(capacidadesDe("inventado").worksheet_max_questions).toBe(10);
    expect(capacidadesDe(undefined).docx_remove_watermark).toBe(false);
  });

  it("no hay if(plan==='pro') repartido por los endpoints", () => {
    for (const f of ["api/generate-session.js", "api/generate-session-resource.js",
                     "api/generate-linked-worksheet.js", "api/generate-project-steam.js"]) {
      const src = fs.readFileSync(f, "utf8")
        .split("\n").filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*")).join("\n");
      expect(src, f).not.toMatch(/===\s*["']pro["']/);
      expect(src, f).not.toMatch(/===\s*["']free["']/);
    }
  });

  it("no se crea un segundo sistema de créditos", () => {
    // Sólo el código: los comentarios explican precisamente que el cupo
    // semanal NO vive aquí, y nombrarlo para decirlo no es duplicarlo.
    const src = fs.readFileSync("api/_lib/entitlements.js", "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
    expect(src).not.toContain("consume_ai_credit");
    expect(src).not.toContain("ai_usage_counters");
    const sql = fs.readFileSync("supabase/migrations/009_plan_entitlements.sql", "utf8");
    expect(sql).not.toMatch(/alter table[^\n]*ai_weekly_limit/i);
  });
});

/* ========================================================================== */
describe("entitlements · el servidor es la autoridad", () => {
  it("I · Free no consigue más de 10 preguntas aunque pida 50", () => {
    const c = cantidadPermitida(50, { minimo: 5, limite: 10, porDefecto: 10 });
    expect(c.valor).toBe(10);
    expect(c.recortado).toBe(true);
  });

  it("J · Pro sí llega a 20", () => {
    expect(cantidadPermitida(20, { minimo: 5, limite: 20, porDefecto: 10 }).valor).toBe(20);
  });

  it("valores absurdos o manipulados no pasan", () => {
    for (const bruto of [-5, 0, "muchas", null, undefined, 1e9, "10; DROP TABLE"]) {
      const c = cantidadPermitida(bruto, { minimo: 5, limite: 10, porDefecto: 8 });
      expect(c.valor, String(bruto)).toBeGreaterThanOrEqual(5);
      expect(c.valor, String(bruto)).toBeLessThanOrEqual(10);
      expect(Number.isInteger(c.valor)).toBe(true);
    }
  });

  it("K · un Free que se declara «pro» sigue siendo Free", async () => {
    // El plan se resuelve con el token de la docente, no con lo que envía.
    global.fetch = vi.fn(async () => ({
      ok: true, status: 200,
      json: async () => ({ plan: "free", plan_name: "Gratuito", limit: 5, features: {} }),
    }));

    const e = await planEfectivo({ token: "t", url: "https://p.supabase.co", key: "k" });
    expect(e.plan).toBe("free");
    expect(e.capacidades.worksheet_max_questions).toBe(10);
    expect(e.capacidades.docx_remove_watermark).toBe(false);

    // Y los endpoints nunca leen el plan del cuerpo.
    for (const f of ["api/generate-linked-worksheet.js", "api/generate-session-resource.js",
                     "api/generate-project-steam.js"]) {
      const src = fs.readFileSync(f, "utf8");
      expect(src, f).not.toMatch(/req\.body[^\n]*\.plan\b/);
      expect(src, f).toContain("planEfectivo");
    }
  });

  it("si no se puede resolver el plan, se cae a Free y no a Pro", async () => {
    global.fetch = vi.fn(async () => { throw new Error("red caída"); });
    const e = await planEfectivo({ token: "t", url: "https://p.supabase.co", key: "k" });
    expect(e.plan).toBe("free");
    expect(e.capacidades.docx_remove_watermark).toBe(false);
  });

  it("L · Pro puede quitar la marca de agua", () => {
    expect(permiteQuitarMarca(CAPACIDADES_POR_DEFECTO.pro, true)).toBe(true);
    expect(permiteQuitarMarca(CAPACIDADES_POR_DEFECTO.pro, false)).toBe(false);
  });

  it("M · Free no puede, ni marcando la casilla", () => {
    expect(permiteQuitarMarca(CAPACIDADES_POR_DEFECTO.free, true)).toBe(false);
    expect(permiteQuitarMarca(undefined, true)).toBe(false);
  });

  it("el mensaje de límite no habla en jerga técnica", () => {
    const m = mensajeDeLimite({ plan: "free", limite: 10, unidad: "preguntas por ficha", limitePro: 20 });
    expect(m).toBe("Tu plan Gratuito permite hasta 10 preguntas por ficha. Con Pro puedes crear hasta 20.");
    for (const jerga of ["403", "entitlement", "quota", "MAX_LIMIT", "forbidden"]) {
      expect(m, jerga).not.toContain(jerga);
    }
  });
});

/* ========================================================================== */
describe("resiliencia · la migración no toca lo que ya funciona", () => {
  const sql = fs.readFileSync("supabase/migrations/009_plan_entitlements.sql", "utf8");
  const activo = sql.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");

  it("sólo escribe en plans.features", () => {
    expect(activo).not.toMatch(/create table/i);
    expect(activo).not.toMatch(/drop /i);
    expect(activo).not.toMatch(/delete from/i);
    expect(activo).not.toMatch(/alter table public\.plans add column/i);
  });

  it("fusiona en vez de reemplazar, para no perder claves ajenas", () => {
    expect(activo).toContain("coalesce(features, '{}'::jsonb) ||");
  });

  it("va en una transacción y comprueba precondiciones", () => {
    expect(activo.trimStart().startsWith("begin;")).toBe(true);
    expect(activo).toContain("commit;");
    expect(activo).toContain("ABORTA: falta 002_commercial_core.sql");
  });
});

/* ========================================================================== */
describe("presupuesto de Serverless Functions", () => {
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

  it("R · seguimos en 8, y nunca por encima de 12", () => {
    const total = entrypoints().length;
    expect(total).toBeLessThanOrEqual(12);
    expect(total).toBeLessThanOrEqual(10);
    expect(total).toBe(8);
  });

  it("la capa de entitlements no es un entrypoint", () => {
    expect(entrypoints().some((r) => r.includes("entitlements"))).toBe(false);
    expect(fs.existsSync("api/_lib/entitlements.js")).toBe(true);
  });
});

/* ============================================================================
   CENTRALIZACIÓN: NINGÚN ENDPOINT LLAMA A GEMINI POR SU CUENTA
   ========================================================================== */
describe("gemini · una sola puerta", () => {
  const ENDPOINTS = ["api/generate-session.js", "api/generate-session-resource.js",
                     "api/generate-linked-worksheet.js", "api/generate-project-steam.js"];

  it("ningún endpoint activo tiene fetch directo a Gemini", () => {
    for (const f of ENDPOINTS) {
      const src = fs.readFileSync(f, "utf8");
      expect(src, f).not.toContain("generativelanguage.googleapis.com");
      expect(src, f).not.toContain(":generateContent");
    }
  });

  it("la URL de Gemini existe en UN solo fichero", () => {
    const encontrados = [];
    const buscar = (dir) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const ruta = `${dir}/${e.name}`;
        if (e.isDirectory()) { buscar(ruta); continue; }
        if (!e.name.endsWith(".js")) continue;
        if (fs.readFileSync(ruta, "utf8").includes("generativelanguage.googleapis.com")) {
          encontrados.push(ruta);
        }
      }
    };
    buscar("api");
    expect(encontrados).toEqual(["api/_lib/gemini.js"]);
  });

  it("los cuatro endpoints importan la capa central", () => {
    for (const f of ENDPOINTS) {
      expect(fs.readFileSync(f, "utf8"), f).toMatch(/generateJson[^\n]*from "\.\/_lib\/gemini\.js"/);
    }
  });

  it("no queda ninguna política de reintentos propia por endpoint", () => {
    for (const f of ENDPOINTS) {
      const src = fs.readFileSync(f, "utf8");
      expect(src, f).not.toContain("ESTADOS_TRANSITORIOS");
      expect(src, f).not.toMatch(/status\s*===\s*429/);
      expect(src, f).not.toMatch(/finishReason\s*===\s*"MAX_TOKENS"/);
    }
  });
});

/* ============================================================================
   LOS DOS ENDPOINTS CENTRALIZADOS HEREDAN LOS REINTENTOS
   ========================================================================== */
describe("gemini · los endpoints refactorizados aguantan un pico", () => {
  const SCHEMA = { type: "object", properties: { titulo: { type: "string" } } };

  it("recurso de sesión: 429 -> reintento -> éxito", async () => {
    let n = 0;
    global.fetch = vi.fn(async () => (++n === 1 ? fallo(429, "rate limit") : OK));
    const { data } = await generateJson({
      prompt: "Genera una ficha", responseSchema: SCHEMA,
      maxOutputTokens: 9000, tool: "recurso:worksheet",
    });
    expect(data.titulo).toBe("Lista");
    expect(n).toBe(2);
  });

  it("ficha vinculada: 503 -> reintento -> éxito", async () => {
    let n = 0;
    global.fetch = vi.fn(async () => (++n === 1 ? fallo(503) : OK));
    await expect(generateJson({
      prompt: "Genera preguntas", responseSchema: SCHEMA,
      maxOutputTokens: 7500, tool: "ficha-vinculada",
    })).resolves.toBeTruthy();
    expect(n).toBe(2);
  });

  it("ambos etiquetan su herramienta en el log", async () => {
    global.fetch = vi.fn(async () => OK);
    for (const tool of ["recurso:reading", "ficha-vinculada"]) {
      logs.length = 0;
      await generateJson({ prompt: "x", responseSchema: SCHEMA, maxOutputTokens: 4500, tool });
      const linea = logs.find((l) => l.includes("[sciverse:gemini]"));
      expect(JSON.parse(linea.slice(linea.indexOf("{"))).tool, tool).toBe(tool);
    }
  });
});

/* ============================================================================
   TIMEOUT: POLÍTICA DECIDIDA, NO HEREDADA POR DESCUIDO
   ========================================================================== */
describe("gemini · política de timeout", () => {
  const SCHEMA = { type: "object", properties: { titulo: { type: "string" } } };

  it("el corte es del cliente, a 45 s, y es el mismo para todos", () => {
    const src = fs.readFileSync("api/_lib/gemini.js", "utf8");
    expect(src).toContain("const DEFAULT_TIMEOUT_MS = 45_000");
    expect(src).toContain("AbortSignal.timeout(timeoutMs)");
  });

  it("un timeout NO se reintenta", async () => {
    // Decisión: ya se esperaron 45 s. Un segundo intento dejaría a la docente
    // hasta 90 s mirando la pantalla, y si el modelo tardó demasiado con este
    // prompt volverá a tardar. Es mejor devolverle el control.
    let n = 0;
    global.fetch = vi.fn(async () => {
      n += 1;
      throw Object.assign(new Error("The operation was aborted"), { name: "TimeoutError" });
    });
    const error = await generateJson({
      prompt: "x", responseSchema: SCHEMA, maxOutputTokens: 4000, tool: "prueba",
    }).catch((e) => e);
    expect(error.code).toBe("AI_TIMEOUT");
    expect(n).toBe(1);
  });

  it("una caída de red SÍ se reintenta: es otra cosa", async () => {
    // Un ECONNRESET puede ser un nodo que se cayó; el siguiente intento
    // aterriza en otro. Distinguirlo del timeout es la razón de mirar `name`.
    let n = 0;
    global.fetch = vi.fn(async () => {
      n += 1;
      if (n === 1) throw Object.assign(new Error("ECONNRESET"), { name: "TypeError" });
      return OK;
    });
    await expect(generateJson({
      prompt: "x", responseSchema: SCHEMA, maxOutputTokens: 4000, tool: "prueba",
    })).resolves.toBeTruthy();
    expect(n).toBe(2);
  });

  it("el timeout no se subió para tapar el problema", () => {
    const src = fs.readFileSync("api/_lib/gemini.js", "utf8");
    expect(src).not.toMatch(/DEFAULT_TIMEOUT_MS\s*=\s*(6|7|8|9)\d_?000/);
  });
});

/* ============================================================================
   CLAMP: DEFENSA SÍ, UX SILENCIOSA NO
   ========================================================================== */
describe("entitlements · el recorte se nota y se registra", () => {
  it("devuelve pedido, efectivo y máximo, no sólo el número final", () => {
    const r = cantidadPermitida(50, { minimo: 5, limite: 10, porDefecto: 10 });
    expect(r).toMatchObject({ pedido: 50, valor: 10, limite: 10, recortado: true });
  });

  it("una petición dentro del límite no se marca como recortada", () => {
    expect(cantidadPermitida(8, { minimo: 5, limite: 10, porDefecto: 10 }))
      .toMatchObject({ pedido: 8, valor: 8, recortado: false });
  });

  it("un recorte deja rastro sin datos personales", () => {
    const registrado = [];
    const antes = console.warn;
    console.warn = (...a) => registrado.push(a.join(" "));
    try {
      cantidadPermitida(500, { minimo: 5, limite: 10, porDefecto: 10, tool: "ficha", plan: "free" });
    } finally { console.warn = antes; }

    const linea = registrado.find((l) => l.includes("clamp"));
    expect(linea).toBeTruthy();
    const datos = JSON.parse(linea.slice(linea.indexOf("{")));
    expect(datos).toMatchObject({ tool: "ficha", plan: "free", pedido: 500, efectivo: 10 });
    // Ni correo, ni nombre, ni identificador de usuario.
    expect(linea).not.toMatch(/@|user_id|nombres|token/);
  });
});

/* ============================================================================
   IDEMPOTENCIA
   ========================================================================== */
describe("idempotencia · una operación lógica, un cobro", () => {
  const AUTH = { token: "t", url: "https://p.supabase.co", key: "k", reason: "prueba" };

  /** Supabase simulado con una tabla de operaciones en memoria. */
  function supabaseFalso({ geminiFalla = false } = {}) {
    const operaciones = new Map();
    const contador = { consume: 0, refund: 0, begin: 0, finish: 0, gemini: 0 };

    global.fetch = vi.fn(async (url, opts) => {
      const u = String(url);
      const cuerpo = opts?.body ? JSON.parse(opts.body) : {};

      if (u.includes("begin_ai_operation")) {
        contador.begin += 1;
        const previa = operaciones.get(cuerpo.p_key);
        if (!previa || previa === "failed") {
          operaciones.set(cuerpo.p_key, "processing");
          return { ok: true, status: 200, json: async () => ({ status: "started" }) };
        }
        return { ok: true, status: 200,
                 json: async () => ({ status: "duplicate", estado_previo: previa }) };
      }
      if (u.includes("finish_ai_operation")) {
        contador.finish += 1;
        operaciones.set(cuerpo.p_key, cuerpo.p_status);
        return { ok: true, status: 200, json: async () => ({ ok: true }) };
      }
      if (u.includes("consume_ai_credit")) {
        contador.consume += 1;
        return { ok: true, status: 200,
                 json: async () => ({ ok: true, consumption_id: `vale-${contador.consume}` }) };
      }
      if (u.includes("refund_ai_credit")) {
        contador.refund += 1;
        return { ok: true, status: 200, json: async () => ({ ok: true }) };
      }
      contador.gemini += 1;
      if (geminiFalla) return fallo(503);
      return OK;
    });

    return contador;
  }

  const operacion = async () => ({ hecho: true });

  it("misma clave, dos veces seguidas: un solo cobro", async () => {
    const c = supabaseFalso();
    const auth = { ...AUTH, idempotencyKey: "op-abcdef123456" };

    await withCredit(auth, operacion);
    await expect(withCredit(auth, operacion)).rejects.toMatchObject({
      code: "DUPLICATE_OPERATION", status: 409,
    });

    expect(c.consume).toBe(1);
    expect(c.refund).toBe(0);
  });

  it("misma clave, dos peticiones a la vez: sólo una pasa", async () => {
    const c = supabaseFalso();
    const auth = { ...AUTH, idempotencyKey: "op-concurrente01" };

    const resultados = await Promise.allSettled([
      withCredit(auth, operacion),
      withCredit(auth, operacion),
    ]);

    const ok = resultados.filter((r) => r.status === "fulfilled");
    const ko = resultados.filter((r) => r.status === "rejected");
    expect(ok).toHaveLength(1);
    expect(ko).toHaveLength(1);
    expect(ko[0].reason.code).toBe("DUPLICATE_OPERATION");
    expect(c.consume).toBe(1);
  });

  it("claves distintas son operaciones distintas", async () => {
    const c = supabaseFalso();
    await withCredit({ ...AUTH, idempotencyKey: "op-primera00001" }, operacion);
    await withCredit({ ...AUTH, idempotencyKey: "op-segunda00002" }, operacion);
    expect(c.consume).toBe(2);
  });

  it("un fallo definitivo devuelve el crédito UNA vez y libera la clave", async () => {
    const c = supabaseFalso();
    const auth = { ...AUTH, idempotencyKey: "op-fallida000001" };

    await expect(withCredit(auth, async () => { throw new Error("falló"); }))
      .rejects.toBeTruthy();
    expect(c.consume).toBe(1);
    expect(c.refund).toBe(1);

    // Reintentar con la MISMA clave debe poder: la anterior quedó en `failed`.
    await withCredit(auth, operacion);
    expect(c.consume).toBe(2);
    expect(c.refund).toBe(1);
  });

  it("sin clave, todo sigue como antes", async () => {
    const c = supabaseFalso();
    await withCredit(AUTH, operacion);
    await withCredit(AUTH, operacion);
    expect(c.begin).toBe(0);
    expect(c.consume).toBe(2);
  });

  it("si la migración 010 no está aplicada, no bloquea a nadie", async () => {
    const contador = { consume: 0 };
    global.fetch = vi.fn(async (url) => {
      const u = String(url);
      if (u.includes("begin_ai_operation")) {
        return { ok: false, status: 404,
                 json: async () => ({ message: "Could not find the function begin_ai_operation" }) };
      }
      if (u.includes("consume_ai_credit")) {
        contador.consume += 1;
        return { ok: true, status: 200, json: async () => ({ ok: true, consumption_id: "v" }) };
      }
      return { ok: true, status: 200, json: async () => ({ ok: true }) };
    });

    await expect(withCredit({ ...AUTH, idempotencyKey: "op-sinsoporte01" }, operacion))
      .resolves.toBeTruthy();
    expect(contador.consume).toBe(1);
  });

  it("los reintentos internos a Gemini no abren una operación nueva", async () => {
    const c = supabaseFalso({ geminiFalla: true });
    const auth = { ...AUTH, idempotencyKey: "op-reintentos001" };

    await expect(withCredit(auth, () => generateJson({
      prompt: "x", responseSchema: { type: "object" }, maxOutputTokens: 4000, tool: "prueba",
    }))).rejects.toBeTruthy();

    expect(c.gemini).toBe(3);   // tres intentos a Gemini
    expect(c.begin).toBe(1);    // una sola reserva
    expect(c.consume).toBe(1);  // un solo cobro
    expect(c.refund).toBe(1);   // una sola devolución
  });
});

describe("idempotencia · la clave", () => {
  it("se acepta la del cliente si es razonable", () => {
    const r = claveDeOperacion({ headers: { "idempotency-key": "sesion-2026-09-06-abc123" } });
    expect(r).toMatchObject({ clave: "sesion-2026-09-06-abc123", delCliente: true });
  });

  it("también se acepta desde el cuerpo", () => {
    expect(claveDeOperacion({ headers: {}, body: { idempotencyKey: "op-desde-el-cuerpo" } }).delCliente)
      .toBe(true);
  });

  it("una clave basura no se usa: se genera una y se nota", () => {
    for (const mala of ["", "corta", null, undefined, "con espacios y ñ", "x".repeat(200)]) {
      const r = claveDeOperacion({ headers: { "idempotency-key": mala }, body: {} });
      expect(r.delCliente, String(mala)).toBe(false);
      expect(r.clave).toMatch(/^srv-/);
    }
  });

  it("no vale en memoria: la garantía está en Postgres", () => {
    const src = fs.readFileSync("api/_lib/idempotency.js", "utf8");
    expect(src).toContain("begin_ai_operation");
    expect(src).not.toMatch(/new Map\(\)|new Set\(\)/);
    const sql = fs.readFileSync("supabase/migrations/010_ai_idempotency.sql", "utf8");
    expect(sql).toContain("on conflict (user_id, key) do nothing");
    expect(sql).toContain("primary key (user_id, key)");
  });

  it("la migración contempla los tres estados y la limpieza", () => {
    const sql = fs.readFileSync("supabase/migrations/010_ai_idempotency.sql", "utf8");
    expect(sql).toContain("'processing', 'completed', 'failed'");
    expect(sql).toContain("purge_ai_operations");
    expect(sql).not.toMatch(/\bdelete from public\./i);
  });
});

/* ============================================================================
   CONCURRENCIA REAL SOBRE LA MISMA CLAVE

   El primer diseño leía el estado con un SELECT y decidía después. Entre esa
   lectura y el UPDATE cabe otra transacción: dos reintentos simultáneos sobre
   la MISMA operación fallida podían verse los dos en `failed` y declararse
   los dos `started`. Dos créditos, dos llamadas a Gemini — exactamente lo
   que esta tabla existe para impedir.

   El simulador de abajo reproduce la semántica corregida: las dos únicas
   sentencias que deciden son el INSERT con ON CONFLICT y el UPDATE acotado
   a `status = 'failed'`. Quien no afecta filas, pierde.
   ========================================================================== */
describe("idempotencia · adquisición atómica", () => {
  /**
   * Postgres simulado.
   *
   * `filas` está indexado por `user::key`, igual que la clave primaria real.
   * `begin` NO consulta antes de decidir: replica insert-o-update-condicional
   * y responde según haya afectado filas o no.
   */
  function postgresFalso(estadoInicial = {}) {
    const filas = new Map(Object.entries(estadoInicial));
    const contador = { begin: 0, finish: 0, consume: 0, refund: 0, gemini: 0 };
    const iniciados = [];

    const rpc = (nombre, usuario, cuerpo) => {
      const id = `${usuario}::${cuerpo.p_key}`;

      if (nombre === "begin_ai_operation") {
        contador.begin += 1;

        // Adquisición 1 · insert ... on conflict do nothing
        if (!filas.has(id)) {
          filas.set(id, "processing");
          iniciados.push(usuario);
          return { status: "started", reintento: false };
        }

        // Adquisición 2 · update ... where status = 'failed'
        if (filas.get(id) === "failed") {
          filas.set(id, "processing");
          iniciados.push(usuario);
          return { status: "started", reintento: true };
        }

        return { status: "duplicate", estado_previo: filas.get(id) };
      }

      if (nombre === "finish_ai_operation") {
        contador.finish += 1;
        // Acotado a la propia usuaria: si no hay fila suya, no toca nada.
        if (!filas.has(id)) return { ok: false, reason: "not_found" };
        filas.set(id, cuerpo.p_status);
        return { ok: true, status: cuerpo.p_status };
      }

      if (nombre === "consume_ai_credit") {
        contador.consume += 1;
        return { ok: true, consumption_id: `vale-${contador.consume}` };
      }
      if (nombre === "refund_ai_credit") {
        contador.refund += 1;
        return { ok: true };
      }
      return {};
    };

    /** Devuelve un `fetch` que actúa como si el token fuera de `usuario`. */
    const comoUsuario = (usuario) => async (url, opts) => {
      const u = String(url);
      if (!u.includes("/rpc/")) {
        contador.gemini += 1;
        return OK;
      }
      const nombre = u.split("/rpc/")[1];
      const cuerpo = opts?.body ? JSON.parse(opts.body) : {};
      return { ok: true, status: 200, json: async () => rpc(nombre, usuario, cuerpo) };
    };

    return { filas, contador, iniciados, comoUsuario };
  }

  const AUTH = (usuario = "ana") => ({
    token: `token-${usuario}`, url: "https://p.supabase.co", key: "k",
    reason: "prueba",
  });

  const operacion = async () => ({ hecho: true });

  it("1 · dos begin simultáneos sobre clave nueva: exactamente uno arranca", async () => {
    const pg = postgresFalso();
    global.fetch = vi.fn(pg.comoUsuario("ana"));
    const auth = { ...AUTH(), idempotencyKey: "op-nueva-00000001" };

    const r = await Promise.allSettled([
      withCredit(auth, operacion),
      withCredit(auth, operacion),
    ]);

    expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    expect(r.filter((x) => x.status === "rejected")).toHaveLength(1);
    expect(pg.contador.consume).toBe(1);
    expect(pg.iniciados).toHaveLength(1);
  });

  it("2 · dos reintentos simultáneos sobre una operación FALLIDA: uno solo", async () => {
    // Éste es el caso que el diseño anterior no cubría.
    const pg = postgresFalso({ "ana::op-fallida-0000001": "failed" });
    global.fetch = vi.fn(pg.comoUsuario("ana"));
    const auth = { ...AUTH(), idempotencyKey: "op-fallida-0000001" };

    const r = await Promise.allSettled([
      withCredit(auth, operacion),
      withCredit(auth, operacion),
    ]);

    const ok = r.filter((x) => x.status === "fulfilled");
    const ko = r.filter((x) => x.status === "rejected");
    expect(ok).toHaveLength(1);
    expect(ko).toHaveLength(1);
    expect(ko[0].reason.code).toBe("DUPLICATE_OPERATION");
    expect(pg.contador.consume).toBe(1);
    expect(pg.contador.gemini).toBe(0);   // el perdedor no llamó a Gemini
  });

  it("tres reintentos simultáneos sobre la misma fallida: sigue siendo uno", async () => {
    const pg = postgresFalso({ "ana::op-fallida-0000002": "failed" });
    global.fetch = vi.fn(pg.comoUsuario("ana"));
    const auth = { ...AUTH(), idempotencyKey: "op-fallida-0000002" };

    const r = await Promise.allSettled([
      withCredit(auth, operacion), withCredit(auth, operacion), withCredit(auth, operacion),
    ]);
    expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    expect(pg.contador.consume).toBe(1);
  });

  it("3 · una operación COMPLETADA nunca se reabre", async () => {
    const pg = postgresFalso({ "ana::op-completa-000001": "completed" });
    global.fetch = vi.fn(pg.comoUsuario("ana"));

    await expect(withCredit({ ...AUTH(), idempotencyKey: "op-completa-000001" }, operacion))
      .rejects.toMatchObject({ code: "DUPLICATE_OPERATION" });
    expect(pg.contador.consume).toBe(0);
  });

  it("4 · una operación EN CURSO nunca se reabre", async () => {
    const pg = postgresFalso({ "ana::op-encurso-000001": "processing" });
    global.fetch = vi.fn(pg.comoUsuario("ana"));

    await expect(withCredit({ ...AUTH(), idempotencyKey: "op-encurso-000001" }, operacion))
      .rejects.toMatchObject({ code: "DUPLICATE_OPERATION" });
    expect(pg.contador.consume).toBe(0);
  });

  it("5 · la clave de una docente no bloquea ni alcanza la de otra", async () => {
    const pg = postgresFalso({ "ana::op-compartida-001": "processing" });
    const clave = "op-compartida-001";

    // Beatriz usa la MISMA cadena: es su propia operación, arranca sin problema.
    global.fetch = vi.fn(pg.comoUsuario("beatriz"));
    await expect(withCredit({ ...AUTH("beatriz"), idempotencyKey: clave }, operacion))
      .resolves.toBeTruthy();

    // Y Ana sigue con la suya en curso: nadie se la ha tocado.
    expect(pg.filas.get("ana::op-compartida-001")).toBe("processing");
    expect(pg.filas.get("beatriz::op-compartida-001")).toBe("completed");
  });

  it("6 · cerrar una clave inexistente NO reporta éxito falso", async () => {
    const pg = postgresFalso();
    global.fetch = vi.fn(pg.comoUsuario("ana"));

    const ok = await cerrarOperacion({
      token: "t", url: "https://p.supabase.co", key: "k",
      clave: "op-que-no-existe-1", estado: "completed",
    });
    expect(ok).toBe(false);
    expect(logs.some((l) => l.includes("cierre_sin_fila"))).toBe(true);
  });

  it("un cierre real sí reporta éxito", async () => {
    const pg = postgresFalso({ "ana::op-existente-0001": "processing" });
    global.fetch = vi.fn(pg.comoUsuario("ana"));

    const ok = await cerrarOperacion({
      token: "t", url: "https://p.supabase.co", key: "k",
      clave: "op-existente-0001", estado: "completed",
    });
    expect(ok).toBe(true);
    expect(pg.filas.get("ana::op-existente-0001")).toBe("completed");
  });
});

/* ============================================================================
   LO QUE DEBE DECIR EL SQL
   ========================================================================== */
describe("idempotencia · el SQL no decide con un SELECT", () => {
  const sql = fs.readFileSync("supabase/migrations/010_ai_idempotency.sql", "utf8");
  const activo = sql.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
  const cuerpoBegin = activo.slice(
    activo.indexOf("function public.begin_ai_operation"),
    activo.indexOf("function public.finish_ai_operation")
  );

  it("la reapertura es un UPDATE condicionado al estado, no un IF tras SELECT", () => {
    expect(cuerpoBegin).toMatch(/update sciverse_private\.ai_operations[\s\S]*?and status\s*=\s*'failed'/);
    // El patrón antiguo: leer y decidir después.
    expect(cuerpoBegin).not.toMatch(/if v_estado\s*=\s*'failed'\s*then/);
  });

  it("la decisión la toma FOUND, dos veces", () => {
    expect((cuerpoBegin.match(/if found then/g) || []).length).toBe(2);
  });

  it("el único SELECT llega DESPUÉS de haber decidido", () => {
    const iUpdate = cuerpoBegin.indexOf("update sciverse_private.ai_operations");
    const iSelect = cuerpoBegin.indexOf("select status into v_estado");
    expect(iUpdate).toBeGreaterThan(0);
    expect(iSelect).toBeGreaterThan(iUpdate);
  });

  it("la inserción sigue siendo la primera adquisición atómica", () => {
    expect(cuerpoBegin).toContain("on conflict (user_id, key) do nothing");
  });

  it("9 · la clave foránea ya no arrastra en cascada", () => {
    expect(activo).toContain("on delete restrict");
    expect(activo).not.toContain("on delete cascade");
    expect(activo).not.toContain("on delete set null");
  });

  it("se documenta que el borrado de cuentas es lógico, no físico", () => {
    expect(sql).toMatch(/desactivar/i);
    expect(sql).toMatch(/RESTRICT/);
  });

  it("finish deja de mentir cuando no toca ninguna fila", () => {
    const cuerpoFinish = activo.slice(activo.indexOf("function public.finish_ai_operation"));
    expect(cuerpoFinish).toContain("if not found then");
    expect(cuerpoFinish).toContain("'not_found'");
  });

  it("7 · anon no ejecuta ninguna de las tres", () => {
    for (const f of ["begin_ai_operation", "finish_ai_operation", "purge_ai_operations"]) {
      expect(activo, f).toMatch(
        new RegExp(`revoke all on function public\\.${f}[^;]*from public, anon, authenticated`));
      expect(activo, f).not.toMatch(
        new RegExp(`grant execute on function public\\.${f}[^;]*anon`));
    }
  });

  it("8 · purgar es sólo del servidor", () => {
    expect(activo).toMatch(/grant execute on function public\.purge_ai_operations\(integer\) to service_role;/);
    expect(activo).not.toMatch(/grant execute on function public\.purge_ai_operations[^;]*authenticated/);
  });

  it("la tabla sigue sin alcance para el cliente", () => {
    expect(activo).toContain("revoke all on sciverse_private.ai_operations from anon, authenticated");
    expect(activo).toContain("enable row level security");
    expect(activo).not.toMatch(/create policy[^\n]*ai_operations/);
    expect(activo).not.toMatch(/grant (select|insert|update|delete)[^;]*ai_operations/i);
  });

  it("las tres son SECURITY DEFINER con search_path vacío y usan auth.uid()", () => {
    for (const f of ["begin_ai_operation", "finish_ai_operation", "purge_ai_operations"]) {
      const i = activo.indexOf(`function public.${f}`);
      const cuerpo = activo.slice(i, i + 900);
      expect(cuerpo, f).toContain("security definer");
      expect(cuerpo, f).toContain("set search_path = ''");
    }
    expect(cuerpoBegin).toContain("auth.uid()");
    expect(activo.slice(activo.indexOf("function public.finish_ai_operation"))).toContain("auth.uid()");
  });

  it("ninguna función acepta un identificador de usuario como parámetro", () => {
    for (const f of ["begin_ai_operation(", "finish_ai_operation("]) {
      const i = activo.indexOf(`function public.${f}`);
      const firma = activo.slice(i, activo.indexOf(")", i));
      expect(firma, f).not.toMatch(/uuid|user_id|p_user/);
    }
  });

  it("el único DELETE está en la purga, y es por antigüedad", () => {
    const deletes = activo.match(/delete from[^\n;]*/g) || [];
    expect(deletes).toHaveLength(1);
    expect(deletes[0]).toContain("sciverse_private.ai_operations");
    expect(activo).toContain("created_at < now() - (v_dias || ' days')::interval");
    expect(activo).toContain("greatest(coalesce(p_dias, 7), 1)");
  });
});

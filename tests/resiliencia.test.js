import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";

import { generateJson, esperaDeReintento } from "../api/_lib/gemini.js";
import { withCredit } from "../api/_lib/credits.js";
import {
  CAPACIDADES_POR_DEFECTO, cantidadPermitida, capacidadesDe, mensajeDeLimite,
  permiteQuitarMarca, planEfectivo,
} from "../api/_lib/entitlements.js";
import { claveDeOperacion } from "../api/_lib/idempotency.js";

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

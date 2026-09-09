import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";

import { generateJson, esperaDeReintento } from "../api/_lib/gemini.js";
import { withCredit } from "../api/_lib/credits.js";
import {
  CAPACIDADES_POR_DEFECTO, cantidadPermitida, capacidadesDe, mensajeDeLimite,
  permiteQuitarMarca, planEfectivo,
} from "../api/_lib/entitlements.js";

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

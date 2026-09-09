import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";

import { generateJson, getGeminiModel } from "../api/_lib/gemini.js";
import { withCredit } from "../api/_lib/credits.js";

/* ============================================================================
   POR QUÉ EXISTE ESTE FICHERO

   «La respuesta llegó incompleta» salía de TRES situaciones muy distintas
   —sin texto, truncada por presupuesto, y JSON inválido— y las tres
   producían la misma línea de log, vacía. En producción era imposible saber
   cuál de las tres estaba ocurriendo, así que el bug de «Sugerir con Kantu»
   no se podía diagnosticar: sólo adivinar.

   Estos tests fijan qué produce cada situación y qué queda registrado.
   Ninguno llama a Gemini: se sustituye `fetch`.
   ========================================================================== */

/** Respuesta de Gemini a medida. */
function respuesta({ text = null, finishReason = "STOP", blockReason = null,
                     tokens = {}, ok = true, status = 200 } = {}) {
  const payload = { candidates: [], usageMetadata: {
    promptTokenCount: tokens.prompt ?? 100,
    candidatesTokenCount: tokens.salida ?? 0,
    thoughtsTokenCount: tokens.pensamiento ?? 0,
    totalTokenCount: tokens.total ?? 100,
  } };

  if (blockReason) payload.promptFeedback = { blockReason };
  else payload.candidates = [{
    finishReason,
    content: text === null ? { parts: [] } : { parts: [{ text }] },
  }];

  return { ok, status, json: async () => payload };
}

const LLAMADA = {
  prompt: "Redacta una situación significativa sobre la escasez de agua.",
  responseSchema: { type: "object", properties: { suggestion: { type: "string" } },
                    required: ["suggestion"] },
  maxOutputTokens: 900,
  tool: "steam-sugerencia:situacion",
};

let logs;

beforeEach(() => {
  process.env.GEMINI_API_KEY = "clave-de-prueba";
  process.env.GEMINI_MAIN_MODEL = "gemini-modelo-de-prueba";
  logs = [];
  vi.spyOn(console, "log").mockImplementation((...a) => logs.push(a.join(" ")));
  vi.spyOn(console, "error").mockImplementation((...a) => logs.push(a.join(" ")));
  vi.spyOn(console, "warn").mockImplementation((...a) => logs.push(a.join(" ")));
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_MAIN_MODEL;
});

/* ========================================================================== */
describe("gemini · el camino que funciona", () => {
  it("una respuesta completa devuelve el JSON parseado", async () => {
    global.fetch = vi.fn(async () =>
      respuesta({ text: '{"suggestion":"En la comunidad falta agua algunos meses."}',
                  tokens: { salida: 40, total: 140 } }));

    const { data, model } = await generateJson(LLAMADA);
    expect(data.suggestion).toContain("agua");
    expect(model).toBe("gemini-modelo-de-prueba");
  });

  it("«Sugerir con Kantu» con una respuesta válida NO dice incompleta", async () => {
    global.fetch = vi.fn(async () =>
      respuesta({ text: '{"suggestion":"Los estudiantes analizan la escasez de agua."}' }));
    await expect(generateJson(LLAMADA)).resolves.toBeTruthy();
  });

  it("deja UNA línea de log con lo necesario para diagnosticar", async () => {
    global.fetch = vi.fn(async () =>
      respuesta({ text: '{"suggestion":"ok"}', tokens: { salida: 12, pensamiento: 30 } }));
    await generateJson(LLAMADA);

    const linea = logs.find((l) => l.includes("[sciverse:gemini]"));
    expect(linea).toBeTruthy();
    const datos = JSON.parse(linea.slice(linea.indexOf("{")));
    expect(datos.tool).toBe("steam-sugerencia:situacion");
    expect(datos.model).toBe("gemini-modelo-de-prueba");
    expect(datos.maxOutputTokens).toBe(900);
    expect(datos.finishReason).toBe("STOP");
    expect(datos.ok).toBe(true);
    expect(datos.tokens.pensamiento).toBe(30);
    expect(typeof datos.durationMs).toBe("number");
    expect(datos.requestId).toMatch(/^[0-9a-f]{8}$/);
  });
});

/* ========================================================================== */
describe("gemini · las tres formas de llegar incompleta, ahora distinguibles", () => {
  it("SIN TEXTO y presupuesto agotado: el caso sospechoso de Kantu", async () => {
    // El modelo gastó los 900 tokens pensando y no llegó a escribir nada.
    global.fetch = vi.fn(async () =>
      respuesta({ text: null, finishReason: "MAX_TOKENS",
                  tokens: { pensamiento: 900, salida: 0, total: 1000 } }));

    await expect(generateJson(LLAMADA)).rejects.toMatchObject({
      code: "AI_INCOMPLETE",
      status: 502,
    });

    const linea = logs.find((l) => l.includes("SIN_TEXTO_POR_PRESUPUESTO"));
    expect(linea, "el log debe decir POR QUÉ").toBeTruthy();
    const datos = JSON.parse(linea.slice(linea.indexOf("{")));
    expect(datos.tokens.pensamiento).toBe(900);
    expect(datos.textLength).toBe(0);
    expect(datos.finishReason).toBe("MAX_TOKENS");
  });

  it("sin texto y sin MAX_TOKENS se distingue del caso anterior", async () => {
    global.fetch = vi.fn(async () => respuesta({ text: null, finishReason: "OTHER" }));
    await expect(generateJson(LLAMADA)).rejects.toMatchObject({ code: "AI_INCOMPLETE" });
    expect(logs.some((l) => l.includes('"motivo":"SIN_TEXTO"'))).toBe(true);
  });

  it("TRUNCADO: hay texto pero se cortó", async () => {
    global.fetch = vi.fn(async () =>
      respuesta({ text: '{"suggestion":"En la comunidad falta ag',
                  finishReason: "MAX_TOKENS", tokens: { salida: 900 } }));

    await expect(generateJson(LLAMADA)).rejects.toMatchObject({ code: "AI_INCOMPLETE" });
    const linea = logs.find((l) => l.includes('"motivo":"TRUNCADO"'));
    expect(linea).toBeTruthy();
    expect(JSON.parse(linea.slice(linea.indexOf("{"))).textLength).toBeGreaterThan(0);
  });

  it("JSON INVÁLIDO: terminó bien pero no es JSON", async () => {
    global.fetch = vi.fn(async () =>
      respuesta({ text: "Aquí tienes la situación significativa:", finishReason: "STOP" }));

    await expect(generateJson(LLAMADA)).rejects.toMatchObject({ code: "AI_INCOMPLETE" });
    expect(logs.some((l) => l.includes('"motivo":"JSON_INVALIDO"'))).toBe(true);
  });

  it("cada motivo llega al log del servidor, no al docente", async () => {
    global.fetch = vi.fn(async () =>
      respuesta({ text: null, finishReason: "MAX_TOKENS", tokens: { pensamiento: 900 } }));

    const error = await generateJson(LLAMADA).catch((e) => e);
    // El mensaje que ve la docente no cambia y no lleva jerga.
    expect(error.message).toBe("La respuesta llegó incompleta. Vuelve a intentarlo.");
    expect(error.message).not.toMatch(/finishReason|token|MAX_TOKENS|gemini/i);
    // El detalle técnico sí existe, para el log.
    expect(error.details).toContain("finishReason=MAX_TOKENS");
    expect(error.details).toContain("pensamiento=900");
  });
});

/* ========================================================================== */
describe("gemini · bloqueos del proveedor no son truncaciones", () => {
  it("SAFETY devuelve un error propio, no «incompleta»", async () => {
    global.fetch = vi.fn(async () => respuesta({ text: null, finishReason: "SAFETY" }));
    const error = await generateJson(LLAMADA).catch((e) => e);
    expect(error.code).toBe("AI_BLOCKED");
    expect(error.status).toBe(422);
    // Reintentar lo mismo no lo arreglaría; el mensaje lo dice.
    expect(error.message).toMatch(/reformular/i);
  });

  it("un prompt bloqueado también se distingue", async () => {
    global.fetch = vi.fn(async () => respuesta({ blockReason: "SAFETY" }));
    const error = await generateJson(LLAMADA).catch((e) => e);
    expect(error.code).toBe("AI_BLOCKED");
    expect(logs.some((l) => l.includes("PROMPT_BLOQUEADO"))).toBe(true);
  });
});

/* ========================================================================== */
describe("gemini · el log no filtra nada", () => {
  it("ni la clave ni el prompt aparecen en ninguna línea", async () => {
    global.fetch = vi.fn(async () =>
      respuesta({ text: null, finishReason: "MAX_TOKENS" }));
    await generateJson({ ...LLAMADA, prompt: "Mis estudiantes de 4.º B, la niña Ana Quispe…" })
      .catch(() => {});

    const todo = logs.join("\n");
    expect(todo).not.toContain("clave-de-prueba");
    expect(todo).not.toContain("Ana Quispe");
    expect(todo).not.toContain("4.º B");
    expect(todo).not.toMatch(/x-goog-api-key/i);
  });

  it("los errores HTTP no arrastran el mensaje del proveedor al cliente", async () => {
    global.fetch = vi.fn(async () => ({
      ok: false, status: 429,
      json: async () => ({ error: { message: "Quota exceeded for project 12345" } }),
    }));
    const error = await generateJson(LLAMADA).catch((e) => e);
    expect(error.message).not.toContain("Quota exceeded");
    expect(error.message).not.toContain("12345");
    expect(logs.some((l) => l.includes("HTTP_429"))).toBe(true);
  });
});

/* ========================================================================== */
describe("gemini · el crédito se devuelve cuando la generación falla", () => {
  function mockRpc({ falla = false }) {
    const llamadas = [];
    global.fetch = vi.fn(async (url, opts) => {
      const u = String(url);
      llamadas.push(u.split("/rpc/")[1] || u);
      if (u.includes("consume_ai_credit")) {
        return { ok: true, status: 200,
                 json: async () => ({ ok: true, consumption_id: "vale-1", remaining: 4 }) };
      }
      if (u.includes("refund_ai_credit")) {
        return { ok: true, status: 200, json: async () => ({ ok: true }) };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    });
    return llamadas;
  }

  const auth = { token: "t", url: "https://p.supabase.co", key: "k", reason: "prueba" };

  it("una generación fallida devuelve el crédito con su vale", async () => {
    const llamadas = mockRpc({});
    await expect(
      withCredit(auth, async () => { throw new Error("fallo de generación"); })
    ).rejects.toThrow();

    expect(llamadas.some((c) => c.includes("consume_ai_credit"))).toBe(true);
    expect(llamadas.some((c) => c.includes("refund_ai_credit"))).toBe(true);
  });

  it("una generación correcta NO devuelve el crédito", async () => {
    const llamadas = mockRpc({});
    const { result } = await withCredit(auth, async () => ({ ok: true }));
    expect(result.ok).toBe(true);
    expect(llamadas.some((c) => c.includes("refund_ai_credit"))).toBe(false);
  });
});

/* ============================================================================
   FREE Y PRO GENERAN IGUAL

   Lo único que debe cambiar entre planes es cuántas veces se puede generar.
   ========================================================================== */
describe("ia · el plan no cambia cómo se genera", () => {
  const ENDPOINTS = ["api/generate-session.js", "api/generate-session-resource.js",
                     "api/generate-linked-worksheet.js", "api/generate-project-steam.js"];

  it("ningún endpoint de generación se bifurca por plan", () => {
    for (const f of ENDPOINTS) {
      const src = fs.readFileSync(f, "utf8");
      const activo = src.split("\n")
        .filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*"))
        .join("\n");
      for (const marca of ["plan_code", "planCode", "ai_weekly_limit",
                           '"pro"', "'pro'", '"free"', "'free'"]) {
        expect(activo, `${f} · ${marca}`).not.toContain(marca);
      }
    }
  });

  it("la librería de Gemini tampoco conoce el plan", () => {
    const src = fs.readFileSync("api/_lib/gemini.js", "utf8");
    for (const marca of ["plan", "free", "pro", "credit"]) {
      expect(src.toLowerCase().includes(`${marca}_code`)).toBe(false);
    }
    expect(src).not.toContain("ai_weekly_limit");
  });

  it("el límite sale del plan efectivo, y sólo el límite", () => {
    const s003 = fs.readFileSync("supabase/migrations/003_secure_ai_credits.sql", "utf8");
    const consumo = s003.slice(s003.indexOf("function public.consume_ai_credit"));
    expect(consumo).toContain("sciverse_private.effective_plan(v_uid)");
    expect(consumo).toContain("v_counter.used >= v_plan.ai_weekly_limit");
  });

  it("Free sigue en 5 y Pro en 100, en la base", () => {
    const s002 = fs.readFileSync("supabase/migrations/002_commercial_core.sql", "utf8");
    expect(s002).toMatch(/'free', 'Gratuito',[\s\S]{0,160}?\n\s*5, 0, null, 0\)/);
    const s008 = fs.readFileSync("supabase/migrations/008_commercial_settings.sql", "utf8");
    expect(s008).toContain("ai_weekly_limit       = 100");
  });
});

/* ========================================================================== */
describe("ia · el modelo es uno y está centralizado", () => {
  it("todos los endpoints resuelven el modelo por la misma función", () => {
    for (const f of ["api/generate-session-resource.js", "api/generate-linked-worksheet.js"]) {
      const src = fs.readFileSync(f, "utf8");
      expect(src, f).toContain("getGeminiModel()");
      // Ninguno escribe un identificador de modelo a mano.
      expect(src, f).not.toMatch(/["']gemini-[\d.]+/);
    }
    const lib = fs.readFileSync("api/_lib/gemini.js", "utf8");
    expect(lib).toContain("GEMINI_MAIN_MODEL");
  });

  it("el modelo por defecto se declara en un solo sitio", () => {
    delete process.env.GEMINI_MAIN_MODEL;
    expect(getGeminiModel()).toBe("gemini-3.6-flash");
    process.env.GEMINI_MAIN_MODEL = "otro-modelo";
    expect(getGeminiModel()).toBe("otro-modelo");
  });
});

/* ============================================================================
   EL ARREGLO DE «SUGERIR CON KANTU»

   Medición real de producción, no supuesto:
     maxOutputTokens=900 · pensamiento=860 · salida=22 · finishReason=MAX_TOKENS
     textLength=112 · motivo=TRUNCADO

   Los tokens de pensamiento salen del MISMO presupuesto que la respuesta. Por
   eso el arreglo no es un presupuesto mayor: es no gastarlo razonando sobre
   una tarea que no lo necesita.

   `gemini-3.6-flash` se controla con `thinkingLevel` (minimal | low | medium |
   high, por defecto medium), NO con `thinkingBudget`, y no tiene un apagado
   real: `minimal` es lo más bajo. Se espera algún token de pensamiento.
   ========================================================================== */
describe("gemini · pensamiento al mínimo, sólo en las sugerencias", () => {
  function capturar(respuestaDada) {
    const cuerpos = [];
    global.fetch = vi.fn(async (_u, opts) => {
      cuerpos.push(JSON.parse(opts.body));
      return respuestaDada;
    });
    return cuerpos;
  }

  it("una sugerencia envía thinkingLevel = minimal", async () => {
    const cuerpos = capturar(respuesta({ text: '{"suggestion":"ok"}' }));
    await generateJson({ ...LLAMADA, thinkingLevel: "minimal" });
    expect(cuerpos[0].generationConfig.thinkingConfig).toEqual({ thinkingLevel: "minimal" });
  });

  it("NO se envía thinkingBudget, que no corresponde a este modelo", async () => {
    const cuerpos = capturar(respuesta({ text: '{"suggestion":"ok"}' }));
    await generateJson({ ...LLAMADA, thinkingLevel: "minimal" });
    expect(JSON.stringify(cuerpos[0])).not.toContain("thinkingBudget");
  });

  it("una generación grande NO recibe thinkingConfig", async () => {
    const cuerpos = capturar(respuesta({ text: '{"titulo":"x"}' }));
    await generateJson({ ...LLAMADA, maxOutputTokens: 7500, tool: "steam-proyecto" });
    expect(cuerpos[0].generationConfig.thinkingConfig).toBeUndefined();
    expect(cuerpos[0].generationConfig.maxOutputTokens).toBe(7500);
  });

  it("una sugerencia hace UNA sola llamada a Gemini", async () => {
    const cuerpos = capturar(respuesta({ text: '{"suggestion":"ok"}' }));
    await generateJson({ ...LLAMADA, thinkingLevel: "minimal" });
    expect(cuerpos).toHaveLength(1);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("un 400 NO dispara ningún reintento", async () => {
    // La red de seguridad anterior estaba mal planteada: el riesgo real no es
    // el rechazo, es que el parámetro se acepte y se ignore en silencio.
    let llamadas = 0;
    global.fetch = vi.fn(async () => {
      llamadas += 1;
      return { ok: false, status: 400,
               json: async () => ({ error: { message: "thinkingConfig not supported" } }) };
    });
    await expect(generateJson({ ...LLAMADA, thinkingLevel: "minimal" })).rejects.toBeTruthy();
    expect(llamadas).toBe(1);
  });

  it("el presupuesto de la sugerencia sigue siendo bajo", async () => {
    const cuerpos = capturar(respuesta({ text: '{"suggestion":"ok"}' }));
    await generateJson({ ...LLAMADA, thinkingLevel: "minimal" });
    expect(cuerpos[0].generationConfig.maxOutputTokens).toBe(900);
  });

  it("con el pensamiento al mínimo, el mismo caso real ahora pasa", async () => {
    // `minimal` no es cero: se espera algo de pensamiento, pero ya cabe la
    // respuesta dentro de los mismos 900 tokens.
    global.fetch = vi.fn(async () =>
      respuesta({ text: '{"suggestion":"En la comunidad el acceso al agua disminuye algunos meses del año."}',
                  finishReason: "STOP", tokens: { pensamiento: 48, salida: 34 } }));

    const { data } = await generateJson({ ...LLAMADA, thinkingLevel: "minimal" });
    expect(data.suggestion.length).toBeGreaterThan(40);

    const linea = logs.find((l) => l.includes("[sciverse:gemini]"));
    const datos = JSON.parse(linea.slice(linea.indexOf("{")));
    expect(datos.ok).toBe(true);
    expect(datos.finishReason).toBe("STOP");
    expect(datos.thinkingLevel).toBe("minimal");
    expect(datos.maxOutputTokens).toBe(900);
    // Se registra lo que gastó de verdad, para poder comprobarlo en producción.
    expect(datos.tokens.pensamiento).toBe(48);
  });

  it("el log dice el nivel también cuando no se configura", async () => {
    global.fetch = vi.fn(async () => respuesta({ text: '{"titulo":"x"}' }));
    await generateJson({ ...LLAMADA, maxOutputTokens: 7500 });
    const linea = logs.find((l) => l.includes("[sciverse:gemini]"));
    expect(JSON.parse(linea.slice(linea.indexOf("{"))).thinkingLevel).toBeNull();
  });

  it("truncar sigue siendo un error controlado", async () => {
    global.fetch = vi.fn(async () =>
      respuesta({ text: '{"suggestion":"corta', finishReason: "MAX_TOKENS" }));
    await expect(generateJson({ ...LLAMADA, thinkingLevel: "minimal" }))
      .rejects.toMatchObject({ code: "AI_INCOMPLETE" });
  });
});

/* ========================================================================== */
describe("ia · prompt y schema dicen lo mismo", () => {
  const STEAM = fs.readFileSync("api/generate-project-steam.js", "utf8");
  const SESION = fs.readFileSync("api/generate-session.js", "utf8");

  it("el prompt de sugerencia pide JSON, no texto suelto", () => {
    for (const [nombre, src] of [["steam", STEAM], ["sesion", SESION]]) {
      expect(src, nombre).toContain('{"suggestion":');
      expect(src, nombre).toContain("Sin markdown");
    }
  });

  it("ya no pide «responde solo el texto», que contradecía al schema", () => {
    expect(STEAM).not.toContain("Responde solo el texto");
    expect(SESION).not.toContain("Responde únicamente con una sugerencia lista");
  });

  it("el schema de sugerencia sigue siendo el mismo objeto simple", () => {
    for (const src of [STEAM, SESION]) {
      expect(src).toMatch(/suggestion:\s*\{\s*type:\s*"string"\s*\}/);
    }
  });
});

/* ========================================================================== */
describe("ia · el arreglo no toca lo que ya funcionaba", () => {
  const STEAM = fs.readFileSync("api/generate-project-steam.js", "utf8");
  const SESION = fs.readFileSync("api/generate-session.js", "utf8");
  const LIB = fs.readFileSync("api/_lib/gemini.js", "utf8");

  it("los presupuestos no se movieron", () => {
    expect(STEAM).toContain("maxOutputTokens: 900");   // sugerencia STEAM
    expect(STEAM).toContain("maxOutputTokens: 7500");  // proyecto completo
    expect(SESION).toContain("? 800");                 // sugerencia sesión
    expect(SESION).toContain(": 8192");                // sesión completa
    expect(SESION).toContain("? 4500");                // reto
    expect(SESION).toContain("? 5000");                // instrumento
  });

  it("las sugerencias conservan minimal y los módulos usan su propia política", () => {
    expect((STEAM.match(/thinkingLevel: "minimal"/g) || []).length).toBe(1);
    expect(SESION).toMatch(/const thinkingLevel = suggestionMode\s*\? "minimal"\s*: politica\s*\? politica.thinkingLevel\s*: null/);
    // La configuración enviada a Gemini por cada módulo se ejecuta y verifica
    // con fetch simulado en clase-completa.test.jsx.
    expect(SESION).toContain("POLITICA_POR_MODULO[moduleName]");
  });

  it("no queda rastro del fallback de thinkingBudget", () => {
    for (const [nombre, src] of [["steam", STEAM], ["sesion", SESION], ["lib", LIB]]) {
      expect(src, nombre).not.toContain("thinkingBudget:");
      expect(src, nombre).not.toContain("fallbackMaxOutputTokens");
      expect(src, nombre).not.toContain("THINKING_NO_SOPORTADO");
    }
  });

  it("la librería sólo manda thinkingConfig si se lo piden", () => {
    expect(LIB).toContain("if (thinkingLevel) {");
    expect(LIB).toContain("thinkingConfig = { thinkingLevel }");
  });

  it("la sugerencia sigue sin consumir crédito", () => {
    const iSug = STEAM.indexOf('if (mode === "suggestion")');
    const iRetorno = STEAM.indexOf("return res.status(200).json(data);", iSug);
    const iCredito = STEAM.indexOf("await withCredit(");
    expect(iSug).toBeGreaterThan(0);
    expect(iRetorno).toBeGreaterThan(iSug);
    expect(iCredito).toBeGreaterThan(iRetorno);
    expect(SESION).toContain("!moduleMode && !suggestionMode");
  });

  it("la generación completa sigue cobrando y devolviendo el crédito", () => {
    expect(STEAM).toContain("withCredit(");
    expect(SESION).toContain("withCredit(");
  });

  it("el modelo no se escribió a mano en ningún endpoint", () => {
    for (const src of [STEAM, SESION]) {
      expect(src).not.toMatch(/["']gemini-[\d.]+/);
    }
  });
});

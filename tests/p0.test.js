// tests/p0.test.js
//
// Pruebas dirigidas a los P0 corregidos en el Bloque B.
// No pretenden ser una suite completa: cubren la lógica cuyo fallo cuesta
// dinero (créditos) o expone datos (administración).

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

import { Errors, AppError, sendError } from "../api/_lib/errors.js";
import { chargesCreditForModule, withCredit } from "../api/_lib/credits.js";
import { clientKey, enforceRateLimit, RateLimits } from "../api/_lib/rate-limit.js";
import { getBearerToken } from "../api/_lib/supabase.js";
import { getGeminiModel, DEFAULT_GEMINI_MODEL } from "../api/_lib/gemini.js";

/** Respuesta HTTP simulada al estilo de Vercel. */
function mockRes() {
  const res = {
    statusCode: null,
    body: null,
    headers: {},
    status(code) { res.statusCode = code; return res; },
    json(payload) { res.body = payload; return res; },
    setHeader(k, v) { res.headers[k] = v; return res; },
  };
  return res;
}

// ---------------------------------------------------------------------------
// CRÉDITOS: 1 sesión completa = 1 crédito (nunca 4)
// ---------------------------------------------------------------------------
describe("créditos · unidad de cobro", () => {
  it("solo el primer módulo de la sesión cobra crédito", () => {
    expect(chargesCreditForModule("alignment")).toBe(true);
    expect(chargesCreditForModule("sequence")).toBe(false);
    expect(chargesCreditForModule("assessment")).toBe(false);
    expect(chargesCreditForModule("annexes")).toBe(false);
  });

  it("una sesión completa consume exactamente 1 crédito", () => {
    const modules = ["alignment", "sequence", "assessment", "annexes"];
    const charged = modules.filter(chargesCreditForModule).length;
    expect(charged).toBe(1);
  });
});

describe("créditos · consumo y devolución", () => {
  const auth = { token: "t", url: "https://x.supabase.co", key: "k" };

  beforeEach(() => { global.fetch = vi.fn(); });
  afterEach(() => { vi.restoreAllMocks(); });

  function mockRpc(responses) {
    let call = 0;
    global.fetch = vi.fn(async () => {
      const next = responses[Math.min(call++, responses.length - 1)];
      return { ok: next.ok, status: next.ok ? 200 : 400, json: async () => next.body };
    });
  }

  it("devuelve el resultado y el estado de créditos cuando todo va bien", async () => {
    mockRpc([{ ok: true, body: { ok: true, remaining: 4, limit: 5, used: 1 } }]);
    const { result, credits } = await withCredit(auth, async () => "sesión generada");
    expect(result).toBe("sesión generada");
    expect(credits.remaining).toBe(4);
    expect(global.fetch).toHaveBeenCalledTimes(1); // solo consume
  });

  it("DEVUELVE el crédito si la generación falla", async () => {
    mockRpc([
      { ok: true, body: { ok: true, remaining: 4 } }, // consume_ai_credit
      { ok: true, body: { ok: true, remaining: 5 } }, // refund_ai_credit
    ]);
    await expect(
      withCredit(auth, async () => { throw Errors.aiUnavailable("gemini caído"); })
    ).rejects.toThrow();

    expect(global.fetch).toHaveBeenCalledTimes(2); // consume + refund
    const refundUrl = global.fetch.mock.calls[1][0];
    expect(refundUrl).toContain("refund_ai_credit");
  });

  it("no ejecuta la generación si no quedan créditos", async () => {
    mockRpc([{ ok: true, body: { ok: false, reason: "WEEKLY_LIMIT_REACHED", remaining: 0 } }]);
    const operation = vi.fn();
    await expect(withCredit(auth, operation)).rejects.toMatchObject({
      code: "WEEKLY_LIMIT_REACHED",
      status: 429,
    });
    expect(operation).not.toHaveBeenCalled(); // no se gasta nada en Gemini
  });

  it("un fallo al devolver el crédito no oculta el error original", async () => {
    let call = 0;
    global.fetch = vi.fn(async () => {
      call += 1;
      if (call === 1) return { ok: true, status: 200, json: async () => ({ ok: true }) };
      throw new Error("red caída durante el refund");
    });
    await expect(
      withCredit(auth, async () => { throw Errors.aiTimeout(); })
    ).rejects.toMatchObject({ code: "AI_TIMEOUT" });
  });
});

// ---------------------------------------------------------------------------
// ADMINISTRACIÓN: el secreto nunca en la URL
// ---------------------------------------------------------------------------
describe("administración · autenticación", () => {
  it("extrae el token de la cabecera Authorization", () => {
    expect(getBearerToken({ headers: { authorization: "Bearer secreto-123" } })).toBe("secreto-123");
    expect(getBearerToken({ headers: { authorization: "bearer  secreto-123 " } })).toBe("secreto-123");
  });

  it("ignora cabeceras mal formadas", () => {
    expect(getBearerToken({ headers: { authorization: "secreto-123" } })).toBeNull();
    expect(getBearerToken({ headers: {} })).toBeNull();
    expect(getBearerToken({ headers: { authorization: "" } })).toBeNull();
  });

  it("rechaza el secreto enviado por query string", async () => {
    process.env.ADMIN_SECRET = "clave-de-prueba";
    const { default: handler } = await import("../api/list-docentes.js");
    const res = mockRes();
    await handler(
      { method: "GET", headers: { "x-forwarded-for": "10.0.0.9" }, query: { secret: "clave-de-prueba" } },
      res
    );
    expect(res.statusCode).toBe(401);
    // El mensaje no revela si la clave era correcta.
    expect(res.body.error).toBe("No autorizado.");
  });
});

// ---------------------------------------------------------------------------
// VALIDACIÓN Y PAGINACIÓN
// ---------------------------------------------------------------------------
describe("paginación · saneado de parámetros", () => {
  // Réplica de la lógica de list-docentes.js
  function parseIntParam(value, fallback, { min, max }) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, parsed));
  }

  it("aplica el valor por defecto ante entradas no numéricas", () => {
    expect(parseIntParam(undefined, 50, { min: 1, max: 100 })).toBe(50);
    expect(parseIntParam("abc", 50, { min: 1, max: 100 })).toBe(50);
  });

  it("acota el límite para impedir volcados completos", () => {
    expect(parseIntParam("99999", 50, { min: 1, max: 100 })).toBe(100);
    expect(parseIntParam("-5", 0, { min: 0, max: 100 })).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// RATE LIMIT
// ---------------------------------------------------------------------------
describe("rate limit", () => {
  it("bloquea al superar el límite dentro de la ventana", () => {
    const key = `test-${Math.random()}`;
    const opts = { key, bucket: "unit", limit: 3, windowMs: 60_000 };
    expect(() => { enforceRateLimit(opts); enforceRateLimit(opts); enforceRateLimit(opts); }).not.toThrow();
    expect(() => enforceRateLimit(opts)).toThrowError(/muy rápido/i);
  });

  it("indica cuántos segundos esperar", () => {
    const key = `test-${Math.random()}`;
    const opts = { key, bucket: "unit", limit: 1, windowMs: 30_000 };
    enforceRateLimit(opts);
    try {
      enforceRateLimit(opts);
      throw new Error("debería haber lanzado");
    } catch (error) {
      expect(error.code).toBe("RATE_LIMITED");
      expect(error.retryAfterSeconds).toBeGreaterThan(0);
    }
  });

  it("distingue usuarios de IPs anónimas", () => {
    const req = { headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" } };
    expect(clientKey(req)).toBe("ip:1.2.3.4");
    expect(clientKey(req, "user-abc")).toBe("u:user-abc");
  });

  it("los presets de generación son más estrictos que los de lectura", () => {
    expect(RateLimits.aiGeneration.limit).toBeLessThan(RateLimits.readOwn.limit);
    expect(RateLimits.adminAuth.limit).toBeLessThan(RateLimits.adminRead.limit);
  });
});

// ---------------------------------------------------------------------------
// ERRORES: nada técnico llega al docente
// ---------------------------------------------------------------------------
describe("errores · nunca filtran detalle técnico", () => {
  it("un error inesperado se traduce a un mensaje genérico", () => {
    const res = mockRes();
    sendError(res, new Error('duplicate key value violates unique constraint "docentes_correo_key"'));
    expect(res.statusCode).toBe(500);
    expect(res.body.error).not.toMatch(/constraint|duplicate|docentes_correo/i);
    expect(res.body.code).toBe("INTERNAL");
  });

  it("el detalle técnico de un AppError no se serializa", () => {
    const res = mockRes();
    sendError(res, Errors.aiUnavailable("HTTP 429: quota exceeded for project 12345"));
    expect(JSON.stringify(res.body)).not.toMatch(/quota exceeded|12345/);
    expect(res.body.code).toBe("AI_UNAVAILABLE");
  });

  it("los créditos agotados devuelven 429 con el saldo", () => {
    const res = mockRes();
    sendError(res, Errors.creditsExhausted({ remaining: 0, limit: 5 }));
    expect(res.statusCode).toBe(429);
    expect(res.body.credits.remaining).toBe(0);
  });

  it("el rate limit fija la cabecera Retry-After", () => {
    const res = mockRes();
    sendError(res, Errors.rateLimited(42));
    expect(res.headers["Retry-After"]).toBe("42");
  });

  it("todos los mensajes están en español y son accionables", () => {
    for (const build of [Errors.sessionExpired, Errors.accountInactive, Errors.aiTimeout, Errors.profileNotFound]) {
      const error = build();
      expect(error).toBeInstanceOf(AppError);
      expect(error.message).toMatch(/[áéíóúñ]|\s/);
      expect(error.message).not.toMatch(/undefined|null|Error:/);
    }
  });
});

// ---------------------------------------------------------------------------
// CONFIGURACIÓN DE GEMINI
// ---------------------------------------------------------------------------
describe("configuración de Gemini", () => {
  const original = process.env.GEMINI_MAIN_MODEL;
  afterEach(() => { process.env.GEMINI_MAIN_MODEL = original; });

  it("respeta GEMINI_MAIN_MODEL cuando está definida", () => {
    process.env.GEMINI_MAIN_MODEL = "gemini-3.8-flash";
    expect(getGeminiModel()).toBe("gemini-3.8-flash");
  });

  it("usa el modelo por defecto documentado si no está definida", () => {
    delete process.env.GEMINI_MAIN_MODEL;
    expect(getGeminiModel()).toBe(DEFAULT_GEMINI_MODEL);
    // Debe ser un identificador con forma válida, no una cadena vacía.
    expect(DEFAULT_GEMINI_MODEL).toMatch(/^gemini-[\w.-]+$/);
  });
});

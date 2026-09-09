import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import fs from "node:fs";
import handler from "../api/generate-session.js";
import GenerationProgress from "../components/ui/GenerationProgress.jsx";
import { cabecerasDeGeneracion } from "../lib/idempotencia.js";
import { generarModulos, modulosListos, componerSesion, progresoDeModulos,
  mensajeDeModuloFallido, accionDeReintento, MODULOS_SESION } from "../lib/sesion/modulos.js";

const form = {
  nivel: "Secundaria", grado: "1.º", seccion: "A", region: "Puno",
  area: "Ciencia y Tecnología", tema: "cuidemos el agua de la región",
  competencia: "Explica el mundo físico basándose en conocimientos sobre los seres vivos, materia y energía, biodiversidad, Tierra y universo.",
  capacidades: ["Comprende y usa conocimientos sobre los seres vivos, materia y energía, biodiversidad, Tierra y universo"],
  contexto: "cuidado del agua en Puno.", proposito: "Explicar el cuidado del agua",
  evidencia: "Explicación del cuidado del agua", recursos: "Botellas y cartulina",
  fecha: "2026-09-09", duracion: "90", steam: true, inclusivo: true,
};
const resultados = {
  alignment: { titulo: form.tema, proposito: form.proposito, evidencia: form.evidencia,
    desempenosPrecisados: ["Explica el cuidado del agua"], enfoquesTransversales: ["Ambiental"] },
  sequence: { preparacionDocente: ["Preparar botellas"], materiales: ["Botellas"],
    inicio: { minutos: 15, actividades: ["Dialogar"] }, desarrollo: { minutos: 60, actividades: ["Explicar"] },
    cierre: { minutos: 15, actividades: ["Reflexionar"] }, orientacionesDUA: ["Permitir respuestas orales"] },
  assessment: { criterios: [{ criterio: "Explica cómo cuidar el agua", capacidad: form.capacidades[0] }],
    instrumentoSugerido: "Lista de cotejo", reflexionesDocente: ["¿Qué aprendieron?"] },
  annexes: { anexos: [{ titulo: "Ficha", contenido: "Cuidado del agua en Puno" }] },
};

// Ejecuta el manejador REAL de App.jsx con sus dependencias inyectadas. No
// copiamos su implementación al test ni necesitamos un navegador para probar
// sus refs, llamadas, estado de error y guardado. El progreso se renderiza abajo.
const app = fs.readFileSync("App.jsx", "utf8");
const inicio = app.indexOf("  async function handleGenerate() {");
const callback = app.slice(inicio, app.indexOf("  async function handleDownloadSession()", inicio));
function pantalla() {
  const state = { step: 3, form: structuredClone(form), failedModule: null, result: null,
    completedModules: [], loading: false, activeModule: null, error: null };
  const sesionEnCurso = { current: null };
  const generandoSesion = { current: false };
  const claveOp = { obtener: vi.fn(() => "sesion-regresion-agua-001"), renovar: vi.fn() };
  const save = vi.fn(async () => {});
  function render() {
    const deps = { ...state, sesionEnCurso, generandoSesion, claveOp,
      generarModulos, modulosListos, componerSesion, cabecerasDeGeneracion,
      documentType: "session", documentName: "sesión de aprendizaje",
      materialSave: { save }, supabase: { auth: { getSession: async () => ({ data: { session: { access_token: "jwt-test" } } }) } },
      setEvaluationFlow: vi.fn() };
    for (const name of ["CompletedModules", "Result", "Loading", "FailedModule", "Error", "ActiveModule"]) {
      const key = name[0].toLowerCase() + name.slice(1);
      deps[`set${name}`] = (value) => { state[key] = typeof value === "function" ? value(state[key]) : value; };
    }
    return new Function(...Object.keys(deps), `${callback}; return handleGenerate;`)(...Object.values(deps));
  }
  return { state, sesionEnCurso, claveOp, save, render };
}

let userNumber = 0;
// Toda red está simulada: navegador -> handler real -> Auth/RPC/Gemini falsos.
// El registro de operaciones rechaza una clave completada como lo hace el RPC.
function entorno(fallo = null) {
  const user = `docente-clase-${++userNumber}`;
  const operaciones = new Map();
  const calls = [], configs = [], responses = [], rpc = [];
  let pendingFailure = fallo;
  const json = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });
  const fetchMock = vi.fn(async (url, options = {}) => {
    if (url === "/api/generate-session") {
      const body = JSON.parse(options.body);
      calls.push({ ...body, headers: options.headers });
      const res = { setHeader() {}, status(n) { this.statusCode = n; return this; }, json(data) { this.body = data; return this; } };
      await handler({ method: "POST", body, headers: {
        authorization: options.headers.Authorization, "idempotency-key": options.headers["Idempotency-Key"],
      } }, res);
      responses.push(res.body);
      return json(res.body, res.statusCode);
    }
    if (String(url).includes("/auth/v1/user")) return json({ id: user });
    if (String(url).includes("/rest/v1/rpc/")) {
      const name = String(url).split("/rpc/")[1];
      const body = JSON.parse(options.body || "{}");
      rpc.push(name);
      if (name === "begin_ai_operation") {
        const prev = operaciones.get(body.p_key);
        if (prev && prev !== "failed") return json({ status: "duplicate", estado_previo: prev });
        operaciones.set(body.p_key, "processing");
        return json({ status: "started" });
      }
      if (name === "finish_ai_operation") operaciones.set(body.p_key, body.p_status);
      return json({ ok: true, consumption_id: "credito-1", remaining: 4 });
    }
    if (String(url).includes("generativelanguage.googleapis.com")) {
      const module = calls.at(-1).module;
      configs.push({ module, config: JSON.parse(options.body).generationConfig });
      const fail = module === pendingFailure;
      if (fail) pendingFailure = null;
      return json({ candidates: [{ finishReason: fail ? "MAX_TOKENS" : "STOP",
        content: { parts: [{ text: fail ? '{"inicio":' : JSON.stringify(resultados[module]) }] } }],
        usageMetadata: { thoughtsTokenCount: fail ? 2901 : 200, candidatesTokenCount: fail ? 1583 : 1000 } });
    }
    throw new Error(`Red inesperada: ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return { calls, configs, responses, rpc, operaciones };
}
beforeEach(() => {
  vi.stubEnv("GEMINI_API_KEY", "test-key");
  vi.stubEnv("GEMINI_MAIN_MODEL", "gemini-test");
  vi.stubEnv("VITE_SUPABASE_URL", "https://supabase.test");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "test-anon");
  for (const method of ["log", "warn", "error"]) vi.spyOn(console, method).mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("Clase completa · recuperación desde el módulo fallido", () => {
  it.each(["sequence", "assessment", "annexes"])("conserva anteriores, corta siguientes y reintenta %s sin segundo crédito", async (fallo) => {
    const env = entorno(fallo), ui = pantalla();
    const index = MODULOS_SESION.indexOf(fallo);
    await ui.render()();
    expect(ui.state.failedModule).toBe(fallo);
    expect(ui.state.completedModules).toEqual(MODULOS_SESION.slice(0, index));
    expect(Object.keys(ui.sesionEnCurso.current.parciales)).toEqual(MODULOS_SESION.slice(0, index));
    expect(env.calls.map(c => c.module)).toEqual(MODULOS_SESION.slice(0, index + 1));
    expect(ui.state.form).toEqual(form);
    expect(ui.state.step).toBe(3);
    expect(ui.state.result).toBeNull();
    expect(ui.save).not.toHaveBeenCalled();
    expect(ui.claveOp.renovar).not.toHaveBeenCalled();
    expect(env.responses.at(-1).code).toBe("AI_INCOMPLETE");
    const previousAlignment = ui.sesionEnCurso.current.parciales.alignment;

    await ui.render()();
    expect(env.calls.map(c => c.module)).toEqual([...MODULOS_SESION.slice(0, index + 1), ...MODULOS_SESION.slice(index)]);
    expect(env.calls[index + 1].previous.alignment).toEqual(previousAlignment);
    expect(ui.state.completedModules).toEqual(MODULOS_SESION);
    expect(ui.state.failedModule).toBeNull();
    expect(ui.state.result.tiempos).toEqual({ inicio: 15, desarrollo: 60, cierre: 15 });
    expect(ui.state.result.anexos).toEqual(resultados.annexes.anexos);
    expect(ui.save).toHaveBeenCalledTimes(1);
    expect(ui.save).toHaveBeenCalledWith({ tipo: "session", titulo: form.tema, form, contenido: ui.state.result });
    expect(env.rpc.filter(n => n === "consume_ai_credit")).toHaveLength(1);
    expect(env.rpc.filter(n => n === "begin_ai_operation")).toHaveLength(1);
    expect(env.rpc.filter(n => n === "refund_ai_credit")).toHaveLength(0);
    expect(new Set(env.calls.map(c => c.headers["Idempotency-Key"])).size).toBe(1);
    expect(ui.claveOp.renovar).toHaveBeenCalledTimes(1);
  });

  it("flujo normal produce y guarda la sesión completa con una sola reserva", async () => {
    const env = entorno(), ui = pantalla();
    await ui.render()();
    expect(env.calls.map(c => c.module)).toEqual(MODULOS_SESION);
    expect(ui.state.result).toEqual(componerSesion({ parciales: resultados, form }));
    expect(ui.save).toHaveBeenCalledTimes(1);
    expect(env.rpc.filter(n => n === "consume_ai_credit")).toHaveLength(1);
  });

  it("doble clic simultáneo sólo ejecuta un flujo", async () => {
    const env = entorno(), ui = pantalla(), click = ui.render();
    await Promise.all([click(), click()]);
    expect(env.calls.map(c => c.module)).toEqual(MODULOS_SESION);
    expect(ui.save).toHaveBeenCalledTimes(1);
  });

  it("MAX_TOKENS no se reintenta automáticamente", async () => {
    const env = entorno("sequence"), ui = pantalla();
    await ui.render()();
    expect(env.configs.map(c => c.module)).toEqual(["alignment", "sequence"]);
    expect(ui.state.loading).toBe(false);
    expect(ui.state.activeModule).toBeNull();
  });

  it("alignment fallido puede reintentarse con la misma clave tras devolución", async () => {
    const env = entorno("alignment"), ui = pantalla();
    await ui.render()();
    expect(ui.state.completedModules).toEqual([]);
    await ui.render()();
    expect(ui.state.result).not.toBeNull();
    expect(env.rpc.filter(n => n === "consume_ai_credit")).toHaveLength(2);
    expect(env.rpc.filter(n => n === "refund_ai_credit")).toHaveLength(1);
  });

  it("no compone resultados parciales", () => {
    expect(() => componerSesion({ parciales: { alignment: resultados.alignment }, form })).toThrow("Sesión incompleta");
  });

  it("envía la política explícita por módulo a Gemini", async () => {
    const env = entorno(), ui = pantalla();
    await ui.render()();
    expect(env.configs.map(({ module, config }) => [module, config.maxOutputTokens, config.thinkingConfig.thinkingLevel]))
      .toEqual([["alignment", 5000, "medium"], ["sequence", 6000, "low"], ["assessment", 5000, "medium"], ["annexes", 6500, "medium"]]);
  });
});

describe("Clase completa · progreso visible", () => {
  function progreso(props = {}) {
    return renderToStaticMarkup(<GenerationProgress
      pasos={progresoDeModulos({ listos: ["alignment"], fallido: "sequence", ...props })}
      eyebrow="Paso 1 de 3 · Sesión" aviso={mensajeDeModuloFallido("sequence")}
      accion={<button>{accionDeReintento("sequence")}</button>} />);
  }
  it("distingue el paso externo y las cuatro partes internas", () => {
    const html = progreso();
    expect(html).toContain("Paso 1 de 3 · Sesión");
    expect(html).toContain("1 de 4 partes listas");
    expect(html.match(/<li /g)).toHaveLength(4);
  });
  it("failed es advertencia sin spinner", () => {
    const html = progreso();
    expect(html).toContain("is-failed");
    expect(html).toContain("lucide-triangle-alert");
    expect(html).not.toContain("sv-spin");
    expect(html).toContain("Reintentar secuencia");
  });
  it("completed lleva check", () => {
    expect(progreso()).toMatch(/is-completed[\s\S]*?lucide-check/);
  });
  it("pending queda neutral sin spinner", () => {
    const html = renderToStaticMarkup(<GenerationProgress pasos={progresoDeModulos()} />);
    expect(html.match(/is-pending/g)).toHaveLength(4);
    expect(html).not.toContain("sv-spin");
  });
  it("sólo processing tiene spinner", () => {
    expect(progreso({ fallido: null, activo: "sequence" })).toContain("sv-spin");
  });
  it.each(MODULOS_SESION)("mensaje de %s no muestra detalles técnicos", (modulo) => {
    const html = renderToStaticMarkup(<GenerationProgress pasos={progresoDeModulos({ fallido: modulo })} aviso={mensajeDeModuloFallido(modulo)} />);
    expect(html).not.toMatch(/MAX_TOKENS|AI_INCOMPLETE|requestId|502|\[sciverse:gemini\]|stack trace/);
    expect(html).toContain("Lo que ya está listo se conservará.");
  });
  it("App conecta los estados y el reintento al progreso persistente", () => {
    const bloque = app.slice(app.indexOf("{(loading || failedModule)"), app.indexOf("{result && completeClass"));
    expect(bloque).toContain("progresoDeModulos({ listos: completedModules, activo: activeModule, fallido: failedModule })");
    expect(bloque).toContain("onClick={handleGenerate}");
    expect(bloque).toContain("mensajeDeModuloFallido(failedModule)");
  });
});

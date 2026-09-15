import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { withCredit } from "../api/_lib/credits.js";
import { claveDeOperacion, claveObligatoria } from "../api/_lib/idempotency.js";
import fichaVinculada from "../api/generate-linked-worksheet.js";
import {
  CABECERA_IDEMPOTENCIA, cabecerasDeGeneracion, esDuplicado,
  mensajeDeRespuesta, useClaveDeOperacion,
} from "../lib/idempotencia.js";

/* ============================================================================
   IDEMPOTENCIA EFECTIVA

   QUÉ FALLABA
   -----------
   La protección existía y no protegía nada. Tres agujeros a la vez:

     1. El navegador no mandaba clave. El servidor generaba una `srv-<uuid>`
        distinta en cada petición, así que dos clics eran dos operaciones
        distintas: dos filas, dos créditos, dos llamadas a Gemini.
     2. `generate-session-resource` y `generate-linked-worksheet` no pasan por
        `withCredit` —tienen su propio consumo y su propio refund— y por eso
        nunca llegaban a reservar. Cobraban directos.
     3. Con (1) y (2), `ai_operations` quedaba vacía después de una generación
        real, que fue justamente como se detectó.

   Estos tests fallan si cualquiera de las tres cosas vuelve. Los estructurales
   miran el código fuente a propósito: una regresión aquí no rompe ninguna
   funcionalidad visible, así que ningún test de comportamiento la delataría.
   ========================================================================== */

/** Los cuatro que cobran. Ninguno puede generar sin haber reservado antes. */
const ENDPOINTS_CON_CREDITO = [
  "api/generate-session.js",
  "api/generate-project-steam.js",
  "api/generate-session-resource.js",
  "api/generate-linked-worksheet.js",
];

/** Los dos que cobran en línea, sin `withCredit`. */
const COBRO_DIRECTO = [
  "api/generate-session-resource.js",
  "api/generate-linked-worksheet.js",
];

const PANTALLAS_QUE_GENERAN = [
  "App.jsx",
  "components/LabGuideGenerator.jsx",
];

const leer = (f) => fs.readFileSync(f, "utf8");

let logs;

beforeEach(() => {
  logs = [];
  vi.spyOn(console, "log").mockImplementation((...a) => logs.push(a.join(" ")));
  vi.spyOn(console, "warn").mockImplementation((...a) => logs.push(a.join(" ")));
  vi.spyOn(console, "error").mockImplementation((...a) => logs.push(a.join(" ")));
});

afterEach(() => { vi.restoreAllMocks(); });

/* ============================================================================
   ESTRUCTURAL · NADIE COBRA SIN HABER RESERVADO
   ========================================================================== */
describe("estructura · ningún endpoint de IA cobra sin idempotencia", () => {
  it("los cuatro exigen la clave del cliente", () => {
    for (const f of ENDPOINTS_CON_CREDITO) {
      expect(leer(f), f).toContain("claveObligatoria");
    }
  });

  it("ninguno cobra apoyándose en el respaldo `srv-*` del servidor", () => {
    // Una clave nacida en el servidor cambia en cada petición: no identifica
    // nada. Usarla para cobrar es idempotencia de adorno.
    for (const f of ENDPOINTS_CON_CREDITO) {
      expect(leer(f), f).not.toMatch(/claveDeOperacion\s*\(\s*req\s*\)/);
    }
  });

  it("quien consume crédito en línea, reserva ANTES de consumirlo", () => {
    for (const f of COBRO_DIRECTO) {
      const src = leer(f);
      const reserva = src.indexOf("await reservarOperacion(");
      const cobro = src.indexOf('rpc("consume_ai_credit"');
      expect(reserva, `${f}: no reserva`).toBeGreaterThan(-1);
      expect(cobro, `${f}: no cobra`).toBeGreaterThan(-1);
      expect(reserva, `${f}: cobra antes de reservar`).toBeLessThan(cobro);
    }
  });

  it("y llama a Gemini DESPUÉS de reservar", () => {
    for (const f of COBRO_DIRECTO) {
      const src = leer(f);
      const reserva = src.indexOf("await reservarOperacion(");
      const gemini = src.indexOf("await generateJson(");
      expect(gemini, `${f}: no genera`).toBeGreaterThan(-1);
      expect(reserva, `${f}: genera antes de reservar`).toBeLessThan(gemini);
    }
  });

  it("un duplicado sale por `return` antes de llegar al cobro", () => {
    for (const f of COBRO_DIRECTO) {
      const src = leer(f);
      const entre = src.slice(
        src.indexOf('reserva.estado === "duplicada"'),
        src.indexOf('rpc("consume_ai_credit"')
      );
      expect(entre, f).toContain("return res.status(duplicado.status)");
    }
  });

  it("los dos que usan `withCredit` no cobran por su cuenta", () => {
    for (const f of ["api/generate-session.js", "api/generate-project-steam.js"]) {
      const src = leer(f);
      expect(src, f).toContain("withCredit(");
      expect(src, f).not.toContain("consume_ai_credit");
    }
  });

  it("`withCredit` también reserva antes de consumir", () => {
    const src = leer("api/_lib/credits.js");
    expect(src.indexOf("await reservarOperacion("))
      .toBeLessThan(src.indexOf("await consumeCredit(auth)"));
  });

  it("los dos de cobro directo cierran la operación en ambos desenlaces", () => {
    for (const f of COBRO_DIRECTO) {
      const src = leer(f);
      expect(src, `${f}: no cierra en éxito`).toMatch(/estado:\s*"completed"/);
      // Fallida y no completada: así un reintento legítimo puede reabrirla.
      expect(src, `${f}: no cierra en fallo`).toMatch(/estado:\s*"failed"/);
    }
  });
});

/* ============================================================================
   ESTRUCTURAL · EL NAVEGADOR MANDA LA CLAVE
   ========================================================================== */
describe("estructura · ninguna generación sale sin Idempotency-Key", () => {
  const RUTAS_QUE_COBRAN =
    /^\/api\/generate-(session|project-steam|session-resource|linked-worksheet)$/;

  /**
   * Cada `fetch` a un endpoint de generación, con el trozo de código que lo
   * acompaña. 900 caracteres cubren de sobra cabeceras y cuerpo.
   */
  function llamadas(src) {
    const salida = [];
    const re = /fetch\("(\/api\/generate-[a-z-]+)"/g;
    let m;
    while ((m = re.exec(src))) {
      const trozo = src.slice(m.index, m.index + 900);
      salida.push({
        ruta: m[1],
        linea: src.slice(0, m.index).split("\n").length,
        trozo,
        sugerencia: /mode:\s*"suggestion"/.test(trozo),
      });
    }
    return salida;
  }

  it("todas las que cobran usan `cabecerasDeGeneracion`", () => {
    let comprobadas = 0;
    for (const f of PANTALLAS_QUE_GENERAN) {
      for (const l of llamadas(leer(f))) {
        if (!RUTAS_QUE_COBRAN.test(l.ruta) || l.sugerencia) continue;
        comprobadas += 1;
        expect(l.trozo, `${f}:${l.linea} · ${l.ruta}`).toContain("cabecerasDeGeneracion(");
      }
    }
    // Si un día el patrón dejara de encontrar llamadas, el test pasaría vacío.
    expect(comprobadas).toBeGreaterThanOrEqual(10);
  });

  it("las sugerencias de campo no la llevan, porque no cobran", () => {
    // Las cuatro sugerencias salen ahora de un solo sitio, el hook de Kantu.
    // Ahí es donde hay que comprobar que NO viaja la clave: una sugerencia no
    // consume crédito, así que no hay cobro doble del que protegerse, y
    // mandarla llenaría `ai_operations` de filas que no significan nada.
    const hook = leer("lib/kantu/useSugerencia.js");
    expect(hook).toContain('mode: "suggestion"');
    expect(hook).not.toContain("cabecerasDeGeneracion(");
    expect(hook).not.toContain("Idempotency-Key");

    // Y en las pantallas ya no debe quedar ninguna suelta.
    const sueltas = PANTALLAS_QUE_GENERAN
      .flatMap((f) => llamadas(leer(f)))
      .filter((l) => l.sugerencia);
    for (const l of sueltas) {
      expect(l.trozo, `sugerencia en ${l.ruta}`).not.toContain("cabecerasDeGeneracion(");
    }
  });

  it("el nombre de la cabecera se escribe en un solo sitio", () => {
    expect(leer("lib/idempotencia.js"))
      .toContain('export const CABECERA_IDEMPOTENCIA = "Idempotency-Key"');
    for (const f of PANTALLAS_QUE_GENERAN) {
      expect(leer(f), `${f} arma la cabecera a mano`).not.toContain("Idempotency-Key");
    }
  });

  it("cada pantalla que genera declara su propio hook de clave", () => {
    for (const f of PANTALLAS_QUE_GENERAN) {
      const src = leer(f);
      const hooks = (src.match(/useClaveDeOperacion\(/g) || []).length;
      const usos = (src.match(/cabecerasDeGeneracion\(/g) || []).length;
      expect(hooks, `${f}: ${usos} generaciones y ${hooks} hooks`).toBe(usos);
    }
  });

  it("cada generación renueva su clave al cerrar el intento", () => {
    // Sin esto la segunda generación reutilizaría una clave ya `completed` y
    // el servidor la rechazaría: la protección bloquearía trabajo legítimo.
    for (const f of PANTALLAS_QUE_GENERAN) {
      const src = leer(f);
      const usos = (src.match(/cabecerasDeGeneracion\(/g) || []).length;
      const renovaciones = (src.match(/claveOp\.renovar\(\)/g) || []).length;
      expect(renovaciones, `${f}: ${usos} generaciones, ${renovaciones} renovaciones`)
        .toBe(usos);
    }
  });
});

/* ============================================================================
   LA CLAVE DEL CLIENTE
   ========================================================================== */
describe("la clave del cliente", () => {
  /** Monta el hook y devuelve el objeto que usaría el componente. */
  function montarClave(prefijo = "recurso") {
    let claveOp = null;
    function Sonda() { claveOp = useClaveDeOperacion(prefijo); return null; }
    renderToStaticMarkup(React.createElement(Sonda));
    return claveOp;
  }

  it("es la misma durante todo el intento", () => {
    const claveOp = montarClave();
    const primera = claveOp.obtener();
    // Un doble clic, un reintento de red y una función que se ejecuta dos
    // veces son exactamente esto: varias llamadas a `obtener()`.
    expect(claveOp.obtener()).toBe(primera);
    expect(claveOp.obtener()).toBe(primera);
  });

  it("cambia sólo cuando empieza una generación nueva", () => {
    const claveOp = montarClave();
    const primera = claveOp.obtener();
    claveOp.renovar();
    expect(claveOp.obtener()).not.toBe(primera);
  });

  it("lleva el prefijo de la herramienta y un UUID", () => {
    expect(montarClave("ficha").obtener())
      .toMatch(/^ficha-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("el formato que genera es el que el servidor acepta", () => {
    const clave = montarClave("instrumento").obtener();
    expect(claveDeOperacion({ headers: { "idempotency-key": clave } }))
      .toMatchObject({ clave, delCliente: true });
    // Y el mismo que admite la restricción de `ai_operations`.
    expect(clave).toMatch(/^[A-Za-z0-9._:-]{8,120}$/);
  });

  it("`cabecerasDeGeneracion` no deja fuera ni el token ni la clave", () => {
    const h = cabecerasDeGeneracion("jwt-de-prueba", "recurso-1234abcd");
    expect(h[CABECERA_IDEMPOTENCIA]).toBe("recurso-1234abcd");
    expect(h.Authorization).toBe("Bearer jwt-de-prueba");
    expect(h["Content-Type"]).toBe("application/json");
  });
});

/* ============================================================================
   EL RESPALDO DEL SERVIDOR NO CUENTA COMO PROTECCIÓN

   Se conserva para las rutas que no cobran, pero queda registrado como lo que
   es. La decisión de hacerlo obligatorio donde sí se cobra está razonada en
   `api/_lib/idempotency.js`: una protección que sólo lo parece es peor que no
   tenerla, porque los logs dirían que sí.
   ========================================================================== */
describe("el respaldo `srv-*`", () => {
  it("se registra diciendo que NO protege", () => {
    const r = claveDeOperacion({ headers: {}, body: {} });
    expect(r.delCliente).toBe(false);
    expect(r.clave).toMatch(/^srv-/);

    const linea = logs.find((l) => l.includes("sin_clave_del_cliente"));
    expect(linea, "no se registró la ausencia de clave").toBeTruthy();
    expect(linea).toContain("NO protege de duplicados");
  });

  it("el código lo dice también para quien lo lea", () => {
    expect(leer("api/_lib/idempotency.js")).toContain("RESPALDO, NO PROTECCIÓN");
  });

  it("donde se cobra, sin clave se rechaza con 400 antes de tocar nada", () => {
    let error = null;
    try { claveObligatoria({ headers: {}, body: {} }); } catch (e) { error = e; }

    expect(error?.code).toBe("IDEMPOTENCY_KEY_REQUIRED");
    expect(error?.status).toBe(400);
    // Se lanza antes de créditos y de Gemini: no hay nada que devolver.
    expect(error?.message).toMatch(/Recarga la página/);
  });

  it("con clave del cliente no se registra nada raro", () => {
    claveDeOperacion({ headers: { "idempotency-key": "recurso-abcdef12" } });
    expect(logs.some((l) => l.includes("sin_clave_del_cliente"))).toBe(false);
  });
});

/* ============================================================================
   CRÉDITOS · LA GARANTÍA QUE IMPORTA
   ========================================================================== */
describe("créditos · misma clave, un solo cobro", () => {
  const AUTH = { token: "t", url: "https://p.supabase.co", key: "k", reason: "prueba" };

  const RESPUESTA_GEMINI = {
    ok: true, status: 200,
    json: async () => ({
      candidates: [{ finishReason: "STOP", content: { parts: [{ text: '{"titulo":"Lista"}' }] } }],
      usageMetadata: { promptTokenCount: 40, candidatesTokenCount: 20, totalTokenCount: 60 },
    }),
  };

  /** Postgres simulado con la semántica de 010, indexado por clave. */
  function supabase(estadoInicial = {}) {
    const filas = new Map(Object.entries(estadoInicial));
    const c = { begin: 0, consume: 0, refund: 0, finish: 0, gemini: 0 };

    global.fetch = vi.fn(async (url, opts) => {
      const u = String(url);
      if (!u.includes("/rpc/")) { c.gemini += 1; return RESPUESTA_GEMINI; }

      const nombre = u.split("/rpc/")[1];
      const cuerpo = opts?.body ? JSON.parse(opts.body) : {};
      const json = (v) => ({ ok: true, status: 200, json: async () => v });

      if (nombre === "begin_ai_operation") {
        c.begin += 1;
        const previo = filas.get(cuerpo.p_key);
        if (previo === undefined || previo === "failed") {
          filas.set(cuerpo.p_key, "processing");
          return json({ status: "started", reintento: previo === "failed" });
        }
        return json({ status: "duplicate", estado_previo: previo });
      }
      if (nombre === "finish_ai_operation") {
        c.finish += 1;
        if (!filas.has(cuerpo.p_key)) return json({ ok: false, reason: "not_found" });
        filas.set(cuerpo.p_key, cuerpo.p_status);
        return json({ ok: true });
      }
      if (nombre === "consume_ai_credit") {
        c.consume += 1;
        return json({ ok: true, consumption_id: `vale-${c.consume}` });
      }
      if (nombre === "refund_ai_credit") { c.refund += 1; return json({ ok: true }); }
      return json({});
    });

    return { filas, c };
  }

  /** Una generación que sí llama a Gemini, para poder contar las llamadas. */
  const generar = async () => {
    await fetch("https://generativelanguage.googleapis.com/v1beta/models/x:generateContent");
    return { hecho: true };
  };

  it("dos veces la misma clave: un crédito y una sola llamada a Gemini", async () => {
    const { c } = supabase();
    const auth = { ...AUTH, idempotencyKey: "recurso-doble-clic" };

    await withCredit(auth, generar);
    await withCredit(auth, generar).catch(() => {});

    expect(c.consume, "cobró dos veces").toBe(1);
    expect(c.gemini, "generó dos veces").toBe(1);
  });

  it("el segundo intento no llega ni a mirar los créditos", async () => {
    const { c } = supabase({ "recurso-en-curso-1": "processing" });
    await withCredit({ ...AUTH, idempotencyKey: "recurso-en-curso-1" }, generar)
      .catch(() => {});
    expect(c.consume).toBe(0);
    expect(c.gemini).toBe(0);
  });

  it("una clave distinta sí es una operación distinta", async () => {
    const { c } = supabase();
    await withCredit({ ...AUTH, idempotencyKey: "recurso-primera-01" }, generar);
    await withCredit({ ...AUTH, idempotencyKey: "recurso-segunda-02" }, generar);
    expect(c.consume).toBe(2);
    expect(c.gemini).toBe(2);
  });

  it("un duplicado NO intenta devolver nada: nunca llegó a cobrar", async () => {
    const { c } = supabase({ "recurso-en-curso-2": "processing" });
    await withCredit({ ...AUTH, idempotencyKey: "recurso-en-curso-2" }, generar)
      .catch(() => {});
    // Devolver aquí abonaría un crédito que esta petición no gastó.
    expect(c.refund).toBe(0);
    expect(logs.some((l) => l.includes("credit-refund-skipped"))).toBe(false);
  });

  it("un fallo después de cobrar mantiene la devolución de siempre", async () => {
    const { c, filas } = supabase();
    await withCredit({ ...AUTH, idempotencyKey: "recurso-que-falla1" },
                     async () => { throw new Error("Gemini no respondió"); })
      .catch(() => {});
    expect(c.consume).toBe(1);
    expect(c.refund).toBe(1);
    // Fallida, no completada: el mismo intento puede reabrirse.
    expect(filas.get("recurso-que-falla1")).toBe("failed");
  });

  it("y esa operación fallida se puede reintentar con la misma clave", async () => {
    const { c } = supabase();
    const auth = { ...AUTH, idempotencyKey: "recurso-reintento1" };
    await withCredit(auth, async () => { throw new Error("cayó"); }).catch(() => {});
    await expect(withCredit(auth, generar)).resolves.toBeTruthy();
    expect(c.consume).toBe(2);
    expect(c.refund).toBe(1);
  });

  it("completar la operación no vuelve a cobrar", async () => {
    const { c, filas } = supabase();
    await withCredit({ ...AUTH, idempotencyKey: "recurso-completa-1" }, generar);
    expect(filas.get("recurso-completa-1")).toBe("completed");
    expect(c.consume).toBe(1);
    expect(c.finish).toBe(1);
  });

  it("una operación en curso responde AI_OPERATION_IN_PROGRESS", async () => {
    supabase({ "recurso-en-curso-3": "processing" });
    await expect(withCredit({ ...AUTH, idempotencyKey: "recurso-en-curso-3" }, generar))
      .rejects.toMatchObject({ code: "AI_OPERATION_IN_PROGRESS", status: 409 });
  });

  it("una ya terminada responde AI_OPERATION_ALREADY_COMPLETED", async () => {
    supabase({ "recurso-terminada-1": "completed" });
    await expect(withCredit({ ...AUTH, idempotencyKey: "recurso-terminada-1" }, generar))
      .rejects.toMatchObject({ code: "AI_OPERATION_ALREADY_COMPLETED", status: 409 });
  });

  it("no se inventa el resultado anterior: la tabla no lo guarda", () => {
    const sql = leer("supabase/migrations/010_ai_idempotency.sql");
    expect(sql).not.toMatch(/\b(result|payload|response)\s+jsonb/);
    expect(leer("api/_lib/errors.js")).toContain("NO se devuelve el resultado anterior");
  });
});

/* ============================================================================
   FICHA DE TRABAJO · EL ENDPOINT COMPLETO

   Los estructurales comprueban el orden leyendo el código; éste lo comprueba
   ejecutándolo. Es el flujo que dejaba `ai_operations` vacía y por el que se
   abrió este bloque.
   ========================================================================== */
describe("ficha vinculada · el endpoint entero, extremo a extremo", () => {
  const URL_SUPABASE = "https://proyecto.supabase.co";

  const PREGUNTAS = [
    "Explica con tus palabras como el sol calienta el agua de los rios",
    "Describe que ocurre con el vapor de agua cuando sube y encuentra aire frio",
    "Menciona dos actividades humanas que alteran las lluvias en tu comunidad",
    "Dibuja y rotula las etapas por las que pasa una gota desde el mar hasta el cerro",
    "Argumenta por que cuidar los manantiales protege el ciclo completo del agua",
  ].map((pregunta, i) => ({
    numero: i + 1, tipo: "abierta", pregunta,
    textoLectura: "", opciones: [], respuestaEsperada: "Respuesta libre del estudiante.",
  }));

  const FICHA = {
    titulo: "El viaje del agua en nuestra comunidad",
    instrucciones: "Resuelve cada pregunta en tu cuaderno con lo trabajado en clase.",
    preguntas: PREGUNTAS,
  };

  function peticion(clave) {
    return {
      method: "POST",
      headers: {
        authorization: "Bearer jwt-de-prueba",
        ...(clave ? { "idempotency-key": clave } : {}),
        "x-forwarded-for": "203.0.113.7",
      },
      body: {
        form: { tema: "El ciclo del agua en la sierra peruana", nivel: "Primaria", grado: "4" },
        session: { titulo: "El ciclo del agua" },
        options: { questionCount: 5, questionTypes: ["abierta"] },
      },
    };
  }

  function respuesta() {
    const r = { estado: null, cuerpo: null };
    r.status = (s) => { r.estado = s; return r; };
    r.json = (b) => { r.cuerpo = b; return r; };
    r.setHeader = () => {};
    return r;
  }

  /** Supabase + Gemini simulados, con la tabla de operaciones en memoria. */
  function entorno({ geminiFalla = false } = {}) {
    const filas = new Map();
    const c = { begin: 0, consume: 0, refund: 0, finish: 0, gemini: 0 };

    global.fetch = vi.fn(async (url, opts) => {
      const u = String(url);
      const json = (v) => ({ ok: true, status: 200, json: async () => v });

      if (u.includes("/auth/v1/user")) return json({ id: "docente-1" });

      if (u.includes("/rest/v1/rpc/")) {
        const nombre = u.split("/rest/v1/rpc/")[1];
        const b = opts?.body ? JSON.parse(opts.body) : {};

        if (nombre === "begin_ai_operation") {
          c.begin += 1;
          const previo = filas.get(b.p_key);
          if (previo === undefined || previo === "failed") {
            filas.set(b.p_key, "processing");
            return json({ status: "started" });
          }
          return json({ status: "duplicate", estado_previo: previo });
        }
        if (nombre === "finish_ai_operation") {
          c.finish += 1;
          if (!filas.has(b.p_key)) return json({ ok: false, reason: "not_found" });
          filas.set(b.p_key, b.p_status);
          return json({ ok: true });
        }
        if (nombre === "consume_ai_credit") {
          c.consume += 1;
          return json({ ok: true, consumption_id: `vale-${c.consume}`, remaining: 4 });
        }
        if (nombre === "refund_ai_credit") { c.refund += 1; return json({ ok: true }); }
        if (nombre === "get_my_plan") {
          return json({ plan: "free", plan_name: "Gratuito", limit: 5, features: {} });
        }
        return json({});
      }

      // Gemini.
      c.gemini += 1;
      if (geminiFalla) {
        return { ok: false, status: 503, json: async () => ({ error: { message: "saturado" } }) };
      }
      return {
        ok: true, status: 200,
        json: async () => ({
          candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify(FICHA) }] } }],
          usageMetadata: { promptTokenCount: 900, candidatesTokenCount: 600, totalTokenCount: 1500 },
        }),
      };
    });

    return { filas, c };
  }

  beforeEach(() => {
    process.env.GEMINI_API_KEY = "clave-de-prueba";
    process.env.GEMINI_MAIN_MODEL = "modelo-de-prueba";
    process.env.VITE_SUPABASE_URL = URL_SUPABASE;
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY = "anon-de-prueba";
    // El backoff real dormiría segundos entre reintentos.
    vi.spyOn(global, "setTimeout").mockImplementation((fn) => { fn(); return 0; });
  });

  afterEach(() => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_MAIN_MODEL;
    delete process.env.VITE_SUPABASE_URL;
    delete process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  });

  it("una generación normal reserva, cobra, genera y cierra — en ese orden", async () => {
    const { filas, c } = entorno();
    const res = respuesta();

    await fichaVinculada(peticion("ficha-primera-vez1"), res);

    expect(res.estado).toBe(200);
    expect(res.cuerpo.resource.preguntas).toHaveLength(5);
    expect(c.begin).toBe(1);
    expect(c.consume).toBe(1);
    expect(c.gemini).toBe(1);
    expect(filas.get("ficha-primera-vez1")).toBe("completed");
  });

  it("el doble clic no cobra ni genera por segunda vez", async () => {
    const { c } = entorno();

    const primera = respuesta();
    await fichaVinculada(peticion("ficha-doble-clic01"), primera);
    const segunda = respuesta();
    await fichaVinculada(peticion("ficha-doble-clic01"), segunda);

    expect(primera.estado).toBe(200);
    expect(segunda.estado).toBe(409);
    expect(segunda.cuerpo.code).toBe("AI_OPERATION_ALREADY_COMPLETED");

    // Lo que realmente importa: un crédito y una llamada a Gemini.
    expect(c.consume, "cobró dos veces").toBe(1);
    expect(c.gemini, "generó dos veces").toBe(1);
    expect(c.refund, "devolvió un crédito que no gastó").toBe(0);
  });

  it("sin clave del cliente responde 400 y no cobra ni genera", async () => {
    const { c } = entorno();
    const res = respuesta();

    await fichaVinculada(peticion(null), res);

    expect(res.estado).toBe(400);
    expect(res.cuerpo.code).toBe("IDEMPOTENCY_KEY_REQUIRED");
    expect(c.begin).toBe(0);
    expect(c.consume).toBe(0);
    expect(c.gemini).toBe(0);
    expect(c.refund).toBe(0);
  });

  it("si Gemini falla, devuelve el crédito y marca la operación fallida", async () => {
    const { filas, c } = entorno({ geminiFalla: true });
    const res = respuesta();

    await fichaVinculada(peticion("ficha-que-falla01"), res);

    expect(res.estado).toBeGreaterThanOrEqual(500);
    expect(c.consume).toBe(1);
    expect(c.refund).toBe(1);
    expect(filas.get("ficha-que-falla01")).toBe("failed");
  });

  it("tras ese fallo, la misma clave puede reintentarse y cobra de nuevo", async () => {
    const { filas, c } = entorno();
    filas.set("ficha-reintentada1", "failed");   // como la dejó el intento anterior

    const res = respuesta();
    await fichaVinculada(peticion("ficha-reintentada1"), res);

    expect(res.estado).toBe(200);
    expect(c.consume).toBe(1);
    expect(filas.get("ficha-reintentada1")).toBe("completed");
  });

  it("cada docente tiene su propia clave: el 409 no viaja entre cuentas", () => {
    // La garantía es la clave primaria `(user_id, key)` de 010, no la cadena.
    const sql = leer("supabase/migrations/010_ai_idempotency.sql");
    expect(sql).toContain("primary key (user_id, key)");
    expect(sql).toContain("on conflict (user_id, key) do nothing");
  });
});

/* ============================================================================
   LA DOCENTE NO VE JERGA
   ========================================================================== */
describe("mensajes · un duplicado no se muestra como error técnico", () => {
  it("cada código de duplicado tiene su frase", () => {
    expect(mensajeDeRespuesta({ code: "AI_OPERATION_IN_PROGRESS" }))
      .toBe("Esta generación ya se está procesando. Espera unos segundos.");
    expect(mensajeDeRespuesta({ code: "AI_OPERATION_ALREADY_COMPLETED" }))
      .toBe("Esta generación ya fue procesada. Revisa el resultado o tu biblioteca.");
    expect(mensajeDeRespuesta({ code: "IDEMPOTENCY_KEY_REQUIRED" }))
      .toMatch(/Recarga la página/);
  });

  it("ninguna de esas frases lleva jerga ni número de estado", () => {
    for (const code of ["AI_OPERATION_IN_PROGRESS", "AI_OPERATION_ALREADY_COMPLETED",
                        "DUPLICATE_OPERATION", "IDEMPOTENCY_KEY_REQUIRED"]) {
      const texto = mensajeDeRespuesta({ code }).toLowerCase();
      for (const jerga of ["409", "400", "idempot", "operation", "key", "error"]) {
        expect(texto, `${code} contiene «${jerga}»`).not.toContain(jerga);
      }
    }
  });

  it("un error normal conserva el mensaje del servidor", () => {
    expect(mensajeDeRespuesta({ error: "No pudimos generar la ficha." }))
      .toBe("No pudimos generar la ficha.");
    expect(mensajeDeRespuesta({}, "Texto por defecto")).toBe("Texto por defecto");
  });

  it("`esDuplicado` reconoce los tres códigos y sólo esos", () => {
    for (const code of ["AI_OPERATION_IN_PROGRESS", "AI_OPERATION_ALREADY_COMPLETED",
                        "DUPLICATE_OPERATION"]) {
      expect(esDuplicado({ code }), code).toBe(true);
    }
    for (const code of ["WEEKLY_LIMIT_REACHED", "AI_BUSY", "GENERATION_ERROR", undefined]) {
      expect(esDuplicado({ code }), String(code)).toBe(false);
    }
  });

  it("las pantallas traducen en vez de pintar el error crudo", () => {
    for (const f of PANTALLAS_QUE_GENERAN) {
      expect(leer(f), f).toContain("mensajeDeRespuesta(");
    }
  });

  it("`sendGenerationError` deja pasar los códigos de duplicado sin traducirlos", () => {
    // Si los tratara como un fallo genérico, la docente vería «no pudimos
    // generar la ficha» justo cuando la ficha sí se generó.
    const src = leer("api/_lib/errors.js");
    for (const code of ["AI_OPERATION_IN_PROGRESS", "AI_OPERATION_ALREADY_COMPLETED",
                        "IDEMPOTENCY_KEY_REQUIRED", "AI_BUSY", "DUPLICATE_OPERATION"]) {
      expect(src, code).toContain(`"${code}"`);
    }
  });
});

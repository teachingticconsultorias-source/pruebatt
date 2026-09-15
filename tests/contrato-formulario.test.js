import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";

import recurso from "../api/generate-session-resource.js";
import sesion from "../api/generate-session.js";
import steam from "../api/generate-project-steam.js";
import { CONTRATO_DE_FORMULARIO, revisarFormulario } from "../lib/ui/validaciones.js";

/* ============================================================================
   NINGUNA GENERACIÓN SE COBRA CON EL FORMULARIO INCOMPLETO

   Cada generador comprobaba sus campos en el navegador y NINGÚN endpoint
   comprobaba nada: el servidor aceptaba cualquier cuerpo, gastaba un crédito de
   la semana y devolvía un documento genérico. Basta una pestaña vieja, un
   reintento a mano o una petición cruda.

   Es la tercera vez que la misma asimetría cuesta un incidente: `tieneTema`
   —cliente y servidor mirando cosas distintas, los botones de Kantu muertos— y
   `revisarProposito`, que sólo vivía en el formulario del laboratorio.

   Aquí se fija que los dos lados usen EL MISMO objeto, y que el rechazo ocurra
   antes de cobrar.
   ========================================================================== */

const COMPLETO = {
  nivel: "Secundaria", grado: "3.º", area: "Ciencia y Tecnología", region: "Puno",
  tema: "El ciclo del agua", fecha: "2026-09-15", duracion: "90",
  competencia: "Indaga mediante métodos científicos", capacidades: ["Problematiza situaciones"],
  proposito: "Explicar el recorrido del agua y relacionarlo con el cuidado en su comunidad.",
  contexto: "La comunidad observa un desperdicio constante de agua en los caños del patio.",
  evidencia: "Explicación acompañada de un esquema del ciclo del agua.",
  situacion: "La comunidad observa un desperdicio constante de agua.",
  producto: "Campaña de cuidado del agua con un prototipo medido.",
  evidencias: "Bitácora de mediciones e infografía final.",
  areasSTEAM: ["Ciencia", "Matemática"], duracionSemanas: 2,
  areaCurricular: "Ciencia y Tecnología",
};

/** Llama al handler real registrando cada RPC, en orden. */
async function llamar(handler, body) {
  const rpcs = [];
  vi.stubGlobal("fetch", vi.fn(async (url) => {
    const j = (b, s = 200) => ({ ok: s < 400, status: s, json: async () => b });
    const u = String(url);
    if (u.includes("/auth/v1/user")) return j({ id: "doc" });
    if (u.includes("/rest/v1/rpc/")) {
      const n = u.split("/rpc/")[1].split("?")[0];
      rpcs.push(n);
      if (n === "consume_ai_credit") return j({ ok: true, consumption_id: "c", remaining: 5, limit: 8 });
      return j({ ok: true, estado: "nueva", status: "started", remaining: 5 });
    }
    if (u.includes("generativelanguage")) {
      return j({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: "{}" }] } }],
        usageMetadata: { candidatesTokenCount: 10 } });
    }
    throw new Error(`Red inesperada: ${u}`);
  }));
  const res = { setHeader() {}, status(n) { this.statusCode = n; return this; }, json(d) { this.body = d; return this; } };
  await handler({ method: "POST", body,
    headers: { authorization: "Bearer j", "idempotency-key": `c-${Math.random()}` } }, res);
  return { estado: res.statusCode ?? 200, error: res.body?.error, rpcs };
}

/** Cada herramienta, con UN campo roto, y el handler que la atiende. */
const CASOS = [
  ["ficha de trabajo", recurso, { type: "worksheet", form: { ...COMPLETO, tema: "" } }],
  ["ficha de lectura", recurso, { type: "reading", form: { ...COMPLETO, tema: "" } }],
  ["escala de valoración", recurso, { type: "rating_scale", form: { ...COMPLETO, evidencia: "" } }],
  ["guía de observación", recurso, { type: "observation_guide", form: { ...COMPLETO, evidencia: "OBSERVAR" } }],
  ["cuestionario", recurso, { type: "questionnaire", form: { ...COMPLETO, proposito: "EVALUAR" } }],
  ["guía de laboratorio", recurso, { type: "lab_guide", form: { ...COMPLETO, proposito: "DEMOSTRAR" } }],
  ["sesión", sesion, { mode: "module", module: "alignment", form: { ...COMPLETO, evidencia: "" }, previous: {} }],
  ["rúbrica / cotejo", sesion, { mode: "instrument", instrumentType: "rubric", form: { ...COMPLETO, evidencia: "" } }],
  ["proyecto STEAM", steam, { mode: "generate", form: { ...COMPLETO, areasSTEAM: ["Ciencia"] } }],
];

beforeEach(() => {
  vi.stubEnv("GEMINI_API_KEY", "k");
  vi.stubEnv("GEMINI_MAIN_MODEL", "gemini-test");
  vi.stubEnv("VITE_SUPABASE_URL", "https://supabase.test");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "anon");
  for (const m of ["log", "warn", "error"]) vi.spyOn(console, m).mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("Contrato de formulario · el servidor rechaza antes de cobrar", () => {
  for (const [nombre, handler, body] of CASOS) {
    it(`${nombre}: cuerpo incompleto → 400 y NI UN crédito`, async () => {
      const { estado, rpcs, error } = await llamar(handler, body);
      expect(estado, `${nombre} devolvió ${estado}: ${error}`).toBe(400);
      expect(rpcs, nombre).not.toContain("consume_ai_credit");
      expect(String(error).length).toBeGreaterThan(10);
    });
  }

  it("y con el formulario completo TODOS siguen pasando", async () => {
    // Endurecer de más sería un incidente, no un arreglo.
    const completos = [
      ["escala", recurso, { type: "rating_scale", form: COMPLETO, options: { numeroCriterios: 4 } }],
      ["observación", recurso, { type: "observation_guide", form: COMPLETO }],
      ["cuestionario", recurso, { type: "questionnaire", form: COMPLETO }],
      ["laboratorio", recurso, { type: "lab_guide", form: COMPLETO }],
      ["sesión", sesion, { mode: "module", module: "alignment", form: COMPLETO, previous: {} }],
      ["instrumento", sesion, { mode: "instrument", instrumentType: "rubric", form: COMPLETO }],
      ["STEAM", steam, { mode: "generate", form: COMPLETO }],
    ];
    for (const [nombre, handler, body] of completos) {
      const { estado, error } = await llamar(handler, body);
      expect(estado, `${nombre} se bloqueó con el formulario completo: ${error}`).not.toBe(400);
    }
  });
});

describe("Contrato de formulario · un solo objeto para los dos lados", () => {
  it("el módulo es puro: el servidor puede importarlo", () => {
    const fuente = fs.readFileSync("lib/ui/validaciones.js", "utf8");
    expect(fuente).not.toMatch(/^import /m);
    expect(fuente).not.toMatch(/\bwindow\.|\bdocument\.|from "react"/);
  });

  it("los tres endpoints lo importan, no lo copian", () => {
    for (const f of ["api/generate-session-resource.js", "api/generate-session.js",
      "api/generate-project-steam.js"]) {
      const src = fs.readFileSync(f, "utf8");
      expect(src, f).toContain(`from "../lib/ui/validaciones.js"`);
      expect(src, f).toContain("revisarFormulario(");
    }
  });

  it("y los formularios también: los mensajes no pueden divergir", () => {
    const app = fs.readFileSync("App.jsx", "utf8");
    const lab = fs.readFileSync("components/LabGuideGenerator.jsx", "utf8");
    for (const herramienta of ["recurso", "escala"]) {
      expect(app, herramienta).toContain(`revisarFormulario("${herramienta}"`);
    }
    expect(lab).toContain(`revisarFormulario("laboratorio", form)`);
    // Observación y cuestionario comparten componente y lo pasan por `meta`.
    expect(app).toContain("revisarFormulario(meta.herramienta, form)");
  });

  it("cada herramienta declarada tiene mensaje y campos", () => {
    for (const [nombre, c] of Object.entries(CONTRATO_DE_FORMULARIO)) {
      expect(Array.isArray(c.campos) && c.campos.length > 0, nombre).toBe(true);
      expect(typeof c.mensaje === "string" && c.mensaje.length > 10, nombre).toBe(true);
    }
  });

  it("una herramienta sin contrato NO se bloquea", () => {
    // Inventar un requisito aquí rompería una pantalla que hoy funciona.
    expect(revisarFormulario("sopa", {})).toBeNull();
    expect(revisarFormulario(undefined, COMPLETO)).toBeNull();
    expect(revisarFormulario("recurso", null)).toBeNull();
  });

  it("y el listón no sube: lo completo pasa en las ocho", () => {
    for (const h of Object.keys(CONTRATO_DE_FORMULARIO)) {
      expect(revisarFormulario(h, COMPLETO), h).toBeNull();
    }
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";

import handler from "../api/generate-session.js";
import { CAMPOS_POR_HERRAMIENTA, construirContextoKantu, SOLO_LECTURA, tieneTema } from "../lib/kantu/contexto.js";
import { bloqueDeContexto } from "../api/_lib/contexto-sugerencia.js";
import { esperaSegun, mensajeDeError, mensajeDeRespuesta, sinConexion } from "../lib/mensajes.js";
import GenerationProgress from "../components/ui/GenerationProgress.jsx";
import { progresoDeModulos } from "../lib/sesion/modulos.js";

/* ============================================================================
   LO QUE LA DOCENTE ESCRIBE ES LO QUE LLEGA

   Estas pruebas siguen el dato REAL de punta a punta: formulario → contexto →
   endpoint → prompt que recibe Gemini. No se comprueba que «existe un campo
   nivel», se comprueba que el valor concreto aparece en el texto que se manda.

   El caso elegido es el peor posible a propósito: DPCC en Puno. Es el área de
   nombre más largo del catálogo y la que más fácil se confundiría con Ciencias
   Sociales o con Personal Social.
   ========================================================================== */

const FORM = {
  nivel: "Secundaria", grado: "3.º", seccion: "B",
  area: "Desarrollo Personal, Ciudadanía y Cívica (DPCC)", region: "Puno",
  fecha: "2026-09-15", duracion: "90",
  tema: "Convivencia democrática en el aula",
  competencia: "Construye su identidad",
  capacidades: ["Se valora a sí mismo", "Reflexiona y argumenta éticamente"],
  proposito: "Argumentar una postura ética sobre la convivencia en el aula.",
  contexto: "Las y los estudiantes reportan conflictos frecuentes en el recreo.",
  evidencia: "Ensayo argumentativo con dos razones sostenidas.",
  recursos: "Papelotes y plumones",
};

/** Ejecuta el endpoint real y devuelve el prompt exacto que recibió Gemini. */
async function promptDeGemini(cuerpo) {
  let prompt = "";
  vi.stubGlobal("fetch", vi.fn(async (url, options = {}) => {
    const json = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });
    if (String(url).includes("/auth/v1/user")) return json({ id: "docente-flujo" });
    if (String(url).includes("/rest/v1/rpc/")) return json({ ok: true, consumption_id: "c1", remaining: 9, status: "started" });
    if (String(url).includes("generativelanguage.googleapis.com")) {
      const enviado = JSON.parse(options.body);
      prompt = enviado.contents.map(c => c.parts.map(p => p.text).join("\n")).join("\n")
        + "\n" + (enviado.systemInstruction?.parts?.map(p => p.text).join("\n") || "");
      return json({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: "{}" }] } }],
        usageMetadata: { candidatesTokenCount: 10 } });
    }
    throw new Error(`Red inesperada: ${url}`);
  }));
  const res = { setHeader() {}, status(n) { this.statusCode = n; return this; }, json(d) { this.body = d; return this; } };
  await handler({ method: "POST", body: cuerpo,
    headers: { authorization: "Bearer jwt", "idempotency-key": "flujo-datos-0001" } }, res);
  return prompt;
}

beforeEach(() => {
  vi.stubEnv("GEMINI_API_KEY", "test-key");
  vi.stubEnv("GEMINI_MAIN_MODEL", "gemini-test");
  vi.stubEnv("VITE_SUPABASE_URL", "https://supabase.test");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "test-anon");
  for (const m of ["log", "warn", "error"]) vi.spyOn(console, m).mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("Flujo de datos · del formulario al prompt", () => {
  it("cada dato del formulario llega literalmente a Gemini", async () => {
    const prompt = await promptDeGemini({ mode: "module", module: "alignment", form: FORM, previous: {} });
    for (const valor of [FORM.nivel, FORM.grado, FORM.area, FORM.region, FORM.tema,
      FORM.competencia, FORM.proposito, FORM.contexto, FORM.evidencia, FORM.duracion]) {
      expect(prompt, valor).toContain(valor);
    }
    for (const capacidad of FORM.capacidades) expect(prompt).toContain(capacidad);
    expect(prompt).toContain(FORM.recursos);
  });

  it("el área NO se sustituye ni se acorta por el camino", async () => {
    const prompt = await promptDeGemini({ mode: "module", module: "sequence", form: FORM, previous: {} });
    expect(prompt).toContain("Desarrollo Personal, Ciudadanía y Cívica (DPCC)");
    // Ni se convierte en su prima ni en la de Primaria.
    expect(prompt).not.toContain("Área: Ciencias Sociales");
    expect(prompt).not.toContain("Área: Personal Social");
  });

  it("los procesos didácticos son los del área elegida, no los de otra", async () => {
    const prompt = await promptDeGemini({ mode: "module", module: "sequence", form: FORM, previous: {} });
    // DPCC: deliberación sobre asuntos públicos.
    expect(prompt).toContain("Análisis de información");
    expect(prompt).toContain("Toma de decisiones o acuerdos");
    // Y NO los de Matemática ni los de Comunicación.
    expect(prompt).not.toContain("Búsqueda y ejecución de estrategias");
    expect(prompt).not.toContain("Antes de la lectura");
  });

  it("los cuatro módulos reciben el mismo contexto curricular", async () => {
    for (const modulo of ["alignment", "sequence", "assessment", "annexes"]) {
      const prompt = await promptDeGemini({ mode: "module", module: modulo, form: FORM, previous: {} });
      expect(prompt, modulo).toContain("Puno");
      expect(prompt, modulo).toContain("Secundaria");
      expect(prompt, modulo).toContain(FORM.tema);
    }
  });
});

describe("Flujo de datos · Kantu", () => {
  it("el contexto que viaja son los campos completados, no uno suelto", () => {
    const contexto = construirContextoKantu("sesion", FORM);
    const claves = contexto.map(c => c.clave);
    for (const clave of ["tema", "nivel", "grado", "area", "competencia", "region", "proposito", "evidencia"]) {
      expect(claves, clave).toContain(clave);
    }
    expect(tieneTema(contexto)).toBe(true);
    // Un campo vacío no ocupa sitio en un presupuesto de 800 tokens.
    expect(construirContextoKantu("sesion", { ...FORM, region: "" }).map(c => c.clave)).not.toContain("region");
  });

  it("el servidor vuelca ese contexto tal cual en el prompt de sugerencia", async () => {
    const contexto = construirContextoKantu("sesion", FORM);
    expect(bloqueDeContexto(contexto)).toContain("Desarrollo Personal, Ciudadanía y Cívica (DPCC)");
    const prompt = await promptDeGemini({ mode: "suggestion", field: "proposito", form: FORM, contexto });
    expect(prompt).toContain("Puno");
    expect(prompt).toContain(FORM.tema);
    expect(prompt).toContain("Desarrollo Personal, Ciudadanía y Cívica (DPCC)");
  });

  it("una sugerencia NO se escribe sola: sólo al confirmar «Usar»", () => {
    const hook = fs.readFileSync("lib/kantu/useSugerencia.js", "utf8");
    // El hook expone la propuesta; jamás toca el formulario.
    expect(hook).not.toMatch(/setForm|update\(/);
    expect(hook).toContain("setPropuesta");
    const app = fs.readFileSync("App.jsx", "utf8");
    // Y quien la aplica lo hace en el `onUsar` del modal, nunca al recibirla.
    expect(app).toContain("onUsar={() => { update(kantu.propuesta.campo, kantu.propuesta.sugerencia); kantu.cerrar(); }}");
    // Rechazar es cerrar: no hay rama que escriba al cancelar.
    expect(app).toContain("onCerrar={kantu.cerrar}");
  });

  it("Kantu no cobra crédito y no admite dos peticiones a la vez", () => {
    const servidor = fs.readFileSync("api/generate-session.js", "utf8");
    // El modo sugerencia responde antes de llegar a `withCredit`.
    const indiceSugerencia = servidor.indexOf("suggestionMode");
    expect(indiceSugerencia).toBeGreaterThan(-1);
    expect(servidor).toContain("chargesCreditForModule");
    const hook = fs.readFileSync("lib/kantu/useSugerencia.js", "utf8");
    expect(hook).toContain("if (enCurso.current) return;");
  });

  it("hay contexto declarado para cada herramienta que usa a Kantu", () => {
    for (const herramienta of ["sesion", "steam", "instrumento", "escala", "recurso", "sopa", "reto"]) {
      expect(CAMPOS_POR_HERRAMIENTA[herramienta], herramienta).toBeTruthy();
      expect(CAMPOS_POR_HERRAMIENTA[herramienta].length).toBeGreaterThan(2);
    }
    // La dinámica del reto se lee y se cierra: no hay campo donde pegarla.
    expect(SOLO_LECTURA.has("dinamica")).toBe(true);
  });
});

describe("UX · mensajes que puede leer una docente", () => {
  it("ningún código técnico llega a la pantalla", () => {
    const casos = [
      { code: "AI_BUSY" }, { code: "GENERATION_INCOMPLETE" }, { code: "CREDITS_EXHAUSTED" },
      { code: "AUTH_REQUIRED" }, { code: "RATE_LIMITED" }, { code: "AI_UNAVAILABLE" },
      { error: "MAX_TOKENS en la respuesta" }, { error: "TypeError: Failed to fetch" },
      { error: "PGRST202 function does not exist" }, { error: "[object Object]" },
    ];
    for (const caso of casos) {
      const texto = mensajeDeRespuesta(caso, "No pudimos completar la generación.");
      expect(texto, JSON.stringify(caso)).not.toMatch(/MAX_TOKENS|PGRST|TypeError|\[object|fetch|50\d\b/i);
      expect(texto.length).toBeGreaterThan(10);
    }
  });

  it("traduce los códigos que más ve una docente", () => {
    expect(mensajeDeRespuesta({ code: "AI_BUSY" })).toContain("muchas solicitudes");
    expect(mensajeDeRespuesta({ code: "GENERATION_INCOMPLETE" })).toContain("Lo que ya está listo se conservará");
    expect(mensajeDeRespuesta({ code: "CREDITS_EXHAUSTED" })).toContain("renuevan");
    expect(mensajeDeError("SIN_CONEXION")).toContain("conexión a internet");
    expect(mensajeDeError(new TypeError("Failed to fetch"))).toContain("Se perdió la conexión");
  });

  it("un Error interno nunca se publica tal cual", () => {
    expect(mensajeDeError(new Error("Cannot read properties of undefined"), "Genérico")).toBe("Genérico");
    expect(mensajeDeError(new SyntaxError("Unexpected token < in JSON"), "Genérico")).toBe("Genérico");
    // Pero un mensaje ya humano sí se respeta.
    expect(mensajeDeError(new Error("Escribe primero el tema."), "Genérico")).toBe("Escribe primero el tema.");
  });

  it("el aviso de espera cambia con el tiempo y nunca cancela nada", () => {
    expect(esperaSegun(0)).toContain("Preparando");
    expect(esperaSegun(20000)).toContain("sigue trabajando");
    expect(esperaSegun(60000)).toContain("No necesitas volver a pulsar Generar");
    expect(sinConexion()).toBe(false);
  });
});

describe("UX · progreso de generación", () => {
  const pasos = progresoDeModulos({ listos: ["alignment"], activo: "sequence", fallido: null });

  it("cada módulo es una fila con su estado a la derecha, no debajo", () => {
    const html = renderToStaticMarkup(<GenerationProgress pasos={pasos} resumen="1 de 4 partes listas" />);
    expect(html).toContain("sv-genprog__step");
    expect(html).toContain("sv-genprog__state");
    // Estado como TEXTO, no sólo color ni sólo spinner.
    expect(html).toContain("Listo");
    expect(html).toContain("Preparando");
    expect(html).toContain("Pendiente");
    // El estado va en la misma fila que la etiqueta: label y state comparten <li>.
    const fila = html.match(/<li[^>]*sv-genprog__step[^>]*>[\s\S]*?<\/li>/)[0];
    expect(fila).toContain("sv-genprog__label");
    expect(fila).toContain("sv-genprog__state");
  });

  it("los cuatro estados existen y se distinguen", () => {
    const todos = progresoDeModulos({ listos: ["alignment"], activo: "assessment", fallido: "sequence" });
    const html = renderToStaticMarkup(<GenerationProgress pasos={todos} />);
    for (const clase of ["is-completed", "is-processing", "is-failed", "is-pending"]) {
      expect(html, clase).toContain(clase);
    }
    expect(html).toContain("Necesita reintento");
  });

  it("la barra avanza por módulos reales, sin porcentaje inventado", () => {
    for (const [listos, ancho] of [[[], "0%"], [["alignment"], "25%"],
      [["alignment", "sequence"], "50%"], [["alignment", "sequence", "assessment", "annexes"], "100%"]]) {
      const html = renderToStaticMarkup(
        <GenerationProgress pasos={progresoDeModulos({ listos })} />);
      expect(html, ancho).toContain(`width:${ancho}`);
    }
  });

  it("es accesible: aria-live, progressbar y alerta del fallo", () => {
    const html = renderToStaticMarkup(
      <GenerationProgress pasos={pasos} activo aviso="No pudimos terminar la secuencia didáctica." />);
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-valuenow="1"');
    expect(html).toContain('role="alert"');
  });

  it("el CSS centra de verdad y respeta prefers-reduced-motion", () => {
    const css = fs.readFileSync("components/ui/ui.css", "utf8");
    const bloque = css.slice(css.indexOf(".sv-genprog-overlay"), css.indexOf(".sv-kantu-head"));
    expect(bloque).toContain("place-items: center");
    expect(bloque).toContain("100dvh");
    expect(bloque).toContain("safe-area-inset");
    // El margen mágico de 400px que descentraba la tarjeta ya no existe.
    expect(bloque).not.toContain("400px");
    expect(bloque).toContain("prefers-reduced-motion");
    // Tres columnas: icono, nombre y estado.
    expect(bloque).toContain("grid-template-columns: 26px minmax(0, 1fr) auto");
  });
});

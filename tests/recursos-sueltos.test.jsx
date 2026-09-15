import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import JSZip from "jszip";
import { Packer } from "docx";

import handler from "../api/generate-session-resource.js";
import { buildDocument } from "../lib/docx/exporters.js";
import { TOOL_GROUPS } from "../config/tools.js";
import { CAMPOS_POR_HERRAMIENTA, construirContextoKantu, tieneTema } from "../lib/kantu/contexto.js";
import { revisarCampoLibre } from "../lib/ui/validaciones.js";

/* ============================================================================
   GUÍA DE OBSERVACIÓN Y CUESTIONARIO

   Dos tipos que el servidor sabía generar desde siempre y a los que ninguna
   pantalla daba acceso: los dos componentes que debían hacerlo no compilaban.
   Se retiraron y se sirven ahora desde un generador suelto.

   Lo que se fija aquí es la cadena entera: que el componente MONTA —el fallo
   exacto que tenía `SessionNextFlow`—, que el endpoint cobra el crédito
   semanal, que el documento sale con su título y que la fila de biblioteca
   lleva un tipo que el CHECK de la 013 acepta.
   ========================================================================== */

const leer = (f) => fs.readFileSync(f, "utf8");
const app = leer("App.jsx");

const FORM = {
  nivel: "Secundaria", grado: "2.º", area: "Ciencia y Tecnología",
  tema: "El ciclo del agua", region: "Puno",
  competencia: "Explica el mundo físico basándose en conocimientos sobre los seres vivos",
  capacidades: ["Comprende y usa conocimientos científicos"],
  proposito: "Comprobar que explican el recorrido del agua y lo relacionan con su comunidad.",
  evidencia: "Participación de cada estudiante durante la actividad experimental en equipos.",
};

const RECURSOS = {
  observation_guide: {
    titulo: "Observamos el trabajo en equipo", competencia: FORM.competencia, evidencia: FORM.evidencia,
    situacionObservacion: "Durante la actividad experimental en equipos de cuatro, mientras miden y registran.",
    indicadores: [
      { aspecto: "Participación", indicador: "Aporta al menos una idea al plan de su equipo." },
      { aspecto: "Registro", indicador: "Anota cada medición con su unidad." }],
  },
  questionnaire: {
    titulo: "Cuestionario sobre el ciclo del agua",
    instrucciones: "Responde con lápiz. Marca una sola alternativa.",
    preguntas: [
      { numero: 1, tipo: "opcion_multiple", pregunta: "¿Qué proceso convierte el agua en vapor?",
        opciones: ["Condensación", "Evaporación"], respuestaEsperada: "Evaporación" },
      { numero: 2, tipo: "verdadero_falso", pregunta: "El agua de las nubes viene sólo del mar.",
        opciones: ["Verdadero", "Falso"], respuestaEsperada: "Falso" }],
  },
};

/** Corre el endpoint REAL y devuelve lo que pasó por la red. */
async function correrEndpoint(tipo, options, respuesta = RECURSOS[tipo]) {
  const rpcs = [];
  let config = null, prompt = "";
  vi.stubGlobal("fetch", vi.fn(async (url, opciones = {}) => {
    const json = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });
    const u = String(url);
    if (u.includes("/auth/v1/user")) return json({ id: "docente-prueba" });
    if (u.includes("/rest/v1/rpc/")) {
      const nombre = u.split("/rpc/")[1].split("?")[0];
      rpcs.push(nombre);
      if (nombre === "consume_ai_credit") return json({ ok: true, consumption_id: "c1", remaining: 7, limit: 8, used: 1 });
      return json({ ok: true, estado: "nueva", status: "started" });
    }
    if (u.includes("generativelanguage.googleapis.com")) {
      const enviado = JSON.parse(opciones.body);
      config = enviado.generationConfig;
      prompt = enviado.contents.map((c) => c.parts.map((p) => p.text).join("\n")).join("\n");
      return json({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify(respuesta) }] } }],
        usageMetadata: { candidatesTokenCount: 700 } });
    }
    throw new Error(`Red inesperada: ${u}`);
  }));
  const res = { setHeader() {}, status(n) { this.statusCode = n; return this; }, json(d) { this.body = d; return this; } };
  await handler({ method: "POST", body: { type: tipo, form: FORM, options },
    headers: { authorization: "Bearer jwt", "idempotency-key": `prueba-${tipo}-0001` } }, res);
  return { res, rpcs, config, prompt };
}

const xmlDe = async (doc) =>
  (await JSZip.loadAsync(await Packer.toBuffer(doc))).file("word/document.xml").async("string");

beforeEach(() => {
  vi.stubEnv("GEMINI_API_KEY", "test-key");
  vi.stubEnv("GEMINI_MAIN_MODEL", "gemini-test");
  vi.stubEnv("VITE_SUPABASE_URL", "https://supabase.test");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "test-anon");
  for (const m of ["log", "warn", "error"]) vi.spyOn(console, m).mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("Recursos sueltos · la pantalla existe y monta", () => {
  it("las dos herramientas están en el catálogo, en el grupo que les toca", () => {
    const de = (grupo) => TOOL_GROUPS.find((g) => g.id === grupo).tools.map((t) => t.id);
    // La guía de observación es un instrumento: va con rúbrica, cotejo y escala.
    expect(de("evaluar")).toContain("observation-guide");
    // El cuestionario es material del estudiante: va con ficha y lectura.
    expect(de("materiales")).toContain("questionnaire");
    for (const id of ["observation-guide", "questionnaire"]) {
      const t = TOOL_GROUPS.flatMap((g) => g.tools).find((x) => x.id === id);
      expect(t.status, id).toBe("available");
      expect(t.action, id).toBe("create");
    }
  });

  it("y cada una tiene su rama en App.jsx", () => {
    expect(app).toContain('creation==="observation-guide"');
    expect(app).toContain('creation==="questionnaire"');
  });

  it("el generador MONTA: es lo que no hacía el componente que se retiró", async () => {
    // `SessionNextFlow` usaba `useClaveDeOperacion`, `cabecerasDeGeneracion` y
    // `mensajeDeRespuesta` sin importar ninguna, y la primera se llama durante
    // el render. Nadie se enteró porque nadie lo enrutaba.
    const { __test__ } = await import("../App.jsx");
    for (const tipo of ["observation_guide", "questionnaire"]) {
      const html = renderToStaticMarkup(
        React.createElement(__test__.SessionResourceGenerator, { tipo, profile: { ie: "IE" } }));
      expect(html.length, tipo).toBeGreaterThan(500);
    }
  });

  it("el formulario pide lo que el endpoint lee en `context()`", async () => {
    const { __test__ } = await import("../App.jsx");
    const html = renderToStaticMarkup(
      React.createElement(__test__.SessionResourceGenerator, { tipo: "observation_guide", profile: {} }));
    for (const campo of ["Nivel", "Grado", "Área", "Región", "Tema", "Competencia"]) {
      expect(html, campo).toContain(campo);
    }
    expect(html).toContain("Número de indicadores");
    const cuestionario = renderToStaticMarkup(
      React.createElement(__test__.SessionResourceGenerator, { tipo: "questionnaire", profile: {} }));
    expect(cuestionario).toContain("Número de preguntas");
  });

  it("y no deja generar con un campo libre de una palabra", () => {
    // Cuesta un crédito de la semana: una palabra da un recurso genérico.
    expect(revisarCampoLibre("OBSERVAR", "Actuación o desempeño que vas a observar *")).toMatch(/una oración/i);
    expect(revisarCampoLibre("", "Tema *")).toMatch(/Completa/);
    expect(revisarCampoLibre(FORM.evidencia, "Actuación *")).toBeNull();
    // El rótulo entra en el mensaje sin el asterisco de obligatorio.
    expect(revisarCampoLibre("x", "Tema *")).toContain("«Tema»");
  });
});

describe("Recursos sueltos · la generación cobra y responde", () => {
  for (const [tipo, clave, valor] of [["observation_guide", "numeroCriterios", 5], ["questionnaire", "questionCount", 8]]) {
    it(`${tipo}: descuenta el crédito semanal y devuelve el recurso`, async () => {
      const { res, rpcs } = await correrEndpoint(tipo, { [clave]: valor });
      expect(res.statusCode ?? 200).toBe(200);
      expect(res.body.resource).toBeTruthy();
      // El límite semanal es el mismo de siempre, sin gate adicional.
      expect(rpcs).toContain("consume_ai_credit");
      // Y con la reserva de idempotencia antes y el cierre después.
      expect(rpcs.indexOf("begin_ai_operation")).toBeLessThan(rpcs.indexOf("consume_ai_credit"));
      expect(rpcs).toContain("finish_ai_operation");
    });
  }

  it("la cantidad elegida llega al prompt", async () => {
    const guia = await correrEndpoint("observation_guide", { numeroCriterios: 7 });
    expect(guia.prompt).toContain("exactamente 7 indicadores");
    const cuest = await correrEndpoint("questionnaire", { questionCount: 8 });
    expect(cuest.prompt).toContain("CUESTIONARIO de 8 preguntas");
  });

  it("y el plan la recorta cuando se pide de más, como al resto de materiales", async () => {
    // El selector ofrece hasta 15; `reading_max_questions` son 10 en Free y 20
    // en Pro. El recorte ya existía para ficha y lectura: el cuestionario entra
    // por la misma puerta, sin gate nuevo.
    const { prompt } = await correrEndpoint("questionnaire", { questionCount: 15 });
    expect(prompt).toContain("CUESTIONARIO de 10 preguntas");
    // La guía de observación NO pasa por ese recorte —nunca estuvo en la
    // lista— así que la limita sólo el prompt, a ocho.
    const guia = await correrEndpoint("observation_guide", { numeroCriterios: 30 });
    expect(guia.prompt).toContain("exactamente 8 indicadores");
  });

  it("y el tipo se guarda tal cual: la 013 ya lo acepta", () => {
    // Sin esto haría falta otra migración. El CHECK los declara desde la 013.
    const m013 = leer("supabase/migrations/013_lab_guide_material.sql");
    const constraint = m013.slice(m013.indexOf("add constraint"));
    expect(constraint).toContain("'observation_guide'");
    expect(constraint).toContain("'questionnaire'");
    // Y el componente guarda con el mismo `tipo` que manda al endpoint.
    const cuerpo = app.slice(app.indexOf("function SessionResourceGenerator"));
    expect(cuerpo.slice(0, cuerpo.indexOf("\n}"))).toContain("recursoSave.save({ tipo,");
  });
});

describe("Recursos sueltos · el Word sale con su nombre", () => {
  it("la guía de observación se titula como lo que es", async () => {
    const xml = await xmlDe(buildDocument("observation_guide",
      { form: FORM, resource: RECURSOS.observation_guide, profile: { ie: "IE" } }));
    const texto = [...xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]);
    expect(texto[0]).toBe("GUÍA DE OBSERVACIÓN");
    expect(xml).toContain(RECURSOS.observation_guide.situacionObservacion);
    expect(xml).toContain(RECURSOS.observation_guide.indicadores[0].indicador);
  });

  it("y el cuestionario ya no se descarga como «FICHA DE TRABAJO»", async () => {
    const xml = await xmlDe(buildDocument("questionnaire",
      { form: FORM, resource: RECURSOS.questionnaire, profile: { ie: "IE" } }));
    const texto = [...xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]);
    expect(texto[0]).toBe("CUESTIONARIO");
    expect(texto).not.toContain("FICHA DE TRABAJO");
    // Incluido el encabezado que Word repite en cada página.
    expect(xml).not.toMatch(/FICHA DE TRABAJO/);
  });

  it("la ficha de trabajo sigue llamándose ficha de trabajo", async () => {
    // El cuestionario comparte su maqueta: el cambio no puede arrastrarla.
    const xml = await xmlDe(buildDocument("worksheet", {
      form: FORM, resource: { titulo: "Investigamos", secciones: [], preguntas: [] }, profile: {} }));
    expect([...xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1])[0]).toBe("FICHA DE TRABAJO");
  });

  it("verdadero/falso imprime las casillas UNA vez, no las opciones además", async () => {
    const xml = await xmlDe(buildDocument("questionnaire",
      { form: FORM, resource: RECURSOS.questionnaire, profile: {} }));
    const texto = [...xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]);
    expect(texto.filter((t) => t.includes("☐ Verdadero"))).toHaveLength(1);
    // Y no aparecen además como «A. Verdadero / B. Falso».
    expect(texto).not.toContain("A. Verdadero");
    expect(texto).not.toContain("B. Falso");
    // La opción múltiple sí conserva sus letras.
    expect(texto.some((t) => t.startsWith("B. Evaporación"))).toBe(true);
  });

  it("los dos pasan por `downloadResource`, que aplica la marca del colegio", () => {
    const cuerpo = app.slice(app.indexOf("function SessionResourceGenerator"));
    expect(cuerpo.slice(0, cuerpo.indexOf("\n}"))).toContain("downloadResource(tipo, resource, form, profile)");
  });
});

describe("Recursos sueltos · Kantu ve lo que hay en el formulario", () => {
  it("cada herramienta declara su contexto", () => {
    for (const herramienta of ["observacion", "cuestionario"]) {
      expect(Object.keys(CAMPOS_POR_HERRAMIENTA), herramienta).toContain(herramienta);
    }
    const guia = CAMPOS_POR_HERRAMIENTA.observacion.map(([k]) => k);
    expect(guia).toContain("evidencia");
    const cuest = CAMPOS_POR_HERRAMIENTA.cuestionario.map(([k]) => k);
    expect(cuest).toContain("proposito");
  });

  it("y con el tema escrito puede responder", () => {
    for (const herramienta of ["observacion", "cuestionario"]) {
      const contexto = construirContextoKantu(herramienta, FORM);
      expect(tieneTema(contexto), herramienta).toBe(true);
      // Los vacíos no viajan: sólo llega lo que la docente completó.
      expect(contexto.every((c) => c.valor.length > 0)).toBe(true);
    }
  });
});

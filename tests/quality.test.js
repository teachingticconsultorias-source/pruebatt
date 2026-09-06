import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  validateWorksheet,
  validateSessionResource,
  looksLikePlaceholder,
  similarity,
  findNearDuplicates,
} from "../api/_lib/quality.js";
import { withCredit } from "../api/_lib/credits.js";
import { qualityError } from "../api/_lib/quality.js";

/* ============================================================================
   El caso real que motivó esto: una ficha sobre el ciclo del agua llegó con
   buenas preguntas al inicio y luego varias seguidas que decían «Pregunta
   sobre ciclo del agua». La validación de entonces sólo contaba preguntas,
   así que el relleno pasaba como éxito.
   ========================================================================== */

/** Ficha correcta de referencia. */
function fichaValida(n = 3) {
  const base = [
    "¿Qué ocurre con el agua de los ríos cuando el sol la calienta durante el día?",
    "Explica con tus palabras cómo se forman las nubes en la sierra peruana.",
    "¿Por qué el agua de lluvia vuelve a los ríos después de caer en los cerros?",
    "Describe qué cambio de estado ocurre cuando el vapor se enfría en la altura.",
    "¿Qué pasaría con el ciclo del agua si dejara de llover en tu comunidad?",
  ];
  return {
    titulo: "El viaje del agua en nuestra región",
    instrucciones: "Lee cada pregunta con calma y responde en tu cuaderno.",
    preguntas: base.slice(0, n).map((pregunta, i) => ({
      numero: i + 1,
      tipo: "abierta",
      pregunta,
      textoLectura: "",
      opciones: [],
      respuestaEsperada: "Respuesta orientadora para la docente.",
    })),
  };
}

describe("calidad · detección de relleno", () => {
  it("acepta una ficha completa y variada", () => {
    const r = validateWorksheet(fichaValida(3), { questionCount: 3 });
    expect(r.ok).toBe(true);
    expect(r.problems).toEqual([]);
  });

  it("RECHAZA el caso real: «Pregunta sobre ciclo del agua»", () => {
    const ficha = fichaValida(3);
    ficha.preguntas[1].pregunta = "Pregunta sobre ciclo del agua";
    ficha.preguntas[2].pregunta = "Pregunta sobre el ciclo del agua";

    const r = validateWorksheet(ficha, { questionCount: 3 });
    expect(r.ok).toBe(false);
    expect(r.problems.join(" ")).toContain("relleno");
  });

  it("reconoce las fórmulas de relleno más habituales", () => {
    for (const texto of [
      "Pregunta sobre fotosíntesis",
      "Escribe aquí tu respuesta",
      "Completar",
      "placeholder",
      "Pregunta 3",
      "Por definir",
      "",
      "   ",
    ]) {
      expect(looksLikePlaceholder(texto), `debía marcar: ${texto}`).toBe(true);
    }
  });

  it("no marca como relleno una pregunta real que empieza parecido", () => {
    expect(
      looksLikePlaceholder(
        "Pregunta a un familiar cómo se abastecía de agua tu comunidad hace veinte años."
      )
    ).toBe(false);
  });

  it("RECHAZA preguntas duplicadas o casi idénticas", () => {
    const ficha = fichaValida(3);
    // Mismo contenido con una palabra cambiada: parafraseo perezoso.
    ficha.preguntas[2].pregunta =
      "Explica con tus palabras cómo se forman las nubes en la sierra peruana hoy.";

    const r = validateWorksheet(ficha, { questionCount: 3 });
    expect(r.ok).toBe(false);
    expect(r.problems.join(" ")).toContain("repite");
  });

  it("RECHAZA una ficha incompleta", () => {
    const r = validateWorksheet(fichaValida(3), { questionCount: 5 });
    expect(r.ok).toBe(false);
    expect(r.problems.join(" ")).toContain("3 preguntas de 5");
  });

  it("RECHAZA una respuesta vacía o sin forma", () => {
    expect(validateWorksheet(null, { questionCount: 3 }).ok).toBe(false);
    expect(validateWorksheet({}, { questionCount: 3 }).ok).toBe(false);
    expect(
      validateWorksheet({ titulo: "", instrucciones: "", preguntas: [] }, { questionCount: 3 }).ok
    ).toBe(false);
  });

  it("RECHAZA opción múltiple mal formada", () => {
    const ficha = fichaValida(1);
    ficha.preguntas[0].tipo = "opcion_multiple";
    ficha.preguntas[0].opciones = ["Solo una", "Placeholder"];

    const r = validateWorksheet(ficha, { questionCount: 1 });
    expect(r.ok).toBe(false);
    expect(r.problems.join(" ")).toContain("4 opciones");
  });

  it("RECHAZA una pregunta de lectura sin texto que leer", () => {
    const ficha = fichaValida(1);
    ficha.preguntas[0].tipo = "lectura";
    ficha.preguntas[0].textoLectura = "El agua.";

    const r = validateWorksheet(ficha, { questionCount: 1 });
    expect(r.ok).toBe(false);
    expect(r.problems.join(" ")).toContain("texto suficiente");
  });

  it("mide el parecido ignorando tildes, mayúsculas y puntuación", () => {
    expect(similarity("¿Cómo se forman las NUBES?", "como se forman las nubes")).toBe(1);
    expect(similarity("El ciclo del agua", "La fotosíntesis vegetal")).toBeLessThan(0.2);
    expect(findNearDuplicates(["hola mundo", "otra cosa", "hola mundo"])).toHaveLength(1);
  });
});

/* ============================================================================
   Ficha por secciones · /api/generate-session-resource
   Éste es el generador donde apareció el problema real: la ficha llegaba con
   cuatro preguntas y la INTERFAZ inventaba otras cuatro para llenar ocho
   huecos fijos. El relleno nunca fue del modelo.
   ========================================================================== */
describe("calidad · ficha por secciones", () => {
  function fichaSecciones(numPreguntas = 8) {
    const enunciados = [
      "¿Qué ocurre con el agua de los ríos cuando el sol la calienta?",
      "Explica cómo se forman las nubes sobre la cordillera.",
      "¿Por qué la lluvia vuelve a los ríos tras caer en los cerros?",
      "Describe el cambio de estado del vapor al enfriarse en la altura.",
      "¿Qué pasaría si dejara de llover en tu comunidad durante un año?",
      "Compara la evaporación en la costa y en la sierra peruana.",
      "¿Cómo aprovecha tu familia el agua de lluvia en temporada húmeda?",
      "Propón una forma de cuidar el agua en tu institución educativa.",
    ];
    return {
      titulo: "El viaje del agua en nuestra región",
      tipoFicha: "INDAGACIÓN",
      instrucciones: "Resuelve cada sección con calma.",
      secciones: [
        {
          titulo: "Observamos",
          indicacion: "Responde a partir de lo trabajado en clase.",
          actividades: enunciados.slice(0, numPreguntas).map((texto) => ({
            tipo: "pregunta", texto, opciones: [], columnas: [],
          })),
        },
      ],
      metacognicion: ["¿Qué aprendí hoy sobre el agua?"],
    };
  }

  it("acepta una ficha con secciones y preguntas suficientes", () => {
    const r = validateSessionResource(fichaSecciones(8), { minQuestions: 6 });
    expect(r.ok).toBe(true);
  });

  it("RECHAZA la ficha que provocó el fallo: solo 4 preguntas reales", () => {
    const r = validateSessionResource(fichaSecciones(4), { minQuestions: 6 });
    expect(r.ok).toBe(false);
    expect(r.problems.join(" ")).toContain("4 preguntas de 6");
  });

  it("acepta 7 preguntas: el margen evita descartar fichas usables", () => {
    expect(validateSessionResource(fichaSecciones(7), { minQuestions: 6 }).ok).toBe(true);
  });

  it("RECHAZA una sección vacía", () => {
    const ficha = fichaSecciones(8);
    ficha.secciones.push({ titulo: "Aplicamos", indicacion: "", actividades: [] });
    const r = validateSessionResource(ficha, { minQuestions: 6 });
    expect(r.ok).toBe(false);
    expect(r.problems.join(" ")).toContain("vacía");
  });

  it("RECHAZA actividades de relleno dentro de una sección", () => {
    const ficha = fichaSecciones(8);
    ficha.secciones[0].actividades[3].texto = "Pregunta sobre el ciclo del agua";
    const r = validateSessionResource(ficha, { minQuestions: 6 });
    expect(r.ok).toBe(false);
    expect(r.problems.join(" ")).toContain("relleno");
  });

  it("RECHAZA una ficha sin secciones", () => {
    const r = validateSessionResource({ titulo: "Algo", secciones: [] }, { minQuestions: 6 });
    expect(r.ok).toBe(false);
    expect(r.problems.join(" ")).toContain("secciones");
  });
});

/* ============================================================================
   El crédito ante un fallo de calidad
   ========================================================================== */
describe("calidad · efecto sobre el crédito", () => {
  const auth = { token: "t", url: "https://x.supabase.co", key: "k" };

  beforeEach(() => { global.fetch = vi.fn(); });
  afterEach(() => { vi.restoreAllMocks(); });

  function mockRpc(responses) {
    let call = 0;
    global.fetch.mockImplementation(async () => {
      const next = responses[Math.min(call++, responses.length - 1)];
      return { ok: next.ok, status: next.ok ? 200 : 400, json: async () => next.body };
    });
  }

  it("DEVUELVE el crédito cuando la generación falla por calidad", async () => {
    mockRpc([
      { ok: true, body: { ok: true, remaining: 4, consumption_id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" } },
      { ok: true, body: { ok: true, remaining: 5 } },
    ]);

    await expect(
      withCredit(auth, async () => { throw qualityError(["la pregunta 2 es de relleno"]); })
    ).rejects.toMatchObject({ code: "GENERATION_INCOMPLETE" });

    expect(global.fetch).toHaveBeenCalledTimes(2); // consume + refund
    const [url, init] = global.fetch.mock.calls[1];
    expect(url).toContain("refund_ai_credit");
    expect(JSON.parse(init.body)).toEqual({
      p_consumption: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    });
  });

  it("NO devuelve el crédito cuando la ficha es válida", async () => {
    mockRpc([{ ok: true, body: { ok: true, remaining: 4, consumption_id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" } }]);

    const { result } = await withCredit(auth, async () => fichaValida(3));
    expect(validateWorksheet(result, { questionCount: 3 }).ok).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(1); // sólo el consumo
  });
});

// Función serverless de Vercel: recibe la petición del navegador y la
// reenvía a la API de Gemini (Google) usando la clave guardada de forma
// segura en el servidor (variable de entorno GEMINI_API_KEY). Así la clave
// nunca queda expuesta en el código del navegador.
//
// Devuelve la respuesta normalizada en la misma forma que espera el cliente:
// { content: [ { type: "text", text: "..." } ] }

import { Errors, sendError } from "./_lib/errors.js";
import { requireUser } from "./_lib/supabase.js";
import { generateJson } from "./_lib/gemini.js";
import { withCredit, chargesCreditForModule } from "./_lib/credits.js";
import { clientKey, enforceRateLimit, RateLimits } from "./_lib/rate-limit.js";

const SESSION_SCHEMA = {
  type: "object",
  properties: {
    titulo: { type: "string" },
    areasSTEAM: { type: "array", items: { type: "string" } },
    competenciasCNEB: { type: "array", items: { type: "string" } },
    capacidadesCNEB: { type: "array", items: { type: "string" } },
    proposito: { type: "string" },
    criteriosEvaluacion: { type: "array", items: { type: "string" } },
    evidencia: { type: "string" },
    procesosPedagogicos: { type: "array", items: { type: "string" } },
    procesosDidacticos: { type: "array", items: { type: "string" } },
    materiales: { type: "array", items: { type: "string" } },
    inicio: { type: "string" },
    desarrollo: { type: "string" },
    cierre: { type: "string" },
    productoSTEAM: { type: "string" },
  },
  required: ["titulo", "areasSTEAM", "competenciasCNEB", "capacidadesCNEB", "proposito", "criteriosEvaluacion", "evidencia", "procesosPedagogicos", "procesosDidacticos", "materiales", "inicio", "desarrollo", "cierre", "productoSTEAM"],
};

const SUGGESTION_SCHEMA = {
  type: "object",
  properties: { suggestion: { type: "string" } },
  required: ["suggestion"],
};

const CHALLENGE_SCHEMA = {
  type: "object",
  properties: {
    titulo: { type: "string" }, mision: { type: "string" }, objetivo: { type: "string" },
    competencia: { type: "string" }, capacidades: { type: "array", items: { type: "string" } },
    duracion: { type: "string" }, equipo: { type: "string" },
    roles: { type: "array", items: { type: "string" } }, materiales: { type: "array", items: { type: "string" } },
    preparacion: { type: "array", items: { type: "string" } }, pasos: { type: "array", items: { type: "string" } },
    reglas: { type: "array", items: { type: "string" } }, producto: { type: "string" },
    criterios: { type: "array", items: { type: "string" } }, preguntas: { type: "array", items: { type: "string" } },
    adaptacionesDUA: { type: "array", items: { type: "string" } },
  },
  required: ["titulo","mision","objetivo","competencia","capacidades","duracion","equipo","roles","materiales","preparacion","pasos","reglas","producto","criterios","preguntas","adaptacionesDUA"],
};

const INSTRUMENT_SCHEMA = {
  type: "object",
  properties: {
    titulo: { type: "string" },
    competencia: { type: "string" },
    capacidades: { type: "array", items: { type: "string" } },
    evidencia: { type: "string" },
    criterios: {
      type: "array",
      items: {
        type: "object",
        properties: {
          capacidad: { type: "string" },
          criterio: { type: "string" },
          inicio: { type: "string" },
          enProceso: { type: "string" },
          logroEsperado: { type: "string" },
          logroDestacado: { type: "string" },
        },
        required: ["capacidad", "criterio", "inicio", "enProceso", "logroEsperado", "logroDestacado"],
      },
    },
  },
  required: ["titulo", "competencia", "capacidades", "evidencia", "criterios"],
};

const MODULE_SCHEMAS = {
  alignment: {
    type: "object",
    properties: {
      titulo: { type: "string" },
      proposito: { type: "string" },
      evidencia: { type: "string" },
      desempenosPrecisados: { type: "array", items: { type: "object", properties: { capacidad: { type: "string" }, desempeno: { type: "string" } }, required: ["capacidad", "desempeno"] } },
      criteriosEvaluacion: { type: "array", items: { type: "object", properties: { capacidad: { type: "string" }, criterio: { type: "string" } }, required: ["capacidad", "criterio"] } },
      enfoquesTransversales: { type: "array", items: { type: "object", properties: { enfoque: { type: "string" }, valor: { type: "string" }, actitudObservable: { type: "string" } }, required: ["enfoque", "valor", "actitudObservable"] } },
    },
    required: ["titulo", "proposito", "evidencia", "desempenosPrecisados", "criteriosEvaluacion", "enfoquesTransversales"],
  },
  sequence: {
    type: "object",
    properties: {
      preparacionDocente: { type: "array", items: { type: "string" } },
      materiales: { type: "array", items: { type: "string" } },
      inicio: { type: "object", properties: {
        minutos: { type: "integer" },
        motivacion: { type: "object", properties: { descripcion: { type: "string" }, preguntas: { type: "array", items: { type: "string" } } }, required: ["descripcion", "preguntas"] },
        saberesPrevios: { type: "object", properties: { descripcion: { type: "string" }, preguntas: { type: "array", items: { type: "string" } } }, required: ["descripcion", "preguntas"] },
        problematizacion: { type: "object", properties: { descripcion: { type: "string" }, preguntas: { type: "array", items: { type: "string" } } }, required: ["descripcion", "preguntas"] },
        propositoOrganizacion: { type: "object", properties: { descripcion: { type: "string" }, criteriosCompartidos: { type: "array", items: { type: "string" } } }, required: ["descripcion", "criteriosCompartidos"] },
      }, required: ["minutos", "motivacion", "saberesPrevios", "problematizacion", "propositoOrganizacion"] },
      desarrollo: { type: "object", properties: {
        minutos: { type: "integer" }, metodologia: { type: "string" },
        procesos: { type: "array", items: { type: "object", properties: { subtitulo: { type: "string" }, actividad: { type: "string" }, preguntasMediacion: { type: "array", items: { type: "string" } }, acompanamiento: { type: "string" }, evaluacionFormativa: { type: "string" } }, required: ["subtitulo", "actividad", "preguntasMediacion", "acompanamiento", "evaluacionFormativa"] } },
      }, required: ["minutos", "metodologia", "procesos"] },
      cierre: { type: "object", properties: {
        minutos: { type: "integer" },
        metacognicion: { type: "object", properties: { descripcion: { type: "string" }, preguntas: { type: "array", items: { type: "string" } } }, required: ["descripcion", "preguntas"] },
        evaluacion: { type: "object", properties: { descripcion: { type: "string" }, mensajeLogro: { type: "string" } }, required: ["descripcion", "mensajeLogro"] },
        transferencia: { type: "object", properties: { descripcion: { type: "string" }, consigna: { type: "string" } }, required: ["descripcion", "consigna"] },
      }, required: ["minutos", "metacognicion", "evaluacion", "transferencia"] },
      orientacionesDUA: { type: "array", items: { type: "string" } },
    },
    required: ["preparacionDocente", "materiales", "inicio", "desarrollo", "cierre", "orientacionesDUA"],
  },
  assessment: {
    type: "object",
    properties: {
      instrumentoSugerido: { type: "string" },
      criterios: { type: "array", items: { type: "object", properties: { capacidad: { type: "string" }, criterio: { type: "string" }, evidenciaObservable: { type: "string" } }, required: ["capacidad", "criterio", "evidenciaObservable"] } },
      reflexionesDocente: { type: "array", items: { type: "string" } },
    },
    required: ["instrumentoSugerido", "criterios", "reflexionesDocente"],
  },
  annexes: {
    type: "object",
    properties: {
      anexos: { type: "array", items: { type: "object", properties: { titulo: { type: "string" }, tipo: { type: "string" }, proposito: { type: "string" }, contenido: { type: "string" }, instrucciones: { type: "string" } }, required: ["titulo", "tipo", "proposito", "contenido", "instrucciones"] } },
    },
    required: ["anexos"],
  },
};

const DIDACTIC_PROCESSES = {
  "Ciencia y Tecnología": {
    indaga: ["Planteamiento del problema", "Planteamiento de hipótesis", "Elaboración del plan de acción", "Recojo de datos y análisis de resultados", "Estructuración del saber construido como respuesta al problema", "Evaluación y comunicación"],
    explica: ["Planteamiento del problema", "Planteamiento de explicaciones preliminares", "Elaboración del plan de acción", "Recojo y análisis de información", "Estructuración del saber construido", "Evaluación y comunicación"],
    disena: ["Planteamiento del problema tecnológico", "Diseño de la alternativa de solución", "Construcción e implementación", "Validación de la solución", "Evaluación y comunicación"],
  },
  Comunicación: {
    lee: ["Antes de la lectura", "Durante la lectura", "Después de la lectura"],
    escribe: ["Planificación", "Textualización", "Revisión y publicación"],
    oral: ["Antes del discurso", "Durante el discurso", "Después del discurso"],
  },
  Matemática: ["Familiarización con el problema", "Búsqueda y ejecución de estrategias", "Socialización de representaciones", "Reflexión y formalización", "Planteamiento de otros problemas"],
  "Personal Social": ["Problematización", "Análisis de información", "Toma de decisiones"],
  "Arte y Cultura": ["Exploración y experimentación", "Aplicación de procesos creativos", "Socialización", "Evaluación y comunicación"],
  "Educación para el Trabajo": ["Problematización", "Diseño de la propuesta de valor", "Aplicación de habilidades técnicas", "Trabajo cooperativo", "Evaluación de resultados"],
};

function didacticProcessList(form) {
  const area=DIDACTIC_PROCESSES[form.area];
  if (!area) return ["Exploración del reto", "Construcción del aprendizaje", "Aplicación", "Evaluación y comunicación"];
  if (Array.isArray(area)) return area;
  const competence=(form.competencia||"").toLowerCase();
  if (form.area === "Ciencia y Tecnología") return competence.includes("indaga")?area.indaga:competence.includes("diseña")?area.disena:area.explica;
  if (form.area === "Comunicación") return competence.includes("lee ")?area.lee:competence.includes("escribe")?area.escribe:area.oral;
  return Object.values(area)[0];
}

function formContext(form) {
  const capacities = Array.isArray(form.capacidades) ? form.capacidades.join("; ") : "";
  return `Nivel: ${form.nivel}. Grado: ${form.grado}. Área: ${form.area}. Región: ${form.region}.
Tema: ${form.tema}. Duración total: ${form.duracion} minutos.
Competencia oficial: ${form.competencia}. Capacidades oficiales: ${capacities}.
Propósito propuesto: ${form.proposito}. Contexto: ${form.contexto}. Evidencia: ${form.evidencia}.
Recursos disponibles: ${form.recursos || "materiales accesibles del entorno"}. DUA: ${form.inclusivo ? "sí" : "no"}. STEAM: ${form.steam ? "sí" : "no"}.`;
}

function modulePrompt(moduleName, form, previous = {}) {
  const context = formContext(form);
  if (moduleName === "alignment") return `${context}\nConstruye únicamente la alineación curricular. Conserva literalmente la competencia y las capacidades entregadas. Precisa un desempeño por cada capacidad seleccionada y formula criterios observables derivados de capacidad, tema, propósito y evidencia. Incluye solo enfoques transversales verdaderamente pertinentes. No inventes referentes locales.`;
  if (moduleName === "sequence") return `${context}\nAlineación aprobada: ${JSON.stringify(previous.alignment || {})}\nDiseña únicamente la preparación y secuencia de la sesión. Distribuye exactamente ${form.duracion} minutos entre inicio, desarrollo y cierre.
El Inicio debe mostrar obligatoriamente, como subtítulos separados: Motivación; Saberes previos; Problematización; Propósito y organización. Incluye preguntas auténticas y criterios comunicados a los estudiantes.
El Desarrollo debe utilizar exactamente estos procesos didácticos, en este orden y como subtítulos: ${didacticProcessList(form).join(" | ")}. Crea un objeto por cada proceso. En cada uno describe actividad, preguntas de mediación, acompañamiento docente y evaluación formativa; evita repetir la misma acción.
El Cierre debe mostrar como subtítulos separados: Metacognición; Evaluación; Cierre y transferencia.
No crees un apartado independiente llamado procesos pedagógicos o procesos didácticos. Estos deben evidenciarse dentro de los tres momentos. Describe acciones concretas del docente y estudiantes y orientaciones DUA aplicables.`;
  if (moduleName === "assessment") return `${context}\nAlineación: ${JSON.stringify(previous.alignment || {})}\nSecuencia: ${JSON.stringify(previous.sequence || {})}\nDiseña únicamente la evaluación. Cada criterio debe conservar la relación con una capacidad, ser observable y poder verificarse en una evidencia. Evita criterios genéricos, adjetivos subjetivos y duplicados. Sugiere el instrumento más pertinente y preguntas de reflexión para completar después de la clase.`;
  return `${context}\nAlineación: ${JSON.stringify(previous.alignment || {})}\nSecuencia: ${JSON.stringify(previous.sequence || {})}\nEvaluación: ${JSON.stringify(previous.assessment || {})}\nPropón exactamente tres anexos textuales utilizables en clase y coherentes con la evidencia: una ficha o texto base, una actividad para estudiantes y un recurso de apoyo. No afirmes que incluyes imágenes que no fueron generadas. El contenido debe estar listo para copiar a Word y adecuado al grado.`;
}

const SYSTEM_INSTRUCTION =
  "Eres un especialista peruano en planificación curricular y CNEB. Respeta la competencia y capacidades seleccionadas. Formula criterios de evaluación como acciones observables derivadas de las capacidades, el propósito y el tema. Organiza inicio, desarrollo y cierre con procesos pedagógicos y los procesos didácticos pertinentes al área, sin convertirlos en una lista mecánica. Adapta el contexto a la región sin inventar datos locales. Entrega siempre JSON válido.";

/** Tope defensivo de tamaño de entrada: evita inflar el prompt y el coste. */
const MAX_BODY_CHARS = 60_000;

function approxSize(body) {
  try {
    return JSON.stringify(body || {}).length;
  } catch {
    return 0;
  }
}

export default async function handler(req, res) {
  let auth = null;

  try {
    if (req.method !== "POST") throw Errors.methodNotAllowed();

    // 1) Autenticación (verificada contra Supabase Auth).
    auth = await requireUser(req);
    const rlKey = clientKey(req, auth.user.id);

    const {
      messages,
      mode,
      field,
      form = {},
      instrumentType,
      module: moduleName,
      previous = {},
    } = req.body || {};

    // 2) Validación de entrada, antes de gastar nada.
    if (approxSize(req.body) > MAX_BODY_CHARS) throw Errors.payloadTooLarge();

    const suggestionMode = mode === "suggestion";
    const instrumentMode = mode === "instrument";
    const moduleMode = mode === "module";
    const challengeMode = mode === "challenge";
    const allowedFields = ["proposito", "contexto", "evidencia"];

    if (suggestionMode && !allowedFields.includes(field)) {
      throw Errors.badRequest("Tipo de sugerencia no válido.");
    }
    if (moduleMode && !MODULE_SCHEMAS[moduleName]) {
      throw Errors.badRequest("Módulo de generación no válido.");
    }
    if (instrumentMode && !["rubric", "checklist"].includes(instrumentType)) {
      throw Errors.badRequest("Tipo de instrumento no válido.");
    }

    // 3) Limitación de ráfagas (ver limitaciones en _lib/rate-limit.js).
    enforceRateLimit({
      key: rlKey,
      bucket: suggestionMode ? "ai-suggestion" : "ai-generation",
      ...(suggestionMode ? RateLimits.aiSuggestion : RateLimits.aiGeneration),
    });

    // 4) Construcción del prompt.
    //    Los textos pedagógicos son EXACTAMENTE los mismos de antes.
    const capacities = Array.isArray(form.capacidades) ? form.capacidades.join("; ") : "";
    const suggestionInstructions = {
      proposito: "Redacta un propósito de aprendizaje breve en una sola oración. Debe expresar qué acción realizará el estudiante, qué contenido movilizará, en qué condición y para qué será útil.",
      contexto: "Propón una situación significativa auténtica y cercana a la región indicada. Relaciónala con el tema y la vida del estudiante, pero no inventes nombres, cifras, festividades ni problemas locales específicos que no hayan sido proporcionados.",
      evidencia: "Propón una evidencia concreta y verificable: un producto, actuación o desempeño que permita observar las capacidades seleccionadas y evaluar el propósito.",
    };
    const suggestionPrompt = `Ayuda a un docente peruano a completar solamente el campo "${field}" de una sesión CNEB.
Nivel: ${form.nivel || "No indicado"}. Grado: ${form.grado || "No indicado"}. Área: ${form.area || "No indicada"}.
Región: ${form.region || "No indicada"}. Tema: ${form.tema || "No indicado"}.
Competencia: ${form.competencia || "No indicada"}. Capacidades: ${capacities || "No indicadas"}.
Propósito actual: ${form.proposito || ""}. Contexto actual: ${form.contexto || ""}.
${suggestionInstructions[field] || ""}
Responde únicamente con una sugerencia lista para pegar en el formulario, en español claro y sin encabezados.`;
    const instrumentPrompt = `Genera un instrumento de evaluación CNEB de tipo ${instrumentType === "rubric" ? "rúbrica analítica" : "lista de cotejo"}.
Nivel: ${form.nivel}. Grado: ${form.grado}. Área: ${form.area}. Región: ${form.region || "No indicada"}.
Tema: ${form.tema}. Competencia: ${form.competencia}. Capacidades seleccionadas: ${capacities}.
Evidencia de aprendizaje: ${form.evidencia}. Cantidad de criterios: ${form.numeroCriterios || 6}.
Criterios ya aprobados en la sesión: ${JSON.stringify(form.criteriosBase || [])}.
Cuando existan criterios aprobados, consérvalos y conviértelos en el instrumento sin sustituirlos por criterios distintos. Cada criterio debe mantener su capacidad relacionada, empezar con un verbo observable, indicar el contenido y una condición de calidad. No repitas criterios.
${instrumentType === "rubric" ? "Para cada criterio redacta descriptores progresivos y coherentes para Inicio, En proceso, Logro esperado y Logro destacado. Evita limitarte a adjetivos como bueno o excelente." : "Para la lista de cotejo deja inicio, enProceso, logroEsperado y logroDestacado como cadenas vacías; los criterios se evaluarán con Sí, No y Observaciones."}`;
    const challengePrompt = `Diseña un reto grupal colaborativo, seguro y listo para aplicar en un aula peruana.
Nivel y grado: ${form.nivel || "No indicado"} · ${form.grado || "No indicado"}. Área: ${form.area || "No indicada"}. Tema: ${form.tema || "No indicado"}.
Región o contexto: ${form.region || "No indicado"}. Duración: ${form.duracion || "45"} minutos. Estudiantes: ${form.estudiantes || "No indicado"}. Integrantes por equipo: ${form.integrantes || "4"}.
Materiales disponibles: ${form.materiales || "materiales sencillos del aula"}. Competencia solicitada: ${form.competencia || "selecciona la competencia CNEB más pertinente"}.
El reto debe exigir colaboración real, asignar roles complementarios y terminar en un producto, solución o prototipo observable. Describe acciones concretas y numeradas. Formula criterios observables derivados de la competencia, el tema y el producto. Adapta el contexto sin inventar nombres, cifras, costumbres ni problemas locales específicos. Incluye apoyos DUA y evita actividades peligrosas o que requieran materiales difíciles de conseguir.`;

    const promptText = challengeMode
      ? challengePrompt
      : suggestionMode
        ? suggestionPrompt
        : instrumentMode
          ? instrumentPrompt
          : moduleMode
            ? modulePrompt(moduleName, form, previous)
            : messages?.[0]?.content || "";

    if (!promptText.trim()) {
      throw Errors.badRequest("Falta información para generar la propuesta.");
    }

    const responseSchema = challengeMode
      ? CHALLENGE_SCHEMA
      : suggestionMode
        ? SUGGESTION_SCHEMA
        : instrumentMode
          ? INSTRUMENT_SCHEMA
          : moduleMode
            ? MODULE_SCHEMAS[moduleName]
            : SESSION_SCHEMA;

    const maxOutputTokens = suggestionMode
      ? 800
      : challengeMode
        ? 4500
        : instrumentMode
          ? 5000
          : moduleMode
            ? moduleName === "annexes"
              ? 6500
              : 4500
            : 8192;

    const runGeneration = () =>
      generateJson({
        prompt: promptText,
        systemInstruction: SYSTEM_INSTRUCTION,
        responseSchema,
        maxOutputTokens,
      });

    // 5) Cobro de créditos.
    //
    //    UNA creación entregada al docente = UN crédito.
    //
    //    Una sesión son 4 llamadas encadenadas (alignment -> sequence ->
    //    assessment -> annexes) pero una sola creación para la docente: por eso
    //    solo el primer módulo cobra. Antes NINGUNA de las cuatro cobraba y el
    //    límite semanal quedaba completamente eludido.
    //
    //    Las sugerencias de campo no cobran (800 tokens); las frena el rate limit.
    const charges =
      challengeMode ||
      instrumentMode ||
      (moduleMode && chargesCreditForModule(moduleName)) ||
      (!moduleMode && !suggestionMode);

    let generation;
    let credits = null;

    if (charges) {
      // Consume, ejecuta y devuelve el crédito si falla. Todo del lado servidor:
      // el cliente no puede saltarse el cobro ni forzar una devolución.
      const outcome = await withCredit(
        {
          token: auth.token,
          url: auth.url,
          key: auth.key,
          reason: `generate-session:${mode || "session"}`,
        },
        runGeneration
      );
      generation = outcome.result;
      credits = outcome.credits;
    } else {
      generation = await runGeneration();
    }

    const { data, model } = generation;

    // 6) Respuesta con la misma forma que ya esperaba el cliente.
    if (suggestionMode) return res.status(200).json({ suggestion: data.suggestion });
    if (challengeMode) return res.status(200).json({ challenge: data, model, _credits: credits });
    if (instrumentMode) return res.status(200).json({ instrument: data, _credits: credits });
    if (moduleMode) {
      return res.status(200).json({ module: moduleName, result: data, model, _credits: credits });
    }
    return res.status(200).json({ session: data, _credits: credits });
  } catch (error) {
    return sendError(res, error, {
      endpoint: "generate-session",
      mode: req.body?.mode,
      module: req.body?.module,
    });
  }
}

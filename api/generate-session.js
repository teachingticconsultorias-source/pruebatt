// Función serverless de Vercel: recibe la petición del navegador y la
// reenvía a la API de Gemini (Google) usando la clave guardada de forma
// segura en el servidor (variable de entorno GEMINI_API_KEY). Así la clave
// nunca queda expuesta en el código del navegador.
//
// Devuelve la respuesta normalizada en la misma forma que espera el cliente:
// { content: [ { type: "text", text: "..." } ] }

const GEMINI_MODEL = process.env.GEMINI_MAIN_MODEL || "gemini-3.6-flash";

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

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Método no permitido" });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "Falta configurar GEMINI_API_KEY en Vercel" });
    return;
  }

  const accessToken = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!accessToken || !supabaseUrl || !supabaseKey) {
    res.status(401).json({ error: "Inicia sesión para utilizar el generador" });
    return;
  }

  const authCheck = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: supabaseKey, Authorization: `Bearer ${accessToken}` },
  });
  if (!authCheck.ok) {
    res.status(401).json({ error: "Tu sesión venció. Vuelve a iniciar sesión." });
    return;
  }

  try {
    const { messages, mode, field, form = {}, instrumentType, module: moduleName, previous = {} } = req.body || {};
    const suggestionMode = mode === "suggestion";
    const instrumentMode = mode === "instrument";
    const moduleMode = mode === "module";
    const allowedFields = ["proposito", "contexto", "evidencia"];

    if (suggestionMode && !allowedFields.includes(field)) {
      res.status(400).json({ error: "Tipo de sugerencia no válido" });
      return;
    }
    if (moduleMode && !MODULE_SCHEMAS[moduleName]) {
      res.status(400).json({ error: "Módulo de generación no válido" });
      return;
    }

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
    const promptText = suggestionMode ? suggestionPrompt : instrumentMode ? instrumentPrompt : moduleMode ? modulePrompt(moduleName, form, previous) : (messages?.[0]?.content || "");

    if (!promptText.trim()) {
      res.status(400).json({ error: "Falta información para generar la propuesta" });
      return;
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }] }],
          systemInstruction: { parts: [{ text: "Eres un especialista peruano en planificación curricular y CNEB. Respeta la competencia y capacidades seleccionadas. Formula criterios de evaluación como acciones observables derivadas de las capacidades, el propósito y el tema. Organiza inicio, desarrollo y cierre con procesos pedagógicos y los procesos didácticos pertinentes al área, sin convertirlos en una lista mecánica. Adapta el contexto a la región sin inventar datos locales. Entrega siempre JSON válido." }] },
          generationConfig: {
            maxOutputTokens: suggestionMode ? 800 : instrumentMode ? 5000 : moduleMode ? (moduleName === "annexes" ? 6500 : 4500) : 8192,
            responseMimeType: "application/json",
            responseSchema: suggestionMode ? SUGGESTION_SCHEMA : instrumentMode ? INSTRUMENT_SCHEMA : moduleMode ? MODULE_SCHEMAS[moduleName] : SESSION_SCHEMA,
          },
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      res.status(response.status).json({ error: data.error?.message || "Error de la API de Gemini" });
      return;
    }

    const candidate = data.candidates?.[0];
    const text = candidate?.content?.parts?.map((p) => p.text).join("") || "";
    if (!text) {
      res.status(500).json({ error: "Gemini no devolvió contenido" });
      return;
    }

    if (candidate?.finishReason === "MAX_TOKENS") {
      res.status(502).json({ error: "La sesión fue demasiado extensa y quedó incompleta. Intenta generarla nuevamente." });
      return;
    }

    if (suggestionMode) {
      const parsed = JSON.parse(text);
      res.status(200).json({ suggestion: parsed.suggestion });
      return;
    }

    if (instrumentMode) {
      const instrument = JSON.parse(text);
      res.status(200).json({ instrument });
      return;
    }

    if (moduleMode) {
      const moduleResult = JSON.parse(text);
      res.status(200).json({ module: moduleName, result: moduleResult, model: GEMINI_MODEL });
      return;
    }

    const session = JSON.parse(text);
    res.status(200).json({ session });
  } catch (err) {
    res.status(500).json({ error: err instanceof SyntaxError ? "Gemini devolvió una respuesta incompleta. Intenta generarla nuevamente." : "Error interno al generar la sesión" });
  }
}

// Función serverless de Vercel: recibe la petición del navegador y la
// reenvía a la API de Gemini (Google) usando la clave guardada de forma
// segura en el servidor (variable de entorno GEMINI_API_KEY). Así la clave
// nunca queda expuesta en el código del navegador.
//
// Devuelve la respuesta normalizada en la misma forma que espera el cliente:
// { content: [ { type: "text", text: "..." } ] }

const GEMINI_MODEL = "gemini-3.6-flash";

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
    const { messages, mode, field, form = {}, instrumentType } = req.body || {};
    const suggestionMode = mode === "suggestion";
    const instrumentMode = mode === "instrument";
    const allowedFields = ["proposito", "contexto", "evidencia"];

    if (suggestionMode && !allowedFields.includes(field)) {
      res.status(400).json({ error: "Tipo de sugerencia no válido" });
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
Cada criterio debe derivarse de una capacidad y del tema, empezar con un verbo observable, indicar el contenido y una condición de calidad. No repitas criterios.
${instrumentType === "rubric" ? "Para cada criterio redacta descriptores progresivos y coherentes para Inicio, En proceso, Logro esperado y Logro destacado. Evita limitarte a adjetivos como bueno o excelente." : "Para la lista de cotejo deja inicio, enProceso, logroEsperado y logroDestacado como cadenas vacías; los criterios se evaluarán con Sí, No y Observaciones."}`;
    const promptText = suggestionMode ? suggestionPrompt : instrumentMode ? instrumentPrompt : (messages?.[0]?.content || "");

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
            maxOutputTokens: suggestionMode ? 800 : instrumentMode ? 5000 : 8192,
            responseMimeType: "application/json",
            responseSchema: suggestionMode ? SUGGESTION_SCHEMA : instrumentMode ? INSTRUMENT_SCHEMA : SESSION_SCHEMA,
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

    const session = JSON.parse(text);
    res.status(200).json({ session });
  } catch (err) {
    res.status(500).json({ error: err instanceof SyntaxError ? "Gemini devolvió una respuesta incompleta. Intenta generarla nuevamente." : "Error interno al generar la sesión" });
  }
}

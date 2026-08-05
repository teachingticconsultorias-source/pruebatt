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
    const { messages, mode, field, form = {} } = req.body || {};
    const suggestionMode = mode === "suggestion";
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
    const promptText = suggestionMode ? suggestionPrompt : (messages?.[0]?.content || "");

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
            maxOutputTokens: 2500,
            temperature: 0.7,
            responseMimeType: "application/json",
            responseSchema: suggestionMode ? SUGGESTION_SCHEMA : SESSION_SCHEMA,
          },
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      res.status(response.status).json({ error: data.error?.message || "Error de la API de Gemini" });
      return;
    }

    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "";
    if (!text) {
      res.status(500).json({ error: "Gemini no devolvió contenido" });
      return;
    }

    if (suggestionMode) {
      const parsed = JSON.parse(text);
      res.status(200).json({ suggestion: parsed.suggestion });
      return;
    }

    // Normalizamos a la misma forma que usaba el cliente para Anthropic,
    // así el código de React no necesita cambios.
    res.status(200).json({ content: [{ type: "text", text }] });
  } catch (err) {
    res.status(500).json({ error: "Error interno al generar la sesión" });
  }
}

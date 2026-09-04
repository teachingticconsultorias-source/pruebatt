import { getGeminiModel } from "./_lib/gemini.js";
import { clientKey, enforceRateLimit, RateLimits } from "./_lib/rate-limit.js";

const GEMINI_MODEL = getGeminiModel();

const SCHEMA = {
  type: "object",
  properties: {
    titulo: { type: "string" },
    instrucciones: { type: "string" },
    preguntas: {
      type: "array",
      items: {
        type: "object",
        properties: {
          numero: { type: "integer" },
          tipo: { type: "string", enum: ["abierta", "opcion_multiple", "lectura", "verdadero_falso"] },
          pregunta: { type: "string" },
          textoLectura: { type: "string" },
          opciones: { type: "array", items: { type: "string" } },
          respuestaEsperada: { type: "string" }
        },
        required: ["numero", "tipo", "pregunta", "textoLectura", "opciones", "respuestaEsperada"]
      }
    }
  },
  required: ["titulo", "instrucciones", "preguntas"]
};

function arr(v) { return Array.isArray(v) ? v : []; }

async function rpc(name, token, url, key) {
  const r = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${token}` },
    body: "{}"
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = new Error(data?.message || `Error ${name}`);
    e.status = r.status;
    throw e;
  }
  return data;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });

  const apiKey = process.env.GEMINI_API_KEY;
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");

  if (!apiKey) return res.status(500).json({ error: "Falta GEMINI_API_KEY" });
  if (!token || !supabaseUrl || !supabaseKey) return res.status(401).json({ error: "Inicia sesión para continuar" });

  let consumed = false;
  try {
    const auth = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { apikey: supabaseKey, Authorization: `Bearer ${token}` } });
    if (!auth.ok) return res.status(401).json({ error: "Tu sesión venció. Vuelve a iniciar sesión." });
    // Limitación de ráfagas (best-effort por instancia; ver _lib/rate-limit.js).
    enforceRateLimit({ key: clientKey(req), bucket: "ai-generation", ...RateLimits.aiGeneration });


    const quota = await rpc("consume_ai_credit", token, supabaseUrl, supabaseKey);
    if (!quota?.ok) return res.status(429).json({ error: "Has utilizado tus creaciones disponibles de esta semana.", code: quota?.reason || "WEEKLY_LIMIT_REACHED", credits: quota });
    consumed = true;

    const form = req.body?.form || {};
    const session = req.body?.session || {};
    const options = req.body?.options || {};
    const questionCount = Math.min(Math.max(Number(options.questionCount || 10), 5), 20);
    const allowed = ["abierta", "opcion_multiple", "lectura", "verdadero_falso"];
    const selected = arr(options.questionTypes).filter(x => allowed.includes(x));
    const questionTypes = selected.length ? selected : ["opcion_multiple"];

    const prompt = `
Actúa como especialista peruano en CNEB y elaboración de materiales para estudiantes.
Genera una FICHA DE TRABAJO vinculada a una sesión de aprendizaje ya creada.

DATOS DE LA SESIÓN:
Nivel: ${form.nivel || ""}
Grado: ${form.grado || ""}
Área: ${form.area || ""}
Título/tema: ${session.titulo || form.tema || ""}
Propósito: ${session.proposito || form.proposito || ""}
Competencia: ${form.competencia || arr(session.competenciasCNEB)[0] || ""}
Capacidades: ${(arr(form.capacidades).length ? arr(form.capacidades) : arr(session.capacidadesCNEB)).join(" | ")}
Evidencia: ${session.evidencia || form.evidencia || ""}
Criterios: ${JSON.stringify(session.criteriosEvaluacion || session.criteriosDetallados || [])}
Contexto/región: ${form.region || ""}

CONFIGURACIÓN DE LA FICHA:
- Cantidad exacta de preguntas: ${questionCount}.
- Tipos permitidos seleccionados por el docente: ${questionTypes.join(" | ")}.

REGLAS:
- Devuelve EXACTAMENTE ${questionCount} preguntas.
- Usa únicamente los tipos seleccionados por el docente.
- Distribuye los tipos de manera equilibrada cuando haya más de uno.
- Las preguntas deben evaluar lo trabajado en la sesión, no contenidos externos.
- Adecuar vocabulario y complejidad al grado.
- En opcion_multiple genera exactamente 4 opciones y una sola respuesta correcta.
- En verdadero_falso, opciones debe ser ["Verdadero","Falso"].
- En abierta, opciones debe ser [].
- En lectura, incluye un textoLectura breve, original y adecuado al grado; la pregunta debe evaluar comprensión de ese texto.
- Para tipos distintos de lectura, textoLectura debe ser "".
- respuestaEsperada es solo para el docente; no debe aparecer en la ficha del estudiante.
- No incluyas claves ni respuestas dentro del texto de la pregunta.
- El título debe ser atractivo y relacionado con la sesión.
- Devuelve únicamente JSON válido según el esquema.
`;

    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        systemInstruction: { parts: [{ text: "Eres especialista peruano en CNEB. Entrega JSON válido, claro y aplicable en aula." }] },
        generationConfig: {
          maxOutputTokens: 7500,
          responseMimeType: "application/json",
          responseSchema: SCHEMA
        }
      })
    });

    const data = await r.json();
    if (!r.ok) throw Object.assign(new Error(data?.error?.message || "Error de Gemini"), { status: r.status });
    const candidate = data?.candidates?.[0];
    const text = candidate?.content?.parts?.map(x => x.text).join("") || "";
    if (!text) throw new Error("Gemini no devolvió contenido");
    if (candidate?.finishReason === "MAX_TOKENS") throw new Error("La ficha quedó incompleta. Intenta nuevamente.");
    const resource = JSON.parse(text);
    resource.preguntas = arr(resource.preguntas).slice(0, questionCount);
    if (resource.preguntas.length !== questionCount) throw new Error("La ficha no llegó con la cantidad solicitada de preguntas. Intenta nuevamente.");
    return res.status(200).json({ resource, model: GEMINI_MODEL, _credits: quota });
  } catch (e) {
    if (consumed) await rpc("refund_ai_credit", token, supabaseUrl, supabaseKey).catch(() => {});
    return res.status(e?.status || 500).json({ error: e instanceof SyntaxError ? "Gemini devolvió una respuesta incompleta." : e?.message || "No se pudo generar la ficha" });
  }
}

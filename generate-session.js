// Función serverless de Vercel: recibe la petición del navegador y la
// reenvía a la API de Gemini (Google) usando la clave guardada de forma
// segura en el servidor (variable de entorno GEMINI_API_KEY). Así la clave
// nunca queda expuesta en el código del navegador.
//
// Devuelve la respuesta normalizada en la misma forma que espera el cliente:
// { content: [ { type: "text", text: "..." } ] }

const GEMINI_MODEL = "gemini-3.5-flash";

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

  try {
    const { messages } = req.body;
    const promptText = messages?.[0]?.content || "";

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
          generationConfig: { maxOutputTokens: 1000 },
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

    // Normalizamos a la misma forma que usaba el cliente para Anthropic,
    // así el código de React no necesita cambios.
    res.status(200).json({ content: [{ type: "text", text }] });
  } catch (err) {
    res.status(500).json({ error: "Error interno al generar la sesión" });
  }
}

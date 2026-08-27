// api/credits.js
// Devuelve el estado semanal de créditos del docente autenticado.

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  const accessToken = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey =
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY;

  if (!accessToken || !supabaseUrl || !supabaseKey) {
    return res.status(401).json({ error: "Inicia sesión para consultar tus créditos" });
  }

  try {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/rpc/get_ai_credit_status`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseKey,
          Authorization: `Bearer ${accessToken}`,
        },
        body: "{}",
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.message || "No se pudo consultar tus créditos",
      });
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error("credits error:", error);
    return res.status(500).json({ error: "Error interno al consultar créditos" });
  }
}

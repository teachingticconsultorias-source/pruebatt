// ⚠️ ENDPOINT LEGACY — NO SE USA
//
// Estado: HUÉRFANO. Ningún archivo del frontend lo invoca (verificado en el
// Bloque A y de nuevo en el Bloque B con una búsqueda de "/api/" sobre
// App.jsx y components/).
//
// Fue escrito para envolver `generate-session` con consumo y devolución de
// crédito. Desde el Bloque B esa responsabilidad vive DENTRO de
// `api/generate-session.js` mediante `_lib/credits.js` (`withCredit`), que
// además cobra 1 crédito por SESIÓN COMPLETA y no por llamada: este wrapper
// habría cobrado 4 créditos por sesión, agotando el cupo semanal de una vez.
//
// Se conserva sin borrar para no perder el historial. NO construir encima.
// Eliminación registrada para el Bloque C.

// api/generate-with-quota.js
//
// Envuelve tu endpoint ACTUAL api/generate-session.js.
// 1. Consume 1 crédito.
// 2. Ejecuta el generador de Gemini que ya tienes.
// 3. Si Gemini/backend falla, devuelve automáticamente el crédito.
// 4. Si funciona, conserva el consumo.
//
// NO expone GEMINI_API_KEY al navegador.

import generateSessionHandler from "./generate-session.js";


function createCapturedResponse() {
  let statusCode = 200;
  let payload = null;

  const captured = {
    status(code) {
      statusCode = code;
      return captured;
    },
    json(data) {
      payload = data;
      return captured;
    },
    setHeader() {
      return captured;
    },
    get statusCode() {
      return statusCode;
    },
    get payload() {
      return payload;
    },
  };

  return captured;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  const accessToken = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey =
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY;

  if (!accessToken || !supabaseUrl || !supabaseKey) {
    return res.status(401).json({ error: "Inicia sesión para utilizar la IA" });
  }

  try {
    // Los créditos los gestiona ÍNTEGRAMENTE generate-session con withCredit:
    // consume, ejecuta y devuelve si falla. Este envoltorio consumía además
    // uno por su cuenta, de modo que una sola creación habría cobrado DOS
    // créditos. Se retira ese consumo y se delega en el interno, que ya
    // incluye `_credits` en su respuesta.
    const innerRes = createCapturedResponse();
    await generateSessionHandler(req, innerRes);

    return res
      .status(innerRes.statusCode || 500)
      .json(innerRes.payload || { error: "No se pudo completar la generación" });
  } catch (error) {
    // El detalle va al log; a la docente, un mensaje claro.
    console.error("[sciverse:with-quota-failed]", error?.message);
    return res.status(500).json({
      error: "No pudimos generar el contenido. Inténtalo nuevamente.",
      code: "GENERATION_ERROR",
    });
  }
}

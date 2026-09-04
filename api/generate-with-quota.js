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

async function callRpc({ name, token, supabaseUrl, supabaseKey }) {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: supabaseKey,
      Authorization: `Bearer ${token}`,
    },
    body: "{}",
  });

  let data = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    const error = new Error(data?.message || `RPC ${name} falló`);
    error.status = response.status;
    throw error;
  }

  return data;
}

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

  let creditConsumed = false;

  try {
    const quota = await callRpc({
      name: "consume_ai_credit",
      token: accessToken,
      supabaseUrl,
      supabaseKey,
    });

    if (!quota?.ok) {
      return res.status(429).json({
        error: "Has utilizado tus 5 creaciones gratuitas de esta semana.",
        code: quota?.reason || "WEEKLY_LIMIT_REACHED",
        credits: quota,
      });
    }

    creditConsumed = true;

    // Ejecutamos exactamente el generador que ya existe en el proyecto.
    const innerRes = createCapturedResponse();
    await generateSessionHandler(req, innerRes);

    const successful =
      innerRes.statusCode >= 200 &&
      innerRes.statusCode < 300 &&
      innerRes.payload;

    if (!successful) {
      await callRpc({
        name: "refund_ai_credit",
        token: accessToken,
        supabaseUrl,
        supabaseKey,
      }).catch((refundError) =>
        console.error("No se pudo devolver el crédito:", refundError)
      );

      return res
        .status(innerRes.statusCode || 500)
        .json(innerRes.payload || { error: "No se pudo completar la generación" });
    }

    // Adjuntamos información de créditos sin modificar las estructuras
    // existentes (session, instrument, challenge, result, etc.).
    return res.status(innerRes.statusCode).json({
      ...innerRes.payload,
      _credits: quota,
    });
  } catch (error) {
    console.error("generate-with-quota error:", error);

    if (creditConsumed) {
      await callRpc({
        name: "refund_ai_credit",
        token: accessToken,
        supabaseUrl,
        supabaseKey,
      }).catch(() => {});
    }

    return res.status(error?.status || 500).json({
      error:
        error?.message ||
        "No se pudo validar el límite semanal de generaciones",
    });
  }
}

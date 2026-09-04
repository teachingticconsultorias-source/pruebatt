// api/_lib/gemini.js
//
// Punto único de configuración y acceso a la API de Gemini.
// Antes, el modelo y la URL estaban duplicados en 4 endpoints.
//
// NOTA SOBRE EL MODELO POR DEFECTO
// --------------------------------
// `gemini-3.6-flash` es un identificador VÁLIDO y estable de la API de
// Gemini (modelo Flash de generación anterior, ventana de 1M de tokens).
// Verificado el 2026-09-03 contra la documentación oficial:
//   https://ai.google.dev/gemini-api/docs/models
//
// Por eso NO se hace fallar el arranque cuando `GEMINI_MAIN_MODEL` no está
// definida: hoy la aplicación funciona con este valor por defecto y abortar
// provocaría una caída total del generador. Lo que sí se hace es:
//   1. declarar el valor por defecto en UN solo sitio (aquí),
//   2. registrar un aviso en el log del servidor cuando se usa,
//   3. documentar la variable en `.env.example`.

import { Errors } from "./errors.js";

/** Valor por defecto, verificado como modelo válido. Ver nota superior. */
export const DEFAULT_GEMINI_MODEL = "gemini-3.6-flash";

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

/** Tiempo máximo por llamada a Gemini. */
const DEFAULT_TIMEOUT_MS = 45_000;

let warnedAboutDefaultModel = false;

/** Modelo configurado. Nunca lanza: siempre hay un modelo válido. */
export function getGeminiModel() {
  const configured = (process.env.GEMINI_MAIN_MODEL || "").trim();
  if (configured) return configured;

  if (!warnedAboutDefaultModel) {
    warnedAboutDefaultModel = true;
    console.warn(
      "[sciverse:config] GEMINI_MAIN_MODEL no está definida; se usa el valor por " +
        `defecto "${DEFAULT_GEMINI_MODEL}". Defínela en Vercel para fijar el modelo ` +
        "de forma explícita."
    );
  }
  return DEFAULT_GEMINI_MODEL;
}

/** Clave de API. Lanza si falta: sin ella no se puede generar nada. */
export function getGeminiApiKey() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw Errors.misconfigured("GEMINI_API_KEY no está definida");
  return key;
}

/**
 * Llama a Gemini y devuelve el JSON ya parseado.
 *
 * Centraliza: modelo, URL, timeout, detección de truncamiento y traducción
 * de errores. Nunca propaga el mensaje crudo del proveedor al cliente.
 *
 * @param {object}  opts
 * @param {string}  opts.prompt            texto del prompt
 * @param {string} [opts.systemInstruction]
 * @param {object}  opts.responseSchema    esquema de salida estructurada
 * @param {number}  opts.maxOutputTokens
 * @param {number} [opts.timeoutMs]
 * @returns {Promise<{data: any, model: string}>}
 */
export async function generateJson({
  prompt,
  systemInstruction,
  responseSchema,
  maxOutputTokens,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}) {
  const apiKey = getGeminiApiKey();
  const model = getGeminiModel();

  if (!prompt || !String(prompt).trim()) {
    throw Errors.badRequest("Falta información para generar la propuesta.");
  }

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      maxOutputTokens,
      responseMimeType: "application/json",
      responseSchema,
    },
  };
  if (systemInstruction) {
    body.systemInstruction = { parts: [{ text: systemInstruction }] };
  }

  let response;
  try {
    response = await fetch(`${API_BASE}/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    if (error?.name === "TimeoutError" || error?.name === "AbortError") {
      throw Errors.aiTimeout();
    }
    throw Errors.aiUnavailable(error?.message);
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw Errors.aiUnavailable("respuesta no parseable de Gemini");
  }

  if (!response.ok) {
    // El mensaje de Gemini se queda en el log, no viaja al cliente.
    throw Errors.aiUnavailable(
      `HTTP ${response.status}: ${payload?.error?.message || "sin detalle"}`
    );
  }

  const candidate = payload?.candidates?.[0];
  const text = candidate?.content?.parts?.map((part) => part.text).join("") || "";

  if (!text) throw Errors.aiIncomplete();
  if (candidate?.finishReason === "MAX_TOKENS") throw Errors.aiIncomplete();

  try {
    return { data: JSON.parse(text), model };
  } catch {
    throw Errors.aiIncomplete();
  }
}

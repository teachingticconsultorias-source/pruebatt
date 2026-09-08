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

import { randomUUID } from "node:crypto";

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
 * Uso de tokens tal como lo devuelve Gemini.
 *
 * `pensamiento` es el dato que faltaba para diagnosticar: en los modelos con
 * razonamiento, los tokens de pensamiento se descuentan del MISMO
 * `maxOutputTokens` que la respuesta. Con un presupuesto corto, el modelo
 * puede agotarlo pensando y devolver `finishReason: MAX_TOKENS` con el texto
 * VACÍO — que es exactamente el síntoma de «la respuesta llegó incompleta».
 * Sin esta cifra en el log, esa hipótesis no se puede confirmar ni descartar.
 */
function usoDeTokens(payload) {
  const u = payload?.usageMetadata || {};
  return {
    prompt: u.promptTokenCount ?? null,
    salida: u.candidatesTokenCount ?? null,
    pensamiento: u.thoughtsTokenCount ?? null,
    total: u.totalTokenCount ?? null,
  };
}

/**
 * Una línea por llamada, en el log del servidor.
 *
 * NO lleva el prompt: contiene el contexto que escribe la docente sobre su
 * aula y sus estudiantes. Se registran longitudes, no contenido. Tampoco la
 * clave, obviamente.
 */
function registrar(nivel, datos) {
  const salida = nivel === "error" ? console.error : console.log;
  salida("[sciverse:gemini]", JSON.stringify(datos));
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
  tool = "desconocida",
}) {
  const requestId = randomUUID().slice(0, 8);
  const inicio = Date.now();
  const base = { requestId, tool, maxOutputTokens };
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
    const timeout = error?.name === "TimeoutError" || error?.name === "AbortError";
    registrar("error", { ...base, model, ok: false, durationMs: Date.now() - inicio,
                         motivo: timeout ? "TIMEOUT" : "RED" });
    if (timeout) throw Errors.aiTimeout();
    throw Errors.aiUnavailable(error?.message);
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    registrar("error", { ...base, model, ok: false, durationMs: Date.now() - inicio,
                         motivo: "RESPUESTA_NO_JSON", status: response.status });
    throw Errors.aiUnavailable("respuesta no parseable de Gemini");
  }

  const durationMs = Date.now() - inicio;

  if (!response.ok) {
    // El mensaje de Gemini se queda en el log, no viaja al cliente.
    registrar("error", { ...base, model, ok: false, durationMs,
                         motivo: "HTTP_" + response.status });
    throw Errors.aiUnavailable(
      `HTTP ${response.status}: ${payload?.error?.message || "sin detalle"}`
    );
  }

  const candidate = payload?.candidates?.[0];
  const finishReason = candidate?.finishReason || null;
  const blockReason = payload?.promptFeedback?.blockReason || null;
  const text = candidate?.content?.parts?.map((part) => part.text).join("") || "";
  const tokens = usoDeTokens(payload);

  /** Todo lo que hace falta para diagnosticar, sin una línea del prompt. */
  const contexto = { ...base, model, durationMs, finishReason, blockReason,
                     textLength: text.length, tokens };

  const fallar = (motivo, error) => {
    registrar("error", { ...contexto, ok: false, motivo });
    throw error;
  };

  // El filtro del proveedor rechazó la petición o la respuesta. No es una
  // truncación, y decirle a la docente que «llegó incompleta» la llevaría a
  // reintentar indefinidamente lo mismo.
  if (blockReason) {
    fallar("PROMPT_BLOQUEADO", Errors.aiBlocked(`blockReason=${blockReason}`));
  }
  if (finishReason === "SAFETY" || finishReason === "RECITATION") {
    fallar("RESPUESTA_BLOQUEADA", Errors.aiBlocked(`finishReason=${finishReason}`));
  }

  if (!text) {
    // El caso más informativo: si además `finishReason` es MAX_TOKENS, el
    // presupuesto se agotó ANTES de escribir nada. Con modelos que razonan,
    // eso suele significar que se fue en tokens de pensamiento — y `tokens`
    // lo dice.
    fallar(
      finishReason === "MAX_TOKENS" ? "SIN_TEXTO_POR_PRESUPUESTO" : "SIN_TEXTO",
      Errors.aiIncomplete(
        `sin texto · finishReason=${finishReason} · pensamiento=${tokens.pensamiento}` +
        ` · salida=${tokens.salida} · maxOutputTokens=${maxOutputTokens}`
      )
    );
  }

  if (finishReason === "MAX_TOKENS") {
    fallar(
      "TRUNCADO",
      Errors.aiIncomplete(
        `truncado a ${text.length} caracteres · pensamiento=${tokens.pensamiento}` +
        ` · salida=${tokens.salida} · maxOutputTokens=${maxOutputTokens}`
      )
    );
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch (error) {
    fallar(
      "JSON_INVALIDO",
      Errors.aiIncomplete(
        `JSON invalido con finishReason=${finishReason} y ${text.length} caracteres:` +
        ` ${String(error?.message || "").slice(0, 120)}`
      )
    );
  }

  registrar("log", { ...contexto, ok: true, motivo: null });
  return { data, model };
}

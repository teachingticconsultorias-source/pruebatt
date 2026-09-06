// api/_lib/errors.js
//
// Errores tipados con mensaje en español apto para el docente.
// El detalle técnico se queda en el log del servidor; al cliente solo
// viaja `message` (redactado) y un `code` estable.

export class AppError extends Error {
  constructor(code, message, status = 500, details = null) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.details = details; // SOLO para logs del servidor, nunca se serializa
  }
}

export const Errors = {
  authRequired: () =>
    new AppError("AUTH_REQUIRED", "Inicia sesión para continuar.", 401),

  sessionExpired: () =>
    new AppError("SESSION_EXPIRED", "Tu sesión venció. Vuelve a iniciar sesión.", 401),

  notAuthorized: () =>
    new AppError("NOT_AUTHORIZED", "No autorizado.", 401),

  methodNotAllowed: () =>
    new AppError("METHOD_NOT_ALLOWED", "Método no permitido.", 405),

  badRequest: (message = "Faltan datos para completar la solicitud.", details = null) =>
    new AppError("BAD_REQUEST", message, 400, details),

  payloadTooLarge: () =>
    new AppError(
      "PAYLOAD_TOO_LARGE",
      "La información enviada es demasiado extensa. Acorta el tema o el contexto.",
      413
    ),

  rateLimited: (retryAfterSeconds = 60) => {
    const error = new AppError(
      "RATE_LIMITED",
      "Estás generando muy rápido. Espera unos segundos y vuelve a intentarlo.",
      429
    );
    error.retryAfterSeconds = retryAfterSeconds;
    return error;
  },

  creditsExhausted: (credits = null) => {
    const error = new AppError(
      "WEEKLY_LIMIT_REACHED",
      "Usaste todas tus creaciones con IA de esta semana.",
      429
    );
    error.credits = credits;
    return error;
  },

  accountInactive: () =>
    new AppError(
      "ACCOUNT_INACTIVE",
      "Tu cuenta está desactivada. Escríbenos para reactivarla.",
      403
    ),

  profileNotFound: () =>
    new AppError(
      "PROFILE_NOT_FOUND",
      "No encontramos tu perfil docente. Cierra sesión y vuelve a entrar.",
      404
    ),

  misconfigured: (what, details = null) =>
    new AppError(
      "MISCONFIGURED",
      "El servicio no está configurado correctamente. Avisa al equipo de SciVerse.",
      500,
      details || what
    ),

  aiUnavailable: (details = null) =>
    new AppError(
      "AI_UNAVAILABLE",
      "El generador no está disponible en este momento. Inténtalo de nuevo en unos minutos.",
      502,
      details
    ),

  aiTimeout: () =>
    new AppError(
      "AI_TIMEOUT",
      "La generación tardó demasiado. Vuelve a intentarlo.",
      504
    ),

  aiIncomplete: () =>
    new AppError(
      "AI_INCOMPLETE",
      "La respuesta llegó incompleta. Vuelve a intentarlo.",
      502
    ),

  internal: (details = null) =>
    new AppError("INTERNAL", "Ocurrió un error inesperado. Inténtalo de nuevo.", 500, details),
};

/**
 * Traduce cualquier error a una respuesta HTTP segura.
 * Nunca filtra mensajes de Postgres, Supabase o Gemini al cliente.
 */
export function sendError(res, error, context = {}) {
  const isApp = error instanceof AppError;
  const status = isApp ? error.status : 500;
  const code = isApp ? error.code : "INTERNAL";
  const message = isApp
    ? error.message
    : "Ocurrió un error inesperado. Inténtalo de nuevo.";

  // El detalle técnico se queda aquí, en el log del servidor.
  const logPayload = {
    code,
    status,
    context,
    detail: isApp ? error.details : error?.message,
  };
  if (status >= 500) console.error("[sciverse:error]", JSON.stringify(logPayload));
  else console.warn("[sciverse:warn]", JSON.stringify(logPayload));

  const body = { error: message, code };
  if (isApp && error.credits) body.credits = error.credits;
  if (isApp && error.retryAfterSeconds) {
    res.setHeader?.("Retry-After", String(error.retryAfterSeconds));
  }
  return res.status(status).json(body);
}


/**
 * Traduce el fallo de una generación a un mensaje que la docente pueda
 * entender, sin filtrar texto de Gemini, PostgREST ni Postgres.
 *
 * Lo usan los dos endpoints que tienen su propio manejo de créditos en línea
 * (generate-linked-worksheet, generate-session-resource). El resto pasa por
 * `sendError`, que ya cumple lo mismo.
 *
 * @param {object} res
 * @param {unknown} error
 * @param {string} pieza      cómo llamar a lo que se intentaba crear
 * @param {boolean} devuelto  si el crédito ya se devolvió, para decírselo
 */
export function sendGenerationError(res, error, pieza = "el material", devuelto = false) {
  const crudo = String(error?.message || "");
  const nota = devuelto ? " No se te descontó ninguna creación." : "";

  // El detalle técnico va al log del servidor, nunca a la respuesta.
  console.error(
    "[sciverse:generation-failed]",
    JSON.stringify({ pieza, status: error?.status ?? null, detail: crudo.slice(0, 300) })
  );

  if (/ACCOUNT_INACTIVE/i.test(crudo)) {
    return res.status(403).json({
      error: "Tu cuenta está desactivada. Escríbenos y la reactivamos.",
      code: "ACCOUNT_INACTIVE",
    });
  }

  if (/AUTH_REQUIRED/i.test(crudo) || error?.status === 401) {
    return res.status(401).json({
      error: "Tu sesión venció. Vuelve a iniciar sesión.",
      code: "AUTH_REQUIRED",
    });
  }

  if (/PROFILE_NOT_FOUND/i.test(crudo)) {
    return res.status(409).json({
      error: "Tu perfil no terminó de crearse. Escríbenos y lo activamos.",
      code: "PROFILE_MISSING",
    });
  }

  // JSON mal formado o respuesta truncada de Gemini.
  if (error instanceof SyntaxError || /MAX_TOKENS|incompleta|no devolvió contenido/i.test(crudo)) {
    return res.status(502).json({
      error: `La respuesta llegó incompleta. Vuelve a intentarlo.${nota}`,
      code: "GENERATION_INCOMPLETE",
    });
  }

  // Fallo transitorio del proveedor: 429/500/503 de Gemini, o timeout.
  if (error?.name === "TimeoutError" || error?.status === 429 || (error?.status >= 500 && error?.status <= 599)) {
    return res.status(503).json({
      error: `No pudimos generar ${pieza} en este momento. Inténtalo de nuevo en unos minutos.${nota}`,
      code: "GENERATION_UNAVAILABLE",
    });
  }

  return res.status(500).json({
    error: `No pudimos generar ${pieza}. Inténtalo nuevamente.${nota}`,
    code: "GENERATION_ERROR",
  });
}

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

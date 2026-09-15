// lib/mensajes.js
//
// LO QUE LEE LA DOCENTE CUANDO ALGO FALLA.
//
// El servidor ya traduce sus errores (`api/_lib/errors.js`): nunca manda un
// stack, ni «MAX_TOKENS», ni el mensaje crudo de Gemini o de Supabase. Lo que
// faltaba estaba en el navegador:
//
//   · un `fetch` que revienta por falta de red no tiene `code` ni `error`, y
//     acababa mostrándose como «Failed to fetch»;
//   · los manejadores lanzaban textos internos —«Módulo incompleto», «Sesión
//     vencida»— que se colaban tal cual a la pantalla;
//   · cada componente inventaba su propia frase para el mismo código.
//
// Aquí está la tabla única. Una regla: el texto dice QUÉ pasó y QUÉ puede
// hacer la docente. Nunca por qué, en términos de máquina.

/** Códigos con los que el servidor dice «esto ya está hecho o en marcha». */
export const CODIGOS_DUPLICADO = new Set([
  "AI_OPERATION_IN_PROGRESS",
  "AI_OPERATION_ALREADY_COMPLETED",
  "DUPLICATE_OPERATION",
]);

const POR_CODIGO = {
  /* ---- idempotencia: no es un error de la docente ---------------------- */
  AI_OPERATION_IN_PROGRESS: "Esta generación ya se está procesando. Espera unos segundos.",
  AI_OPERATION_ALREADY_COMPLETED: "Esta generación ya fue procesada. Revisa el resultado o tu biblioteca.",
  DUPLICATE_OPERATION: "Esta creación ya se está procesando. Espera unos segundos antes de volver a intentarlo.",
  IDEMPOTENCY_KEY_REQUIRED: "Tu sesión quedó desactualizada. Recarga la página y vuelve a intentarlo.",

  /* ---- proveedor de IA ------------------------------------------------- */
  AI_BUSY: "Hay muchas solicitudes en este momento. Intenta nuevamente en unos segundos.",
  AI_UNAVAILABLE: "El servicio de generación no está disponible ahora mismo. Inténtalo en unos minutos.",
  AI_TIMEOUT: "La generación tardó más de lo esperado. Vuelve a intentarlo.",
  AI_BLOCKED: "No pudimos generar este contenido. Prueba a reformular el tema.",
  // Truncado: el presupuesto de la respuesta se agotó. La docente no tiene por
  // qué saber qué es un token; sí tiene que saber que no pierde lo anterior.
  AI_INCOMPLETE: "No pudimos terminar esta parte. Lo que ya está listo se conservará.",
  GENERATION_INCOMPLETE: "No pudimos terminar esta parte. Lo que ya está listo se conservará.",
  GENERATION_UNAVAILABLE: "No pudimos generar esto en este momento. Inténtalo de nuevo en unos minutos.",
  GENERATION_ERROR: "No pudimos completar la generación. Inténtalo nuevamente.",

  /* ---- cuenta y límites ------------------------------------------------ */
  CREDITS_EXHAUSTED: "Usaste todas tus generaciones de esta semana. Se renuevan el lunes.",
  RATE_LIMITED: "Estás generando muy seguido. Espera unos segundos e inténtalo otra vez.",
  PLAN_LIMIT: "Tu plan actual no incluye esta opción.",
  AUTH_REQUIRED: "Tu sesión venció. Vuelve a iniciar sesión.",
  SESSION_EXPIRED: "Tu sesión venció. Vuelve a iniciar sesión.",
  ACCOUNT_INACTIVE: "Tu cuenta está desactivada. Escríbenos y la reactivamos.",
  PROFILE_MISSING: "Tu perfil no terminó de crearse. Escríbenos y lo activamos.",
  FORBIDDEN: "No tienes acceso a esta sección.",
  PAYLOAD_TOO_LARGE: "El texto que enviaste es demasiado largo. Acórtalo e inténtalo otra vez.",
  BAD_REQUEST: "Faltan datos para completar la solicitud.",

  /* ---- del navegador, no del servidor ---------------------------------- */
  SIN_CONEXION: "No tienes conexión a internet. Revísala e inténtalo nuevamente.",
  RED: "Se perdió la conexión. Revisa tu internet e intenta nuevamente.",
  GUARDADO: "Tu material se generó, pero no pudimos guardarlo en Biblioteca. Puedes volver a intentar guardar sin generar de nuevo.",
  DESCARGA: "No pudimos preparar el archivo. Tu material sigue intacto: vuelve a intentar la descarga.",
};

/**
 * Códigos cuyo texto de tabla no dice nada que el servidor no diga mejor.
 *
 * `BAD_REQUEST` es el ejemplo: «Faltan datos» no le dice a nadie QUÉ dato
 * falta, y el servidor lo sabe y lo manda.
 */
const CODIGOS_SIN_DETALLE = new Set(["BAD_REQUEST"]);

const GENERICO = "No pudimos completar la operación. Inténtalo nuevamente.";

/**
 * Cosas que jamás deben verse en pantalla.
 *
 * Si un mensaje trae algo de esto es que se coló un texto interno, y vale más
 * el genérico que una filtración técnica delante de una docente.
 */
const HUELE_A_TECNICO = /MAX_TOKENS|finishReason|\bfetch\b|Failed to|TypeError|SyntaxError|undefined|\[object|supabase|postgres|PGRST|RPC|stack|500\b|502\b|503\b|\bnull\b|JSON/i;

/** ¿El navegador sabe que no hay red? */
export function sinConexion() {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

/** El texto de un código del servidor, o el genérico. */
export function mensajeDeCodigo(codigo, porDefecto = GENERICO) {
  return POR_CODIGO[codigo] || porDefecto;
}

/**
 * Traduce la respuesta del servidor a algo que una docente entienda.
 *
 * Se prefiere el texto del propio servidor cuando lo trae, porque suele ser
 * más específico que la tabla; pero sólo si NO huele a técnico.
 */
export function mensajeDeRespuesta(data, porDefecto = "No pudimos completar la generación.") {
  const codigo = data?.code;
  const delServidor = typeof data?.error === "string" ? data.error.trim() : "";
  const publicable = delServidor && !HUELE_A_TECNICO.test(delServidor);

  // Para los códigos cajón de sastre, el servidor casi siempre sabe más: sabe
  // QUÉ campo falta. La docente veía «Faltan datos para completar la
  // solicitud» mientras el servidor decía «Escribe primero el tema para que
  // Kantu pueda ayudarte». El resto de códigos conservan su texto curado,
  // que existe justamente porque el del servidor era peor.
  if (codigo && CODIGOS_SIN_DETALLE.has(codigo) && publicable) return delServidor;
  if (codigo && POR_CODIGO[codigo]) return POR_CODIGO[codigo];
  if (publicable) return delServidor;
  return porDefecto;
}

/**
 * Traduce CUALQUIER cosa que llegue a un `catch` a una frase publicable.
 *
 * Acepta un Error, una respuesta ya parseada o una cadena. Un `TypeError` de
 * `fetch` sin red es el caso más común y el que peor se veía.
 */
export function mensajeDeError(error, porDefecto = GENERICO) {
  if (sinConexion()) return POR_CODIGO.SIN_CONEXION;
  if (!error) return porDefecto;
  if (typeof error === "object" && (error.code || error.error)) return mensajeDeRespuesta(error, porDefecto);

  const texto = String(error?.message || error || "").trim();
  if (!texto) return porDefecto;
  // `fetch` lanza TypeError sin más detalle cuando la red se corta a mitad.
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(texto)) return POR_CODIGO.RED;
  if (POR_CODIGO[texto]) return POR_CODIGO[texto];
  return HUELE_A_TECNICO.test(texto) ? porDefecto : texto;
}

/** ¿La respuesta dice que la operación ya existía? */
export function esDuplicado(data) {
  return CODIGOS_DUPLICADO.has(data?.code);
}

/**
 * Mensaje de espera según lo que lleva tardando.
 *
 * No se cancela nada por tardar: el servidor tiene sus propios límites. Esto
 * sólo evita que la pantalla parezca colgada y que alguien vuelva a pulsar
 * Generar pensando que no pasó nada.
 */
export function esperaSegun(ms) {
  if (ms >= 45000) return "Estamos terminando los últimos detalles. No necesitas volver a pulsar Generar.";
  if (ms >= 15000) return "Kantu sigue trabajando. Algunas sesiones requieren más tiempo.";
  return "Preparando…";
}

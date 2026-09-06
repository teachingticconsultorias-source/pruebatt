// api/_lib/mailer.js
//
// Envío de correo transaccional de la APLICACIÓN.
//
// POR QUÉ NO SIRVE EL SMTP DE SUPABASE AUTH
// -----------------------------------------
// El SMTP configurado en Supabase Auth manda confirmaciones y recuperaciones
// de contraseña, y sólo eso: lo dispara Auth cuando pasa algo con una cuenta.
// No hay forma de pedirle «manda este aviso al equipo». Son dos canales
// distintos aunque acaben en el mismo buzón, y confundirlos llevaría a
// depender de una API que no existe.
//
// QUÉ HACE ESTE FICHERO
// ---------------------
// Una capa fina sobre proveedores intercambiables. Hoy hay dos:
//
//   resend    · POST a api.resend.com — el más directo desde serverless
//   webhook   · POST de un JSON a la URL que sea (Make, Zapier, n8n…)
//
// Ninguno añade dependencias: los dos son `fetch`. Cambiar de proveedor es
// cambiar una variable de entorno, no reescribir esto.
//
// SI NO HAY NADA CONFIGURADO
// --------------------------
// `sendMail` devuelve `{ sent:false, reason:"not_configured" }` y deja una
// línea en el log. NO lanza. Ninguna función de negocio puede romperse
// porque falte configurar el correo, y ninguna debe comportarse distinto
// según si el aviso salió o no.
//
// QUÉ NO VIAJA EN UN CORREO
// -------------------------
// Ni tokens, ni claves, ni cabeceras, ni identificadores internos de usuario.
// Lo que se manda es lo que un administrador necesita leer para actuar.

const TIMEOUT_MS = 6_000;

/** Destinatario acordado mientras no se defina SCIVERSE_ADMIN_EMAILS. */
const DESTINO_INICIAL = "teachingticconsultorias@gmail.com";

/** Dónde vive el panel. Se usa en el enlace de los avisos. */
export function getAdminUrl() {
  const base = (process.env.SCIVERSE_APP_URL || "https://pruebatt-five.vercel.app")
    .replace(/\/+$/, "");
  return `${base}/?admin=1&seccion=pagos`;
}

/**
 * Configuración efectiva del correo. No devuelve ni un secreto: sólo si
 * están presentes, para poder diagnosticar sin exponer nada.
 */
export function getMailConfig() {
  const provider = (process.env.SCIVERSE_MAIL_PROVIDER || "").trim().toLowerCase();
  const to = (process.env.SCIVERSE_ADMIN_EMAILS || DESTINO_INICIAL)
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

  return {
    provider: provider || "none",
    from: (process.env.SCIVERSE_MAIL_FROM || "").trim(),
    to,
    hasResendKey: Boolean(process.env.RESEND_API_KEY),
    hasWebhook: Boolean(process.env.SCIVERSE_MAIL_WEBHOOK_URL),
  };
}

/**
 * Explica por qué no se puede enviar, o null si sí se puede.
 * Se separa del envío para poder decirlo en el log y en los tests.
 */
export function mailUnavailableReason(cfg = getMailConfig()) {
  if (cfg.provider === "none") return "not_configured";
  if (cfg.to.length === 0) return "no_recipients";
  if (cfg.provider === "resend") {
    if (!cfg.hasResendKey) return "missing_resend_key";
    if (!cfg.from) return "missing_from";
    return null;
  }
  if (cfg.provider === "webhook") {
    if (!cfg.hasWebhook) return "missing_webhook_url";
    return null;
  }
  return "unknown_provider";
}

/**
 * Manda un correo. NUNCA lanza.
 *
 * @param {{subject:string, text:string, html?:string, tag?:string}} mensaje
 * @returns {Promise<{sent:boolean, reason?:string, provider?:string}>}
 */
export async function sendMail({ subject, text, html, tag = "notificacion" }) {
  const cfg = getMailConfig();
  const motivo = mailUnavailableReason(cfg);

  if (motivo) {
    // Log sin secretos: sirve para saber qué falta configurar.
    console.warn("[sciverse:mail-skipped]", JSON.stringify({ tag, reason: motivo, provider: cfg.provider }));
    return { sent: false, reason: motivo, provider: cfg.provider };
  }

  try {
    if (cfg.provider === "resend") {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ from: cfg.from, to: cfg.to, subject, text, html }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      if (!res.ok) {
        const detalle = await res.text().catch(() => "");
        console.error("[sciverse:mail-failed]",
          JSON.stringify({ tag, provider: "resend", status: res.status, detail: detalle.slice(0, 200) }));
        return { sent: false, reason: `http_${res.status}`, provider: "resend" };
      }
    } else {
      const res = await fetch(process.env.SCIVERSE_MAIL_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: cfg.to, subject, text, html, tag }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      if (!res.ok) {
        console.error("[sciverse:mail-failed]",
          JSON.stringify({ tag, provider: "webhook", status: res.status }));
        return { sent: false, reason: `http_${res.status}`, provider: "webhook" };
      }
    }

    console.log("[sciverse:mail-sent]", JSON.stringify({ tag, provider: cfg.provider, destinatarios: cfg.to.length }));
    return { sent: true, provider: cfg.provider };
  } catch (error) {
    // Timeout, DNS, red… nada de esto puede afectar a lo que ya se guardó.
    console.error("[sciverse:mail-failed]",
      JSON.stringify({ tag, provider: cfg.provider, detail: String(error?.message || error).slice(0, 200) }));
    return { sent: false, reason: "transport_error", provider: cfg.provider };
  }
}

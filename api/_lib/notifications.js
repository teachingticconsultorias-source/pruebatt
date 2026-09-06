// api/_lib/notifications.js
//
// Los avisos que el equipo recibe cuando pasa algo que requiere una persona.
//
// Separado del transporte a propósito: `mailer.js` sabe CÓMO se manda algo,
// esto sabe QUÉ se dice. Así se puede cambiar de proveedor sin tocar los
// textos, y cambiar los textos sin tocar la infraestructura.
//
// REGLA DE CONTENIDO
// ------------------
// Un aviso lleva lo que hace falta para decidir, y nada más. Nombre, correo,
// plan, importe, método, referencia y fecha bastan para buscar el pago en
// Yape y aprobarlo. No viajan identificadores internos de usuario, ni el id
// de la solicitud, ni por supuesto nada parecido a un secreto: quien recibe
// el correo no actúa desde el correo, actúa desde el panel.

import { sendMail, getAdminUrl } from "./mailer.js";

const MONEDA = { PEN: "S/", USD: "US$" };

function importe(centimos, moneda = "PEN") {
  const simbolo = MONEDA[moneda] || `${moneda} `;
  return `${simbolo}${((Number(centimos) || 0) / 100).toFixed(2)}`;
}

/** Fecha y hora de Lima, que es donde está el equipo que va a revisarlo. */
export function fechaPeru(valor = new Date()) {
  try {
    return new Intl.DateTimeFormat("es-PE", {
      timeZone: "America/Lima",
      dateStyle: "long",
      timeStyle: "short",
    }).format(valor instanceof Date ? valor : new Date(valor));
  } catch {
    return new Date(valor).toISOString();
  }
}

function escapar(texto) {
  return String(texto ?? "").replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}

/**
 * Aviso de solicitud de pago nueva.
 *
 * NUNCA lanza: se invoca DESPUÉS de que la solicitud ya esté guardada, y una
 * caída del correo no puede tener ningún efecto sobre ella.
 *
 * @returns {Promise<{sent:boolean, reason?:string}>}
 */
export async function notifyNewPaymentRequest({
  nombre, email, plan, montoCentimos, moneda, metodo, referencia, fecha,
}) {
  const panel = getAdminUrl();
  const cuando = fechaPeru(fecha);
  const ref = String(referencia ?? "").trim() || "No indicada";
  const monto = importe(montoCentimos, moneda);
  const quien = String(nombre ?? "").trim() || "Docente sin nombre en su perfil";

  const filas = [
    ["Docente", quien],
    ["Correo", email || "—"],
    ["Plan", plan],
    ["Monto", monto],
    ["Método", metodo],
    ["Referencia", ref],
    ["Estado", "Pendiente"],
    ["Fecha", cuando],
  ];

  const text = [
    "Nueva solicitud de activación.",
    "",
    ...filas.map(([k, v]) => `${k}: ${v}`),
    "",
    `Revisar pago en SciVerse: ${panel}`,
    "",
    "La activación sólo ocurre cuando alguien pulsa Aprobar en el panel.",
  ].join("\n");

  const html = `
<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a">
  <h2 style="font-size:18px;margin:0 0 4px">Nueva solicitud de activación</h2>
  <p style="margin:0 0 20px;color:#555;font-size:14px">Una docente registró un pago y espera verificación.</p>
  <table style="width:100%;border-collapse:collapse;font-size:14px">
    ${filas.map(([k, v]) => `
    <tr>
      <td style="padding:7px 0;color:#666;width:110px;vertical-align:top">${escapar(k)}</td>
      <td style="padding:7px 0;font-weight:600">${escapar(v)}</td>
    </tr>`).join("")}
  </table>
  <p style="margin:24px 0 8px">
    <a href="${escapar(panel)}"
       style="display:inline-block;background:#0F766E;color:#fff;text-decoration:none;
              padding:11px 20px;border-radius:8px;font-weight:600;font-size:14px">
      Revisar pago en SciVerse
    </a>
  </p>
  <p style="margin:16px 0 0;color:#777;font-size:12px;line-height:1.5">
    La activación sólo ocurre cuando alguien pulsa Aprobar en el panel.
    Este correo es un aviso, no una autorización.
  </p>
</div>`.trim();

  return sendMail({
    subject: "🔔 Nuevo pago por verificar — SciVerse Pro",
    text,
    html,
    tag: "payment-request",
  });
}

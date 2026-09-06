// components/account/avisoWhatsApp.js
//
// El aviso por WhatsApp que la docente puede mandar DESPUÉS de registrar su
// solicitud.
//
// QUÉ ES Y QUÉ NO ES
// ------------------
// Es un acelerador, no un canal. La solicitud vive en `payment_requests` y la
// activación sólo ocurre cuando alguien pulsa Aprobar en el panel. Un mensaje
// de WhatsApp no activa nada y no sustituye a nada: por eso este botón sólo
// aparece cuando la solicitud YA está creada.
//
// EL NÚMERO NO ESTÁ AQUÍ
// ----------------------
// Sale de `payment_settings.whatsapp`, que se edita desde Administración. Si
// no está configurado, no hay botón. Nunca se inventa un número: mandar a una
// docente a escribir a un teléfono equivocado es peor que no ofrecer el atajo.
//
// Lógica pura y en `.js` a propósito, para poder probarla sin montar React.

// La normalización NO se reimplementa aquí: es la misma que usa el panel al
// guardar. Dos versiones del mismo criterio acabarían discrepando justo en el
// caso raro, y el caso raro aquí es un botón que no abre nada.
export { normalizarWhatsApp as normalizarNumero } from "../../api/_lib/phone.js";

import { normalizarWhatsApp } from "../../api/_lib/phone.js";

const ETIQUETA_METODO = {
  yape: "Yape",
  plin: "Plin",
  transferencia: "transferencia",
  efectivo: "efectivo",
  otro: "otro medio",
};

function importe(centimos, moneda = "PEN") {
  const simbolo = moneda === "PEN" ? "S/" : `${moneda} `;
  return `${simbolo}${((Number(centimos) || 0) / 100).toFixed(2)}`;
}

/**
 * Texto del mensaje.
 *
 * Lleva lo justo para que el equipo encuentre el pago: plan, importe, método
 * y, si la docente la anotó, la referencia. Nada de correos, identificadores
 * ni datos que el equipo ya tiene en el panel — un mensaje de WhatsApp acaba
 * en el teléfono de alguien y no hace falta que lleve de más.
 *
 * @param {{plan?:string, montoCentimos?:number, moneda?:string, metodo?:string, referencia?:string, metodoEtiqueta?:string}} d
 */
export function construirAvisoWhatsApp({
  plan = "Pro",
  montoCentimos,
  moneda = "PEN",
  metodo = "yape",
  metodoEtiqueta,
  referencia,
} = {}) {
  const via = metodoEtiqueta || ETIQUETA_METODO[metodo] || metodo;
  const ref = String(referencia ?? "").trim();

  const lineas = [
    "Hola Teaching TIC 👋",
    `Acabo de registrar una solicitud para activar SciVerse ${plan} por ${importe(montoCentimos, moneda)} mediante ${via}.`,
    "Mi solicitud ya está registrada en la plataforma.",
  ];

  if (ref) lineas.push(`Referencia: ${ref}`);

  lineas.push("¿Podrían verificar mi pago y activar mi cuenta?", "Gracias.");

  return lineas.join("\n");
}

/**
 * Enlace listo para abrir, o null si no hay número configurado.
 * Devolver null es la señal de «no pintes el botón».
 */
export function enlaceAvisoWhatsApp(whatsapp, datos) {
  const numero = normalizarWhatsApp(whatsapp);
  if (!numero) return null;
  return `https://wa.me/${numero}?text=${encodeURIComponent(construirAvisoWhatsApp(datos))}`;
}

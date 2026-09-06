// api/_lib/phone.js
//
// Normalización del número de WhatsApp. FUENTE ÚNICA: la usa el panel al
// guardar y la usa el flujo de la docente al construir el enlace. Si cada
// lado tuviera su propia versión, acabarían discrepando justo en el caso raro.
//
// Vive en `_lib/` porque ahí ya está probado que Vercel no lo cuenta como
// Serverless Function, y el frontend lo importa igual: es un módulo sin
// dependencias, sin secretos y sin nada de servidor.
//
// EL PROBLEMA QUE RESUELVE
// -----------------------
// El número acordado es 931582435: nueve dígitos, como se escribe en Perú.
// `https://wa.me/931582435` NO abre ese contacto — wa.me exige el número en
// formato internacional. Sin código de país el botón lleva a una pantalla de
// número inválido, que es peor que no tener botón.
//
// Por eso un móvil peruano de nueve dígitos que empieza por 9 se completa con
// el 51. Lo que ya trae código de país se respeta tal cual.

/** Perú. Es el único país donde opera SciVerse hoy. */
export const CODIGO_PAIS_POR_DEFECTO = "51";

/** Móvil peruano tal como lo teclea cualquiera: 9 dígitos empezando por 9. */
const MOVIL_PERUANO = /^9\d{8}$/;

/**
 * Deja el número en formato internacional, sólo dígitos.
 *
 * @param {string} valor  lo que escribió el administrador
 * @returns {string|null} `51931582435`, o null si no es un número utilizable
 */
export function normalizarWhatsApp(valor) {
  const bruto = String(valor ?? "").trim();
  if (!bruto) return null;

  // Un `+` inicial significa «esto ya viene con código de país».
  const internacional = bruto.startsWith("+");
  const digitos = bruto.replace(/\D+/g, "");

  if (!digitos) return null;

  if (!internacional && MOVIL_PERUANO.test(digitos)) {
    return CODIGO_PAIS_POR_DEFECTO + digitos;
  }

  // Rango de la E.164: por debajo de 8 no hay número marcable, por encima de
  // 15 tampoco. Fuera de ahí es basura y no se guarda.
  if (digitos.length < 8 || digitos.length > 15) return null;

  return digitos;
}

/** Para mostrarlo: `+51 931 582 435`. Sólo presentación. */
export function formatearWhatsApp(valor) {
  const n = normalizarWhatsApp(valor);
  if (!n) return "";
  if (n.startsWith(CODIGO_PAIS_POR_DEFECTO) && n.length === 11) {
    const local = n.slice(2);
    return `+51 ${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
  }
  return `+${n}`;
}

/** ¿Se puede guardar? Vacío también vale: significa «todavía no hay número». */
export function whatsappValido(valor) {
  const bruto = String(valor ?? "").trim();
  if (!bruto) return true;
  return normalizarWhatsApp(bruto) !== null;
}

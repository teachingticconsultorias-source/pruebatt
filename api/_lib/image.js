// api/_lib/image.js
//
// Validación de la imagen del QR de pago.
//
// POR QUÉ SE MIRAN LOS BYTES Y NO LA CABECERA
// -------------------------------------------
// El `Content-Type` lo escribe quien sube el fichero. Un .exe renombrado a
// .png llega con `image/png` si el cliente lo dice. Aquí se comprueba la
// FIRMA REAL del fichero (los primeros bytes) y sólo se acepta si coincide
// con uno de los tres formatos permitidos.
//
// POR QUÉ VIAJA EN BASE64 Y AUN ASÍ NO HAY BASE64 EN NINGÚN SITIO
// ---------------------------------------------------------------
// La regla del bloque es que la imagen NO se guarde codificada: ni en
// Postgres ni en Storage. Se cumple — lo que se almacena son los bytes
// originales en un bucket privado, y la base sólo guarda la RUTA.
// El transporte navegador → función es JSON porque el cuerpo binario crudo
// se comporta de forma distinta según cómo esté parseando Vercel cada
// runtime, y un fallo ahí sería invisible hasta producción. La codificación
// se deshace en la primera línea del endpoint.
//
// TRES CERRADURAS PARA LA MISMA PUERTA
//   1. este validador            (formato real + tamaño)
//   2. `allowed_mime_types` y `file_size_limit` del bucket   (Storage)
//   3. sin política de escritura (sólo service_role escribe) (RLS)

import { Errors } from "./errors.js";

/** 2 MB. Un QR de pago no llega ni de lejos; el resto es abuso o error. */
export const MAX_QR_BYTES = 2 * 1024 * 1024;

/** Formatos admitidos, con su firma en los primeros bytes. */
const FIRMAS = [
  { mime: "image/png",  ext: "png",  test: (b) =>
      b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
      b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a },
  { mime: "image/jpeg", ext: "jpg",  test: (b) =>
      b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: "image/webp", ext: "webp", test: (b) =>
      b.length > 12 &&
      b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&   // RIFF
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50 }, // WEBP
];

/**
 * Reconoce el formato real por su firma.
 * @param {Buffer|Uint8Array} bytes
 * @returns {{mime:string, ext:string}|null}
 */
export function sniffImage(bytes) {
  if (!bytes || bytes.length === 0) return null;
  const b = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  for (const f of FIRMAS) {
    if (f.test(b)) return { mime: f.mime, ext: f.ext };
  }
  return null;
}

/**
 * Decodifica y valida la imagen recibida.
 *
 * El mensaje de error es para una persona que está subiendo un QR, no para
 * un desarrollador: dice qué formato hace falta y cuánto puede pesar.
 *
 * @param {string} base64  contenido, con o sin prefijo `data:`
 * @returns {{bytes:Buffer, mime:string, ext:string, size:number}}
 * @throws AppError 400
 */
export function decodeQrUpload(base64) {
  if (typeof base64 !== "string" || base64.trim() === "") {
    throw Errors.badRequest("Elige una imagen para el QR.");
  }

  // Admite tanto "data:image/png;base64,AAAA" como el base64 pelado.
  const limpio = base64.includes(",") ? base64.slice(base64.indexOf(",") + 1) : base64;

  // Se corta antes de decodificar: 4 caracteres base64 son 3 bytes, así que
  // un cuerpo desmesurado se rechaza sin reservar memoria para él.
  if (limpio.length > Math.ceil((MAX_QR_BYTES * 4) / 3) + 4096) {
    throw Errors.badRequest("La imagen supera los 2 MB. Sube una más ligera.");
  }

  let bytes;
  try {
    bytes = Buffer.from(limpio, "base64");
  } catch {
    throw Errors.badRequest("No pudimos leer la imagen. Vuelve a intentarlo.");
  }

  if (bytes.length === 0) {
    throw Errors.badRequest("La imagen llegó vacía. Vuelve a intentarlo.");
  }
  if (bytes.length > MAX_QR_BYTES) {
    throw Errors.badRequest("La imagen supera los 2 MB. Sube una más ligera.");
  }

  const tipo = sniffImage(bytes);
  if (!tipo) {
    throw Errors.badRequest("El archivo debe ser una imagen PNG, JPG o WEBP.");
  }

  return { bytes, mime: tipo.mime, ext: tipo.ext, size: bytes.length };
}

/**
 * Ruta dentro del bucket. El patrón es fijo y la BASE lo vuelve a exigir con
 * una restricción CHECK, así que ni un fallo aquí puede apuntar el QR a un
 * sitio arbitrario.
 */
export function qrObjectPath(method, ext, uuid) {
  return `qr/${method}/${uuid}.${ext}`;
}

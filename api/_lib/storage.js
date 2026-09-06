// api/_lib/storage.js
//
// Acceso a Supabase Storage desde el servidor.
//
// El bucket `payment-assets` es PRIVADO y no tiene ninguna política de
// escritura: la única identidad que puede subir o borrar es `service_role`,
// que sólo existe aquí. El navegador de un docente no puede escribir en él
// aunque conozca la URL.
//
// La lectura sí está abierta a `authenticated` mediante política de SELECT,
// para que la docente pueda firmar una URL temporal del QR desde la
// aplicación sin pasar por una función.

import { Errors } from "./errors.js";

export const PAYMENT_BUCKET = "payment-assets";

/**
 * Sube (o reemplaza) un objeto.
 *
 * @param {{url:string, serviceKey:string, path:string, bytes:Buffer, contentType:string}} o
 */
export async function uploadObject({ url, serviceKey, path, bytes, contentType }) {
  let res;
  try {
    res = await fetch(`${url}/storage/v1/object/${PAYMENT_BUCKET}/${path}`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": contentType,
        "cache-control": "3600",
        "x-upsert": "true",
      },
      body: bytes,
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    throw Errors.internal(`storage upload no respondió: ${error?.message}`);
  }

  if (!res.ok) {
    const detalle = await res.text().catch(() => "");
    // 404 sobre el bucket significa que 008 no pudo crearlo: es un fallo de
    // configuración, no del administrador que está subiendo la imagen.
    if (res.status === 404) {
      throw Errors.misconfigured(`bucket ${PAYMENT_BUCKET} inexistente`, detalle.slice(0, 200));
    }
    throw Errors.internal(`storage upload HTTP ${res.status}: ${detalle.slice(0, 200)}`);
  }
}

/**
 * Borra un objeto. No lanza: se usa para limpiar el QR anterior una vez que
 * el nuevo ya está registrado en la base. Si la limpieza falla, queda un
 * fichero huérfano de unos kilobytes — molesto, no grave, y desde luego
 * preferible a romper la operación que sí importa.
 */
export async function deleteObjectQuietly({ url, serviceKey, path }) {
  if (!path) return false;
  try {
    const res = await fetch(`${url}/storage/v1/object/${PAYMENT_BUCKET}/${path}`, {
      method: "DELETE",
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.warn("[sciverse:storage-orphan]", JSON.stringify({ path, status: res.status }));
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[sciverse:storage-orphan]", JSON.stringify({ path, detail: error?.message }));
    return false;
  }
}

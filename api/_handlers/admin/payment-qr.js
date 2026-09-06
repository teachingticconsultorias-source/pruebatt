// api/admin/payment-qr.js — cargar, reemplazar o quitar el QR de un método.
//
// ORDEN DE LAS OPERACIONES, QUE AQUÍ IMPORTA
// ------------------------------------------
//   1. validar la imagen        (formato real, no la cabecera; ≤ 2 MB)
//   2. subirla con nombre nuevo (nunca se sobrescribe el fichero anterior)
//   3. registrar la ruta en la base, que devuelve la ruta ANTERIOR
//   4. borrar la anterior
//
// El nombre nuevo del paso 2 es lo que hace que el paso 3 sea seguro: si la
// base fallara, el QR que ve la docente seguiría siendo el viejo, intacto.
// Sobrescribir el fichero habría roto la pantalla antes de saber si el
// cambio se guardaba.
//
// El paso 4 puede fallar sin consecuencias: deja un fichero huérfano de unos
// kilobytes, y se registra en el log para poder limpiarlo.

import { randomUUID } from "node:crypto";

import { sendError, Errors } from "../../_lib/errors.js";
import { requireAdmin, callAdminRpc } from "../../_lib/admin.js";
import { clientKey, enforceRateLimit, RateLimits } from "../../_lib/rate-limit.js";
import { decodeQrUpload, qrObjectPath } from "../../_lib/image.js";
import { uploadObject, deleteObjectQuietly } from "../../_lib/storage.js";

const METODOS = new Set(["yape", "plin", "transferencia", "efectivo", "otro"]);

const MENSAJES = [
  [/ADMIN_REQUIRED/i,          403, "Tu cuenta ya no tiene permisos de administración."],
  [/ADMIN_ROLE_INSUFFICIENT/i, 403, "Tu rol permite consultar la configuración, no cambiarla."],
  [/METHOD_NOT_FOUND/i,        404, "Ese método de pago no existe."],
  [/QR_PATH_INVALID/i,         400, "No pudimos registrar esa imagen. Vuelve a subirla."],
];

function traducir(error) {
  const crudo = `${error?.details ?? ""} ${error?.message ?? ""}`;
  for (const [re, status, mensaje] of MENSAJES) {
    if (re.test(crudo)) {
      const e = new Error(mensaje);
      e.status = status;
      e.code = "QR_REJECTED";
      return e;
    }
  }
  return error;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") throw Errors.methodNotAllowed();
    enforceRateLimit({ key: clientKey(req), bucket: "qr-upload", ...RateLimits.adminUpload });

    const admin = await requireAdmin(req, { minRole: "admin" });
    const { method, data, remove } = req.body || {};

    if (!METODOS.has(String(method ?? ""))) {
      throw Errors.badRequest("Método de pago no válido.");
    }

    const comun = { url: admin.url, serviceKey: admin.serviceKey };

    // ---- quitar el QR --------------------------------------------------
    if (remove === true) {
      const r = await callAdminRpc({
        name: "admin_set_payment_qr",
        ...comun,
        body: { p_actor: admin.user.id, p_code: method, p_path: null },
      });
      if (r?.anterior) {
        await deleteObjectQuietly({ url: admin.url, serviceKey: admin.serviceKey, path: r.anterior });
      }
      return res.status(200).json({ ok: true, qr_path: null });
    }

    // ---- 1 · validar ----------------------------------------------------
    const imagen = decodeQrUpload(data);
    const path = qrObjectPath(method, imagen.ext, randomUUID());

    // ---- 2 · subir con nombre nuevo -------------------------------------
    await uploadObject({
      url: admin.url,
      serviceKey: admin.serviceKey,
      path,
      bytes: imagen.bytes,
      contentType: imagen.mime,
    });

    // ---- 3 · registrar y recuperar la ruta anterior ---------------------
    let registro;
    try {
      registro = await callAdminRpc({
        name: "admin_set_payment_qr",
        ...comun,
        body: { p_actor: admin.user.id, p_code: method, p_path: path },
      });
    } catch (error) {
      // La base no aceptó la ruta: el fichero recién subido sobra.
      await deleteObjectQuietly({ url: admin.url, serviceKey: admin.serviceKey, path });
      throw error;
    }

    // ---- 4 · limpiar el anterior ----------------------------------------
    if (registro?.anterior && registro.anterior !== path) {
      await deleteObjectQuietly({
        url: admin.url, serviceKey: admin.serviceKey, path: registro.anterior,
      });
    }

    return res.status(200).json({
      ok: true,
      qr_path: path,
      bytes: imagen.size,
      formato: imagen.mime,
    });
  } catch (error) {
    return sendError(res, traducir(error), { endpoint: "admin/payment-qr" });
  }
}

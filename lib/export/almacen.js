// lib/export/almacen.js
//
// LA MARCA, GUARDADA Y RECUPERADA.
//
// Habla con Supabase: la fila de `export_branding` y los dos ficheros del
// bucket privado `export-templates`. Sin React, para que el exportador pueda
// usarlo sin arrastrar el árbol de componentes.
//
// LA CACHÉ
// --------
// Exportar es lo más frecuente que hace una docente, y la marca no cambia
// entre una descarga y la siguiente. Se resuelve una vez por sesión y se
// reutiliza; `olvidarMarca()` la tira al cerrar sesión o al guardar cambios.
//
// Una pestaña tiene UNA sesión, así que la caché no puede mezclar docentes.
// Aun así se guarda el `user_id` junto al valor y se descarta si no coincide:
// más barato que razonar sobre ello cada vez que alguien toque este fichero.
//
// FALLA HACIA NITIA
// -----------------
// Cualquier problema —sin sesión, sin fila, bucket caído, fichero borrado—
// devuelve la marca de Nitia. Una docente que no puede cargar su logo debe
// seguir descargando su documento, no quedarse sin él.

import { supabase } from "../../supabaseClient.js";
import { MARCA_NITIA, modoEfectivo, normalizarMarca } from "./marca.js";

export const BUCKET = "export-templates";
export const RUTA_PLANTILLA = (uid) => `${uid}/plantilla.docx`;
export const RUTA_LOGO = (uid, extension = "png") => `${uid}/logo.${extension}`;

let cache = null;   // { userId, marca }

/** Tira la caché. Al cerrar sesión y después de cada cambio. */
export function olvidarMarca() {
  cache = null;
}

/** El docente conectado, o null. Lo usa también el hook para armar rutas. */
export async function usuarioActual() {
  const { data } = await supabase.auth.getUser();
  return data?.user || null;
}
const usuario = usuarioActual;

/** ¿Puede este docente usar plantilla propia? Lo decide la base, no el cliente. */
export async function puedePlantillaPropia() {
  try {
    const { data, error } = await supabase.rpc("puede_plantilla_propia");
    if (error) return false;
    return data === true;
  } catch {
    return false;
  }
}

/** La fila cruda de `export_branding`, o null. */
export async function leerConfiguracion() {
  const user = await usuario();
  if (!user) return null;
  const { data, error } = await supabase
    .from("export_branding").select("*").eq("user_id", user.id).maybeSingle();
  if (error) {
    console.warn("[sciverse:export] no se pudo leer la configuración", error.message);
    return null;
  }
  return data || null;
}

/** Crea o actualiza la fila del docente. Devuelve la fila guardada. */
export async function guardarConfiguracion(cambios) {
  const user = await usuario();
  if (!user) throw new Error("Tu sesión venció. Vuelve a iniciar sesión.");
  const { data, error } = await supabase
    .from("export_branding")
    .upsert({ user_id: user.id, ...cambios }, { onConflict: "user_id" })
    .select().single();
  if (error) throw error;
  olvidarMarca();
  return data;
}

/** Sube un fichero al bucket privado. Devuelve su ruta. */
export async function subirArchivo(ruta, archivo, contentType) {
  const { error } = await supabase.storage.from(BUCKET)
    .upload(ruta, archivo, { upsert: true, contentType, cacheControl: "3600" });
  if (error) throw error;
  olvidarMarca();
  return ruta;
}

export async function borrarArchivo(ruta) {
  if (!ruta) return;
  const { error } = await supabase.storage.from(BUCKET).remove([ruta]);
  if (error) throw error;
  olvidarMarca();
}

/** Los bytes de un fichero del bucket, o null si ya no está. */
async function descargarArchivo(ruta) {
  if (!ruta) return null;
  try {
    const { data, error } = await supabase.storage.from(BUCKET).download(ruta);
    if (error || !data) return null;
    return await data.arrayBuffer();
  } catch {
    return null;
  }
}

/** Las medidas reales del logo, para no deformarlo en la cabecera. */
async function medirImagen(bytes, tipo) {
  if (typeof createImageBitmap !== "function") return {};
  try {
    const mapa = await createImageBitmap(new Blob([bytes], { type: tipo }));
    const medidas = { logoAncho: mapa.width, logoAlto: mapa.height };
    mapa.close?.();
    return medidas;
  } catch {
    return {};
  }
}

/**
 * La marca lista para exportar: modo resuelto y ficheros ya descargados.
 *
 * Es lo que `lib/docx/exporters.js` registra con `configurarMarca()`.
 */
export async function marcaVigente() {
  const user = await usuario();
  if (!user) return { ...MARCA_NITIA, modoEfectivo: "nitia" };
  if (cache?.userId === user.id) return cache.marca;

  const fila = await leerConfiguracion();
  const marca = normalizarMarca(fila);
  const puede = marca.modo === "plantilla" ? await puedePlantillaPropia() : false;
  const efectivo = modoEfectivo(marca, { puedePlantilla: puede });

  const resuelta = { ...marca, modoEfectivo: efectivo, puedePlantilla: puede };

  if (efectivo === "plantilla") {
    resuelta.plantillaBytes = await descargarArchivo(marca.plantillaPath);
    // El fichero pudo borrarse desde el panel de Storage: sin bytes no hay
    // plantilla, y se cae al escalón de abajo en vez de exportar en blanco.
    if (!resuelta.plantillaBytes) resuelta.modoEfectivo = modoEfectivo({ ...marca, plantillaPath: null }, { puedePlantilla: puede });
  }
  if (resuelta.modoEfectivo === "colegio" && marca.logoPath) {
    const bytes = await descargarArchivo(marca.logoPath);
    if (bytes) {
      const tipo = marca.logoPath.endsWith(".png") ? "png"
        : marca.logoPath.endsWith(".webp") ? "png" : "jpg";
      Object.assign(resuelta, { logoBytes: bytes, logoTipo: tipo }, await medirImagen(bytes, `image/${tipo}`));
    }
  }

  cache = { userId: user.id, marca: resuelta };
  return resuelta;
}

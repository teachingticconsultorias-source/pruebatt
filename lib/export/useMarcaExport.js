import { useCallback, useEffect, useRef, useState } from "react";

import {
  RUTA_LOGO, RUTA_PLANTILLA, borrarArchivo, guardarConfiguracion, leerConfiguracion,
  olvidarMarca, puedePlantillaPropia, subirArchivo, usuarioActual,
} from "./almacen.js";
import { MAX_LOGO_BYTES, normalizarHex, normalizarMarca, normalizarPosicion } from "./marca.js";
import { MIME_DOCX, comprobarPatcheables, detectarMarcadores, explicarMarcadorCompartido,
  explicarMarcadorRoto, marcadoresConTextoAlLado, marcadoresFaltantes, validarPlantilla } from "./plantilla.js";
import { Paragraph, TextRun } from "docx";
import { mensajeDeError } from "../mensajes.js";

/* ==========================================================================
   LA PANTALLA DE «PERSONALIZAR EXPORT», EN UN HOOK

   Todo el estado y todas las operaciones de la sección, para que el
   componente sólo tenga que pintar. Tres reglas:

     · nada se guarda solo: cada acción es explícita;
     · un fallo deja la configuración anterior intacta y lo dice;
     · el plan lo decide la BASE (`puede_plantilla_propia`), no este hook.
       Aquí sólo se usa para enseñar o no el candado.
   ========================================================================== */

const MIME_LOGO = ["image/png", "image/jpeg", "image/webp"];

export function useMarcaExport() {
  const [fila, setFila] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState(null);   // "logo" | "plantilla" | "modo"
  const [error, setError] = useState("");
  const [puedePlantilla, setPuedePlantilla] = useState(false);
  const vivo = useRef(true);

  useEffect(() => () => { vivo.current = false; }, []);

  const recargar = useCallback(async () => {
    setCargando(true);
    try {
      const [config, permiso] = await Promise.all([leerConfiguracion(), puedePlantillaPropia()]);
      if (!vivo.current) return;
      setFila(config);
      setPuedePlantilla(permiso);
    } finally {
      if (vivo.current) setCargando(false);
    }
  }, []);

  useEffect(() => { recargar(); }, [recargar]);

  const marca = normalizarMarca(fila);

  /** Envuelve una operación: marca ocupado, limpia el error, recarga al final. */
  const operar = useCallback(async (etiqueta, tarea) => {
    setOcupado(etiqueta);
    setError("");
    try {
      await tarea();
      olvidarMarca();
      await recargar();
      return true;
    } catch (fallo) {
      if (vivo.current) setError(mensajeDeError(fallo, "No pudimos guardar el cambio. Inténtalo nuevamente."));
      return false;
    } finally {
      if (vivo.current) setOcupado(null);
    }
  }, [recargar]);

  /** Cambia el modo de exportación. */
  const elegirModo = useCallback((modo) => operar("modo", async () => {
    await guardarConfiguracion({ modo });
  }), [operar]);

  /** Guarda posición y colores del modo simple. */
  const guardarEstilo = useCallback(({ logoPosicion, colorPrimario, colorAcento }) =>
    operar("modo", async () => {
      await guardarConfiguracion({
        logo_posicion: normalizarPosicion(logoPosicion),
        color_primario: normalizarHex(colorPrimario),
        color_acento: normalizarHex(colorAcento),
      });
    }), [operar]);

  /** Sube el logo del colegio. */
  const subirLogo = useCallback((archivo) => operar("logo", async () => {
    if (!archivo) throw new Error("Elige una imagen.");
    if (!MIME_LOGO.includes(archivo.type)) {
      throw new Error("El logo debe ser PNG, JPG o WEBP.");
    }
    if (archivo.size > MAX_LOGO_BYTES) {
      throw new Error(`El logo pesa ${(archivo.size / 1048576).toFixed(1)} MB y el máximo es 1 MB.`);
    }
    const user = await usuarioActual();
    if (!user) throw new Error("Tu sesión venció. Vuelve a iniciar sesión.");
    const extension = archivo.type === "image/jpeg" ? "jpg" : archivo.type === "image/webp" ? "webp" : "png";
    const ruta = RUTA_LOGO(user.id, extension);
    await subirArchivo(ruta, archivo, archivo.type);
    await guardarConfiguracion({ logo_path: ruta, logo_bytes: archivo.size, modo: marca.modo === "nitia" ? "colegio" : marca.modo });
  }), [operar, marca.modo]);

  const quitarLogo = useCallback(() => operar("logo", async () => {
    await borrarArchivo(marca.logoPath);
    await guardarConfiguracion({ logo_path: null, logo_bytes: null });
  }), [operar, marca.logoPath]);

  /**
   * Sube la plantilla .docx.
   *
   * Se valida ANTES de subir: extensión, tamaño, firma ZIP y marcadores. Si la
   * plantilla no trae los mínimos, se rechaza con el motivo concreto en vez de
   * dejar que la docente descubra el documento vacío al exportar.
   */
  const subirPlantilla = useCallback((archivo) => operar("plantilla", async () => {
    const bytes = archivo ? await archivo.arrayBuffer() : null;
    const validacion = validarPlantilla(archivo, bytes);
    if (!validacion.ok) throw new Error(validacion.error);

    const marcadores = await detectarMarcadores(bytes);
    const faltan = marcadoresFaltantes(marcadores);
    if (faltan.length) {
      throw new Error(`A tu plantilla le faltan estas marcas: ${faltan.map((m) => `{{${m}}}`).join(", ")}. Descarga la plantilla base y cópialas donde quieras que aparezca el contenido.`);
    }

    // NO basta con que el texto `{{x}}` exista en el XML. Se comprueba que se
    // pueda sustituir DE VERDAD —parcheo de prueba— y que ningún marcador de
    // bloque comparta párrafo, porque al rellenarlo se comería el texto de al
    // lado. Se hace aquí, UNA vez, y no cada vez que la docente exporta.
    const { rotos } = await comprobarPatcheables(bytes, marcadores, { Paragraph, TextRun });
    if (rotos.length) throw new Error(explicarMarcadorRoto(rotos[0]));

    const compartidos = await marcadoresConTextoAlLado(bytes);
    if (compartidos.length) throw new Error(explicarMarcadorCompartido(compartidos[0]));

    const user = await usuarioActual();
    if (!user) throw new Error("Tu sesión venció. Vuelve a iniciar sesión.");
    const ruta = RUTA_PLANTILLA(user.id);
    await subirArchivo(ruta, archivo, MIME_DOCX);
    await guardarConfiguracion({
      plantilla_path: ruta,
      plantilla_nombre: archivo.name.slice(0, 200),
      plantilla_bytes: archivo.size,
      plantilla_marcadores: marcadores,
      plantilla_subida_en: new Date().toISOString(),
      modo: "plantilla",
    });
  }), [operar]);

  const quitarPlantilla = useCallback(() => operar("plantilla", async () => {
    await borrarArchivo(marca.plantillaPath);
    await guardarConfiguracion({
      plantilla_path: null, plantilla_nombre: null, plantilla_bytes: null,
      plantilla_marcadores: null, plantilla_subida_en: null,
      modo: marca.logoPath ? "colegio" : "nitia",
    });
  }), [operar, marca.plantillaPath, marca.logoPath]);

  return {
    marca, fila, cargando, ocupado, error, puedePlantilla,
    elegirModo, guardarEstilo, subirLogo, quitarLogo, subirPlantilla, quitarPlantilla,
    recargar,
  };
}

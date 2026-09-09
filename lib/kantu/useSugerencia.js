import { useCallback, useEffect, useRef, useState } from "react";

import { construirContextoKantu, tieneTema } from "./contexto.js";
import { mensajeDeRespuesta } from "../idempotencia.js";

/* ==========================================================================
   PEDIRLE UNA SUGERENCIA A KANTU

   Cuatro sitios de la aplicación hacían esto por su cuenta, y ninguno igual:
   uno guardaba el estado en una cadena, otro en un booleano, otro no
   comprobaba nada y el de la sopa de letras ni siquiera llamaba a Kantu.
   Tres mostraban el resultado escribiendo directamente sobre el formulario y
   el cuarto lo anunciaba con un `alert` del navegador.

   Aquí está una vez y con las reglas del encargo:

     · el contexto sale de `contexto.js`, así que Kantu ve TODO lo que la
       docente ya escribió en esa herramienta, no un campo suelto;
     · mientras hay una petición en marcha el botón no acepta otra;
     · el mensaje de espera cambia si tarda, en vez de quedarse congelado;
     · el formulario NO se toca hasta que alguien pulsa «Usar»;
     · los errores se cuentan en español, sin códigos ni JSON.
   ========================================================================== */

/** A partir de aquí conviene decir que sigue trabajando, no que se colgó. */
const TARDA_MS = 6000;

const ESPERA_INICIAL = "Buscando ideas para tu tema…";
const ESPERA_LARGA = "Kantu sigue trabajando…";

const SIN_TEMA = "Escribe primero el tema para que Kantu pueda ayudarte.";
const GENERICO = "No pudimos generar una sugerencia en este momento.";
const REINTENTO = "Inténtalo nuevamente en unos segundos.";

/**
 * @param {object} config
 * @param {string} config.herramienta   clave de CAMPOS_POR_HERRAMIENTA
 * @param {string} config.endpoint      ruta de la API que atiende la sugerencia
 * @param {() => Promise<string>} config.obtenerToken
 * @param {(aviso:{tone:string,title:string,description?:string}) => void} config.avisar
 */
export function useSugerenciaKantu({ herramienta, endpoint, obtenerToken, avisar }) {
  const [campoActivo, setCampoActivo] = useState(null);
  const [espera, setEspera] = useState(ESPERA_INICIAL);
  const [propuesta, setPropuesta] = useState(null);

  // Guarda del doble clic. Se usa una referencia y no el estado porque dos
  // clics seguidos ocurren antes de que React vuelva a pintar.
  const enCurso = useRef(false);
  const ultimaPeticion = useRef(null);
  const vivo = useRef(true);

  useEffect(() => () => { vivo.current = false; }, []);

  const cerrar = useCallback(() => setPropuesta(null), []);

  const pedir = useCallback(async (campo, form, opciones = {}) => {
    if (enCurso.current) return;

    const contexto = construirContextoKantu(herramienta, form);
    // El tema es lo que ancla la respuesta. Sin él, Kantu contesta algo
    // genérico que no le sirve a nadie, así que se dice antes de gastar la
    // llamada. Sólo se exige donde el contexto no lo suple.
    if (opciones.exigeTema !== false && !tieneTema(contexto)) {
      avisar?.({ tone: "warning", title: SIN_TEMA });
      return;
    }

    enCurso.current = true;
    setCampoActivo(campo);
    setEspera(ESPERA_INICIAL);

    const aviso = window.setTimeout(() => {
      if (vivo.current) setEspera(ESPERA_LARGA);
    }, TARDA_MS);

    ultimaPeticion.current = { campo, form, opciones };

    try {
      const token = await obtenerToken();
      const respuesta = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token || ""}`,
        },
        // `form` sigue viajando por compatibilidad con el respaldo del
        // servidor; `contexto` es lo que de verdad se usa.
        body: JSON.stringify({ mode: "suggestion", field: campo, form, contexto }),
      });
      const datos = await respuesta.json().catch(() => ({}));

      if (!respuesta.ok) throw new Error(mensajeDeRespuesta(datos, GENERICO));

      // Dos formas y sólo dos: una lista (`items`) o un párrafo
      // (`suggestion`). Ver CAMPOS_DE_LISTA en api/generate-session.js.
      const lista = Array.isArray(datos.items) ? datos.items.filter(Boolean) : null;
      const texto = typeof datos.suggestion === "string" ? datos.suggestion.trim() : "";

      if (!lista?.length && !texto) throw new Error(GENERICO);

      if (vivo.current) {
        setPropuesta({
          campo,
          lista,
          sugerencia: texto || null,
          // Sólo se advierte de que se pierde algo cuando de verdad hay algo.
          // `destino` permite que la propuesta caiga en un campo distinto del
          // que se pidió: la ficha de trabajo sugiere «enfoque» y lo escribe
          // en «contexto», porque es el campo que existe en su formulario.
          reemplaza: Boolean(String(form?.[opciones.destino || campo] ?? "").trim()),
        });
      }
    } catch (error) {
      if (vivo.current) {
        avisar?.({
          tone: "error",
          title: error?.message || GENERICO,
          description: REINTENTO,
        });
      }
    } finally {
      window.clearTimeout(aviso);
      enCurso.current = false;
      if (vivo.current) setCampoActivo(null);
    }
  }, [herramienta, endpoint, obtenerToken, avisar]);

  /** «Volver a sugerir»: la misma petición, sin tener que cerrar el modal. */
  const reintentar = useCallback(() => {
    const ultima = ultimaPeticion.current;
    if (!ultima) return;
    setPropuesta(null);
    pedir(ultima.campo, ultima.form, ultima.opciones);
  }, [pedir]);

  return {
    /** Campo que se está pidiendo ahora mismo, o null. */
    campoActivo,
    /** Mensaje de espera, que cambia si tarda. */
    espera,
    /** `{campo, palabras, sugerencia, reemplaza}` cuando hay algo que revisar. */
    propuesta,
    pedir,
    reintentar,
    cerrar,
  };
}

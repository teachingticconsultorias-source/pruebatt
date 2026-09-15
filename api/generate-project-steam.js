// api/generate-project-steam.js
//
// Generador de proyectos STEAM (1 a 4 semanas).
//
// Este archivo se generaba en cada build desde una cadena dentro de
// `apply-sciverse-v2.mjs`; desde el Bloque A está versionado y es revisable.
//
// CAMBIOS (Bloque B):
//   • Consume 1 crédito por proyecto generado (antes: ninguno).
//   • Devuelve el crédito automáticamente si la generación falla.
//   • Limitación de ráfagas.
//   • Validación de tamaño de entrada.
//   • Modelo y llamada a Gemini centralizados en `_lib/gemini.js`.
//   • Errores en español, sin filtrar el mensaje crudo del proveedor.
//
// Los prompts pedagógicos NO se han modificado.

import { Errors, sendError } from "./_lib/errors.js";
import { requireUser } from "./_lib/supabase.js";
import { generateJson } from "./_lib/gemini.js";
import { withCredit } from "./_lib/credits.js";
import { revisarFormulario } from "../lib/ui/validaciones.js";
import { cantidadPermitida, planEfectivo } from "./_lib/entitlements.js";
import { claveObligatoria } from "./_lib/idempotency.js";
import { bloqueDeContexto } from "./_lib/contexto-sugerencia.js";
import { clientKey, enforceRateLimit, RateLimits } from "./_lib/rate-limit.js";

const SUGGESTION_SCHEMA={type:"object",properties:{suggestion:{type:"string"}},required:["suggestion"]};
const PROJECT_SCHEMA={
  type:"object",
  properties:{
    titulo:{type:"string"},
    situacionSignificativa:{type:"string"},
    reto:{type:"string"},
    integracionSTEAM:{type:"array",items:{type:"object",properties:{area:{type:"string"},aporte:{type:"string"}},required:["area","aporte"]}},
    competencias:{type:"array",items:{type:"object",properties:{area:{type:"string"},competencia:{type:"string"}},required:["area","competencia"]}},
    productoEsperado:{type:"string"},
    evidencias:{type:"array",items:{type:"string"}},
    rutaSemanas:{type:"array",items:{type:"object",properties:{semana:{type:"integer"},titulo:{type:"string"},proposito:{type:"string"},actividades:{type:"array",items:{type:"string"}},evidencia:{type:"string"}},required:["semana","titulo","proposito","actividades","evidencia"]}},
    sesiones:{type:"array",items:{type:"object",properties:{titulo:{type:"string"},competencia:{type:"string"},actividadCentral:{type:"string"},evidencia:{type:"string"},criterios:{type:"array",items:{type:"string"}},instrumento:{type:"string"}},required:["titulo","competencia","actividadCentral","evidencia","criterios","instrumento"]}}
  },
  required:["titulo","situacionSignificativa","reto","integracionSTEAM","competencias","productoEsperado","evidencias","rutaSemanas","sesiones"]
};

const SYSTEM_INSTRUCTION =
  "Eres especialista peruano en CNEB y proyectos STEAM. No conviertas proyectos en sesiones.";

const MAX_BODY_CHARS = 40_000;

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") throw Errors.methodNotAllowed();

    const auth = await requireUser(req);
    const rlKey = clientKey(req, auth.user.id);

    if (JSON.stringify(req.body || {}).length > MAX_BODY_CHARS) {
      throw Errors.payloadTooLarge();
    }

    const { mode = "generate", field, form = {} } = req.body || {};

    // El formulario se comprobaba sólo en el navegador. Va antes de
    // `withCredit` —y antes incluso de consultar el plan— para que un cuerpo
    // incompleto no gaste una generación de la semana. Las sugerencias de
    // campo no pasan por aquí: son baratas y no cobran.
    //
    // `duracionSemanas` queda fuera del contrato a propósito: el servidor ya
    // la recorta según el plan en vez de rechazarla.
    if (mode !== "suggestion") {
      const faltaAlgo = revisarFormulario("steam", form);
      if (faltaAlgo) return res.status(400).json({ error: faltaAlgo, code: "BAD_REQUEST" });
    }

    // La duración la limita el plan, no el navegador: Free llega a 2 semanas,
    // Pro a 4. Se recorta en vez de rechazar — si la interfaz se quedó con un
    // valor viejo, entregar un proyecto de 2 semanas es mejor servicio que un
    // error a mitad del formulario.
    const entitlements = await planEfectivo(auth);
    const weeks = cantidadPermitida(form.duracionSemanas, {
      minimo: 1,
      limite: entitlements.capacidades.steam_max_weeks,
      porDefecto: Math.min(2, entitlements.capacidades.steam_max_weeks),
    }).valor;

    // ---------- Sugerencia de un campo: barata, no consume crédito ----------
    if (mode === "suggestion") {
      enforceRateLimit({ key: rlKey, bucket: "ai-suggestion", ...RateLimits.aiSuggestion });

      const instructions={
        situacion:"Redacta una situación significativa auténtica y cercana al contexto del estudiante. Debe presentar un problema o necesidad que dé sentido al proyecto, sin inventar datos locales específicos.",
        reto:"Formula una sola pregunta guía retadora, abierta, comprensible para el grado y que conduzca a crear una solución o producto.",
        producto:"Propón un producto final concreto, construible, observable y adecuado al grado, relacionado con la situación significativa.",
        evidencias:"Propón entre 3 y 5 evidencias concretas del proceso y producto: bocetos, registros, pruebas, prototipo, explicación, exposición u otras pertinentes."
      };
      if (!instructions[field]) throw Errors.badRequest("Campo de sugerencia no válido.");

      // El contexto lo elige el navegador (`lib/kantu/contexto.js`) y aquí sólo
      // se vuelca. Antes este prompt enumeraba cinco campos a mano, así que al
      // pedir «sugerir evidencias» Kantu no veía el producto ni el reto que la
      // docente acababa de escribir. Si llega vacío —pestaña vieja— se cae a
      // los campos de siempre.
      const bloqueKantu = bloqueDeContexto(req.body?.contexto) || `
Nivel: ${form.nivel}. Grado: ${form.grado}. Región: ${form.region||"No indicada"}.
Tema: ${form.tema||"No indicado"}. Situación actual: ${form.situacion||""}.
Áreas STEAM: ${(form.areasSTEAM||[]).join(", ")}.`;

      const prompt=`Eres especialista peruano en CNEB y metodología STEAM.
${bloqueKantu}
${instructions[field]}

Devuelve únicamente un objeto JSON con esta forma exacta:
{"suggestion": "el texto listo para pegar en el formulario"}
Sin markdown, sin bloques de código y sin ningún texto fuera del JSON.`;

      // Sugerencias breves: pensamiento al mínimo.
      //
      // MEDIDO EN PRODUCCIÓN, no supuesto: con maxOutputTokens=900 el modelo
      // gastó 860 tokens pensando y sólo 22 escribiendo, terminó en MAX_TOKENS
      // y la sugerencia llegó cortada a 112 caracteres. Los tokens de
      // pensamiento salen del MISMO presupuesto que la respuesta, así que la
      // solución no es un presupuesto mayor: es no gastarlo razonando sobre
      // una tarea que no lo necesita.
      //
      // `gemini-3.6-flash` se controla con `thinkingLevel`, cuyo valor por
      // defecto es `medium`. `minimal` es lo más bajo que admite: no existe un
      // apagado real, así que se espera algún token de pensamiento, no cero.
      //
      // El presupuesto se mantiene en 900 a propósito. Si con `minimal` no
      // bastara, el log lo dirá y se sube con criterio, no por si acaso.
      const { data } = await generateJson({
        prompt,
        responseSchema: SUGGESTION_SCHEMA,
        maxOutputTokens: 900,
        thinkingLevel: "minimal",
        tool: `steam-sugerencia:${field}`,
      });
      return res.status(200).json(data);
    }

    // ---------- Proyecto completo: 1 crédito ----------
    enforceRateLimit({ key: rlKey, bucket: "ai-generation", ...RateLimits.aiGeneration });

    if (!(form.areasSTEAM || []).length || !form.tema || !form.situacion) {
      throw Errors.badRequest("Falta información del proyecto.");
    }

    const prompt=`Actúa como especialista peruano en CNEB, aprendizaje basado en proyectos y metodología STEAM.

Diseña un PROYECTO STEAM, no una sesión de aprendizaje.

DATOS DEL DOCENTE:
Nivel: ${form.nivel}
Grado: ${form.grado}
Sección: ${form.seccion||"No indicada"}
Región: ${form.region}
Duración TOTAL: ${weeks} semana(s). Debes producir exactamente ${weeks} elementos en rutaSemanas y nunca más de 4.
Tema o título provisional: ${form.tema}
Situación significativa proporcionada: ${form.situacion}
Reto propuesto: ${form.reto||"Formúlalo"}
Áreas STEAM seleccionadas: ${(form.areasSTEAM||[]).join(" | ")}
Área curricular principal: ${form.areaCurricular}
Competencia CNEB principal, conservar literalmente: ${form.competencia}
Capacidades seleccionadas: ${(form.capacidades||[]).join(" | ")}
Producto esperado: ${form.producto}
Evidencias propuestas: ${form.evidencias}
Recursos disponibles: ${form.recursos||"materiales accesibles del entorno"}

REGLAS:
- No lo estructures como Inicio, Desarrollo y Cierre de una sola clase.
- Organiza el proyecto por semanas.
- En integracionSTEAM incluye solo las áreas STEAM seleccionadas y explica su aporte real.
- Conserva literalmente la competencia CNEB principal. Puedes incorporar otras competencias únicamente si pertenecen claramente a las áreas curriculares y son pertinentes; evita inventar competencias.
- El producto debe responder al reto.
- Las evidencias deben mostrar proceso y producto.
- La ruta semanal debe mostrar progresión: comprender el problema, investigar/diseñar, construir/probar/mejorar y comunicar, adaptando las fases al número de semanas.
- Genera entre ${weeks*2} y ${weeks*3} sesiones breves dentro de "sesiones".
- Cada sesión debe incluir competencia, actividad central, evidencia, criterios observables e instrumento sugerido.
- Usa lenguaje claro y aplicable por docentes peruanos.
- Devuelve únicamente JSON válido.`;

    const { result, credits } = await withCredit(
      { token: auth.token, url: auth.url, key: auth.key,
        reason: "generate-project-steam",
        idempotencyKey: claveObligatoria(req) },
      () =>
        generateJson({
          prompt,
          systemInstruction: SYSTEM_INSTRUCTION,
          responseSchema: PROJECT_SCHEMA,
          maxOutputTokens: 7500,
          tool: "steam-proyecto",
        })
    );

    const project = result.data;
    project.rutaSemanas = (project.rutaSemanas || []).slice(0, weeks);

    return res.status(200).json({ project, model: result.model, _credits: credits });
  } catch (error) {
    return sendError(res, error, { endpoint: "generate-project-steam" });
  }
}

// api/generate-session-resource.js
// SciVerse V2 — recursos de una sesión con flujo tipo asistente.
// Tipos:
// Instrumentos: rubric, checklist, observation_guide, rating_scale
// Materiales: worksheet, reading, questionnaire

import { getGeminiModel } from "./_lib/gemini.js";
import { clientKey, enforceRateLimit, RateLimits } from "./_lib/rate-limit.js";
import { sendGenerationError } from "./_lib/errors.js";

const GEMINI_MODEL = getGeminiModel();

const SCHEMAS = {
  rubric: {
    type: "object",
    properties: {
      titulo: { type: "string" },
      competencia: { type: "string" },
      evidencia: { type: "string" },
      criterios: {
        type: "array",
        items: {
          type: "object",
          properties: {
            capacidad: { type: "string" },
            criterio: { type: "string" },
            ad: { type: "string" },
            a: { type: "string" },
            b: { type: "string" },
            c: { type: "string" }
          },
          required: ["capacidad","criterio","ad","a","b","c"]
        }
      }
    },
    required: ["titulo","competencia","evidencia","criterios"]
  },
  checklist: {
    type: "object",
    properties: {
      titulo: { type: "string" },
      competencia: { type: "string" },
      evidencia: { type: "string" },
      criterios: {
        type: "array",
        items: {
          type: "object",
          properties: {
            capacidad: { type: "string" },
            criterio: { type: "string" }
          },
          required: ["capacidad","criterio"]
        }
      }
    },
    required: ["titulo","competencia","evidencia","criterios"]
  },
  observation_guide: {
    type: "object",
    properties: {
      titulo: { type: "string" },
      competencia: { type: "string" },
      evidencia: { type: "string" },
      situacionObservacion: { type: "string" },
      indicadores: {
        type: "array",
        items: {
          type: "object",
          properties: {
            aspecto: { type: "string" },
            indicador: { type: "string" }
          },
          required: ["aspecto","indicador"]
        }
      }
    },
    required: ["titulo","competencia","evidencia","situacionObservacion","indicadores"]
  },
  rating_scale: {
    type: "object",
    properties: {
      titulo: { type: "string" },
      competencia: { type: "string" },
      evidencia: { type: "string" },
      tipoEscala: { type: "string", enum: ["logro","frecuencia"] },
      niveles: { type: "array", items: { type: "string" } },
      criterios: {
        type: "array",
        items: {
          type: "object",
          properties: {
            capacidad: { type: "string" },
            criterio: { type: "string" }
          },
          required: ["capacidad","criterio"]
        }
      }
    },
    required: ["titulo","competencia","evidencia","tipoEscala","niveles","criterios"]
  },
  worksheet: {
    type: "object",
    properties: {
      titulo: { type: "string" },
      tipoFicha: { type: "string" },
      propositoEstudiante: { type: "string" },
      instrucciones: { type: "string" },
      secciones: {
        type: "array",
        items: {
          type: "object",
          properties: {
            titulo: { type: "string" },
            indicacion: { type: "string" },
            actividades: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  tipo: { type: "string", enum: ["pregunta","respuesta_larga","tabla","lista","pasos","texto"] },
                  texto: { type: "string" },
                  opciones: { type: "array", items: { type: "string" } },
                  columnas: { type: "array", items: { type: "string" } }
                },
                required: ["tipo","texto","opciones","columnas"]
              }
            }
          },
          required: ["titulo","indicacion","actividades"]
        }
      },
      metacognicion: { type: "array", items: { type: "string" } }
    },
    required: ["titulo","tipoFicha","propositoEstudiante","instrucciones","secciones","metacognicion"]
  },
  reading: {
    type: "object",
    properties: {
      titulo: { type: "string" },
      tipoTexto: { type: "string" },
      proposito: { type: "string" },
      texto: { type: "string" },
      vocabulario: {
        type: "array",
        items: {
          type: "object",
          properties: { palabra: { type: "string" }, significado: { type: "string" } },
          required: ["palabra","significado"]
        }
      },
      preguntas: {
        type: "array",
        items: {
          type: "object",
          properties: {
            nivel: { type: "string", enum: ["literal","inferencial","critico"] },
            pregunta: { type: "string" }
          },
          required: ["nivel","pregunta"]
        }
      }
    },
    required: ["titulo","tipoTexto","proposito","texto","vocabulario","preguntas"]
  },
  questionnaire: {
    type: "object",
    properties: {
      titulo: { type: "string" },
      instrucciones: { type: "string" },
      preguntas: {
        type: "array",
        items: {
          type: "object",
          properties: {
            numero: { type: "integer" },
            tipo: { type: "string", enum: ["opcion_multiple","verdadero_falso","respuesta_corta","respuesta_abierta"] },
            pregunta: { type: "string" },
            opciones: { type: "array", items: { type: "string" } },
            respuestaEsperada: { type: "string" }
          },
          required: ["numero","tipo","pregunta","opciones","respuestaEsperada"]
        }
      }
    },
    required: ["titulo","instrucciones","preguntas"]
  }
};

function arr(v){ return Array.isArray(v) ? v : []; }

function context(body){
  const form = body.form || {};
  const s = body.session || {};
  return {
    nivel: form.nivel || s.nivel || "",
    grado: form.grado || s.grado || "",
    area: form.area || s.area || "",
    tema: form.tema || s.titulo || "",
    proposito: form.proposito || s.proposito || "",
    competencia: form.competencia || s.competencia || arr(s.competenciasCNEB)[0] || "",
    capacidades: arr(form.capacidades).length ? form.capacidades : arr(s.capacidadesCNEB),
    evidencia: form.evidencia || s.evidencia || "",
    criterios: arr(form.criteriosBase).length ? form.criteriosBase : arr(s.criteriosEvaluacion),
    region: form.region || ""
  };
}

function prompt(type, c, options={}){
  const n = Math.min(Math.max(Number(options.numeroCriterios || 4), 3), 8);
  const base = `
Actúa como especialista peruano en CNEB, evaluación formativa y diseño de materiales.
El recurso se crea a partir de una sesión YA DISEÑADA.

DATOS:
Nivel: ${c.nivel}
Grado: ${c.grado}
Área: ${c.area}
Tema: ${c.tema}
Propósito: ${c.proposito}
Competencia: ${c.competencia}
Capacidades: ${c.capacidades.join(" | ")}
Evidencia: ${c.evidencia}
Criterios de la sesión: ${JSON.stringify(c.criterios)}
Región/contexto: ${c.region}

Reglas:
- No inventes competencias ni capacidades.
- Mantén coherencia con la sesión.
- Adecuar lenguaje al grado.
- No incluyas explicaciones técnicas.
- Devuelve únicamente JSON válido según el esquema.
`;

  if(type==="rubric") return `${base}
Genera una RÚBRICA ANALÍTICA con exactamente ${n} criterios.
Cada descriptor AD/A/B/C debe mostrar progresión observable real.
Evita adjetivos vagos. Conserva los criterios existentes cuando sean pertinentes.`;

  if(type==="checklist") return `${base}
Genera una LISTA DE COTEJO con exactamente ${n} criterios observables.
El criterio debe iniciar con verbo observable y estar ligado a la evidencia.
El documento final añadirá Sí / No / Observaciones.`;

  if(type==="observation_guide") return `${base}
Genera una GUÍA DE OBSERVACIÓN con exactamente ${n} indicadores.
Debe servir para observar una actuación, procedimiento, participación o desempeño durante la clase.
Incluye una situación de observación clara y aspectos observables.
No convertirla en rúbrica.`;

  if(type==="rating_scale") return `${base}
Genera una ESCALA DE VALORACIÓN con exactamente ${n} criterios.
Tipo solicitado: ${options.scaleType==="frecuencia" ? "frecuencia" : "nivel de logro"}.
Frecuencia: Nunca, A veces, Casi siempre, Siempre.
Logro: Inicio, En proceso, Logrado, Destacado.`;

  if(type==="worksheet") return `${base}
Genera una FICHA DE TRABAJO PARA EL ESTUDIANTE.
No debe parecer planificación docente.
Debe tener 3 a 5 secciones con actividades listas para responder.
Adapta el tipo de ficha al área:
Ciencia y Tecnología: indagación/investigación/diseño.
Comunicación: comprensión/producción.
Matemática: resolución de problemas.
Personal Social: análisis/reflexión.
Incluye espacios de respuesta y tabla cuando sea pedagógicamente útil.
Finaliza con metacognición.`;

  if(type==="reading") return `${base}
Genera una LECTURA PEDAGÓGICA original y adecuada al grado, vinculada al propósito.
Extensión aproximada: ${options.readingLength || "media"}.
Incluye vocabulario breve y preguntas de comprensión literal, inferencial y crítica.
No copies textos protegidos ni atribuyas a autores reales.`;

  return `${base}
Genera un CUESTIONARIO de ${Math.min(Math.max(Number(options.questionCount || 8),5),15)} preguntas.
Mezcla opción múltiple, verdadero/falso, respuesta corta y abierta cuando sea pertinente.
Debe evaluar lo que realmente se trabajó en la sesión.
Incluye respuesta esperada para uso docente, aunque la interfaz del estudiante no la muestre.`;
}

async function rpc(name, token, url, key, body = {}){
  const r = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method:"POST",
    headers:{"Content-Type":"application/json",apikey:key,Authorization:`Bearer ${token}`},
    body: JSON.stringify(body)
  });
  const d = await r.json().catch(()=>({}));
  if(!r.ok){ const e=new Error(d?.message || `Error ${name}`); e.status=r.status; throw e; }
  return d;
}

export default async function handler(req,res){
  if(req.method!=="POST") return res.status(405).json({error:"Método no permitido"});

  const apiKey=process.env.GEMINI_API_KEY;
  const supabaseUrl=process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey=process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const token=req.headers.authorization?.replace(/^Bearer\s+/i,"");
  const type=req.body?.type;

  if(!SCHEMAS[type]) return res.status(400).json({error:"Tipo de recurso no válido"});
  if(!apiKey) return res.status(500).json({error:"Falta GEMINI_API_KEY"});
  if(!token || !supabaseUrl || !supabaseKey) return res.status(401).json({error:"Inicia sesión para continuar"});

  let consumptionId=null;
  try{
    const auth=await fetch(`${supabaseUrl}/auth/v1/user`,{headers:{apikey:supabaseKey,Authorization:`Bearer ${token}`}});
    if(!auth.ok) return res.status(401).json({error:"Tu sesión venció. Vuelve a iniciar sesión."});
    // Limitación de ráfagas (best-effort por instancia; ver _lib/rate-limit.js).
    enforceRateLimit({ key: clientKey(req), bucket: "ai-generation", ...RateLimits.aiGeneration });


    const quota=await rpc("consume_ai_credit",token,supabaseUrl,supabaseKey);
    if(!quota?.ok) return res.status(429).json({
      // El número de creaciones sale del plan, no de un literal: desde 003
      // el límite lo define public.plans y puede no ser 5.
      error:"Ya usaste tus creaciones de esta semana. Se renuevan el lunes.",
      code:quota?.reason || "WEEKLY_LIMIT_REACHED",
      credits:quota
    });
    consumptionId=quota.consumption_id;

    const c=context(req.body||{});
    const p=prompt(type,c,req.body?.options||{});
    const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,{
      method:"POST",
      headers:{"Content-Type":"application/json","x-goog-api-key":apiKey},
      body:JSON.stringify({
        contents:[{parts:[{text:p}]}],
        systemInstruction:{parts:[{text:"Eres especialista peruano en CNEB. Entrega JSON válido y pedagógicamente aplicable."}]},
        generationConfig:{
          maxOutputTokens:type==="worksheet"||type==="reading"?6000:4500,
          responseMimeType:"application/json",
          responseSchema:SCHEMAS[type]
        }
      })
    });
    const data=await r.json();
    if(!r.ok) throw Object.assign(new Error(data?.error?.message || "Error de Gemini"),{status:r.status});
    const candidate=data?.candidates?.[0];
    const text=candidate?.content?.parts?.map(x=>x.text).join("") || "";
    if(!text) throw new Error("Gemini no devolvió contenido");
    if(candidate?.finishReason==="MAX_TOKENS") throw new Error("El recurso quedó incompleto. Intenta nuevamente.");
    const resource=JSON.parse(text);
    return res.status(200).json({resource,type,_credits:quota,model:GEMINI_MODEL});
  }catch(e){
    if(consumptionId){
      await rpc("refund_ai_credit",token,supabaseUrl,supabaseKey,
                {p_consumption:consumptionId}).catch(()=>{});
    }
    return sendGenerationError(res, e, "el recurso", Boolean(consumptionId));
  }
}

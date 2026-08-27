// api/generate-session-resource.js
// SciVerse | Teaching TIC
//
// Genera recursos complementarios a partir de una sesión:
//   worksheet    -> ficha de aprendizaje
//   rubric       -> rúbrica analítica
//   checklist    -> lista de cotejo
//   rating_scale -> escala de valoración
//
// Cada generación consume 1 crédito semanal.
// Si Gemini falla, el crédito se devuelve automáticamente.

const GEMINI_MODEL =
  process.env.GEMINI_MAIN_MODEL || "gemini-3.6-flash";

const schemas = {
  worksheet: {
    type: "object",
    properties: {
      titulo: { type: "string" },
      subtitulo: { type: "string" },
      tipoFicha: { type: "string" },
      proposito: { type: "string" },
      indicacionGeneral: { type: "string" },
      secciones: {
        type: "array",
        items: {
          type: "object",
          properties: {
            titulo: { type: "string" },
            indicacion: { type: "string" },
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  tipo: {
                    type: "string",
                    enum: ["texto", "pregunta", "respuesta_larga", "tabla", "pasos", "lista"]
                  },
                  texto: { type: "string" },
                  opciones: { type: "array", items: { type: "string" } },
                  columnas: { type: "array", items: { type: "string" } },
                  filas: {
                    type: "array",
                    items: { type: "array", items: { type: "string" } }
                  }
                },
                required: ["tipo", "texto", "opciones", "columnas", "filas"]
              }
            }
          },
          required: ["titulo", "indicacion", "items"]
        }
      },
      cierre: {
        type: "object",
        properties: {
          titulo: { type: "string" },
          preguntas: { type: "array", items: { type: "string" } }
        },
        required: ["titulo", "preguntas"]
      }
    },
    required: [
      "titulo",
      "subtitulo",
      "tipoFicha",
      "proposito",
      "indicacionGeneral",
      "secciones",
      "cierre"
    ]
  },

  rubric: {
    type: "object",
    properties: {
      titulo: { type: "string" },
      evidencia: { type: "string" },
      competencia: { type: "string" },
      capacidades: { type: "array", items: { type: "string" } },
      criterios: {
        type: "array",
        items: {
          type: "object",
          properties: {
            capacidad: { type: "string" },
            criterio: { type: "string" },
            destacado: { type: "string" },
            esperado: { type: "string" },
            proceso: { type: "string" },
            inicio: { type: "string" }
          },
          required: [
            "capacidad",
            "criterio",
            "destacado",
            "esperado",
            "proceso",
            "inicio"
          ]
        }
      }
    },
    required: ["titulo", "evidencia", "competencia", "capacidades", "criterios"]
  },

  checklist: {
    type: "object",
    properties: {
      titulo: { type: "string" },
      evidencia: { type: "string" },
      competencia: { type: "string" },
      criterios: {
        type: "array",
        items: {
          type: "object",
          properties: {
            capacidad: { type: "string" },
            criterio: { type: "string" }
          },
          required: ["capacidad", "criterio"]
        }
      }
    },
    required: ["titulo", "evidencia", "competencia", "criterios"]
  },

  rating_scale: {
    type: "object",
    properties: {
      titulo: { type: "string" },
      evidencia: { type: "string" },
      competencia: { type: "string" },
      tipoEscala: {
        type: "string",
        enum: ["frecuencia", "logro"]
      },
      niveles: { type: "array", items: { type: "string" } },
      criterios: {
        type: "array",
        items: {
          type: "object",
          properties: {
            capacidad: { type: "string" },
            criterio: { type: "string" }
          },
          required: ["capacidad", "criterio"]
        }
      }
    },
    required: [
      "titulo",
      "evidencia",
      "competencia",
      "tipoEscala",
      "niveles",
      "criterios"
    ]
  }
};

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function contextFrom(body) {
  const form = body.form || {};
  const session = body.session || {};
  const profile = body.profile || {};

  const competencia =
    form.competencia ||
    session.competencia ||
    session.competenciasCNEB?.[0] ||
    "No indicada";

  const capacidades =
    normalizeArray(form.capacidades).length
      ? form.capacidades
      : normalizeArray(session.capacidadesCNEB);

  const criterios =
    normalizeArray(form.criteriosBase).length
      ? form.criteriosBase
      : normalizeArray(session.criteriosEvaluacion);

  return {
    docente:
      [profile.nombres, profile.apellidos].filter(Boolean).join(" ") ||
      profile.nombre ||
      "",
    ie: profile.ie || profile.institucion || form.institucion || "",
    nivel: form.nivel || session.nivel || "",
    grado: form.grado || session.grado || "",
    area: form.area || session.area || "",
    tema: form.tema || session.titulo || "",
    proposito: form.proposito || session.proposito || "",
    evidencia: form.evidencia || session.evidencia || "",
    competencia,
    capacidades,
    criterios,
    inicio: session.inicio || session.sequence?.inicio || "",
    desarrollo: session.desarrollo || session.sequence?.desarrollo || "",
    cierre: session.cierre || session.sequence?.cierre || "",
    producto: session.productoSTEAM || "",
    region: form.region || "",
  };
}

function promptFor(type, ctx, options = {}) {
  const base = `
Eres especialista en Educación Básica Regular del Perú y CNEB.
Generarás un recurso pedagógico LISTO PARA USAR, coherente con una sesión ya creada.

DATOS DE LA SESIÓN
Nivel: ${ctx.nivel || "No indicado"}
Grado: ${ctx.grado || "No indicado"}
Área: ${ctx.area || "No indicada"}
Tema/título: ${ctx.tema || "No indicado"}
Propósito: ${ctx.proposito || "No indicado"}
Competencia: ${ctx.competencia}
Capacidades: ${ctx.capacidades.join(" | ") || "No indicadas"}
Evidencia: ${ctx.evidencia || "No indicada"}
Criterios previamente definidos: ${JSON.stringify(ctx.criterios)}
Región/contexto: ${ctx.region || "No indicado"}

REGLAS GENERALES
- No inventes competencias ni capacidades oficiales.
- Mantén coherencia estricta con propósito, evidencia y criterios.
- Redacta en español peruano claro.
- Adecuar lenguaje y complejidad al grado.
- No pongas notas para el programador ni explicaciones del proceso.
- No afirmes que incluyes imágenes.
- El resultado será convertido a Word, por lo que el contenido debe ser usable tal cual.
`;

  if (type === "worksheet") {
    return `${base}

Crea una FICHA DE APRENDIZAJE PARA EL ESTUDIANTE, no una ficha para el docente.
El nombre de la ficha debe adaptarse al área y competencia:
- Ciencia y Tecnología: ficha de indagación / investigación / diseño, según corresponda.
- Comunicación: comprensión lectora, producción escrita u oral, según corresponda.
- Matemática: resolución de problemas.
- Personal Social: análisis/reflexión.
- Otras áreas: nombre pedagógicamente pertinente.

Debe incluir:
1. Título atractivo y subtítulo.
2. Propósito en lenguaje comprensible para el estudiante.
3. Espacio implícito para Nombre, grado y fecha (el Word ya agregará esos campos).
4. Activación/situación inicial.
5. Desarrollo con preguntas y actividades reales.
6. Espacios de respuesta.
7. Cuando sea pertinente, una tabla de registro o análisis.
8. Cierre con metacognición.
9. Entre 3 y 5 secciones, sin sobrecargar la hoja.
10. Evita convertir la ficha en una copia de la sesión.

En los items:
- "pregunta": pregunta breve con espacio de respuesta.
- "respuesta_larga": pregunta que necesita varias líneas.
- "tabla": usa columnas y filas; puede dejar celdas vacías para el estudiante.
- "pasos": texto con opciones como pasos numerados.
- "lista": texto con opciones como lista.
- "texto": texto breve informativo.

Devuelve JSON según el esquema.`;
  }

  const count = Math.min(Math.max(Number(options.numeroCriterios || 4), 3), 8);

  if (type === "rubric") {
    return `${base}

Crea una RÚBRICA ANALÍTICA con exactamente ${count} criterios.
- Cada criterio debe ser observable y derivarse de la capacidad, propósito y evidencia.
- Si ya existen criterios aprobados, consérvalos en esencia.
- Cada descriptor debe mostrar progresión REAL entre:
  Inicio (C), En proceso (B), Logro esperado (A), Logro destacado (AD).
- No uses solo adjetivos como "excelente", "bueno" o "regular".
- Los descriptores deben indicar qué hace el estudiante y con qué nivel de calidad.
Devuelve JSON según el esquema.`;
  }

  if (type === "checklist") {
    return `${base}

Crea una LISTA DE COTEJO con exactamente ${count} criterios.
- Criterios breves, observables y verificables.
- Empieza cada criterio con un verbo observable.
- Deben corresponder a la evidencia y capacidades.
- El Word añadirá columnas Sí / No / Observaciones.
Devuelve JSON según el esquema.`;
  }

  return `${base}

Crea una ESCALA DE VALORACIÓN con exactamente ${count} criterios.
Tipo solicitado: ${options.scaleType === "frecuencia" ? "frecuencia" : "nivel de logro"}.
Si es frecuencia usa niveles: Nunca, A veces, Casi siempre, Siempre.
Si es logro usa niveles: Inicio, En proceso, Logrado, Destacado.
- Criterios observables, claros y coherentes con la evidencia.
- No repitas criterios.
Devuelve JSON según el esquema.`;
}

async function rpc(name, token, supabaseUrl, supabaseKey) {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: supabaseKey,
      Authorization: `Bearer ${token}`
    },
    body: "{}"
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data?.message || `No se pudo ejecutar ${name}`);
    error.status = response.status;
    throw error;
  }

  return data;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  const supabaseUrl =
    process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey =
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY;
  const accessToken =
    req.headers.authorization?.replace(/^Bearer\s+/i, "");

  if (!apiKey) {
    return res.status(500).json({
      error: "Falta configurar GEMINI_API_KEY en Vercel"
    });
  }

  if (!accessToken || !supabaseUrl || !supabaseKey) {
    return res.status(401).json({
      error: "Inicia sesión para generar recursos"
    });
  }

  const type = req.body?.type;
  if (!schemas[type]) {
    return res.status(400).json({
      error: "Tipo de recurso no válido"
    });
  }

  let consumed = false;

  try {
    // Confirma que el token pertenece a un usuario válido.
    const auth = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${accessToken}`
      }
    });

    if (!auth.ok) {
      return res.status(401).json({
        error: "Tu sesión venció. Vuelve a iniciar sesión."
      });
    }

    const quota = await rpc(
      "consume_ai_credit",
      accessToken,
      supabaseUrl,
      supabaseKey
    );

    if (!quota?.ok) {
      return res.status(429).json({
        error: "Has utilizado tus 5 creaciones gratuitas de esta semana.",
        code: quota?.reason || "WEEKLY_LIMIT_REACHED",
        credits: quota
      });
    }

    consumed = true;

    const ctx = contextFrom(req.body || {});
    const options = req.body?.options || {};
    const promptText = promptFor(type, ctx, options);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }] }],
          systemInstruction: {
            parts: [{
              text:
                "Eres especialista peruano en planificación curricular, evaluación formativa y diseño de materiales. Entrega siempre JSON válido que respete estrictamente el esquema solicitado."
            }]
          },
          generationConfig: {
            maxOutputTokens: type === "worksheet" ? 6000 : 4500,
            responseMimeType: "application/json",
            responseSchema: schemas[type]
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw Object.assign(
        new Error(data?.error?.message || "Error de la API de Gemini"),
        { status: response.status }
      );
    }

    const candidate = data?.candidates?.[0];
    const text =
      candidate?.content?.parts?.map(part => part.text).join("") || "";

    if (!text) {
      throw new Error("Gemini no devolvió contenido");
    }

    if (candidate?.finishReason === "MAX_TOKENS") {
      throw new Error(
        "El recurso quedó incompleto. Intenta generarlo nuevamente."
      );
    }

    const resource = JSON.parse(text);

    return res.status(200).json({
      resource,
      type,
      model: GEMINI_MODEL,
      _credits: quota
    });
  } catch (error) {
    console.error("generate-session-resource:", error);

    if (consumed) {
      await rpc(
        "refund_ai_credit",
        accessToken,
        supabaseUrl,
        supabaseKey
      ).catch(refundError => {
        console.error("No se pudo devolver el crédito:", refundError);
      });
    }

    return res.status(error?.status || 500).json({
      error:
        error instanceof SyntaxError
          ? "Gemini devolvió un recurso incompleto. Intenta nuevamente."
          : error?.message || "No se pudo generar el recurso"
    });
  }
}

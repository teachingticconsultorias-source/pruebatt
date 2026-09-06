// api/_lib/quality.js
//
// Control de calidad determinista sobre lo que devuelve Gemini.
//
// POR QUÉ EXISTE
// --------------
// Una ficha sobre «el ciclo del agua» llegó con buenas preguntas al principio
// y luego varias seguidas que decían literalmente «Pregunta sobre ciclo del
// agua». La validación de entonces sólo contaba preguntas, así que el relleno
// pasaba: el número era correcto y el contenido no.
//
// La causa está en cómo funciona `responseSchema`: obliga a rellenar los
// campos obligatorios, pero no obliga a que digan algo. Cuando el modelo se
// queda sin presupuesto o pierde el hilo, emite cadenas que satisfacen el
// esquema y no sirven en un aula.
//
// Por eso el prompt NO basta. Esto se comprueba después, sobre el objeto ya
// parseado, y sin llamar a nadie.

/** Minúsculas, sin tildes, sin puntuación y con espacios colapsados. */
export function normalizeText(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Fórmulas de relleno. Se comparan sobre el texto normalizado, así que no
 * hace falta contemplar tildes ni mayúsculas.
 */
const PLACEHOLDER_PATTERNS = [
  /^pregunta\s+(sobre|acerca|de|del|numero|n\s*\d)/, // «Pregunta sobre X»
  // Sólo la forma desnuda. "Completa la frase: el agua se evapora cuando…" es
  // una pregunta legítima, y rechazarla descartaría fichas buenas: un falso
  // positivo aquí cuesta una regeneración y un crédito devuelto de más.
  /^(completar|completa|complete|rellenar|rellena)$/,
  /^(escribe|escriba|escribir)\s+(aqui|tu respuesta|su respuesta)/,
  /placeholder|lorem ipsum|texto de ejemplo/,
  /^(por definir|pendiente|sin definir|a determinar)$/,
  /^(pregunta|opcion|respuesta|item)\s*\d*$/, // «Pregunta 3», a secas
  /\btodo\s*:/,
  /^x{3,}$/,
];

/** Longitud mínima creíble para el enunciado de una pregunta. */
const MIN_QUESTION_LENGTH = 20;

/** Dos preguntas por encima de este parecido se consideran la misma. */
const SIMILARITY_THRESHOLD = 0.85;

export function looksLikePlaceholder(value) {
  const text = normalizeText(value);
  if (!text) return true;
  return PLACEHOLDER_PATTERNS.some((re) => re.test(text));
}

/**
 * Parecido por conjunto de palabras (Jaccard). Basta para detectar la
 * repetición y el parafraseo perezoso, que es lo que se busca aquí, sin
 * traerse una librería de distancia de edición.
 */
export function similarity(a, b) {
  const wa = new Set(normalizeText(a).split(" ").filter(Boolean));
  const wb = new Set(normalizeText(b).split(" ").filter(Boolean));
  if (!wa.size || !wb.size) return 0;
  let comunes = 0;
  for (const w of wa) if (wb.has(w)) comunes += 1;
  return comunes / (wa.size + wb.size - comunes);
}

/** Índices de textos repetidos o casi idénticos a uno anterior. */
export function findNearDuplicates(texts, threshold = SIMILARITY_THRESHOLD) {
  const repetidos = [];
  for (let i = 0; i < texts.length; i += 1) {
    for (let j = 0; j < i; j += 1) {
      if (similarity(texts[i], texts[j]) >= threshold) {
        repetidos.push({ index: i, duplicaA: j });
        break;
      }
    }
  }
  return repetidos;
}

/**
 * Comprueba una ficha de trabajo ya parseada.
 *
 * @param {object} resource
 * @param {{questionCount:number, questionTypes?:string[]}} expected
 * @returns {{ ok: boolean, problems: string[] }}
 */
export function validateWorksheet(resource, { questionCount, questionTypes = [] } = {}) {
  const problems = [];
  const preguntas = Array.isArray(resource?.preguntas) ? resource.preguntas : [];

  if (!resource || typeof resource !== "object") {
    return { ok: false, problems: ["la respuesta no es un objeto"] };
  }

  if (looksLikePlaceholder(resource.titulo)) problems.push("el título es de relleno o está vacío");
  if (!normalizeText(resource.instrucciones)) problems.push("las instrucciones están vacías");

  if (preguntas.length !== questionCount) {
    problems.push(`llegaron ${preguntas.length} preguntas de ${questionCount}`);
  }

  preguntas.forEach((p, i) => {
    const n = i + 1;
    const enunciado = String(p?.pregunta ?? "");

    if (looksLikePlaceholder(enunciado)) {
      problems.push(`la pregunta ${n} es de relleno`);
    } else if (normalizeText(enunciado).length < MIN_QUESTION_LENGTH) {
      problems.push(`la pregunta ${n} es demasiado corta para ser real`);
    }

    if (questionTypes.length && p?.tipo && !questionTypes.includes(p.tipo)) {
      problems.push(`la pregunta ${n} usa un tipo no pedido (${p.tipo})`);
    }

    const opciones = Array.isArray(p?.opciones) ? p.opciones : [];
    if (p?.tipo === "opcion_multiple") {
      if (opciones.length !== 4) problems.push(`la pregunta ${n} no trae 4 opciones`);
      else if (opciones.some((o) => looksLikePlaceholder(o))) {
        problems.push(`la pregunta ${n} tiene opciones de relleno`);
      }
    }
    if (p?.tipo === "verdadero_falso" && opciones.length !== 2) {
      problems.push(`la pregunta ${n} de verdadero/falso no trae dos opciones`);
    }
    if (p?.tipo === "lectura" && normalizeText(p?.textoLectura).length < 40) {
      problems.push(`la pregunta ${n} es de lectura pero no trae texto suficiente`);
    }
  });

  for (const { index, duplicaA } of findNearDuplicates(preguntas.map((p) => p?.pregunta))) {
    problems.push(`la pregunta ${index + 1} repite la ${duplicaA + 1}`);
  }

  return { ok: problems.length === 0, problems };
}

/**
 * Comprueba una ficha por secciones (`/api/generate-session-resource`).
 *
 * Aquí el problema observado NO era relleno del modelo: la ficha llegaba bien
 * y era la interfaz la que inventaba preguntas para llenar ocho huecos fijos.
 * Aun así conviene garantizar un mínimo real de preguntas, porque si llegan
 * cuatro la ficha se queda coja y antes eso se tapaba con texto inventado.
 *
 * @param {object} resource
 * @param {{minQuestions?:number}} expected
 * @returns {{ ok: boolean, problems: string[] }}
 */
export function validateSessionResource(resource, { minQuestions = 6 } = {}) {
  const problems = [];

  if (!resource || typeof resource !== "object") {
    return { ok: false, problems: ["la respuesta no es un objeto"] };
  }

  const secciones = Array.isArray(resource.secciones) ? resource.secciones : [];
  if (!secciones.length) problems.push("la ficha no trae secciones");

  if (looksLikePlaceholder(resource.titulo)) problems.push("el título es de relleno o está vacío");

  const actividades = secciones.flatMap((s) =>
    Array.isArray(s?.actividades) ? s.actividades : []
  );

  secciones.forEach((s, i) => {
    if (looksLikePlaceholder(s?.titulo)) problems.push(`la sección ${i + 1} no tiene título real`);
    if (!Array.isArray(s?.actividades) || !s.actividades.length) {
      problems.push(`la sección ${i + 1} está vacía`);
    }
  });

  actividades.forEach((a, i) => {
    if (looksLikePlaceholder(a?.texto)) problems.push(`la actividad ${i + 1} es de relleno`);
  });

  const preguntas = actividades
    .filter((a) => ["pregunta", "respuesta_larga"].includes(a?.tipo))
    .map((a) => a?.texto);

  if (preguntas.length < minQuestions) {
    problems.push(`sólo llegaron ${preguntas.length} preguntas de ${minQuestions} mínimas`);
  }

  for (const { index, duplicaA } of findNearDuplicates(preguntas)) {
    problems.push(`la pregunta ${index + 1} repite la ${duplicaA + 1}`);
  }

  return { ok: problems.length === 0, problems };
}

/**
 * Error de calidad. Lleva `code` para que `sendGenerationError` lo traduzca
 * sin tener que adivinar por el texto, y los detalles quedan sólo en el log.
 */
export function qualityError(problems) {
  const error = new Error(
    `La respuesta llegó incompleta: ${problems.slice(0, 5).join("; ")}`
  );
  error.code = "GENERATION_INCOMPLETE";
  error.problems = problems;
  return error;
}

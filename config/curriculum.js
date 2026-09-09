// config/curriculum.js
//
// LAS ÁREAS CURRICULARES DEL CNEB. UNA SOLA VEZ, PARA TODA LA APLICACIÓN.
//
// EL PROBLEMA QUE RESUELVE
// -----------------------
// Había UNA lista de seis áreas —`GENERATOR_AREAS`— compartida por Primaria y
// Secundaria y repetida en cinco selectores de App.jsx. A una docente de
// Secundaria le faltaban cinco áreas oficiales (DPCC, Ciencias Sociales,
// Educación Física, las dos de lenguas y Educación Religiosa) y le sobraba
// «Personal Social», que en Secundaria no existe: se reparte entre DPCC y
// Ciencias Sociales.
//
// ÁREA NO ES CURSO
// ----------------
// Biología, Física y Química no son áreas: son contenidos de Ciencia y
// Tecnología. Historia, Geografía y Economía son contenidos de Ciencias
// Sociales. Lengua y Literatura, de Comunicación. Meterlos como áreas rompería
// la alineación con el CNEB, porque las competencias y capacidades se definen
// por área y no por curso.
//
// LOS MATERIALES ANTIGUOS SIGUEN ABRIENDO
// ---------------------------------------
// Lo que ya está guardado en Supabase NO se toca: ni una migración, ni un
// update. La compatibilidad es de LECTURA —`normalizarArea()`— y sólo para los
// casos en los que la equivalencia es exacta. Un material guardado como
// «Historia» se sigue guardando como «Historia»; sólo se sabe leer que
// pertenece a Ciencias Sociales cuando algo necesita su área canónica.

/* ==========================================================================
   SECUNDARIA · las once áreas oficiales
   ========================================================================== */
export const AREAS_SECUNDARIA = [
  {
    id: "dpcc",
    label: "Desarrollo Personal, Ciudadanía y Cívica (DPCC)",
    shortLabel: "DPCC",
    description: "Enfocada en la construcción de la identidad y la convivencia democrática.",
  },
  {
    id: "ciencias-sociales",
    label: "Ciencias Sociales",
    shortLabel: "Ciencias Sociales",
    description: "Centrada en el análisis histórico, geográfico y económico.",
  },
  {
    id: "educacion-fisica",
    label: "Educación Física",
    shortLabel: "Ed. Física",
    description: "Orientada al desarrollo corporal, la salud y la interacción sociomotriz.",
  },
  {
    id: "arte-cultura",
    label: "Arte y Cultura",
    shortLabel: "Arte y Cultura",
    description: "Busca la apreciación crítica de manifestaciones artístico-culturales y la creación desde los lenguajes del arte.",
  },
  {
    id: "comunicacion",
    label: "Comunicación",
    shortLabel: "Comunicación",
    description: "Trabaja competencias de lectura, escritura y expresión oral en lengua materna.",
  },
  {
    id: "castellano-segunda-lengua",
    label: "Castellano como Segunda Lengua",
    shortLabel: "Castellano 2.ª lengua",
    description: "Aplicada de manera específica en instituciones de educación bilingüe.",
  },
  {
    id: "ingles",
    label: "Inglés como Lengua Extranjera",
    shortLabel: "Inglés",
    description: "Promueve la comunicación oral y escrita en inglés.",
  },
  {
    id: "matematica",
    label: "Matemática",
    shortLabel: "Matemática",
    description: "Desarrolla el razonamiento lógico y la resolución de problemas de cantidad, regularidad, forma, movimiento y gestión de datos.",
  },
  {
    id: "ciencia-tecnologia",
    label: "Ciencia y Tecnología",
    shortLabel: "Ciencia y Tecnología",
    description: "Promueve la indagación y explicación del mundo físico, biológico y tecnológico a partir de conocimientos científicos.",
  },
  {
    id: "educacion-trabajo",
    label: "Educación para el Trabajo",
    shortLabel: "Ed. para el Trabajo",
    description: "Fomenta capacidades para gestionar proyectos de emprendimiento económico o social y habilidades vinculadas al mundo productivo.",
  },
  {
    id: "educacion-religiosa",
    label: "Educación Religiosa",
    shortLabel: "Ed. Religiosa",
    description: "Promueve la formación espiritual, ética y religiosa, considerando las disposiciones aplicables respecto a la exoneración.",
  },
];

/* ==========================================================================
   PRIMARIA

   Se conserva EXACTAMENTE el catálogo que ya estaba en producción. Este
   bloque venía a corregir Secundaria; cambiar Primaria de paso metería un
   riesgo que nadie pidió y que ninguna docente está esperando.
   ========================================================================== */
export const AREAS_PRIMARIA = [
  { id: "ciencia-tecnologia", label: "Ciencia y Tecnología", shortLabel: "Ciencia y Tecnología", description: "Promueve la indagación y explicación del mundo físico, biológico y tecnológico." },
  { id: "comunicacion", label: "Comunicación", shortLabel: "Comunicación", description: "Trabaja competencias de lectura, escritura y expresión oral en lengua materna." },
  { id: "matematica", label: "Matemática", shortLabel: "Matemática", description: "Desarrolla el razonamiento lógico y la resolución de problemas matemáticos." },
  { id: "personal-social", label: "Personal Social", shortLabel: "Personal Social", description: "Construcción de la identidad, convivencia democrática y gestión del espacio y el ambiente." },
  { id: "arte-cultura", label: "Arte y Cultura", shortLabel: "Arte y Cultura", description: "Apreciación crítica de manifestaciones artístico-culturales y creación desde los lenguajes del arte." },
  { id: "educacion-trabajo", label: "Educación para el Trabajo", shortLabel: "Ed. para el Trabajo", description: "Capacidades para gestionar proyectos de emprendimiento económico o social." },
];

const POR_NIVEL = { Primaria: AREAS_PRIMARIA, Secundaria: AREAS_SECUNDARIA };

/** Normaliza «secundaria», «Secundaria» o «SECUNDARIA» a la clave del catálogo. */
export function nivelCanonico(nivel) {
  return String(nivel || "").trim().toLowerCase().startsWith("s") ? "Secundaria" : "Primaria";
}

/**
 * Las áreas de un nivel, como objetos.
 * @returns {{id:string,label:string,shortLabel:string,description:string}[]}
 */
export function getAreasByLevel(nivel) {
  return POR_NIVEL[nivelCanonico(nivel)];
}

/** Sólo los nombres visibles, que es lo que consume un `<select>`. */
export function areasDeNivel(nivel) {
  return getAreasByLevel(nivel).map((area) => area.label);
}

/** Todas las áreas conocidas, sin repetir. Para pantallas sin nivel. */
export const TODAS_LAS_AREAS = [
  ...AREAS_SECUNDARIA.map((a) => a.label),
  ...AREAS_PRIMARIA.map((a) => a.label).filter((label) => !AREAS_SECUNDARIA.some((s) => s.label === label)),
];

/** ¿Es `area` una opción válida del nivel? */
export function esAreaValida(nivel, area) {
  return getAreasByLevel(nivel).some((item) => item.label === area);
}

export function areaPorId(id) {
  return AREAS_SECUNDARIA.find((a) => a.id === id) || AREAS_PRIMARIA.find((a) => a.id === id) || null;
}

export function descripcionDeArea(area) {
  const encontrada = [...AREAS_SECUNDARIA, ...AREAS_PRIMARIA].find((item) => item.label === area);
  return encontrada ? encontrada.description : "";
}

/* ==========================================================================
   COMPATIBILIDAD DE LECTURA

   Sólo equivalencias exactas. «Ciudadanía» no está aquí a propósito: podría
   ser DPCC o Ciencias Sociales según el año, y una conversión ambigua es peor
   que ninguna. Lo que no se sabe traducir se devuelve tal cual.
   ========================================================================== */
export const ALIAS_DE_AREA = {
  Biología: "Ciencia y Tecnología",
  Física: "Ciencia y Tecnología",
  Química: "Ciencia y Tecnología",
  "Ciencia, Tecnología y Ambiente": "Ciencia y Tecnología",
  "Ciencia Tecnología y Ambiente": "Ciencia y Tecnología",
  CTA: "Ciencia y Tecnología",
  Historia: "Ciencias Sociales",
  Geografía: "Ciencias Sociales",
  Economía: "Ciencias Sociales",
  "Historia, Geografía y Economía": "Ciencias Sociales",
  Lengua: "Comunicación",
  Literatura: "Comunicación",
  "Lengua y Literatura": "Comunicación",
  Emprendimiento: "Educación para el Trabajo",
  "Formación Ciudadana y Cívica": "Desarrollo Personal, Ciudadanía y Cívica (DPCC)",
  "Persona, Familia y Relaciones Humanas": "Desarrollo Personal, Ciudadanía y Cívica (DPCC)",
  Inglés: "Inglés como Lengua Extranjera",
};

/**
 * El área canónica de un valor guardado.
 *
 * NO altera lo guardado: se usa para leer. Si el valor no tiene equivalencia
 * conocida se devuelve intacto, porque un material viejo tiene que seguir
 * abriendo aunque su área ya no exista en ningún catálogo.
 */
export function normalizarArea(area) {
  const texto = String(area ?? "").trim();
  if (!texto) return "";
  return ALIAS_DE_AREA[texto] || texto;
}

/**
 * El área que corresponde al cambiar de nivel.
 *
 * Si la seleccionada sigue existiendo en el nivel nuevo, se conserva: nadie
 * espera perder su elección por tocar el desplegable de al lado. Si no existe
 * —«Personal Social» al pasar a Secundaria— se usa su equivalente, y sólo si
 * tampoco lo hay se cae a la primera del catálogo.
 */
const AL_CAMBIAR_DE_NIVEL = {
  Secundaria: { "Personal Social": "Desarrollo Personal, Ciudadanía y Cívica (DPCC)" },
  Primaria: {
    "Desarrollo Personal, Ciudadanía y Cívica (DPCC)": "Personal Social",
    "Ciencias Sociales": "Personal Social",
    "Educación Física": "Personal Social",
    "Castellano como Segunda Lengua": "Comunicación",
    "Inglés como Lengua Extranjera": "Comunicación",
    "Educación Religiosa": "Personal Social",
  },
};

export function areaAlCambiarNivel(nivel, areaActual) {
  const destino = nivelCanonico(nivel);
  if (esAreaValida(destino, areaActual)) return areaActual;
  const equivalente = AL_CAMBIAR_DE_NIVEL[destino]?.[normalizarArea(areaActual)];
  if (equivalente && esAreaValida(destino, equivalente)) return equivalente;
  return getAreasByLevel(destino)[0].label;
}

// Datos completamente ficticios para OOXML y revisión visual. No llama a IA.
export const form = { docente: "Docente de prueba", institucion: "IE Demostración",
  nivel: "Secundaria", grado: "2.º", seccion: "A", area: "Ciencia y Tecnología", region: "Puno",
  fecha: "2026-09-09", duracion: "90 minutos", tema: "Ciclo del agua",
  proposito: "Explicar el ciclo del agua y relacionarlo con su cuidado en la comunidad.",
  competencia: "Explica el mundo físico basándose en conocimientos sobre los seres vivos, materia y energía, biodiversidad, Tierra y universo.",
  capacidades: ["Comprende y usa conocimientos científicos", "Evalúa las implicancias del saber científico"],
  evidencia: "Explicación acompañada por un esquema del ciclo del agua." };
export const criterios = ["Identifica los cambios de estado del agua y los relaciona con la temperatura.",
  "Explica la evaporación utilizando un ejemplo observado en su entorno.",
  "Describe la condensación y su relación con la formación de nubes.",
  "Relaciona la precipitación con la disponibilidad de agua en la comunidad.",
  "Representa el ciclo del agua mediante un esquema con relaciones claras.",
  "Sustenta una acción para cuidar el agua usando lo aprendido."];
export const instrument = { titulo: "Ciclo del agua", competencia: form.competencia,
  capacidades: form.capacidades, evidencia: form.evidencia, criterios: criterios.map((criterio, i) => ({ criterio,
    capacidad: form.capacidades[i % 2], inicio: "Reconoce algunos elementos con acompañamiento del docente.",
    enProceso: "Describe los elementos principales y necesita apoyo para relacionarlos.",
    logroEsperado: "Explica las relaciones entre los elementos con ejemplos pertinentes.",
    logroDestacado: "Explica las relaciones, sustenta sus ideas y las aplica a una situación nueva." })) };
export const session = { titulo: form.tema, proposito: form.proposito, competenciasCNEB: [form.competencia],
  capacidadesCNEB: form.capacidades, evidencia: form.evidencia, criteriosEvaluacion: criterios,
  desempenosPrecisados: ["Explica los cambios de estado y su intervención en el ciclo del agua."],
  enfoquesTransversales: [{ enfoque: "Ambiental", valor: "Responsabilidad", actitud: "Propone acciones para cuidar el agua." }],
  preparacionDocente: ["Preparar los materiales y organizar equipos de cuatro integrantes."],
  materiales: ["Recipientes transparentes", "Agua", "Cartulina", "Lápices"],
  inicio: { minutos: 15, motivacion: { descripcion: "Observan un recipiente con gotas de agua en su superficie.", preguntas: ["¿De dónde vienen las gotas?"] },
    saberesPrevios: { descripcion: "Comparten lo que conocen de la lluvia." },
    problematizacion: { descripcion: "Explican por qué vuelve a llover si el agua cae al suelo." },
    propositoOrganizacion: { descripcion: form.proposito } },
  desarrollo: { minutos: 60, metodologia: "Observación y explicación en equipos.", procesos: [
    { subtitulo: "Observamos y explicamos", descripcion: "Los equipos representan los cambios de estado en un esquema.",
      preguntasMediacion: ["¿Qué cambia y qué permanece?", "¿Cómo se relacionan los procesos?"],
      acompanamiento: "Solicitar evidencias para cada explicación.", evaluacionFormativa: "Revisar las relaciones representadas." }] },
  cierre: { minutos: 15, metacognicion: { preguntas: ["¿Qué aprendimos?", "¿Cómo lo sabemos?"] },
    evaluacion: { descripcion: "Presentan su esquema y reciben retroalimentación." },
    transferencia: { descripcion: "Proponen una acción para cuidar el agua." } },
  orientacionesDUA: ["Permitir explicaciones orales apoyadas en imágenes."],
  reflexionesDocente: ["¿Qué relaciones necesitaron mayor acompañamiento?"],
  anexos: [{ titulo: "Registro de observación", contenido: "Anota los cambios observados en el recipiente.", instrucciones: "Compara tus observaciones con las de tu equipo." }] };
export const worksheet = { titulo: "Investigamos el agua", propositoEstudiante: form.proposito,
  instrucciones: "Lee las actividades y registra tus respuestas.", secciones: [{ titulo: "Observamos",
    indicacion: "Utiliza los materiales de tu equipo.", actividades: [
      { tipo: "texto", texto: "El agua puede presentarse en distintos estados." },
      { tipo: "respuesta_corta", texto: "¿Qué cambios observaste?" },
      { tipo: "tabla", texto: "Registra las observaciones.", columnas: ["Antes", "Después", "Explicación"] },
      { tipo: "pasos", texto: "Organiza tu explicación.", opciones: ["Revisa tus registros.", "Relaciona los cambios con la temperatura."] }] }],
  preguntas: [{ tipo: "opcion_multiple", pregunta: "¿Qué proceso forma vapor de agua?", opciones: ["Evaporación", "Condensación"] },
    { tipo: "verdadero_falso", pregunta: "El agua cambia de estado." }], metacognicion: ["¿Qué evidencia apoyó tu explicación?"] };
export const reading = { titulo: "Un viaje que se repite", proposito: "Comprender el recorrido del agua.",
  antesDeLeer: ["Observa el título y escribe qué recorrido imaginas."],
  texto: "El agua de una laguna recibe calor del sol. Parte de ella se transforma en vapor y asciende.\n\nCuando el vapor se enfría, se forman pequeñas gotas. Estas gotas se agrupan en las nubes. Luego, el agua puede volver a la superficie en forma de lluvia.\n\nEl recorrido continúa por el suelo, los ríos y las lagunas. Por eso, cuidar el agua también implica cuidar los lugares por los que pasa.",
  vocabulario: [{ palabra: "Vapor", significado: "Agua en estado gaseoso." }], preguntas: [
    { nivel: "literal", pregunta: "¿Qué proporciona calor al agua?" },
    { nivel: "inferencial", pregunta: "¿Por qué el texto llama viaje al ciclo del agua?" },
    { nivel: "critico", pregunta: "¿Qué acción propondrías para cuidar este recorrido? Sustenta tu respuesta." }] };
export const challenge = { titulo: "Protegemos cada gota", area: form.area, duracion: "45 minutos", equipo: "Cuatro integrantes",
  mision: "Diseñar una propuesta para reducir el desperdicio de agua.", objetivo: "Sustentar una propuesta con evidencias.",
  competencia: form.competencia, capacidades: form.capacidades, roles: ["Coordinación", "Registro", "Materiales", "Presentación"],
  producto: "Propuesta ilustrada", materiales: ["Papel", "Lápices"], preparacion: ["Organizar los equipos."],
  pasos: ["Identifiquen una situación de desperdicio.", "Comparen posibles acciones.", "Presenten su propuesta."],
  condicionExito: "La propuesta explica cómo evita el desperdicio.", variante: "Comparar dos propuestas.",
  criterios: ["Sustenta su propuesta con evidencias."], reglas: ["Todas las personas participan."], preguntas: ["¿Cómo mejorarían la propuesta?"] };
export const project = { titulo: "Guardianes del agua", situacionSignificativa: "La clase observa formas de utilizar el agua.",
  reto: "¿Cómo podemos cuidar el agua?", integracionSTEAM: [{ area: "Ciencia", aporte: "Explicar los cambios del agua." },
    { area: "Arte", aporte: "Comunicar la propuesta mediante imágenes." }], competencias: [{ area: form.area, competencia: form.competencia }],
  productoEsperado: "Campaña de cuidado del agua", evidencias: ["Esquema", "Propuesta"],
  semanas: [{ semana: 1, titulo: "Investigamos", actividades: ["Observar y registrar."], evidencia: "Registro" },
    { semana: 2, titulo: "Comunicamos", actividades: ["Presentar propuestas."], evidencia: "Propuesta" }],
  sesiones: [{ titulo: "¿Cómo viaja el agua?", competencia: form.competencia, actividadCentral: "Representar el ciclo del agua.", criterios, instrumento: "Lista de cotejo" }] };
const grid = Array.from({ length: 20 }, (_, y) => Array.from({ length: 20 }, (_, x) => "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[(x + y) % 26]));
for (const [i, c] of [..."AGUA"].entries()) grid[0][i] = c;
export const wordsearch = { titulo: "El agua", palabras: ["AGUA"], gridData: { grid, gridSize: 20,
  placedWords: [{ word: "AGUA", row: 0, col: 0, direction: "horizontal" }] } };
export const complete = { session: { form, result: session }, instrument: { type: "checklist", form, resource: instrument },
  material: { type: "worksheet", form, resource: worksheet } };
export const fixtures = [
  ["01-sesion.docx", "session", session], ["02-clase-completa.docx", "complete", complete],
  ["03-proyecto-steam.docx", "project", project], ["04-rubrica.docx", "rubric", { ...instrument, criterios: [...instrument.criterios, ...instrument.criterios.slice(0, 2)] }],
  ["05-lista-cotejo.docx", "checklist", instrument], ["06-escala.docx", "rating_scale", instrument],
  ["07-ficha-trabajo.docx", "worksheet", worksheet], ["08-ficha-lectura.docx", "reading", reading],
  ["09-reto-grupal.docx", "challenge", challenge], ["10-sopa-letras.docx", "wordsearch", wordsearch],
];

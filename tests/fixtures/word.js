// Datos completamente ficticios para OOXML y revisión visual. No llama a IA.
//
// Las formas de `session` y `project` son las que produce HOY la generación
// —`componerSesion()` y `PROJECT_SCHEMA`—, no una versión reducida: si la
// fixture fuera más pobre que la realidad, la revisión visual no probaría nada.
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

export const session = { titulo: form.tema, proposito: form.proposito,
  areasSTEAM: [form.area, "Enfoque STEAM"], competenciasCNEB: [form.competencia],
  capacidadesCNEB: form.capacidades, evidencia: form.evidencia, criteriosEvaluacion: criterios,
  desempenosPrecisados: [
    { capacidad: form.capacidades[0], desempeno: "Explica los cambios de estado y su intervención en el ciclo del agua." },
    { capacidad: form.capacidades[1], desempeno: "Evalúa el impacto del uso del agua en su comunidad usando evidencias." }],
  criteriosDetallados: criterios.map((criterio, i) => ({ criterio, capacidad: form.capacidades[i % 2],
    evidenciaObservable: "El esquema muestra la relación entre los procesos." })),
  enfoquesTransversales: [{ enfoque: "Ambiental", valor: "Responsabilidad", actitudObservable: "Propone acciones para cuidar el agua." },
    { enfoque: "Búsqueda de la excelencia", valor: "Superación personal", actitudObservable: "Revisa su esquema para mejorarlo." }],
  preparacionDocente: ["Preparar los materiales y organizar equipos de cuatro integrantes.",
    "Imprimir la ficha de registro de observaciones."],
  materiales: ["Recipientes transparentes", "Agua", "Cartulina", "Lápices"],
  inicio: { minutos: 15,
    motivacion: { descripcion: "Observan un recipiente con gotas de agua en su superficie.", preguntas: ["¿De dónde vienen las gotas?", "¿Han visto algo parecido en casa?"] },
    saberesPrevios: { descripcion: "Comparten lo que conocen de la lluvia.", preguntas: ["¿Por qué llueve?"] },
    problematizacion: { descripcion: "Explican por qué vuelve a llover si el agua cae al suelo.", preguntas: ["¿A dónde va el agua después de la lluvia?"] },
    propositoOrganizacion: { descripcion: form.proposito, criteriosCompartidos: ["Explicamos con evidencias.", "Escuchamos a cada integrante del equipo."] } },
  desarrollo: { minutos: 60, metodologia: "Indagación científica con registro de observaciones en equipos.", procesos: [
    { subtitulo: "Planteamiento del problema", actividad: "Los equipos formulan la pregunta que guiará su observación.",
      preguntasMediacion: ["¿Qué quieren averiguar exactamente?", "¿Cómo lo podrían comprobar?"],
      acompanamiento: "Orientar la formulación sin dar la respuesta.", evaluacionFormativa: "Revisar que la pregunta sea comprobable." },
    { subtitulo: "Recojo de datos y análisis de resultados", actividad: "Registran los cambios observados en el recipiente durante la sesión.",
      preguntasMediacion: ["¿Qué cambia y qué permanece?", "¿Cómo se relacionan los procesos?"],
      acompanamiento: "Solicitar evidencias para cada explicación.", evaluacionFormativa: "Revisar las relaciones representadas en el esquema." }] },
  cierre: { minutos: 15,
    metacognicion: { descripcion: "Reflexionan sobre cómo llegaron a su explicación.", preguntas: ["¿Qué aprendimos?", "¿Cómo lo sabemos?"] },
    evaluacion: { descripcion: "Presentan su esquema y reciben retroalimentación.", mensajeLogro: "Hoy explicaron un fenómeno usando sus propias observaciones." },
    transferencia: { descripcion: "Proponen una acción para cuidar el agua.", consigna: "Conversen en casa sobre una forma de reducir el desperdicio de agua." } },
  tiempos: { inicio: 15, desarrollo: 60, cierre: 15 },
  orientacionesDUA: ["Permitir explicaciones orales apoyadas en imágenes.", "Ofrecer el registro en formato de dibujo o de tabla."],
  instrumentoSugerido: "Lista de cotejo aplicada al esquema del ciclo del agua.",
  reflexionesDocente: ["¿Qué relaciones necesitaron mayor acompañamiento?", "¿Qué evidencia resultó más útil para retroalimentar?"],
  anexos: [
    { titulo: "Ficha informativa del ciclo del agua", tipo: "lectura", proposito: "Dar el soporte conceptual antes de la observación.",
      contenido: "El agua de una laguna recibe calor del sol y parte de ella se transforma en vapor.", instrucciones: "Lee en parejas y subraya los procesos." },
    { titulo: "Guía de trabajo del equipo", tipo: "actividad", proposito: "Ordenar el registro de las observaciones.",
      contenido: "Anota los cambios observados en el recipiente cada diez minutos.", instrucciones: "Compara tus observaciones con las de tu equipo." },
    { titulo: "Recurso de apoyo para el cierre", tipo: "recurso", proposito: "Sostener la metacognición con preguntas escritas.",
      contenido: "Tres preguntas para responder por escrito antes de salir del aula.", instrucciones: "Responde de forma individual y guarda la hoja." }],
  productoSTEAM: form.evidencia };

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

export const project = { titulo: "Guardianes del agua", situacionSignificativa: "La clase observa formas de utilizar el agua en su comunidad y detecta un desperdicio constante en los caños del patio.",
  reto: "¿Cómo podemos diseñar y construir un sistema sencillo que reduzca el desperdicio de agua en nuestra institución educativa?",
  integracionSTEAM: [{ area: "Ciencia", aporte: "Explicar los cambios del agua y las condiciones que favorecen la evaporación." },
    { area: "Tecnología", aporte: "Comparar dispositivos de ahorro disponibles en el mercado local." },
    { area: "Ingeniería", aporte: "Diseñar y probar un prototipo de reductor de caudal." },
    { area: "Arte", aporte: "Comunicar la propuesta mediante infografías." },
    { area: "Matemática", aporte: "Medir el caudal y calcular el ahorro semanal." }],
  competencias: [{ area: form.area, competencia: form.competencia },
    { area: "Matemática", competencia: "Resuelve problemas de cantidad" }],
  productoEsperado: "Campaña de cuidado del agua con un prototipo de reductor de caudal instalado y medido.",
  evidencias: ["Esquema del ciclo del agua", "Bitácora de mediciones", "Prototipo construido", "Infografía de la campaña"],
  rutaSemanas: [
    { semana: 1, titulo: "Investigamos y medimos", proposito: "Dimensionar el desperdicio con datos propios.",
      actividades: ["Observar y registrar el uso del agua.", "Medir el caudal de cada caño."], evidencia: "Bitácora de mediciones" },
    { semana: 2, titulo: "Construimos y comunicamos", proposito: "Probar el prototipo y presentar el ahorro logrado.",
      actividades: ["Construir el prototipo.", "Volver a medir.", "Presentar la campaña."], evidencia: "Infografía de la campaña" }],
  sesiones: [
    { semana: 1, titulo: "¿Cómo viaja el agua?", competencia: form.competencia, actividadCentral: "Representar el ciclo del agua.", evidencia: "Esquema", criterios: criterios.slice(0, 2), instrumento: "Lista de cotejo" },
    { semana: 1, titulo: "Medimos el caudal", competencia: "Resuelve problemas de cantidad", actividadCentral: "Medir y registrar el caudal de cada caño.", evidencia: "Bitácora", criterios: criterios.slice(2, 4), instrumento: "Escala de valoración" },
    { semana: 2, titulo: "Construimos el prototipo", competencia: form.competencia, actividadCentral: "Construir y probar el reductor de caudal.", evidencia: "Prototipo", criterios: criterios.slice(4), instrumento: "Rúbrica" }] };

/* ==========================================================================
   CASO REAL DPCC · Secundaria 3.o, Puno

   El area de nombre mas largo del catalogo, una IE larga y un titulo de 130+
   caracteres. Sirve para comprobar que la celda de area no se corta, que la
   de la IE crece y que desempenos, criterios y enfoques siguen siendo tablas.
   ========================================================================== */
export const formDPCC = { docente: "Maria del Carmen Quispe Mamani",
  institucion: "Institucion Educativa Emblematica Glorioso Colegio Nacional San Carlos de Puno",
  nivel: "Secundaria", grado: "3.º", seccion: "B",
  area: "Desarrollo Personal, Ciudadanía y Cívica (DPCC)", region: "Puno",
  fecha: "2026-09-15", duracion: "90",
  tema: "Reflexionamos éticamente sobre el impacto de la ciencia y la tecnología en nuestra identidad y comunidad puneña",
  competencia: "Construye su identidad",
  capacidades: ["Se valora a sí mismo", "Reflexiona y argumenta éticamente"],
  proposito: "Argumentar una postura ética sobre el uso de la tecnología en la vida comunitaria.",
  evidencia: "Ensayo argumentativo con una postura sostenida en al menos dos razones." };

export const sessionDPCC = { ...session,
  titulo: formDPCC.tema, proposito: formDPCC.proposito, evidencia: formDPCC.evidencia,
  competenciasCNEB: [formDPCC.competencia], capacidadesCNEB: formDPCC.capacidades,
  desempenosPrecisados: [
    { capacidad: "Se valora a sí mismo", desempeno: "Explica cómo la tecnología influye en la construcción de su identidad personal y colectiva, reconociendo practicas de su comunidad." },
    { capacidad: "Reflexiona y argumenta éticamente", desempeno: "Sustenta una postura ética sobre un dilema tecnológico usando principios y evidencias del contexto puneño." }],
  criteriosDetallados: [
    { capacidad: "Se valora a sí mismo", criterio: "Identifica al menos dos prácticas tecnológicas que modifican la vida de su comunidad.", evidenciaObservable: "El ensayo nombra las practicas y explica su efecto." },
    { capacidad: "Reflexiona y argumenta éticamente", criterio: "Sostiene su postura con dos razones verificables y reconoce una objeción.", evidenciaObservable: "El ensayo presenta razones y responde a la objecion." }],
  enfoquesTransversales: [
    { enfoque: "Enfoque de derechos", valor: "Diálogo y concertación", actitudObservable: "Escucha posturas distintas antes de responder." },
    { enfoque: "Enfoque intercultural", valor: "Respeto a la identidad cultural", actitudObservable: "Reconoce saberes de su comunidad en el debate." }],
  desarrollo: { minutos: 60, metodologia: "Enfoque de desarrollo personal y ciudadanía activa, centrado en la deliberacion sobre asuntos publicos.",
    procesos: [
      { subtitulo: "Problematización", actividad: "Analizan un caso real de uso de tecnología en su comunidad.",
        preguntasMediacion: ["¿Qué cambia para las personas?", "¿Quién gana y quién pierde?"],
        acompanamiento: "Orientar sin cerrar la discusion.", evaluacionFormativa: "Observar si distinguen hecho de opinion." },
      { subtitulo: "Análisis de información", actividad: "Contrastan dos fuentes sobre el mismo caso.",
        preguntasMediacion: ["¿Qué dice cada fuente?", "¿En qué se contradicen?"],
        acompanamiento: "Pedir la cita concreta.", evaluacionFormativa: "Revisar que citen la fuente." },
      { subtitulo: "Acuerdo o toma de decisiones", actividad: "Redactan en equipo una postura comun.",
        preguntasMediacion: ["¿Qué razon sostiene mejor la postura?"],
        acompanamiento: "Devolver la pregunta al equipo.", evaluacionFormativa: "Verificar que la postura tenga dos razones." }] } };

/* ==========================================================================
   GUÍA DE LABORATORIO · las dos partes de una misma práctica
   ========================================================================== */
export const formLab = { docente: "Docente de prueba", institucion: "IE Demostración",
  nivel: "Secundaria", grado: "3.º", seccion: "B", area: "Ciencia y Tecnología",
  fecha: "2026-09-20", duracion: "90", integrantes: "4",
  tema: "Descubriendo la densidad de los líquidos",
  competencia: "Indaga mediante métodos científicos para construir conocimientos",
  capacidades: ["Problematiza situaciones para hacer indagación", "Genera y registra datos e información"],
  proposito: "Comparar la densidad de tres líquidos caseros y explicar por qué unos flotan sobre otros.",
  tipoExperimento: "Experimento comparativo (con variables)",
  materialesDisponibles: "probetas, balanza digital, aceite, agua, miel, colorante",
  medidasSeguridad: "Uso de mandil y lentes de protección; Prohibido probar u oler sustancias" };

export const labGuide = {
  titulo: "Descubriendo la densidad de los líquidos",
  proposito: "Comparar la densidad de tres líquidos caseros y explicar por qué unos flotan sobre otros usando evidencias de su propia medición.",
  normasSeguridad: ["Usar mandil y lentes de protección durante toda la práctica.",
    "No probar ni oler ninguna sustancia del experimento.",
    "Avisar de inmediato al docente si se derrama un líquido.",
    "Lavarse las manos al terminar y dejar el mesón despejado."],
  materialesKit: ["Probeta graduada de 100 ml", "Balanza digital", "Pipeta", "Vaso de precipitados"],
  materialesCaseros: ["Aceite de cocina", "Agua", "Miel", "Colorante vegetal", "Vaso transparente"],
  preguntaIndagatoria: "¿Qué ocurre cuando vertemos aceite, agua y miel en el mismo recipiente y por qué se ordenan de esa manera?",
  procedimiento: ["Midan 30 ml de cada líquido con la probeta y registren su masa en la balanza.",
    "Viertan la miel en el vaso transparente, luego el agua con colorante y al final el aceite.",
    "Observen durante dos minutos sin mover el vaso y dibujen lo que ven.",
    "Registren en la tabla la masa, el volumen y el orden en que quedó cada líquido."],
  columnasRegistro: ["Líquido", "Masa (g)", "Volumen (ml)", "Posición en el vaso"],
  preguntasAnalisis: ["¿Qué diferencia encontraron entre la masa de los tres líquidos con el mismo volumen?",
    "¿Nuestra hipótesis sobre el orden de los líquidos fue verdadera o falsa? ¿Por qué?",
    "¿Qué relación observan entre la masa medida y la posición que ocupó cada líquido?"],
  preguntasMetacognicion: ["¿Qué dificultades tuvimos como equipo al medir? ¿Cómo lo solucionamos?",
    "¿Cómo podemos aplicar lo aprendido sobre densidad en nuestra vida diaria?"],
  guiaDocente: {
    desempenoPrecisado: "Explica, a partir de sus mediciones de masa y volumen, por qué los líquidos de distinta densidad se ordenan en capas dentro de un mismo recipiente.",
    evidencia: "Tabla de datos completa con la conclusión escrita que relaciona densidad y posición de cada líquido.",
    criterios: ["Mide la masa y el volumen de cada líquido registrando las unidades correctas.",
      "Relaciona la densidad calculada con la posición que ocupa el líquido en el vaso.",
      "Formula una conclusión que responde directamente a la pregunta de indagación.",
      "Respeta las normas de seguridad durante toda la manipulación de materiales."],
    enfoquesTransversales: ["Enfoque ambiental: reutiliza materiales caseros y gestiona los residuos de la práctica.",
      "Búsqueda de la excelencia: repite la medición para mejorar la precisión de sus datos."],
    hipotesisModelo: "Si el aceite tiene menos masa que el agua para el mismo volumen, entonces el aceite quedará por encima del agua al verterlos en el mismo recipiente.",
    preparacion: ["Preparar seis juegos de materiales, uno por equipo de cuatro integrantes, con 100 ml de cada líquido.",
      "Tiempo estimado de armado antes de la clase: 20 minutos, incluida la calibración de las balanzas.",
      "La miel y el colorante vegetal se consiguen en cualquier bodega; las probetas salen del kit del laboratorio."],
    seguridadDocente: "El aceite derramado vuelve el piso resbaladizo: tener papel absorbente a mano y limpiar de inmediato.",
    gestionTiempo: [
      { momento: "Presentación del propósito y entrega de la ficha", tiempo: "10 min", observacion: "Verificar que cada equipo tenga su ficha y su juego de materiales." },
      { momento: "1. Problematizamos (pregunta e hipótesis)", tiempo: "15 min", observacion: "Circular entre equipos para revisar la redacción de la hipótesis." },
      { momento: "2. Diseñamos la estrategia y armamos el montaje", tiempo: "15 min", observacion: "Confirmar que miden el mismo volumen para los tres líquidos." },
      { momento: "3. Registramos datos", tiempo: "20 min", observacion: "Insistir en anotar unidades en cada casilla de la tabla." },
      { momento: "4. Analizamos y concluimos", tiempo: "20 min", observacion: "Pedir que vuelvan a su tabla antes de escribir la conclusión." },
      { momento: "5. Evaluamos y comunicamos / cierre", tiempo: "10 min", observacion: "Dar la palabra a dos equipos con resultados distintos." }],
    orientaciones: [
      { momento: "1. Problematizamos", queObservar: "Si la hipótesis relaciona con claridad la variable independiente con la dependiente.", errorFrecuente: "Confunden causa y efecto, o formulan una pregunta que se responde con sí o no.", comoIntervenir: "Devolver la pregunta: qué van a cambiar ustedes y qué esperan que cambie por eso." },
      { momento: "2. Diseñamos la estrategia", queObservar: "Si el procedimiento que proponen es replicable y controla el volumen.", errorFrecuente: "No mantienen el mismo volumen en los tres líquidos.", comoIntervenir: "Preguntar qué pasaría si compararan 30 ml con 80 ml." },
      { momento: "3. Registramos datos", queObservar: "Precisión en las mediciones y orden en el registro de la tabla.", errorFrecuente: "Registran una sola medición en vez de repetirla.", comoIntervenir: "Sugerir una segunda medición y comparar ambas." },
      { momento: "4. Analizamos y concluimos", queObservar: "Si la conclusión responde a la hipótesis planteada al inicio.", errorFrecuente: "Concluyen con una opinión general sin referirse a sus datos.", comoIntervenir: "Pedir que señalen en su tabla la fila que sostiene su afirmación." },
      { momento: "5. Evaluamos y comunicamos", queObservar: "Calidad de la autoevaluación y disposición para compartir lo que no salió.", errorFrecuente: "Solo comparten el resultado final y omiten las dificultades.", comoIntervenir: "Cerrar destacando un error que un equipo corrigió." }],
    solucionario: {
      resultadoEsperado: "La miel queda abajo (1,4 g/ml), el agua en medio (1,0 g/ml) y el aceite arriba (0,9 g/ml), con una variación de 0,1 g/ml.",
      conclusionModelo: "El aceite flota sobre el agua y la miel se hunde porque, para un mismo volumen, cada líquido tiene una masa distinta." },
    dua: ["Múltiples medios de representación: ofrecer el procedimiento también en pictogramas.",
      "Múltiples medios de expresión: permitir registrar los datos en dibujo o dictarlos.",
      "Múltiples medios de compromiso: rotar los roles dentro del equipo."],
    rubrica: [
      { criterio: "Medición", logroDestacado: "Mide masa y volumen con unidades correctas, repite la medición y justifica el dato elegido.", logroEsperado: "Mide masa y volumen con unidades correctas en los tres líquidos.", enProceso: "Mide con apoyo del docente y olvida alguna unidad.", inicio: "Registra datos incompletos o sin unidades." },
      { criterio: "Explicación", logroDestacado: "Explica la relación entre densidad y posición y la aplica a un caso nuevo.", logroEsperado: "Explica la relación entre densidad y posición usando sus datos.", enProceso: "Describe lo observado sin relacionarlo con la densidad.", inicio: "Menciona lo que vio sin explicar por qué ocurre." },
      { criterio: "Conclusión", logroDestacado: "Concluye respondiendo a la hipótesis y señala qué mejoraría.", logroEsperado: "Concluye respondiendo directamente a la hipótesis planteada.", enProceso: "Concluye de forma general sin citar sus datos.", inicio: "No formula una conclusión relacionada con la práctica." },
      { criterio: "Seguridad y trabajo en equipo", logroDestacado: "Cumple las normas y ayuda a que su equipo las cumpla.", logroEsperado: "Cumple las normas de seguridad durante toda la práctica.", enProceso: "Necesita recordatorios para cumplir alguna norma.", inicio: "No cumple las normas sin acompañamiento constante." }],
  },
};

const grid = Array.from({ length: 20 }, (_, y) => Array.from({ length: 20 }, (_, x) => "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[(x + y) % 26]));
for (const [i, c] of [..."AGUA"].entries()) grid[0][i] = c;
export const wordsearch = { titulo: "El agua", palabras: ["AGUA"], gridData: { grid, gridSize: 20,
  placedWords: [{ word: "AGUA", row: 0, col: 0, direction: "horizontal" }] } };
export const complete = { session: { form, result: session }, instrument: { type: "checklist", form, resource: instrument },
  material: { type: "worksheet", form, resource: worksheet } };

/* ==========================================================================
   CONTENIDO EXTREMO

   El área más larga del catálogo, un título de más de 150 caracteres y
   párrafos que no caben en una celda. Sirve para comprobar que nada se corta
   ni desborda cuando el modelo se extiende.
   ========================================================================== */
const PARRAFO_LARGO = "Los estudiantes analizan la disponibilidad de agua en su comunidad, contrastan los registros de consumo de tres semanas consecutivas, identifican los momentos de mayor desperdicio, discuten en equipo las causas posibles y elaboran una explicación escrita que relaciona la evidencia recogida con los procesos del ciclo del agua estudiados en la sesión anterior, incorporando al menos dos fuentes de información revisadas en clase.";
export const formLargo = { ...form,
  area: "Desarrollo Personal, Ciudadanía y Cívica (DPCC)",
  institucion: "Institución Educativa Emblemática Nuestra Señora de la Asunción de Chiquián",
  tema: "Analizamos la convivencia democrática en el aula y construimos acuerdos que podamos sostener durante todo el año escolar en cada uno de nuestros espacios comunes" };
export const sessionLarga = { ...session,
  titulo: formLargo.tema,
  proposito: PARRAFO_LARGO,
  desempenosPrecisados: Array.from({ length: 6 }, (_, i) => ({ capacidad: `Capacidad número ${i + 1} con un nombre deliberadamente extenso para comprobar el ajuste`, desempeno: PARRAFO_LARGO })),
  criteriosDetallados: Array.from({ length: 8 }, (_, i) => ({ capacidad: `Capacidad ${i + 1}`, criterio: PARRAFO_LARGO, evidenciaObservable: PARRAFO_LARGO })),
  enfoquesTransversales: [{ enfoque: "Enfoque de derechos", valor: "Diálogo y concertación", actitudObservable: PARRAFO_LARGO }] };
export const instrumentoLargo = { titulo: formLargo.tema,
  criterios: Array.from({ length: 8 }, (_, i) => ({ criterio: `Criterio ${i + 1}: ${PARRAFO_LARGO}`,
    logroDestacado: PARRAFO_LARGO, logroEsperado: PARRAFO_LARGO, enProceso: PARRAFO_LARGO, inicio: PARRAFO_LARGO })) };

export const fixtures = [
  ["01-sesion.docx", "session", session], ["02-clase-completa.docx", "complete", complete],
  ["03-proyecto-steam.docx", "project", project], ["04-rubrica.docx", "rubric", { ...instrument, criterios: [...instrument.criterios, ...instrument.criterios.slice(0, 2)] }],
  ["05-lista-cotejo.docx", "checklist", instrument], ["06-escala.docx", "rating_scale", instrument],
  ["07-ficha-trabajo.docx", "worksheet", worksheet], ["08-ficha-lectura.docx", "reading", reading],
  ["09-reto-grupal.docx", "challenge", challenge], ["10-sopa-letras.docx", "wordsearch", wordsearch],
];
/** El caso DPCC se revisa aparte porque lleva su propio formulario. */
export const fixturasConFormulario = [
  ["11-sesion-dpcc.docx", "session", sessionDPCC, formDPCC],
  ["12-laboratorio.docx", "lab_guide", labGuide, formLab],
];

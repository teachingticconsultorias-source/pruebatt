// lib/atlas/textos-anatomia.es.js
//
// LOS TEXTOS EDUCATIVOS DE LA FICHA.
//
// DE DÓNDE SALE CADA PALABRA
// --------------------------
// Nada de esto está inventado. Cada bloque dice su origen:
//
//   · FUNCION_DE_SISTEMA y DESCRIPCION_DE_ORGANO son traducción de
//     `app/anatomy.ts` de human-atlas (MIT, © 2026 ashemag): sus `SYSTEMS[].
//     description` y su `EXPLANATIONS`.
//   · TEMAS es traducción de `src/content.js` de OMFAtlas (MIT, © 2026 Ahmad
//     Sofi-Mahmudi): sus `topics`, con las fuentes NCBI que el propio
//     proyecto cita.
//   · NOTA_DOCENTE lo escribió SciVerse. NO es un dato anatómico: es una
//     sugerencia de aula. Va rotulado como tal en la ficha para que nadie lo
//     confunda con contenido de la fuente.
//
// LO QUE NO HAY, NO SE INVENTA
// ---------------------------
// BodyParts3D no trae descripción por estructura. Sólo nueve órganos tienen
// texto propio en human-atlas. Para las 2.225 restantes la ficha enseña lo
// que sí existe —nombre, sistema, identificador FMA, región y relaciones— y
// calla el resto. Una descripción inventada para rellenar hueco sería el
// peor resultado posible en material que va a un aula.

/* ==========================================================================
   FUNCIÓN DE CADA SISTEMA
   Traducido de `SYSTEMS[].description` · human-atlas · MIT © 2026 ashemag
   ========================================================================== */
export const FUNCION_DE_SISTEMA = {
  skeletal:
    "Los huesos forman el armazón que sostiene el cuerpo, protegen los órganos y dan puntos de anclaje a los músculos. Su tejido interno además almacena minerales y produce células sanguíneas.",
  muscular:
    "Los músculos esqueléticos generan movimiento tirando de sus inserciones. Junto con los tendones mueven las articulaciones, estabilizan la postura y producen calor.",
  cardiac:
    "El corazón es una bomba muscular de cuatro cavidades. Sus válvulas dirigen la sangre hacia delante a través de los circuitos pulmonar y sistémico.",
  sensory:
    "Estas estructuras participan en los sentidos especiales, como la vista, la audición y el equilibrio. Sus tejidos especializados detectan estímulos y trabajan con el sistema nervioso para transmitir la información.",
  arterial:
    "El corazón impulsa la sangre por la circulación. Las arterias la llevan desde el corazón hasta los tejidos o, en el circuito pulmonar, hasta los pulmones.",
  venous:
    "Las venas devuelven la sangre hacia el corazón. Las redes superficial y profunda la recogen de los tejidos; las venas pulmonares traen de vuelta la sangre oxigenada desde los pulmones.",
  nervous:
    "El encéfalo, la médula espinal y los nervios periféricos transportan y procesan señales. Sostienen la sensibilidad, el movimiento, la coordinación y la regulación automática de las funciones del cuerpo.",
  respiratory:
    "Las vías aéreas conducen el aire hasta los pulmones, donde el oxígeno y el dióxido de carbono pasan entre el aire y la sangre. La respiración depende de los cambios de presión que producen los músculos respiratorios.",
  digestive:
    "El tubo digestivo descompone los alimentos, absorbe nutrientes y agua, y hace avanzar los residuos. Los órganos accesorios aportan bilis y enzimas digestivas.",
  urinary:
    "Los riñones filtran la sangre y regulan el equilibrio de líquidos, electrolitos y ácido-base. La orina viaja por los uréteres hasta la vejiga y sale por la uretra.",
  lymphatic:
    "Los vasos linfáticos devuelven a la circulación el exceso de líquido de los tejidos. Los ganglios y otros órganos linfoides sostienen la vigilancia y la respuesta inmunitarias.",
  endocrine:
    "Los órganos endocrinos liberan hormonas a la sangre para coordinar procesos como el metabolismo, el crecimiento, la respuesta al estrés y la reproducción.",
  reproductive:
    "Las estructuras reproductoras masculinas representadas aquí contribuyen a la producción, maduración y transporte de los espermatozoides, y a la producción de hormonas sexuales.",
  integumentary:
    "La superficie corporal da una referencia anatómica externa. El sistema tegumentario forma una barrera protectora y participa en la sensibilidad y en la regulación de la temperatura.",
  connective:
    "Los cartílagos, ligamentos y demás tejidos conectivos sostienen, unen y separan estructuras. Entre sus funciones están estabilizar articulaciones y repartir las cargas mecánicas.",
};

/* ==========================================================================
   DESCRIPCIÓN DE ÓRGANOS CONCRETOS
   Traducido de `EXPLANATIONS` · human-atlas · MIT © 2026 ashemag

   Son los nueve que el proyecto de origen documenta. Ni uno más: el resto de
   estructuras no tiene descripción propia en ninguna fuente reutilizable.
   ========================================================================== */
export const DESCRIPCION_DE_ORGANO = {
  Heart:
    "Bomba muscular situada en el tórax. Su lado derecho envía la sangre a los pulmones; su lado izquierdo la envía a la circulación sistémica.",
  Liver:
    "Órgano voluminoso bajo el lado derecho del diafragma. Procesa los nutrientes absorbidos, produce bilis y sintetiza muchas de las proteínas que viajan en la sangre.",
  Brain:
    "Órgano central del sistema nervioso. Sus regiones interconectadas sostienen la percepción, el movimiento, la memoria, el lenguaje y la regulación de las funciones corporales.",
  Stomach:
    "Cámara muscular entre el esófago y el intestino delgado. Almacena y mezcla los alimentos con ácido y enzimas antes de liberarlos al duodeno.",
  Spleen:
    "Órgano linfoide del abdomen superior izquierdo. Filtra la sangre, retira los glóbulos envejecidos y participa en la respuesta inmunitaria.",
  Pancreas:
    "Órgano abdominal con funciones digestivas y endocrinas. Aporta enzimas al intestino delgado y libera hormonas como la insulina y el glucagón.",
  "Urinary bladder":
    "Reservorio muscular situado en la pelvis que almacena la orina que llega desde los riñones por los uréteres.",
  Trachea:
    "Vía aérea principal que conecta la laringe con los bronquios. Sus anillos de cartílago mantienen la vía abierta durante la respiración.",
  Diaphragm:
    "Músculo ancho que separa el tórax del abdomen. Al contraerse aumenta el volumen torácico y ayuda a introducir aire en los pulmones.",
};

/* ==========================================================================
   TEMAS DE LA REGIÓN ORAL Y MAXILOFACIAL
   Traducido de `topics` · OMFAtlas · MIT © 2026 Ahmad Sofi-Mahmudi

   Cada tema se activa por el nombre de la estructura, igual que en el
   original. `fuente` es la referencia que el propio proyecto cita.
   ========================================================================== */
export const TEMAS = [
  {
    id: "mandibula",
    titulo: "La mandíbula",
    subtitulo: "Cuerpo, rama y relaciones neurovasculares",
    coincide: /^Mandible$/i,
    resumen:
      "La mandíbula forma el maxilar inferior. Su cuerpo sostiene los dientes inferiores, y sus dos ramas se extienden hacia las articulaciones temporomandibulares.",
    paraElAula:
      "Gira el modelo hasta la cara interna de la rama. Localiza el agujero mandibular y compara su posición con la del agujero mentoniano, en el cuerpo.",
    limite:
      "Este modelo de superficie no resuelve el nervio ni el trayecto del conducto en cada paciente.",
    fuente: {
      titulo: "Mandible anatomy",
      url: "https://www.ncbi.nlm.nih.gov/books/NBK532292/",
    },
  },
  {
    id: "denticion",
    titulo: "Dentición permanente",
    subtitulo: "Identidad del diente y notación FDI",
    coincide: /tooth|gingiva/i,
    resumen:
      "Incisivos, caninos, premolares y molares tienen formas de corona distintas. Selecciona un diente para ver su identificador FDI de dos dígitos.",
    paraElAula:
      "En la notación FDI el primer dígito indica el cuadrante desde el punto de vista del paciente: superior derecho 1, superior izquierdo 2, inferior izquierdo 3, inferior derecho 4. El segundo cuenta desde la línea media.",
    limite:
      "Esta referencia contiene 28 dientes permanentes: no incluye los terceros molares ni la dentición temporal. Las mallas muestran la forma externa; no modelan cámara pulpar, conductos radiculares ni ligamento periodontal.",
    fuente: {
      titulo: "Tooth anatomy",
      url: "https://www.ncbi.nlm.nih.gov/books/NBK557543/",
    },
  },
  {
    id: "maxilar",
    titulo: "El maxilar",
    subtitulo: "Arcada superior y esqueleto facial",
    coincide: /maxilla/i,
    resumen:
      "Los dos maxilares sostienen la dentición superior. Explora su relación con los huesos faciales vecinos y con la arcada superior.",
    paraElAula:
      "Selecciona cada maxilar y mira el cráneo desde abajo para examinar su aportación al paladar óseo.",
    limite:
      "Es una referencia anatómica, no una reconstrucción radiográfica. No se representan la mucosa sinusal ni las dimensiones óseas de cada paciente.",
    fuente: {
      titulo: "Masticatory system: anatomy and function",
      url: "https://www.ncbi.nlm.nih.gov/books/NBK557988/",
    },
  },
  {
    id: "atm",
    titulo: "ATM: relaciones óseas",
    subtitulo: "Cóndilo mandibular y hueso temporal",
    coincide: /^Mandible$|temporal bone/i,
    resumen:
      "La articulación temporomandibular une la mandíbula con el hueso temporal. Su movimiento combina rotación y traslación.",
    paraElAula:
      "Compara el cóndilo mandibular y el hueso temporal desde una vista lateral. El disco articular y la cápsula no están incluidos en este modelo.",
    limite:
      "Una geometría estática no puede demostrar el desplazamiento discal ni la mecánica mandibular, y no ofrece mediciones del espacio articular.",
    fuente: {
      titulo: "Temporomandibular joint anatomy",
      url: "https://www.ncbi.nlm.nih.gov/books/NBK538486/",
    },
  },
  {
    id: "suelo-boca",
    titulo: "Suelo de la boca",
    subtitulo: "Lengua, músculos y glándulas",
    coincide: /mylohyoid|geniohyoid|genioglossus|hyoglossus|Tongue|sublingual|submandibular/i,
    resumen:
      "Explora la lengua y las estructuras pares que hay debajo. Apaga la mandíbula para descubrir el conjunto del suelo de la boca.",
    paraElAula:
      "Identifica el milohioideo y compáralo con el geniohioideo. Usa la selección y el aislamiento para distinguir estructuras vecinas.",
    limite:
      "No están segmentados los conductos, los espacios fasciales ni las vías de diseminación de una infección.",
    fuente: {
      titulo: "Masticatory system: anatomy and function",
      url: "https://www.ncbi.nlm.nih.gov/books/NBK557988/",
    },
  },
];

/* ==========================================================================
   NOTA PARA EL AULA · contenido propio de SciVerse

   NO es anatomía: es didáctica. Sugiere cómo trabajar cada sistema en clase.
   Va rotulado aparte en la ficha, y su procedencia se dice en la propia
   interfaz, para que nadie lo lea como si viniera del dataset.
   ========================================================================== */
export const NOTA_DOCENTE = {
  skeletal:
    "Pide a tus estudiantes que localicen tres huesos en su propio cuerpo antes de buscarlos en el modelo. La comparación entre lo que se palpa y lo que se ve fija mejor el nombre que la lista.",
  muscular:
    "Aísla un músculo y pregunta qué articulación cruza. Un músculo que cruza una articulación la mueve: de ahí sale su función sin memorizarla.",
  cardiac:
    "Sigue el recorrido de una gota de sangre por las cuatro cavidades. Es la forma más rápida de entender por qué hay dos circuitos y no uno.",
  sensory:
    "Relaciona cada órgano con el sentido que sostiene y con el nervio que lo conecta al encéfalo. Ver los tres juntos evita estudiarlos por separado.",
  arterial:
    "Compara el calibre de la aorta con el de una arteria distal. La diferencia explica por qué la presión baja a lo largo del recorrido.",
  venous:
    "Enciende arterias y venas a la vez y busca los pares que viajan juntos. La disposición no es casual y se recuerda mejor viéndola.",
  nervous:
    "Aísla un nervio y sigue su trayecto hasta el músculo o la zona de piel que inerva. Es el mismo razonamiento que se usa en clínica.",
  respiratory:
    "Sigue el aire desde la tráquea hasta los bronquios segmentarios. La ramificación explica por qué una obstrucción afecta sólo a una parte del pulmón.",
  digestive:
    "Recorre el tubo de principio a fin y pregunta qué se absorbe en cada tramo. La longitud de cada porción tiene que ver con su función.",
  urinary:
    "Localiza los riñones respecto a la columna y sigue el uréter hasta la vejiga. La posición retroperitoneal se entiende mejor girando el modelo.",
  lymphatic:
    "Compara el recorrido linfático con el venoso. Que acaben en el mismo sitio explica para qué sirve el sistema.",
  endocrine:
    "Sitúa cada glándula y pregunta a qué distancia está su órgano diana. Que la señal viaje por la sangre y no por un nervio es la idea central.",
  reproductive:
    "Trabaja este sistema con el enfoque de educación sexual integral del CNEB: nombres correctos, sin eufemismos y con vocabulario científico.",
  integumentary:
    "La superficie corporal sirve de referencia para situar todo lo demás. Úsala como punto de partida antes de entrar en profundidad.",
  connective:
    "Busca dónde se unen dos huesos y qué hay entre ellos. El tejido conectivo se entiende por lo que separa y por lo que sostiene.",
};

/** Créditos de los textos. Se enseñan en la ficha, no sólo en un fichero. */
export const CREDITOS_TEXTO = {
  sistemas: {
    texto: "Descripciones de sistemas y órganos adaptadas de Human Atlas",
    autor: "© 2026 ashemag",
    licencia: "MIT",
    url: "https://github.com/ashemag/human-atlas",
  },
  temas: {
    texto: "Temas de la región oral y maxilofacial adaptados de OMF Atlas",
    autor: "© 2026 Ahmad Sofi-Mahmudi",
    licencia: "MIT",
    url: "https://github.com/choxos/OMFAtlas",
  },
};

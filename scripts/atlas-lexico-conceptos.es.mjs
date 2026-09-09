// scripts/atlas-lexico-conceptos.es.mjs
//
// VOCABULARIO DE LOS CONCEPTOS FMA
//
// `atlas.json` trae, además de las 2.234 estructuras, 3.432 conceptos de la
// Foundational Model of Anatomy, cada uno con la lista de mallas que le
// pertenece. Ese grafo es lo que permite decirle a la docente de qué región
// es una estructura y con qué se relaciona SIN inventarse nada: son datos del
// propio dataset.
//
// POR QUÉ VA APARTE DEL LÉXICO DE ESTRUCTURAS
// -------------------------------------------
// El vocabulario es distinto. Los nombres de estructura son concretos
// («arteria carótida común»); los de concepto son abstractos y jerárquicos
// («subdivision of», «zone of», «region of», «anatomical entity»). Mezclarlos
// en un solo diccionario haría difícil ver de dónde sale cada término, y
// —peor— cualquier término nuevo para conceptos podría cambiar en silencio la
// traducción de un nombre de estructura ya revisado.
//
// El generador fusiona los dos y comprueba que las 2.234 estructuras siguen
// traduciéndose exactamente igual que antes.

export const NUCLEOS_CONCEPTO = {
  subdivision: { es: "Subdivisión", g: "f" },
  organ: { es: "Órgano", g: "m" },
  organs: { es: "Órganos", g: "m", pl: true },
  zone: { es: "Zona", g: "f" },
  symphysis: { es: "Sínfisis", g: "f" },
  neuraxis: { es: "Neuroeje", g: "m" },
  region: { es: "Región", g: "f" },
  regions: { es: "Regiones", g: "f", pl: true },
  compartment: { es: "Compartimento", g: "m" },
  fascia: { es: "Fascia", g: "f" },
  nose: { es: "Nariz", g: "f" },
  system: { es: "Sistema", g: "m" },
  girdle: { es: "Cintura", g: "f" },
  skeleton: { es: "Esqueleto", g: "m" },
  layer: { es: "Capa", g: "f" },
  chest: { es: "Tórax", g: "m" },
  side: { es: "Lado", g: "m" },
  component: { es: "Componente", g: "m" },
  thigh: { es: "Muslo", g: "m" },
  myocardium: { es: "Miocardio", g: "m" },
  abdomen: { es: "Abdomen", g: "m" },
  sector: { es: "Sector", g: "m" },
  subsector: { es: "Subsector", g: "m" },
  musculature: { es: "Musculatura", g: "f" },
  anastomosis: { es: "Anastomosis", g: "f" },
  tissue: { es: "Tejido", g: "m" },
  pelvis: { es: "Pelvis", g: "f" },
  cluster: { es: "Grupo", g: "m" },
  clusters: { es: "Grupos", g: "m", pl: true },
  mouth: { es: "Boca", g: "f" },
  brain: { es: "Encéfalo", g: "m" },
  heart: { es: "Corazón", g: "m" },
  knee: { es: "Rodilla", g: "f" },
  space: { es: "Espacio", g: "m" },
  column: { es: "Columna", g: "f" },
  shoulder: { es: "Hombro", g: "m" },
  arm: { es: "Brazo", g: "m" },
  larynx: { es: "Laringe", g: "f" },
  lung: { es: "Pulmón", g: "m" },
  content: { es: "Contenido", g: "m" },
  neck: { es: "Cuello", g: "m" },
  peritoneum: { es: "Peritoneo", g: "m" },
  diencephalon: { es: "Diencéfalo", g: "m" },
  outflow: { es: "Tracto de salida", g: "m" },
  inflow: { es: "Tracto de entrada", g: "m" },
  mediastinum: { es: "Mediastino", g: "m" },
  eye: { es: "Ojo", g: "m" },
  thorax: { es: "Tórax", g: "m" },
  pharynx: { es: "Faringe", g: "f" },
  laryngopharynx: { es: "Laringofaringe", g: "f" },
  face: { es: "Cara", g: "f" },
  cage: { es: "Caja", g: "f" },
  back: { es: "Espalda", g: "f" },
  vertebrae: { es: "Vértebras", g: "f", pl: true },
  portion: { es: "Porción", g: "f" },
  bile: { es: "Bilis", g: "f" },
  palate: { es: "Paladar", g: "m" },
  entity: { es: "Entidad", g: "f" },
  circle: { es: "Círculo", g: "m" },
  hindbrain: { es: "Rombencéfalo", g: "m" },
  tectum: { es: "Techo", g: "m" },
  dorsum: { es: "Dorso", g: "m" },
  metencephalon: { es: "Metencéfalo", g: "m" },
  hairs: { es: "Vello", g: "m" },
  dura: { es: "Duramadre", g: "f" },
  cell: { es: "Celdilla", g: "f" },
  perineum: { es: "Periné", g: "m" },
  hemiliver: { es: "Hemihígado", g: "m" },
  orbit: { es: "Órbita", g: "f" },
  cheek: { es: "Mejilla", g: "f" },
  apparatus: { es: "Aparato", g: "m" },
  subcortex: { es: "Subcorteza", g: "f" },
  archicortex: { es: "Arquicorteza", g: "f" },
  formation: { es: "Formación", g: "f" },
  decussation: { es: "Decusación", g: "f" },
  line: { es: "Línea", g: "f" },
  continuity: { es: "Continuidad", g: "f" },
  conduit: { es: "Conducto", g: "m" },
  boundary: { es: "Límite", g: "m" },
  incisure: { es: "Incisura", g: "f" },
  complex: { es: "Complejo", g: "m" },
  parts: { es: "Partes", g: "f", pl: true },
  curtain: { es: "Cortina", g: "f" },
  cecum: { es: "Ciego", g: "m" },
  mons: { es: "Monte", g: "m" },
  pubis: { es: "Pubis", g: "m" },
  skull: { es: "Cráneo", g: "m" },
  basicranium: { es: "Base del cráneo", g: "f" },
  neurocranium: { es: "Neurocráneo", g: "m" },
  viscerocranium: { es: "Viscerocráneo", g: "m" },
  uvula: { es: "Úvula", g: "f" },
  root: { es: "Raíz", g: "f" },
  epithalamus: { es: "Epitálamo", g: "m" },
  integument: { es: "Tegumento", g: "m" },
  brainstem: { es: "Tronco encefálico", g: "m" },
  epithelium: { es: "Epitelio", g: "m" },
  leaf: { es: "Hoja", g: "f" },
  epidermis: { es: "Epidermis", g: "f" },
  appendage: { es: "Anexo", g: "m" },
  quadriceps: { es: "Cuádriceps", g: "m" },
  // En los conceptos, «limb» es siempre miembro (superior o inferior). En los
  // nombres de estructura es el brazo de la cápsula interna, y por eso el
  // léxico base lo traduce distinto: cada diccionario con su significado.
  limb: { es: "Miembro", g: "m" },
};

export const MODIFICADORES_CONCEPTO = {
  bronchopulmonary: "broncopulmonar",
  investing: "de revestimiento",
  free: { m: "libre", f: "libre" },
  subsegmental: { m: "subsegmentario", f: "subsegmentaria" },
  anatomical: { m: "anatómico", f: "anatómica" },
  intrapulmonary: "intrapulmonar",
  intrinsic: { m: "intrínseco", f: "intrínseca" },
  extrinsic: { m: "extrínseco", f: "extrínseca" },
  systemic: { m: "sistémico", f: "sistémica" },
  bony: { m: "óseo", f: "ósea" },
  osseous: { m: "óseo", f: "ósea" },
  vascular: "vascular",
  large: { m: "grueso", f: "gruesa" },
  fibrous: { m: "fibroso", f: "fibrosa" },
  postvertebral: "posvertebral",
  prevertebral: "prevertebral",
  nervous: { m: "nervioso", f: "nerviosa" },
  gray: { m: "gris", f: "gris" },
  variant: { m: "variante", f: "variante" },
  parasympathetic: { m: "parasimpático", f: "parasimpática" },
  connective: { m: "conectivo", f: "conectiva" },
  "in-vivo": "in vivo",
  lobular: "lobulillar",
  apicoposterior: "apicoposterior",
  cartilaginous: { m: "cartilaginoso", f: "cartilaginosa" },
  myocardial: { m: "miocárdico", f: "miocárdica" },
  autonomic: { m: "autónomo", f: "autónoma" },
  salivary: "salival",
  neural: "neural",
  peritoneal: "peritoneal",
  visceral: "visceral",
  skeletal: { m: "esquelético", f: "esquelética" },
  nonskeletal: { m: "no esquelético", f: "no esquelética" },
  suboccipital: "suboccipital",
  heterogeneous: { m: "heterogéneo", f: "heterogénea" },
  gastrointestinal: "gastrointestinal",
  inferomedial: "inferomedial",
  limbic: { m: "límbico", f: "límbica" },
  patellar: { m: "rotuliano", f: "rotuliana" },
  subendocardial: { m: "subendocárdico", f: "subendocárdica" },
  hippocampal: "hipocampal",
  flat: { m: "plano", f: "plana" },
  pneumatized: { m: "neumatizado", f: "neumatizada" },
  true: { m: "verdadero", f: "verdadera" },
  typical: { m: "típico", f: "típica" },
  atypical: { m: "atípico", f: "atípica" },
  false: { m: "falso", f: "falsa" },
  floating: "flotante",
  infrahyoid: "infrahioideo",
  suprahyoid: "suprahioideo",
  extrahepatic: { m: "extrahepático", f: "extrahepática" },
  intrahepatic: { m: "intrahepático", f: "intrahepática" },
  coeliac: { m: "celíaco", f: "celíaca" },
  coli: "del colon",
  loose: { m: "laxo", f: "laxa" },
  mucoid: "mucoide",
  "extra-ocular": "extraocular",
  trigeminal: "trigeminal",
  laryngeal: { m: "laríngeo", f: "laríngea" },
  parenchymatous: { m: "parenquimatoso", f: "parenquimatosa" },
  corticomedullary: "corticomedular",
  hollow: { m: "hueco", f: "hueca" },
  auriculotemporal: "auriculotemporal",
  serous: { m: "seroso", f: "serosa" },
  scalene: { m: "escaleno", f: "escalena" },
  thenar: "tenar",
  hypothenar: "hipotenar",
  immaterial: "inmaterial",
  articular: "articular",
  facial: "facial",
  intracranial: "intracraneal",
  supreme: { m: "supremo", f: "suprema" },
  caval: { m: "cavo", f: "cava" },
  membranous: { m: "membranoso", f: "membranosa" },
  nuclear: "nuclear",
  circumventricular: "circunventricular",
  genital: "genital",
  subaortic: { m: "subaórtico", f: "subaórtica" },
  endocrine: { m: "endocrino", f: "endocrina" },
  sternal: "esternal",
  soft: { m: "blando", f: "blanda" },
  mandibular: "mandibular",
  maxillary: "maxilar",
  faucial: "faucial",
  "antero-medial": "anteromedial",
  axial: "axial",
  integumentary: { m: "tegumentario", f: "tegumentaria" },
  fascial: "fascial",
  pancreaticobiliary: "pancreatobiliar",
  basicranial: "basicraneal",
  irregular: "irregular",
  cavernous: { m: "cavernoso", f: "cavernosa" },
  mater: { m: "madre", f: "madre" },
  subarachnoid: { m: "subaracnoideo", f: "subaracnoidea" },
  pineal: "pineal",
  alimentary: { m: "alimentario", f: "alimentaria" },
  musculoskeletal: { m: "musculoesquelético", f: "musculoesquelética" },
  tracheobronchial: "traqueobronquial",
  pulmopleural: "pulmopleural",
  cavitated: { m: "cavitado", f: "cavitada" },
  cardinal: "cardinal",
  lata: "lata",
  vivo: "vivo",
  // Erratas del origen. Se corrigen aquí en vez de tocar `atlas.json`, que se
  // conserva tal cual llegó de BodyParts3D.
  subdivisionof: { m: "subdivisión de", f: "subdivisión de" },
};

/** Conceptos con nombre propio, donde las reglas generales no acertarían. */
export const FRASES_CONCEPTO = {
  "human body": "Cuerpo humano",
  "body proper": "Cuerpo propiamente dicho",
  "anatomical entity": "Entidad anatómica",
  "physical anatomical entity": "Entidad anatómica física",
  "material anatomical entity": "Entidad anatómica material",
  "immaterial anatomical entity": "Entidad anatómica inmaterial",
  "anatomical structure": "Estructura anatómica",
  "dura mater": "Duramadre",
  "pia mater": "Piamadre",
  // `normalizar()` quita los paréntesis, así que la clave va sin ellos.
  "skeleton in vivo": "Esqueleto in vivo",
  "in-vivo skeleton": "Esqueleto in vivo",
  "right liver in-vivo": "Hígado derecho in vivo",
  "left liver in-vivo": "Hígado izquierdo in vivo",
  "liver in-vivo": "Hígado in vivo",
  "lower jaw": "Maxilar inferior",
  "upper jaw": "Maxilar superior",
  "large intestine": "Intestino grueso",
  "small intestine": "Intestino delgado",
  "mons pubis": "Monte del pubis",
  "gray matter": "Sustancia gris",
  "white matter": "Sustancia blanca",
  "muscles of mastication": "Músculos de la masticación",
  "body cavity content": "Contenido de las cavidades corporales",
  "head": "Cabeza",
  "neck": "Cuello",
  "face": "Cara",
  "mouth": "Boca",
  "skull": "Cráneo",
  "thorax": "Tórax",
  "abdomen": "Abdomen",
  "pelvis": "Pelvis",
  "perineum": "Periné",
  "trunk": "Tronco",
  "back": "Espalda",
  "shoulder": "Hombro",
  "mediastinum": "Mediastino",
  "vertebral column": "Columna vertebral",
  "rib cage": "Caja torácica",
  "lower limb": "Miembro inferior",
  "branch of anterior choroidal artery to posterior limb of internal capsule":
    "Rama de la arteria coroidea anterior para el brazo posterior de la cápsula interna",
  "branch of right anterior choroidal artery to posterior limb of right internal capsule":
    "Rama de la arteria coroidea anterior derecha para el brazo posterior de la cápsula interna derecha",
  "branch of left anterior choroidal artery to posterior limb of left internal capsule":
    "Rama de la arteria coroidea anterior izquierda para el brazo posterior de la cápsula interna izquierda",
  "upper limb": "Miembro superior",
  "neurocranium": "Neurocráneo",
  "viscerocranium": "Viscerocráneo",
};

/**
 * Conceptos que sitúan una estructura en el cuerpo.
 *
 * Son los que se enseñan como «Localización». Se listan a mano porque el
 * dataset no marca cuáles son regiones: mezcla regiones anatómicas con
 * clasificaciones («órgano hueco») y con sistemas, y enseñar «órgano hueco»
 * como localización sería confundir a quien lee.
 *
 * El orden va de lo general a lo concreto: así la ficha lee «Cabeza · Cara ·
 * Boca» y no al revés.
 */
export const CONCEPTOS_DE_REGION = [
  "FMA20394",   // human body
  "FMA7181",    // trunk
  "FMA7154",    // head
  "FMA7155",    // neck
  "FMA24728",   // face
  "FMA46565",   // skull
  "FMA53672",   // neurocranium
  "FMA53673",   // viscerocranium
  "FMA49184",   // mouth
  "FMA9576",    // thorax
  "FMA9826",    // mediastinum
  "FMA9827",    // superior mediastinum
  "FMA9577",    // abdomen
  "FMA9578",    // pelvis
  "FMA9579",    // perineum
  "FMA7480",    // rib cage
  "FMA13478",   // vertebral column
  "FMA7184",    // lower limb
];

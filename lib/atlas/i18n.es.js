// lib/atlas/i18n.es.js
//
// TODO EL TEXTO DEL ATLAS, EN UN SOLO SITIO.
//
// POR QUÉ NO SE TRADUCE EN CALIENTE
// ---------------------------------
// Un traductor automático en el navegador convierte «Left lower first
// secondary molar tooth» en algo que ningún odontólogo reconoce, y lo hace
// distinto cada vez. Aquí el texto está escrito, revisado y versionado: lo
// que lee la docente es lo que alguien decidió que leyera.
//
// Los nombres de las 2.234 estructuras NO están aquí —son datos, no
// interfaz— y viven en `public/models/atlas-es.json`, generado por
// `scripts/build-atlas-es.mjs` a partir de un léxico traducido a mano.

export const T = {
  /* ------------------------------------------------------------ CABECERAS */
  humano: {
    titulo: "Atlas del cuerpo humano",
    subtitulo: "Explora los sistemas y estructuras del cuerpo humano en 3D.",
  },
  omf: {
    titulo: "Atlas oral y maxilofacial",
    subtitulo:
      "Explora estructuras de cabeza, cuello, cavidad oral y región maxilofacial en 3D.",
  },

  /* -------------------------------------------------------------- CONTROLES */
  restablecer: "Restablecer",
  centrar: "Centrar modelo",
  acercar: "Acercar",
  alejar: "Alejar",
  sistemas: "Sistemas",
  categorias: "Categorías",
  informacion: "Información",
  pantallaCompleta: "Pantalla completa",
  salirPantallaCompleta: "Salir de pantalla completa",
  ocultar: "Ocultar",
  mostrar: "Mostrar",
  aislar: "Aislar",
  dejarDeAislar: "Dejar de aislar",
  minimizar: "Minimizar",
  maximizar: "Maximizar",
  cerrar: "Cerrar",
  abrir: "Abrir",

  /* ------------------------------------------------------------- BÚSQUEDA */
  buscar: "Buscar una estructura",
  buscarCorto: "Buscar",
  sinResultados: "No encontramos ninguna estructura con ese nombre.",
  resultados: (n) => (n === 1 ? "1 estructura" : `${n} estructuras`),
  limpiarBusqueda: "Limpiar la búsqueda",

  /* --------------------------------------------------------------- VISTAS */
  vista: "Vista",
  anterior: "Anterior",
  posterior: "Posterior",
  izquierda: "Izquierda",
  derecha: "Derecha",
  superiorVista: "Superior",

  /* -------------------------------------------------------------- PANELES */
  todosLosSistemas: "Todos los sistemas",
  mostrarTodo: "Mostrar todo",
  ocultarTodo: "Ocultar todo",
  estructurasVisibles: (n) =>
    n === 1 ? "1 estructura visible" : `${n} estructuras visibles`,
  seleccionaEstructura: "Toca una estructura del modelo para ver su información.",
  sinSeleccion: "Ninguna estructura seleccionada",
  perteneceA: "Pertenece a",
  identificador: "Identificador anatómico",
  origenDelDato: "Origen del modelo",
  quitarSeleccion: "Quitar la selección",
  volverAlModelo: "Volver al modelo",

  /* ------------------------------------------------------- FICHA COMPLETA */
  descripcion: "Descripción",
  funcion: "Función",
  funcionDelSistema: "Función del sistema",
  localizacion: "Localización",
  relaciones: "Grupos anatómicos",
  relacionadas: "Explorar estructuras relacionadas",
  importanciaEducativa: "Para el aula",
  notaDelTema: "Ten en cuenta",
  nombreOriginal: "Nombre en el modelo original",
  sinTraduccion: "Sin traducción revisada",
  numeroFdi: "Número FDI",
  fdiExplicacion:
    "Notación FDI. El primer dígito es el cuadrante desde el punto de vista del paciente; el segundo cuenta desde la línea media.",
  agrupaEstructuras: (n) => `${n} estructuras`,
  segunElGrupo: (nombre) => `Comparten «${nombre}»`,

  /* ------------------------------------------------- OCULTAR Y AISLAR */
  aislamientoActivo: "Estás viendo una estructura aislada.",
  salirDelAislamiento: "Salir del aislamiento",
  ocultas: (n) => (n === 1 ? "1 estructura oculta" : `${n} estructuras ocultas`),
  restaurarOcultas: "Restaurar ocultas",
  estaOculta: "Esta estructura está oculta.",

  /* --------------------------------------------------------------- ESTADOS */
  preparando: "Preparando el atlas 3D…",
  cargandoEstructuras: "Cargando estructuras anatómicas…",
  casiListo: "Casi listo…",
  progreso: (pct) => `${pct}%`,

  /* --------------------------------------------------------------- ERRORES */
  errorTitulo: "No pudimos cargar el atlas 3D.",
  errorWebgl: "Tu dispositivo o navegador no pudo iniciar la visualización 3D.",
  errorReintento: "Intenta recargar la vista.",
  errorAccion: "Recargar la vista",
  errorVolver: "Volver al panel",
  errorDetalle:
    "Si vuelve a ocurrir, prueba con otro navegador o con un equipo distinto.",

  /* ------------------------------------------------------------- INSTRUCCIONES */
  ayudaEscritorio:
    "Arrastra para girar · rueda para acercar · clic en una estructura para verla.",
  ayudaMovil: "Arrastra para girar · pellizca para acercar · toca una estructura.",
  lienzoEtiqueta:
    "Modelo anatómico interactivo. Arrastra para girar, pellizca o usa la rueda para acercar, y toca una estructura para consultarla.",

  /* ------------------------------------------------------------- ATRIBUCIÓN */
  atribucionTitulo: "Créditos del modelo",
  atribucionTexto:
    "Geometría de BodyParts3D 4.0, © The Database Center for Life Science, bajo licencia Creative Commons Atribución 4.0 Internacional.",
  atribucionEnlace: "Ver la licencia",
  atribucionUrl: "https://creativecommons.org/licenses/by/4.0/deed.es",
  atribucionAviso:
    "Material educativo. No sustituye a un texto de anatomía ni sirve para diagnóstico.",
};

/* ==========================================================================
   SISTEMAS DEL CUERPO

   Las claves son las que trae el manifiesto de BodyParts3D. El color es el
   que usa el modelo cuando ese sistema está visible: se eligió dentro de la
   paleta de SciVerse para que el lienzo no parezca de otra aplicación.
   ========================================================================== */
export const SISTEMAS = {
  skeletal: { nombre: "Esqueleto", color: "#E8EFEF" },
  muscular: { nombre: "Músculos", color: "#D9705F" },
  cardiac: { nombre: "Corazón", color: "#C43D2A" },
  arterial: { nombre: "Arterias", color: "#D9421F" },
  venous: { nombre: "Venas", color: "#3B6FD4" },
  lymphatic: { nombre: "Sistema linfático", color: "#7FB069" },
  nervous: { nombre: "Sistema nervioso", color: "#FFBB00" },
  sensory: { nombre: "Órganos de los sentidos", color: "#B98BD1" },
  respiratory: { nombre: "Sistema respiratorio", color: "#6FD4CE" },
  digestive: { nombre: "Sistema digestivo", color: "#E0A458" },
  urinary: { nombre: "Sistema urinario", color: "#4FA3A0" },
  reproductive: { nombre: "Sistema reproductor", color: "#C98BB0" },
  endocrine: { nombre: "Sistema endocrino", color: "#8FBF6A" },
  connective: { nombre: "Tejido conectivo", color: "#C6D3D2" },
  integumentary: { nombre: "Piel y anexos", color: "#F0C9A8" },
};

/** Nombre legible de un sistema, con respaldo por si el manifiesto crece. */
export function nombreDeSistema(clave) {
  return SISTEMAS[clave]?.nombre || "Otras estructuras";
}

export function colorDeSistema(clave) {
  return SISTEMAS[clave]?.color || "#B4C6C4";
}

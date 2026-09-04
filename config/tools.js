import {
  BookOpen, ClipboardList, CheckCircle2, ListChecks, FileText, Cog,
  Search, Users, Sparkles, CalendarDays,
} from "lucide-react";

/* ==========================================================================
   CATÁLOGO ÚNICO DE HERRAMIENTAS

   Lo consumen tanto el estudio de creación como el catálogo de herramientas,
   para no mantener dos sistemas visuales distintos.

   `status` describe el estado REAL de cada herramienta:
     available  → funciona de extremo a extremo hoy
     soon       → visible pero sin backend: abre openComingSoon()

   `action` indica cómo se activa:
     create   → abre el generador dentro del estudio (`creation = id`)
     navigate → lleva a otra sección de la aplicación
     soon     → modal de próximamente

   ⚠️ El crucigrama NO está aquí: su generador era una simulación
   (setTimeout + eco de las pistas) y se retiró en el Bloque B. No volver a
   añadirlo sin un algoritmo real. Ver docs/audit/10-FEATURE-AUDIT.md.
   ========================================================================== */

export const TOOL_GROUPS = [
  {
    id: "planificar",
    title: "Planificar",
    desc: "Diseña la clase completa o cada pieza por separado.",
    tools: [
      {
        id: "complete",
        name: "Clase completa",
        desc: "Sesión, instrumento de evaluación y material en un mismo recorrido.",
        icon: Sparkles,
        action: "create",
        status: "available",
        badge: { tone: "brand", label: "Recomendado" },
      },
      {
        id: "session",
        name: "Sesión de aprendizaje",
        desc: "Propósito, criterios, evidencia y secuencia didáctica del área.",
        icon: BookOpen,
        action: "create",
        status: "available",
      },
      {
        id: "project-v2",
        name: "Proyecto STEAM",
        desc: "Proyecto interdisciplinario organizado entre 1 y 4 semanas.",
        icon: CalendarDays,
        action: "create",
        status: "available",
      },
      {
        id: "unit",
        name: "Unidad de aprendizaje",
        desc: "Secuencia de sesiones articuladas por una situación significativa.",
        icon: Cog,
        action: "soon",
        status: "soon",
      },
    ],
  },
  {
    id: "evaluar",
    title: "Evaluar",
    desc: "Instrumentos con criterios observables, listos para el registro de aula.",
    tools: [
      {
        id: "rubric",
        name: "Rúbrica de evaluación",
        desc: "Criterios con descriptores progresivos por nivel de logro.",
        icon: ClipboardList,
        action: "create",
        status: "available",
      },
      {
        id: "checklist",
        name: "Lista de cotejo",
        desc: "Verificación rápida con Sí, No y observaciones.",
        icon: CheckCircle2,
        action: "create",
        status: "available",
      },
      {
        id: "rating-scale",
        name: "Escala de valoración",
        desc: "Por nivel de logro o por frecuencia de la conducta observada.",
        icon: ListChecks,
        action: "create",
        status: "available",
      },
    ],
  },
  {
    id: "materiales",
    title: "Crear materiales",
    desc: "Recursos para que tus estudiantes practiquen y comprendan.",
    tools: [
      {
        id: "worksheet-v2",
        name: "Ficha de trabajo",
        desc: "Preguntas y actividades listas para imprimir y repartir.",
        icon: FileText,
        action: "create",
        status: "available",
      },
      {
        id: "reading-v2",
        name: "Ficha de lectura",
        desc: "Texto original con preguntas literal, inferencial y crítica.",
        icon: BookOpen,
        action: "create",
        status: "available",
      },
    ],
  },
  {
    id: "dinamicas",
    title: "Proyectos y dinámicas",
    desc: "Actividades para mover el aula y trabajar en equipo.",
    tools: [
      {
        id: "wordsearch",
        name: "Sopa de letras",
        desc: "Cuadrícula con solucionario, generada al momento.",
        icon: Search,
        action: "create",
        status: "available",
      },
      {
        id: "retos",
        name: "Reto grupal",
        desc: "Roles, reglas, producto final y criterios observables.",
        icon: Users,
        action: "navigate",
        target: "retos",
        status: "available",
      },
    ],
  },
];

/** Índice plano por id, para resolver etiquetas y descripciones. */
export const TOOLS_BY_ID = TOOL_GROUPS.reduce((acc, group) => {
  group.tools.forEach((tool) => {
    acc[tool.id] = { ...tool, groupId: group.id, groupTitle: group.title };
  });
  return acc;
}, {});

export const COMING_SOON_COPY = {
  unit: {
    title: "Unidad de aprendizaje",
    description:
      "Estamos terminando esta herramienta para que genere una secuencia completa de sesiones articuladas, no solo un esquema.",
    detail:
      "Mientras tanto puedes crear cada sesión por separado y agruparlas en tu biblioteca.",
  },
};

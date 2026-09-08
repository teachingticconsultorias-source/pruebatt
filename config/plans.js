/* ==========================================================================
   FUENTE ÚNICA DE PLANES, PRECIOS Y CONTACTO
   ==========================================================================

   ⚠️ TODO: confirmar precio comercial

   La auditoría encontró una contradicción que NO puede resolverse desde el
   código, porque depende de una decisión de negocio:

     • El copy del plan gratuito prometía "5 actividades + 5 instrumentos +
       5 materiales" semanales, es decir 15 creaciones.
     • La base de datos concede UN SOLO cupo compartido de 5 por semana
       (docentes.ai_weekly_limit, por defecto 5).

   Mientras no se confirme la intención comercial, el texto describe lo que
   el sistema realmente entrega, para no prometer al docente algo que no va
   a recibir. Si la intención es 15/semana, el cambio correcto NO es el copy:
   es subir ai_weekly_limit en Supabase.

   El número real que ve la docente sale SIEMPRE de la API de créditos
   (CreditsIndicator), no de esta constante.
   ========================================================================== */

/**
 * WhatsApp de CONTACTO GENERAL. Antes estaba repetido en 8 sitios de App.jsx.
 *
 * ⚠️ NO ES EL WHATSAPP DE PAGOS. Son dos canales distintos y conviene no
 * confundirlos:
 *
 *   · éste          → dudas, consultas institucionales, Libro de Reclamaciones.
 *                     Vive aquí porque es identidad de la empresa, no
 *                     configuración comercial.
 *   · el de pagos   → `payment_settings.whatsapp`, editable desde
 *                     Administración, y sólo se usa DESPUÉS de que una docente
 *                     registre su solicitud (`components/account/avisoWhatsApp.js`).
 *
 * Ningún botón de compra debe apuntar aquí: comprar ocurre dentro de SciVerse.
 */
export const WHATSAPP_NUMBER = "51921090875";

export function whatsappLink(message) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

/** Cupo semanal del plan gratuito, según la base de datos. */
export const FREE_WEEKLY_AI_LIMIT = 5;

export const CONTACT = {
  email: "teachingticconsultorias@gmail.com",
  phoneLabel: "+51 921 090 875",
  company: "Teaching TIC Consultorías S.A.C.",
  ruc: "20607945331",
  facebook: "https://www.facebook.com/teachingticconsultorias/",
};

/* --------------------------------------------------------------------------
   RESPALDO DEL CATÁLOGO

   ⚠️ ESTO NO ES LA FUENTE DE VERDAD. Lo es `public.plans`, que se edita desde
   Administración; `components/usePlanCatalog.js` la lee y esto sólo se usa
   mientras carga o si la consulta falla.

   Antes aquí ponía «Todo ilimitado», «Sesiones de aprendizaje ilimitadas» e
   «Instrumentos de evaluación ilimitados». El plan real da 100 creaciones por
   semana. Prometer ilimitado y aplicar un tope no se arregla suavizando el
   texto: se arregla haciendo que el texto salga del mismo sitio que el límite
   que aplica el servidor.

   Si algún día esto y la base dicen cosas distintas, la base tiene razón y
   esto hay que corregirlo.
   ------------------------------------------------------------------------ */
export const FALLBACK_PLANS = [
  {
    id: "free",
    name: "Gratuito",
    price: "0",
    period: "para conocer SciVerse",
    saving: `${FREE_WEEKLY_AI_LIMIT} creaciones con IA por semana`,
    featured: false,
    tagline: "Ideal para probar SciVerse en tu próxima clase.",
    benefits: [
      `${FREE_WEEKLY_AI_LIMIT} creaciones con IA por semana`,
      "Acceso a todas las herramientas",
      "Exportación a Word",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: "20",
    period: "por 1 mes",
    saving: "100 creaciones con IA por semana",
    featured: true,
    tagline: "Plan mensual con 100 creaciones con IA por semana.",
    benefits: [
      "100 creaciones con IA por semana",
      "Sesiones de aprendizaje, fichas, instrumentos y proyectos STEAM",
      "Exportación a Word de todo lo que crees",
      "Vigencia de 1 mes desde la activación",
    ],
  },
];

/** @deprecated Usa `usePlanCatalog()`: esto es sólo el respaldo. */
export const PLANS = FALLBACK_PLANS;

/** Plan institucional: sin precio publicado, se cotiza. No inventar cifras. */
export const INSTITUTIONAL_PLAN = {
  id: "institucional",
  name: "Institucional",
  tagline: "Para colegios y redes educativas.",
  benefits: [
    "Licencias para todo el equipo docente",
    "Capacitación para la institución",
    "Acompañamiento en la implementación",
  ],
};

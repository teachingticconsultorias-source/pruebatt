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

/** Contacto comercial único. Antes estaba repetido en 8 sitios de App.jsx. */
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

export const PLANS = [
  {
    id: "gratuito",
    name: "Gratuito",
    price: "0",
    period: "para conocer SciVerse",
    saving: "Sin tarjeta",
    featured: false,
    tagline: "Ideal para probar SciVerse en tu próxima clase.",
    benefits: [
      `${FREE_WEEKLY_AI_LIMIT} creaciones con IA por semana (sesiones, instrumentos o materiales)`,
      "Banco de actividades STEAM completo",
      "Retos grupales y plantillas",
      "Exportación a Word",
      "Acceso a comunidad de WhatsApp",
    ],
  },
  {
    id: "mensual",
    name: "Mensual",
    price: "20",
    period: "por 1 mes",
    saving: "Todo ilimitado",
    featured: true,
    tagline: "Para quien planifica todas sus sesiones con SciVerse.",
    benefits: [
      "Sesiones de aprendizaje ilimitadas",
      "Actividades STEAM y recursos CNEB ilimitados",
      "Instrumentos de evaluación ilimitados",
      "Materiales editables sin límite",
      "Exportación Word, PDF y PPT sin marca de agua",
      "Plantillas y fichas personalizables",
      "Primaria y Secundaria",
      "Soporte prioritario por WhatsApp",
    ],
  },
];

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

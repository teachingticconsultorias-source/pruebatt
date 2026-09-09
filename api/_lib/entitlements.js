// api/_lib/entitlements.js
//
// QUÉ PUEDE HACER CADA PLAN. UNA SOLA FUENTE.
//
// POR QUÉ AQUÍ Y NO REPARTIDO
// ---------------------------
// La alternativa era `if (plan === "pro")` en cada endpoint. Con dos límites
// eso parece más simple; con ocho y creciendo, garantiza que un día la ficha
// de trabajo permita 20 preguntas a Free porque alguien tocó un endpoint y no
// los otros. El límite se decide en un sitio y se aplica en todos.
//
// NO ES UN SEGUNDO SISTEMA DE CRÉDITOS
// ------------------------------------
// El cupo semanal ya lo lleva `consume_ai_credit` contra
// `plans.ai_weekly_limit`, y eso NO se toca. `weekly_ai_credits` aparece aquí
// sólo como espejo informativo para la interfaz: quien manda sigue siendo la
// base. Duplicar el contador sería la manera más rápida de que un docente
// tuviera dos saldos distintos.
//
// DÓNDE VIVEN ESTOS VALORES
// -------------------------
// En `public.plans.features`, la columna jsonb que 002 creó exactamente para
// esto («interruptores de beneficio; nada que el backend deba hacer cumplir
// por sí solo» — matiz que este bloque cambia: ahora sí se hacen cumplir, y
// por eso el servidor los valida en lugar de confiar en el cliente).
//
// `get_my_plan()` ya devuelve `features`, así que no hace falta ninguna
// consulta nueva. Los valores de abajo son el respaldo mientras la migración
// 009 no esté aplicada, y la red si un plan llega con `features` vacío.

import { callRpc } from "./supabase.js";

/**
 * Respaldo. Debe decir lo mismo que sembrará 009_plan_entitlements.sql.
 * Si algún día divergen, manda la base.
 */
export const CAPACIDADES_POR_DEFECTO = {
  free: {
    weekly_ai_credits: 5,
    worksheet_max_questions: 10,
    reading_max_questions: 10,
    rubric_max_criteria: 5,
    checklist_max_criteria: 8,
    rating_scale_max_criteria: 8,
    steam_max_weeks: 2,
    docx_remove_watermark: false,
  },
  pro: {
    weekly_ai_credits: 100,
    worksheet_max_questions: 20,
    reading_max_questions: 20,
    rubric_max_criteria: 10,
    checklist_max_criteria: 15,
    rating_scale_max_criteria: 15,
    steam_max_weeks: 4,
    docx_remove_watermark: true,
  },
};

/** Topes absolutos. Ni la base puede saltárselos por un error de tecleo. */
const TECHO = {
  worksheet_max_questions: 30,
  reading_max_questions: 30,
  rubric_max_criteria: 15,
  checklist_max_criteria: 25,
  rating_scale_max_criteria: 25,
  steam_max_weeks: 4,
};

function entero(valor, porDefecto) {
  const n = Number.parseInt(valor, 10);
  return Number.isFinite(n) && n > 0 ? n : porDefecto;
}

/** Mezcla lo que diga la base con el respaldo, y recorta por el techo. */
export function capacidadesDe(planCode, features = {}) {
  const base = CAPACIDADES_POR_DEFECTO[planCode] || CAPACIDADES_POR_DEFECTO.free;
  const f = features && typeof features === "object" ? features : {};
  const salida = { ...base };

  for (const clave of Object.keys(base)) {
    if (!(clave in f)) continue;
    if (typeof base[clave] === "boolean") {
      salida[clave] = f[clave] === true;
    } else {
      salida[clave] = entero(f[clave], base[clave]);
    }
  }

  for (const [clave, tope] of Object.entries(TECHO)) {
    if (typeof salida[clave] === "number") salida[clave] = Math.min(salida[clave], tope);
  }
  return salida;
}

/**
 * Plan efectivo del usuario, resuelto EN EL SERVIDOR.
 *
 * Se llama con el token de la propia docente, así que `get_my_plan()` resuelve
 * `auth.uid()` y devuelve su suscripción real. El plan que venga en el cuerpo
 * de la petición se ignora por completo: si un Free manda `plan: "pro"`, aquí
 * no se lee.
 *
 * Si la consulta falla, se cae a `free`. Es la única caída segura: dar de más
 * por un fallo de red sería regalar el producto.
 */
export async function planEfectivo(auth) {
  try {
    const data = await callRpc({ name: "get_my_plan", ...auth });
    const code = data?.plan || "free";
    return {
      plan: code,
      nombre: data?.plan_name || "Gratuito",
      limiteSemanal: data?.limit ?? null,
      capacidades: capacidadesDe(code, data?.features),
    };
  } catch {
    return {
      plan: "free",
      nombre: "Gratuito",
      limiteSemanal: null,
      capacidades: capacidadesDe("free"),
    };
  }
}

/**
 * Normaliza una cantidad pedida por el cliente contra el límite del plan.
 *
 * Recorta en vez de rechazar cuando el exceso es plausible —la interfaz pudo
 * quedarse con un valor viejo— y lanza sólo cuando el valor no tiene sentido.
 * Un error a media generación cuesta más que entregar 10 preguntas cuando se
 * pidieron 12.
 *
 * @returns {{valor:number, recortado:boolean, limite:number}}
 */
export function cantidadPermitida(pedida, { minimo = 1, limite, porDefecto }) {
  const tope = entero(limite, porDefecto);
  const n = Number.parseInt(pedida, 10);

  if (!Number.isFinite(n)) return { valor: entero(porDefecto, tope), recortado: false, limite: tope };
  if (n < minimo) return { valor: minimo, recortado: true, limite: tope };
  if (n > tope) return { valor: tope, recortado: true, limite: tope };
  return { valor: n, recortado: false, limite: tope };
}

/**
 * ¿Se puede quitar la marca de agua?
 *
 * El navegador manda su preferencia, pero quitarla es un beneficio de Pro:
 * la decisión final la toma el servidor. Un Free que envíe `sinMarca: true`
 * recibe su documento con marca, sin error y sin drama.
 */
export function permiteQuitarMarca(capacidades, pedido) {
  return Boolean(capacidades?.docx_remove_watermark) && pedido === true;
}

/**
 * Mensaje para la docente cuando toca su límite.
 *
 * Sin «403», sin «quota», sin «entitlement»: dice qué puede hacer con su plan
 * y qué ganaría con el otro, que es la información que le sirve.
 */
export function mensajeDeLimite({ plan, limite, unidad, limitePro }) {
  const nombre = plan === "free" ? "Gratuito" : "actual";
  const base = `Tu plan ${nombre} permite hasta ${limite} ${unidad}.`;
  return plan === "free" && limitePro
    ? `${base} Con Pro puedes crear hasta ${limitePro}.`
    : base;
}

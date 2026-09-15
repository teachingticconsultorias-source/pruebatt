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
    // Plantilla .docx propia. La hace cumplir la POLÍTICA DE SUBIDA del bucket
    // (migración 012), no sólo la interfaz: un Free no puede insertar el
    // objeto aunque llame al API de Storage a mano.
    docx_custom_template: false,
    // PREPARADA, SIN USO REAL TODAVÍA.
    //
    // La guía de laboratorio es Free completa por decisión de producto: es la
    // herramienta del área por defecto de la aplicación y ponerla tras el muro
    // dejaría Ciencia y Tecnología peor servida que Comunicación.
    //
    // Esta capacidad existe para que mover a Pro el solucionario y la rúbrica
    // de la Guía del Docente —lo que de verdad tiene valor profesional— sea
    // encender un interruptor y no volver a tocar el esquema. Mientras nadie
    // llame a `permiteGuiaDocente()`, no cambia nada.
    lab_teacher_guide: false,
  },
  pro: {
    weekly_ai_credits: 100,
    worksheet_max_questions: 20,
    reading_max_questions: 20,
    rubric_max_criteria: 10,
    checklist_max_criteria: 15,
    rating_scale_max_criteria: 15,
    steam_max_weeks: 4,
    docx_custom_template: true,
    lab_teacher_guide: true,
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
 * DEVUELVE LOS TRES NÚMEROS, no sólo el final: `pedido`, `valor` y `limite`.
 * El recorte es una defensa contra peticiones manipuladas, no una forma de
 * atender al docente: en el flujo normal la interfaz debe impedir pedir de
 * más, y para eso necesita conocer el límite. Si aquí sólo se devolviera el
 * número recortado, la única manera de enterarse sería contar las preguntas
 * del resultado.
 *
 * Se recorta en vez de rechazar porque el exceso suele ser plausible —una
 * pestaña con un valor viejo— y un error a media generación cuesta más que
 * entregar 10 preguntas cuando se pidieron 12.
 *
 * @returns {{pedido:number|null, valor:number, recortado:boolean, limite:number}}
 */
export function cantidadPermitida(pedida, { minimo = 1, limite, porDefecto, tool, plan }) {
  const tope = entero(limite, porDefecto);
  const n = Number.parseInt(pedida, 10);
  const pedido = Number.isFinite(n) ? n : null;

  const resultado = (valor, recortado) => {
    if (recortado && pedido !== null) {
      // Queda registrado para poder distinguir una interfaz desactualizada de
      // alguien editando la petición a mano. Sin correo, sin nombre, sin id.
      console.warn("[sciverse:clamp]", JSON.stringify({
        tool: tool || null, plan: plan || null, pedido, efectivo: valor, limite: tope,
      }));
    }
    return { pedido, valor, recortado, limite: tope };
  };

  if (pedido === null) return { pedido: null, valor: entero(porDefecto, tope), recortado: false, limite: tope };
  if (pedido < minimo) return resultado(minimo, true);
  if (pedido > tope) return resultado(tope, true);
  return resultado(pedido, false);
}

/* --------------------------------------------------------------------------
   RETIRADA: `docx_remove_watermark` / `permiteQuitarMarca()`

   Se declaró en la 009 y nunca se usó: el exportador no pinta ninguna marca de
   agua y la función no se llamaba desde ningún endpoint. La sustituye
   `docx_custom_template`, que sí se hace cumplir —y en la base, no aquí—.

   La clave sigue viva en `plans.features` de producción a propósito; es inerte
   y la 012 trae el `update` para limpiarla, comentado.
   -------------------------------------------------------------------------- */

/**
 * ¿Puede este plan recibir la Guía del Docente completa?
 *
 * Declarada y probada, pero NO conectada: hoy la guía de laboratorio es Free
 * entera. El día que se decida mover el solucionario y la rúbrica a Pro, se
 * llama desde el endpoint y se recorta la respuesta ahí; el navegador no
 * decide nada.
 */
export function permiteGuiaDocente(capacidades) {
  return Boolean(capacidades?.lab_teacher_guide);
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

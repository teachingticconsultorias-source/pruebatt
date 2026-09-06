// components/usePlanCatalog.js
//
// El catálogo comercial que ve cualquiera, leído de la base.
//
// POR QUÉ EXISTE
// --------------
// `config/plans.js` describía el plan de pago como «Todo ilimitado»,
// «Sesiones de aprendizaje ilimitadas», «Instrumentos ilimitados». El plan
// real da 100 creaciones por semana. Prometer ilimitado y aplicar un tope es
// exactamente el tipo de contradicción que acaba en una reclamación, y no se
// arregla cambiando el texto: se arregla haciendo que el texto no pueda
// separarse del dato.
//
// Ahora el precio, la vigencia, el límite y las viñetas salen de
// `public.plans`, que se edita desde Administración. Cambiar el precio deja
// de exigir un despliegue, y el escaparate no puede contradecir al backend.
//
// LECTURA SIN SESIÓN
// ------------------
// La política de `plans` permite `select` a `anon` sobre los planes activos,
// así que la portada lo lee sin que nadie haya entrado.
//
// SI LA BASE NO RESPONDE
// ----------------------
// Se usa `FALLBACK_PLANS`, que dice lo mismo que la base dice hoy. Es un
// respaldo honesto, no una promesa distinta: si algún día divergen, el que
// manda es el de la base y el respaldo hay que corregirlo.

import { useEffect, useState } from "react";

import { supabase } from "../supabaseClient.js";
import { FALLBACK_PLANS } from "../config/plans.js";

/** Fila de `public.plans` → la forma que ya usan las tarjetas de precios. */
export function planDesdeCatalogo(fila) {
  const gratis = Number(fila.price_cents) === 0;
  const meses = fila.billing_period_months;

  const viñetas = Array.isArray(fila.benefits) ? fila.benefits.filter(Boolean) : [];

  return {
    id: fila.code,
    name: fila.name,
    price: String(Math.round(Number(fila.price_cents || 0) / 100)),
    period: gratis
      ? "para conocer SciVerse"
      : meses === 1 ? "por 1 mes" : `por ${meses} meses`,
    // El reclamo es el dato, no un adjetivo. Si el límite cambia, el reclamo
    // cambia con él.
    saving: `${fila.ai_weekly_limit} creaciones con IA por semana`,
    featured: !gratis,
    tagline: fila.description || "",
    benefits: viñetas.length > 0
      ? viñetas
      : [`${fila.ai_weekly_limit} creaciones con IA por semana`],
  };
}

/**
 * Catálogo activo, ordenado. Devuelve el respaldo mientras carga y si la
 * consulta falla, para que la portada nunca se quede sin precios.
 */
export function usePlanCatalog() {
  const [planes, setPlanes] = useState(FALLBACK_PLANS);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let vivo = true;
    if (!supabase) { setCargando(false); return undefined; }

    supabase
      .from("plans")
      .select("code,name,description,benefits,ai_weekly_limit,price_cents,currency,billing_period_months,sort_order")
      .eq("is_active", true)
      .order("sort_order")
      .then(({ data, error }) => {
        if (!vivo) return;
        if (!error && Array.isArray(data) && data.length > 0) {
          setPlanes(data.map(planDesdeCatalogo));
        }
        setCargando(false);
      });

    return () => { vivo = false; };
  }, []);

  return { planes, cargando };
}

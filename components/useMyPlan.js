// components/useMyPlan.js
//
// EL PLAN VIGENTE DE LA DOCENTE. UNA SOLA FUENTE.
//
// QUÉ SE ROMPIÓ
// -------------
// Tras aprobar un pago, la aplicación mostraba dos cosas a la vez: los
// créditos decían 100/100 y la barra lateral seguía diciendo «Gratuito».
// No era un fallo de sincronización: eran datos distintos.
//
//   · créditos y Plan y uso  → `effective_plan()`, que resuelve la
//                              suscripción activa. Correcto.
//   · barra lateral y el
//     distintivo de Perfil    → `public.docentes.plan`, una columna de texto
//                              anterior al núcleo comercial. La migración 002
//                              la dejó donde estaba a propósito y nadie la
//                              escribe: aprobar un pago crea una fila en
//                              `subscriptions`, no toca esa columna.
//
// Es decir, la barra lateral no estaba desactualizada: leía un dato que ya no
// significa nada. Por eso no se arregla refrescando, ni escribiendo en esa
// columna — se arregla dejando de leerla.
//
// Este hook envuelve `get_my_plan()`, el mismo RPC que ya usaba Plan y uso, y
// lo comparten la barra lateral, Mi cuenta y la sección de plan.
//
// REACTIVIDAD
// -----------
// Se revalida al volver a la pestaña, igual que ya hacía CreditsIndicator.
// Es el caso real: a la docente le avisan por WhatsApp de que su plan ya está
// activo, vuelve a la ventana y lo ve, sin cerrar sesión ni recargar.

import { useCallback, useEffect, useState } from "react";

import { supabase } from "../supabaseClient.js";

/** Nombre presentable, sin inventar nada si todavía no ha cargado. */
export function nombreDePlan(plan) {
  return plan?.plan_name || "Gratuito";
}

/**
 * @returns {{plan: object|null, cargando: boolean, recargar: () => void}}
 *   `plan` es lo que devuelve `get_my_plan()`:
 *   { plan, plan_name, limit, features, starts_at, ends_at, is_fallback }
 */
export function useMyPlan() {
  const [plan, setPlan] = useState(null);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    if (!supabase) { setCargando(false); return; }
    try {
      const { data, error } = await supabase.rpc("get_my_plan");
      // Sin sesión o sin perfil la función lanza; se deja el plan en null y
      // quien lo pinta cae en «Gratuito», que es el fallback seguro.
      if (!error && data) setPlan(data);
    } catch {
      /* silencio deliberado: esto no debe romper ninguna pantalla */
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const refrescar = () => cargar();
    const alVolver = () => { if (!document.hidden) cargar(); };
    // `focus` en escritorio; `visibilitychange` porque en el móvil —donde una
    // docente lee el WhatsApp que le dice que su plan ya está activo— cambiar
    // de aplicación no siempre dispara `focus`.
    window.addEventListener("focus", refrescar);
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      window.removeEventListener("focus", refrescar);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, [cargar]);

  return { plan, cargando, recargar: cargar };
}

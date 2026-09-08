import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import Landing from "../components/landing/Landing.jsx";
import { usePlanCatalog, planDesdeCatalogo } from "../components/usePlanCatalog.js";
import { FALLBACK_PLANS } from "../config/plans.js";

/* ============================================================================
   PANTALLA BLANCA

   POR QUÉ EXISTE ESTE FICHERO
   ---------------------------
   `Landing.jsx` pasó a leer el catálogo de la base y se cambió `PLANS.map`
   por `planes.map`, pero nunca se llamó al hook que define `planes`. En
   producción eso es un `ReferenceError` en el primer render: React aborta el
   árbol entero y la aplicación queda en blanco.

   Ni el build ni 303 tests lo vieron, y no es raro: Rollup no comprueba si un
   identificador existe —eso sólo se sabe al ejecutar— y no había un solo test
   que MONTARA un componente. Se comprobaba el contenido de los ficheros, que
   es otra cosa.

   Estos tests renderizan de verdad. Se usa `renderToStaticMarkup` en vez de
   montar en jsdom porque no hace falta ninguna dependencia nueva —React y
   react-dom ya están— y basta para lo que importa: si un identificador no
   existe en su ámbito, el render lanza aquí y no en el navegador de una
   docente.

   Los efectos no corren en render de servidor, así que esto no toca red ni
   Supabase. Es exactamente la primera pasada de React, que es donde estalló.
   ========================================================================== */

describe("render · la aplicación no se queda en blanco", () => {
  it("la portada se renderiza sin ReferenceError", () => {
    expect(() =>
      renderToStaticMarkup(<Landing onRegister={() => {}} onLogin={() => {}} />)
    ).not.toThrow();
  });

  it("la sección de planes sale con contenido, no vacía", () => {
    const html = renderToStaticMarkup(<Landing onRegister={() => {}} onLogin={() => {}} />);
    expect(html).toContain('id="planes"');
    // Antes de que responda la base se pinta el respaldo, que dice lo mismo.
    expect(html).toContain("Pro");
    expect(html).toContain("100 creaciones con IA por semana");
    expect(html).toContain("Gratuito");
  });

  it("la portada no promete nada ilimitado", () => {
    const html = renderToStaticMarkup(<Landing onRegister={() => {}} onLogin={() => {}} />);
    expect(html).not.toMatch(/ilimitad/i);
  });

  it("el botón del plan gratuito se distingue por precio, no por identificador", () => {
    // El catálogo real usa el código `free`; comparar contra `"gratuito"`
    // mandaba a WhatsApp a quien sólo quería crear una cuenta.
    const html = renderToStaticMarkup(<Landing onRegister={() => {}} onLogin={() => {}} />);
    expect(html).toContain("Crear cuenta gratis");
    expect(FALLBACK_PLANS.find((p) => Number(p.price) === 0)).toBeTruthy();
  });
});

/* ============================================================================
   LOS OTROS COMPONENTES DEL MISMO BLOQUE

   El fallo no fue una distracción aislada: fue cambiar de dónde salen los
   datos y olvidar declarar la variable en UN sitio. Los otros componentes que
   se tocaron a la vez merecen la misma red, porque el error habría sido
   igual de invisible y con la misma consecuencia.

   Son humo, no funcionalidad: comprueban que el primer render no estalla.
   ========================================================================== */
describe("render · las pantallas que cambiaron en el mismo bloque", () => {
  it("Mi plan (docente) monta sin lanzar", async () => {
    const { default: PlanSection } = await import("../components/account/PlanSection.jsx");
    expect(() => renderToStaticMarkup(<PlanSection />)).not.toThrow();
  });

  it("Administración → Planes monta sin lanzar", async () => {
    const { Planes } = await import("../components/admin/Comercial.jsx");
    expect(() => renderToStaticMarkup(<Planes token={null} />)).not.toThrow();
  });

  it("Administración → Configuración monta sin lanzar", async () => {
    const { ConfiguracionPagos } = await import("../components/admin/Comercial.jsx");
    expect(() => renderToStaticMarkup(<ConfiguracionPagos token={null} />)).not.toThrow();
  });
});

/* ============================================================================
   EL HOOK QUE FALTABA POR LLAMAR
   ========================================================================== */
describe("render · catálogo de planes", () => {
  it("el hook devuelve el respaldo antes de que responda la base", () => {
    // Un componente mínimo: si el hook lanzara, este render fallaría.
    function Sonda() {
      const { planes, cargando } = usePlanCatalog();
      return <span data-cargando={String(cargando)}>{planes.map((p) => p.id).join(",")}</span>;
    }
    const html = renderToStaticMarkup(<Sonda />);
    expect(html).toContain("free");
    expect(html).toContain("pro");
  });

  it("una fila de la base se traduce a la forma que usan las tarjetas", () => {
    const fila = planDesdeCatalogo({
      code: "pro", name: "Pro", description: "Plan mensual.",
      benefits: ["100 creaciones con IA por semana"],
      ai_weekly_limit: 100, price_cents: 2000, currency: "PEN",
      billing_period_months: 1,
    });
    expect(fila).toMatchObject({
      id: "pro", name: "Pro", price: "20", period: "por 1 mes", featured: true,
      saving: "100 creaciones con IA por semana",
    });
  });

  it("el gratuito no se marca como destacado ni cobra", () => {
    const fila = planDesdeCatalogo({
      code: "free", name: "Gratuito", description: "", benefits: [],
      ai_weekly_limit: 5, price_cents: 0, currency: "PEN",
      billing_period_months: null,
    });
    expect(fila.price).toBe("0");
    expect(fila.featured).toBe(false);
    expect(fila.period).toBe("para conocer SciVerse");
    // Sin viñetas en la base, se deriva una del límite en vez de dejarlo vacío.
    expect(fila.benefits).toEqual(["5 creaciones con IA por semana"]);
  });
});

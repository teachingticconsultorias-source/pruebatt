import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import fs from "node:fs";

import Landing from "../components/landing/Landing.jsx";
import { usePlanCatalog, planDesdeCatalogo } from "../components/usePlanCatalog.js";
import { nombreDePlan } from "../components/useMyPlan.js";
import AppShell from "../components/layout/AppShell.jsx";
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
   LA PORTADA NO VENDE POR WHATSAPP

   El flujo real es: la docente crea su cuenta, registra el pago dentro de
   SciVerse y el equipo lo verifica antes de activar. Un CTA público que abría
   WhatsApp pidiendo «los datos para pagar» contaba otra historia — y además
   enseñaba datos de pago a alguien sin sesión, a quien luego no hay a quién
   activarle nada.
   ========================================================================== */
describe("portada · comprar ocurre dentro de SciVerse", () => {
  const html = renderToStaticMarkup(<Landing onRegister={() => {}} onLogin={() => {}} />);

  it("el CTA del plan de pago invita a crear cuenta", () => {
    expect(html).toContain("Crear cuenta y elegir Pro");
    expect(html).toContain("Crear cuenta gratis");
  });

  it("el CTA del plan de pago llama a onRegister, no abre WhatsApp", () => {
    let registro = 0;
    const abrir = globalThis.window?.open;
    renderToStaticMarkup(<Landing onRegister={() => { registro += 1; }} onLogin={() => {}} />);
    // En render de servidor no hay clic; se comprueba en la fuente que el
    // manejador no tiene otra salida que el registro.
    const src = fs.readFileSync("components/landing/Landing.jsx", "utf8");
    const fn = src.slice(src.indexOf("function choosePlan"), src.indexOf("function contactInstitutional"));
    expect(fn).toContain("onRegister()");
    expect(fn).not.toContain("whatsappLink");
    expect(fn).not.toContain("wa.me");
    expect(abrir === globalThis.window?.open).toBe(true);
    expect(registro).toBe(0); // nada se dispara en el render
  });

  it("no queda el copy de la activación por WhatsApp", () => {
    expect(html).not.toContain("La activación se confirma por WhatsApp");
    expect(html).toContain("lo verifica antes de activar tu plan");
  });

  it("la sección de planes no enlaza a WhatsApp en ningún sitio", () => {
    const planes = html.slice(html.indexOf('id="planes"'));
    const hasta = planes.slice(0, planes.indexOf("</section>"));
    expect(hasta).not.toContain("wa.me");
    expect(hasta).not.toContain("whatsapp");
  });

  it("ningún componente lleva un teléfono escrito a mano", () => {
    const ficheros = ["App.jsx", "components/landing/Landing.jsx",
                      "components/account/PlanSection.jsx",
                      "components/account/avisoWhatsApp.js",
                      "components/admin/Comercial.jsx"];
    for (const f of ficheros) {
      const src = fs.readFileSync(f, "utf8");
      expect(src, `${f} · 921090875`).not.toContain("921090875");
      expect(src, `${f} · 931582435`).not.toContain("931582435");
    }
  });

  it("PlanMini, que era código muerto con el teléfono dentro, ya no existe", () => {
    expect(fs.readFileSync("App.jsx", "utf8")).not.toContain("PlanMini");
  });

  it("el único wa.me operativo es el de después del pago", () => {
    // El del flujo post-pago usa payment_settings.whatsapp; el de config es
    // contacto general (pie, consulta institucional, reclamaciones).
    const aviso = fs.readFileSync("components/account/avisoWhatsApp.js", "utf8");
    expect(aviso).toContain("https://wa.me/${numero}");
    expect(aviso).toContain("normalizarWhatsApp");

    const cfg = fs.readFileSync("config/plans.js", "utf8");
    expect(cfg).toContain("NO ES EL WHATSAPP DE PAGOS");

    // Y ninguna pantalla de compra lo usa.
    const planSection = fs.readFileSync("components/account/PlanSection.jsx", "utf8");
    expect(planSection).not.toContain("whatsappLink");
  });

  it("el plan gratuito no toca el flujo de pago", () => {
    const src = fs.readFileSync("components/landing/Landing.jsx", "utf8");
    // Distinguir por precio y no por el identificador `gratuito`.
    expect(src).toContain("Number(plan.price) === 0");
    expect(src).not.toContain('=== "gratuito"');
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

/* ============================================================================
   EL PLAN QUE VE LA DOCENTE SALE DE UN SOLO SITIO

   Tras aprobar un pago, los créditos decían 100/100 y la barra lateral seguía
   diciendo «Gratuito». No era falta de refresco: eran datos distintos. La
   barra leía `docentes.plan`, una columna anterior al núcleo comercial que
   nadie escribe — aprobar un pago crea una fila en `subscriptions` y no la
   toca. Se arregla dejando de leerla, no refrescándola.
   ========================================================================== */
function pintarShell(plan) {
  return renderToStaticMarkup(
    <AppShell
      profile={{ nombres: "Ana", apellidos: "Quispe", correo: "a@x.pe" }}
      plan={nombreDePlan(plan)}
      activeSection="inicio"
      onNavigate={() => {}}
      onOpenAccount={() => {}}
      onLogout={() => {}}
    >
      <div />
    </AppShell>
  );
}

describe("plan · la barra lateral dice lo mismo que Plan y uso", () => {
  const FREE = { plan: "free", plan_name: "Gratuito", limit: 5, is_fallback: true };
  const PRO = { plan: "pro", plan_name: "Pro", limit: 100, ends_at: "2026-10-08T00:00:00Z" };

  it("con plan gratuito muestra Gratuito", () => {
    const html = pintarShell(FREE);
    expect(html).toContain("Plan actual");
    expect(html).toContain("Gratuito");
    expect(html).not.toContain(">Pro<");
  });

  it("con plan Pro muestra Pro, no Gratuito", () => {
    const html = pintarShell(PRO);
    expect(html).toContain("Plan actual");
    expect(html).toContain("Pro");
    expect(html).not.toContain("Gratuito");
  });

  it("sin dato todavía cae en Gratuito, nunca en blanco ni en 'undefined'", () => {
    const html = pintarShell(null);
    expect(html).toContain("Gratuito");
    expect(html).not.toContain("undefined");
  });

  it("cambiar de Free a Pro cambia lo que se pinta", () => {
    const antes = pintarShell(FREE);
    const despues = pintarShell(PRO);
    expect(antes).toContain("Gratuito");
    expect(despues).not.toContain("Gratuito");
    expect(nombreDePlan(FREE)).toBe("Gratuito");
    expect(nombreDePlan(PRO)).toBe("Pro");
  });

  it("el nombre NO se deduce de los créditos ni se inventa", () => {
    // nombreDePlan sólo lee `plan_name`; no mira límites ni consumo.
    expect(nombreDePlan({ limit: 100 })).toBe("Gratuito");
    expect(nombreDePlan({ plan: "pro" })).toBe("Gratuito");
    expect(nombreDePlan({ plan_name: "Pro", limit: 5 })).toBe("Pro");
  });
});

describe("plan · el card 'Plan actual' no lleva a WhatsApp", () => {
  const html = pintarShell({ plan: "free", plan_name: "Gratuito", limit: 5 });

  it("es un botón, no un enlace externo", () => {
    const card = html.slice(html.indexOf("shell__plan"));
    const hasta = card.slice(0, card.indexOf("shell__user"));
    expect(hasta).not.toContain("href");
    expect(hasta).not.toContain("wa.me");
    expect(hasta).not.toContain("whatsapp");
    expect(hasta).not.toContain("target=");
  });

  it("abre Mi cuenta → Plan y uso", () => {
    const src = fs.readFileSync("components/layout/AppShell.jsx", "utf8");
    expect(src).toContain('onOpenAccount("plan")');
    expect(src).not.toContain("whatsappLink");
    expect(src).not.toContain("mejorar mi plan");
  });

  it("en toda la barra lateral no hay ni un enlace a WhatsApp", () => {
    expect(html).not.toContain("wa.me");
    expect(html).not.toContain("whatsapp");
    expect(html).not.toContain("921090875");
  });
});

describe("plan · una sola fuente de verdad", () => {
  it("get_my_plan se llama en un único sitio del frontend", () => {
    const ficheros = ["App.jsx", "components/account/Account.jsx",
                      "components/account/PlanSection.jsx",
                      "components/layout/AppShell.jsx",
                      "components/CreditsIndicator.jsx"];
    for (const f of ficheros) {
      expect(fs.readFileSync(f, "utf8"), f).not.toContain('rpc("get_my_plan")');
    }
    expect(fs.readFileSync("components/useMyPlan.js", "utf8")).toContain('rpc("get_my_plan")');
  });

  it("nadie pinta el plan desde la columna legacy docentes.plan", () => {
    const app = fs.readFileSync("App.jsx", "utf8");
    expect(app).not.toContain("plan={dbProfile?.plan}");
    const cuenta = fs.readFileSync("components/account/Account.jsx", "utf8");
    expect(cuenta).not.toContain('dbProfile?.plan || "gratuito"');
    expect(cuenta).toContain("nombreDePlan(planVigente)");
  });

  it("el plan y los créditos se revalidan con las mismas señales", () => {
    for (const f of ["components/useMyPlan.js", "components/CreditsIndicator.jsx"]) {
      const src = fs.readFileSync(f, "utf8");
      expect(src, `${f} focus`).toContain('addEventListener("focus"');
      expect(src, `${f} visibilitychange`).toContain('"visibilitychange"');
    }
  });

  it("el flujo post-pago sigue usando payment_settings.whatsapp", () => {
    const plansec = fs.readFileSync("components/account/PlanSection.jsx", "utf8");
    expect(plansec).toContain("ajustes?.whatsapp");
    expect(plansec).not.toContain("whatsappLink");
    const aviso = fs.readFileSync("components/account/avisoWhatsApp.js", "utf8");
    expect(aviso).toContain("https://wa.me/${numero}");
  });

  it("la barra lateral monta sin lanzar", () => {
    expect(() => pintarShell({ plan: "pro", plan_name: "Pro", limit: 100 })).not.toThrow();
  });
});

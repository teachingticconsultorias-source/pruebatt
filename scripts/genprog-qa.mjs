#!/usr/bin/env node
/* ==========================================================================
   QA RESPONSIVE DEL PROGRESO DE GENERACIÓN

   Comprueba en un Chromium real, en seis resoluciones, que la tarjeta de
   generación:

     · queda centrada de verdad (no con un margen mágico);
     · no provoca scroll horizontal en la página;
     · mantiene el ESTADO de cada módulo alineado a la derecha y en la misma
       fila que su nombre —el defecto que originó este trabajo—;
     · sigue legible cuando el nombre del módulo ocupa dos líneas.

   USO
   ---
     npx playwright install chromium     (la primera vez)
     node scripts/genprog-qa.mjs
     QA_SHOTS=1 node scripts/genprog-qa.mjs docs/qa/genprog

   Playwright NO es dependencia del proyecto: se instala aparte cuando se va a
   ejecutar el QA. Si no está, el script lo dice y termina sin fallar el build.
   ========================================================================== */
import fs from "node:fs/promises";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import GenerationProgress from "../components/ui/GenerationProgress.jsx";
import { progresoDeModulos, textoDeProgreso } from "../lib/sesion/modulos.js";

const RESOLUCIONES = [
  { w: 375, h: 667, nombre: "movil-pequeno" },
  { w: 390, h: 844, nombre: "movil" },
  { w: 768, h: 1024, nombre: "tablet-vertical" },
  { w: 1024, h: 768, nombre: "tablet-horizontal" },
  { w: 1440, h: 900, nombre: "portatil" },
  { w: 1920, h: 1080, nombre: "escritorio" },
];

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.log("Playwright no está instalado. `npm i --no-save playwright` y `npx playwright install chromium`.");
  process.exit(0);
}

const raiz = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/(\w:)/, "$1"), "..");
const css = [
  await fs.readFile(path.join(raiz, "styles/tokens.css"), "utf8").catch(() => ""),
  await fs.readFile(path.join(raiz, "components/ui/ui.css"), "utf8"),
].join("\n");

const listos = ["alignment"];
const markup = renderToStaticMarkup(
  React.createElement(GenerationProgress, {
    pasos: progresoDeModulos({ listos, activo: "sequence", fallido: null }),
    resumen: textoDeProgreso(listos),
    eyebrow: "Paso 1 de 3 · Sesión",
    title: "Kantu está preparando tu sesión",
    activo: true,
  })
);
const html = `<!doctype html><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>*{box-sizing:border-box}html,body{margin:0;padding:0}${css}</style>
<div class="sv-genprog-overlay">${markup}</div>`;

const destino = process.env.QA_SHOTS ? (process.argv[2] || "docs/qa/genprog") : null;
if (destino) await fs.mkdir(path.join(raiz, destino), { recursive: true });

const navegador = await chromium.launch();
let problemas = 0;

for (const { w, h, nombre } of RESOLUCIONES) {
  const pagina = await navegador.newPage({ viewport: { width: w, height: h } });
  await pagina.setContent(html);
  await pagina.waitForTimeout(60);

  const medida = await pagina.evaluate(() => {
    const tarjeta = document.querySelector(".sv-genprog").getBoundingClientRect();
    const filas = [...document.querySelectorAll(".sv-genprog__step")].map((li) => {
      const etiqueta = li.querySelector(".sv-genprog__label").getBoundingClientRect();
      const estado = li.querySelector(".sv-genprog__state").getBoundingClientRect();
      const fila = li.getBoundingClientRect();
      return {
        // El estado está en la MISMA fila que el nombre si sus franjas
        // verticales se solapan. Si estuviera debajo, no se solaparían.
        mismaFila: estado.top < etiqueta.bottom && etiqueta.top < estado.bottom,
        // Y pegado al borde derecho de la fila, con el padding interior.
        alDerecha: fila.right - estado.right < 20,
        solapa: estado.left < etiqueta.right - 1,
      };
    });
    return {
      izquierda: Math.round(tarjeta.left),
      derecha: Math.round(window.innerWidth - tarjeta.right),
      ancho: Math.round(tarjeta.width),
      alto: Math.round(tarjeta.height),
      scrollHorizontal: document.documentElement.scrollWidth > window.innerWidth,
      filas,
    };
  });

  const desvio = Math.abs(medida.izquierda - medida.derecha);
  const fallos = [];
  if (desvio > 2) fallos.push(`descentrada ${desvio}px`);
  if (medida.scrollHorizontal) fallos.push("scroll horizontal");
  if (medida.filas.some((f) => !f.mismaFila)) fallos.push("estado debajo del nombre");
  if (medida.filas.some((f) => !f.alDerecha)) fallos.push("estado sin alinear a la derecha");
  if (medida.filas.some((f) => f.solapa)) fallos.push("estado solapa el nombre");
  if (medida.alto > h) fallos.push(`tarjeta más alta que la ventana (${medida.alto} > ${h})`);

  problemas += fallos.length;
  console.log(
    `${String(w).padStart(4)}x${String(h).padEnd(5)} ${nombre.padEnd(18)} ` +
    `tarjeta ${String(medida.ancho).padStart(4)}x${String(medida.alto).padEnd(4)} ` +
    `margen ${medida.izquierda}/${medida.derecha}  ` +
    (fallos.length ? `✗ ${fallos.join(" · ")}` : "✓")
  );

  if (destino) {
    await pagina.screenshot({ path: path.join(raiz, destino, `${w}x${h}-${nombre}.png`), fullPage: true });
  }
  await pagina.close();
}

await navegador.close();
console.log(problemas ? `\n${problemas} problema(s).` : "\nSin problemas de maquetación.");
process.exit(problemas ? 1 : 0);

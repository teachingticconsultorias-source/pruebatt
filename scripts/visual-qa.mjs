#!/usr/bin/env node
/* ==========================================================================
   QA VISUAL AUTOMATIZADO

   Inspecciona el RENDER REAL con Chromium en 8 resoluciones y 9 pantallas
   (3 públicas + 6 autenticadas), y detecta:
     • desbordamiento horizontal, con el elemento culpable
     • texto por debajo de 12px según getComputedStyle
     • objetivos táctiles menores de 24px en anchos móviles
     • errores y warnings de consola, y peticiones fallidas propias

   USO
   ---
     npm run build && npm run preview     (en otra terminal)
     npx playwright install chromium      (la primera vez)
     node scripts/visual-qa.mjs           (informe)
     QA_SHOTS=1 node scripts/visual-qa.mjs docs/qa   (además, capturas)

   Playwright NO es dependencia del proyecto: instálalo con
   `npm i --no-save playwright` solo cuando vayas a ejecutar el QA.

   Para alcanzar las pantallas autenticadas siembra una sesión FALSA en
   localStorage. Las llamadas de red a Supabase fallan a propósito: así se
   revisan los estados vacíos y de carga.

   EXCEPCIÓN CONOCIDA
   ------------------
   Los enlaces "términos y condiciones" y "política de privacidad" del
   registro miden 143x20 y 132x20. Son objetivos EN LÍNEA dentro de una
   frase: WCAG 2.5.8 los exceptúa expresamente y agrandarlos rompería el
   párrafo. No es un defecto.
   ========================================================================== */

import { chromium } from "playwright";
import fs from "node:fs";

const BASE = "http://localhost:4173";
const OUT = process.argv[2] || "docs/qa";
const SHOTS = process.env.QA_SHOTS === "1";
fs.mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { name: "375",  width: 375,  height: 812 },
  { name: "430",  width: 430,  height: 932 },
  { name: "768",  width: 768,  height: 1024 },
  { name: "1024", width: 1024, height: 768 },
  { name: "1280", width: 1280, height: 800 },
  { name: "1440", width: 1440, height: 900 },
  { name: "1920", width: 1920, height: 1080 },
  { name: "land844", width: 844, height: 390 },
];

/* Sesión simulada de Supabase para poder inspeccionar la app autenticada.
   supabase-js v2 guarda la sesión en localStorage con la clave
   sb-<ref>-auth-token. Con VITE_SUPABASE_URL=https://example.supabase.co
   el ref es "example". Las llamadas de red fallarán (el dominio no existe),
   que es justo lo que queremos para revisar los estados vacíos. */
const FAKE_SESSION = {
  access_token: "qa-fake-token",
  token_type: "bearer",
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 86400,
  refresh_token: "qa-fake-refresh",
  user: {
    id: "00000000-0000-0000-0000-0000000000qa".slice(0, 36),
    aud: "authenticated",
    role: "authenticated",
    email: "maria.perez@colegio.edu.pe",
    created_at: "2026-03-15T10:00:00Z",
    user_metadata: {
      nombres: "María",
      apellidos: "Pérez López",
      ie: "I.E. 1234 José Carlos Mariátegui",
      celular: "999888777",
      nivel: "primaria",
    },
    app_metadata: { provider: "email" },
  },
};

const PUBLIC_SCREENS = [
  { id: "landing", go: async () => {} },
  { id: "login",    go: async (p) => clickText(p, "Ingresar") },
  { id: "registro", go: async (p) => clickText(p, "Crear cuenta") },
];

const APP_SCREENS = [
  { id: "dashboard",    go: async () => {} },
  { id: "crear",        go: async (p) => navTo(p, "Crear recurso", "Crear") },
  { id: "biblioteca",   go: async (p) => navTo(p, "Mi biblioteca", "Biblioteca") },
  { id: "actividades",  go: async (p) => navTo(p, "Actividades STEAM", "Actividades") },
  { id: "retos",        go: async (p) => navTo(p, "Retos grupales", "Más") },
  { id: "cuenta",       go: async (p) => openAccount(p) },
];

async function clickText(page, text) {
  // >> visible=true descarta la sidebar oculta, que contiene los mismos textos
  const el = page.locator(`text="${text}" >> visible=true`).first();
  if (!(await el.count())) return false;
  try { await el.click({ timeout: 2500 }); } catch { return false; }
  await page.waitForTimeout(500);
  return true;
}
async function navTo(page, desktopLabel, mobileLabel) {
  // Escritorio: enlace de la barra lateral
  const side = page.locator(".shell__link", { hasText: desktopLabel }).first();
  if (await side.count() && await side.isVisible().catch(() => false)) {
    await side.click().catch(() => {}); await page.waitForTimeout(600); return;
  }
  // Móvil: botón de la barra inferior
  const tab = page.locator(".shell__mobile button", { hasText: mobileLabel }).first();
  if (await tab.count() && await tab.isVisible().catch(() => false)) {
    await tab.click().catch(() => {}); await page.waitForTimeout(600);
    // Si abrió la hoja "Más", elegir el destino dentro
    const inSheet = page.locator(".shell__sheetlinks button", { hasText: desktopLabel }).first();
    if (await inSheet.count() && await inSheet.isVisible().catch(() => false)) {
      await inSheet.click().catch(() => {}); await page.waitForTimeout(600);
    }
  }
}
async function openAccount(page) {
  const side = page.locator(".shell__user").first();
  if (await side.count() && await side.isVisible().catch(() => false)) {
    await side.click().catch(() => {});
  } else {
    const more = page.locator(".shell__mobile button", { hasText: "Más" }).first();
    if (await more.count()) { await more.click().catch(() => {}); await page.waitForTimeout(500); }
    const acc = page.locator(".shell__sheetlinks button", { hasText: "Mi cuenta" }).first();
    if (await acc.count()) await acc.click().catch(() => {});
  }
  await page.waitForTimeout(800);
}

async function audit(page) {
  return page.evaluate(() => {
    const problems = [];
    const de = document.documentElement;

    if (de.scrollWidth > de.clientWidth + 1) {
      problems.push({ type: "overflow-x", detail: `scrollWidth ${de.scrollWidth} > ${de.clientWidth}` });
      let n = 0;
      for (const el of document.querySelectorAll("body *")) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && (r.right > de.clientWidth + 2 || r.left < -2)) {
          const cls = typeof el.className === "string" && el.className ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".") : "";
          problems.push({ type: "overflow-el", detail: `${el.tagName.toLowerCase()}${cls} [${Math.round(r.left)}..${Math.round(r.right)}]` });
          if (++n >= 5) break;
        }
      }
    }

    const small = new Map();
    for (const el of document.querySelectorAll("body *")) {
      if (el.children.length || !el.textContent?.trim()) continue;
      const size = parseFloat(getComputedStyle(el).fontSize);
      if (size && size < 12) {
        const cls = typeof el.className === "string" && el.className ? "." + el.className.trim().split(/\s+/)[0] : "";
        const sel = el.tagName.toLowerCase() + cls;
        small.set(sel, Math.min(small.get(sel) ?? 99, size));
      }
    }
    for (const [sel, size] of small) problems.push({ type: "font-small", detail: `${sel} = ${size}px` });

    if (de.clientWidth <= 768) {
      const seen = new Set();
      for (const el of document.querySelectorAll("button, a[href], [role=button]")) {
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        if (r.height < 24 || r.width < 24) {
          const cls = typeof el.className === "string" && el.className ? "." + el.className.trim().split(/\s+/)[0] : "";
          const sel = el.tagName.toLowerCase() + cls;
          if (!seen.has(sel)) { seen.add(sel); problems.push({ type: "touch-small", detail: `${sel} ${Math.round(r.width)}x${Math.round(r.height)}` }); }
        }
      }
    }
    return problems;
  });
}

const browser = await chromium.launch();
const report = [];
const consoleIssues = [];

function wire(page, vp, screen) {
  page.on("console", (m) => {
    if (m.type() !== "error" && m.type() !== "warning") return;
    const t = m.text();
    if (/favicon|React DevTools|example\.supabase\.co|Failed to fetch|net::ERR/i.test(t)) return;
    consoleIssues.push({ vp, screen, type: m.type(), text: t.slice(0, 180) });
  });
  page.on("response", (r) => {
    if (r.status() >= 400 && r.url().startsWith(BASE)) {
      consoleIssues.push({ vp, screen, type: "http" + r.status(), text: r.url().replace(BASE, "") });
    }
  });
}

for (const vp of VIEWPORTS) {
  // ---- públicas ----
  for (const screen of PUBLIC_SCREENS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await ctx.newPage();
    wire(page, vp.name, screen.id);
    await page.goto(BASE, { waitUntil: "networkidle" });
    await page.waitForTimeout(400);
    await screen.go(page);
    await page.waitForTimeout(400);
    report.push({ vp: vp.name, screen: screen.id, problems: await audit(page) });
    if (SHOTS) await page.screenshot({ path: `${OUT}/${screen.id}-${vp.name}.png` });
    await ctx.close();
  }

  // ---- autenticadas ----
  for (const screen of APP_SCREENS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    await ctx.addInitScript((session) => {
      localStorage.setItem("sb-example-auth-token", JSON.stringify(session));
    }, FAKE_SESSION);
    const page = await ctx.newPage();
    wire(page, vp.name, screen.id);
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);

    const authed = await page.locator(".shell").count();
    if (!authed) { report.push({ vp: vp.name, screen: screen.id, problems: [{ type: "skip", detail: "no autenticado" }] }); await ctx.close(); continue; }

    await screen.go(page);
    await page.waitForTimeout(600);
    let crumb = await page.locator(".shell__crumb:visible, .shell__mobile button.is-active span:visible").first().textContent().catch(() => "");
    if (await page.locator(".acc__tabs").count()) crumb = "cuenta";
    const problems = await audit(page);
    problems.push({ type: "info-where", detail: (crumb || "?").trim() });
    report.push({ vp: vp.name, screen: screen.id, problems });
    if (SHOTS) await page.screenshot({ path: `${OUT}/${screen.id}-${vp.name}.png` });
    await ctx.close();
  }
}
await browser.close();

console.log("\n===== PROBLEMAS DE LAYOUT =====");
let total = 0, skipped = 0;
const coverage = [];
for (const row of report) {
  const where = row.problems.find((p) => p.type === "info-where");
  const real = row.problems.filter((p) => p.type !== "skip" && !p.type.startsWith("info-"));
  coverage.push(`${row.screen}@${row.vp} -> ${where ? where.detail : "publica"}`);
  if (row.problems.some((p) => p.type === "skip")) skipped++;
  if (!real.length) continue;
  total += real.length;
  console.log(`\n[${row.screen} @ ${row.vp}]`);
  for (const p of real) console.log(`   ${p.type.padEnd(13)} ${p.detail}`);
}
if (!total) console.log("  ninguno");
if (skipped) console.log(`\n(${skipped} vistas autenticadas no alcanzadas)`);

console.log("\n===== CONSOLA / RED (propias) =====");
const uniq = new Map();
for (const c of consoleIssues) {
  const k = c.type + "|" + c.text;
  if (!uniq.has(k)) uniq.set(k, { ...c, count: 0 });
  uniq.get(k).count++;
}
if (!uniq.size) console.log("  sin errores ni warnings");
for (const c of uniq.values()) console.log(`  [${c.type}] x${c.count} ${c.text}`);
console.log(`\nTOTAL problemas: ${total}`);

console.log("\n===== COBERTURA REAL =====");
const MAP = { dashboard: "inicio", crear: "crear", biblioteca: "biblioteca", actividades: "actividades", retos: "retos", cuenta: "cuenta" };
const bad = coverage.filter((c) => {
  const [key, where] = c.split(" -> ");
  const screen = key.split("@")[0];
  const expect = MAP[screen];
  return expect && !String(where).toLowerCase().includes(expect);
});
console.log("  vistas auditadas: " + coverage.length);
if (bad.length) {
  console.log("  NO alcanzaron su destino (" + bad.length + "):");
  for (const b of bad) console.log("    " + b);
} else {
  console.log("  todas las vistas alcanzaron su destino");
}

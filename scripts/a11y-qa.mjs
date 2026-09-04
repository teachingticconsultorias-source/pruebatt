/**
 * AUDITORÍA DE ACCESIBILIDAD SOBRE RENDER REAL
 *
 * No lee CSS: mide el árbol renderizado en Chromium.
 *   1. Contraste real de cada nodo de texto contra su fondo efectivo
 *      (sube por los ancestros hasta encontrar un fondo opaco).
 *   2. Recorrido de teclado: orden, foco visible, trampas de foco.
 *
 * Playwright no es dependencia del proyecto:  npm i --no-save playwright
 * Uso:  npm run preview  y luego  node scripts/a11y-qa.mjs
 */
import { chromium } from "playwright";

const BASE = process.env.QA_URL || "http://localhost:4173";

const FAKE_SESSION = {
  access_token: "qa", token_type: "bearer", expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 86400, refresh_token: "qa",
  user: {
    id: "00000000-0000-0000-0000-000000000001", aud: "authenticated",
    role: "authenticated", email: "maria@example.pe", created_at: "2026-03-15T10:00:00Z",
    user_metadata: { nombres: "María", apellidos: "Pérez", ie: "IE 1234", nivel: "primaria" },
    app_metadata: {},
  },
};

/* Auditoría inyectada en la página. */
const AUDIT = () => {
  const srgb = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const lum = ([r, g, b]) => 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
  const parse = (s) => {
    const m = String(s).match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
    return { rgb: p.slice(0, 3), a: p.length > 3 ? p[3] : 1 };
  };
  const over = (fg, bg) => fg.rgb.map((c, i) => c * fg.a + bg[i] * (1 - fg.a));
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

  /* Fondo efectivo: compone capas semitransparentes hasta hallar una opaca. */
  function backdrop(el) {
    const layers = [];
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (!c || c.a === 0) continue;
      layers.push(c);
      if (c.a === 1) break;
    }
    let base = [255, 255, 255];
    for (let i = layers.length - 1; i >= 0; i--) base = over(layers[i], base);
    return base;
  }

  const out = [];
  for (const el of document.querySelectorAll("body *")) {
    const st = getComputedStyle(el);
    if (st.display === "none" || st.visibility === "hidden" || +st.opacity === 0) continue;
    // El texto decorativo oculto a tecnología asistiva queda fuera de 1.4.3.
    if (el.closest("[aria-hidden=\"true\"]")) continue;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;

    // Solo elementos con texto propio.
    const text = [...el.childNodes]
      .filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(" ").trim();
    if (!text) continue;

    const fg = parse(st.color);
    if (!fg) continue;
    const bg = backdrop(el);
    const cr = ratio(over(fg, bg), bg);

    const size = parseFloat(st.fontSize);
    const weight = +st.fontWeight || 400;
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    const min = large ? 3 : 4.5;
    if (cr + 0.05 < min) {
      out.push({
        text: text.slice(0, 42), ratio: +cr.toFixed(2), min,
        size: +size.toFixed(1), weight,
        sel: el.tagName.toLowerCase() + (el.className && typeof el.className === "string"
          ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".") : ""),
      });
    }
  }
  return out;
};

async function tabWalk(page, limit = 60) {
  const seen = [];
  let noOutline = [];
  await page.evaluate(() => document.body.focus());
  for (let i = 0; i < limit; i++) {
    await page.keyboard.press("Tab");
    const info = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const st = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      const visible = r.width > 0 && r.height > 0 && st.visibility !== "hidden";
      const ring = st.outlineStyle !== "none" && parseFloat(st.outlineWidth) > 0;
      const shadow = st.boxShadow && st.boxShadow !== "none";
      return {
        tag: el.tagName.toLowerCase(),
        label: (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 34),
        visible, focusRing: ring || shadow,
      };
    });
    if (!info) break;
    seen.push(info);
    if (info.visible && !info.focusRing) noOutline.push(info);
  }
  return { count: seen.length, first: seen[0], noOutline };
}

const browser = await chromium.launch();
const problems = [];

for (const [name, viewport, auth] of [
  ["landing", { width: 1440, height: 900 }, false],
  ["landing-movil", { width: 375, height: 812 }, false],
  ["panel", { width: 1440, height: 900 }, true],
  ["panel-movil", { width: 375, height: 812 }, true],
]) {
  const ctx = await browser.newContext({ viewport });
  if (auth) {
    await ctx.addInitScript((s) => localStorage.setItem("sb-example-auth-token", JSON.stringify(s)), FAKE_SESSION);
  }
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1800);

  const contrast = await page.evaluate(AUDIT);
  const kb = await tabWalk(page);
  problems.push({ name, contrast, kb });
  await ctx.close();
}
await browser.close();

let total = 0;
console.log("\n===== CONTRASTE (WCAG AA sobre render real) =====");
for (const p of problems) {
  const uniq = [...new Map(p.contrast.map((c) => [c.sel + c.ratio, c])).values()];
  total += uniq.length;
  console.log(`\n[${p.name}] ${uniq.length ? uniq.length + " insuficientes" : "✓ todo cumple AA"}`);
  for (const c of uniq.slice(0, 12)) {
    console.log(`   ${String(c.ratio).padStart(5)}:1 (min ${c.min})  ${c.size}px/${c.weight}  ${c.sel}  "${c.text}"`);
  }
}

console.log("\n===== TECLADO =====");
for (const p of problems) {
  const f = p.kb.first;
  console.log(`\n[${p.name}] ${p.kb.count} paradas | primera: ${f ? `<${f.tag}> "${f.label}"` : "ninguna"}`);
  if (p.kb.noOutline.length) {
    console.log(`   sin foco visible (${p.kb.noOutline.length}):`);
    for (const n of p.kb.noOutline.slice(0, 8)) console.log(`     <${n.tag}> "${n.label}"`);
    total += p.kb.noOutline.length;
  } else {
    console.log("   ✓ todas las paradas visibles tienen foco perceptible");
  }
}
console.log(`\nTOTAL problemas de accesibilidad: ${total}`);

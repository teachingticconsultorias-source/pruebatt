#!/usr/bin/env node
/* ==========================================================================
   SALVAGUARDA DE VARIABLES DE ENTORNO

   POR QUÉ EXISTE
   --------------
   `supabaseClient.js` hace:

       export const supabase = url && anonKey ? createClient(url, anonKey) : null;

   Vite sustituye `import.meta.env.VITE_*` en tiempo de compilación. Si las
   variables no están definidas, la ternaria se resuelve estáticamente a
   `null` y Rollup elimina como CÓDIGO MUERTO todo lo protegido por
   `if (!supabase)`: registro, login, recuperación, reenvío de confirmación,
   guardado de materiales…

   El resultado es un bundle que se pinta perfectamente pero NO autentica
   ni guarda nada, sin ningún aviso. Verificado: sin variables,
   "signInWithPassword" y "resend" desaparecen del bundle; con variables,
   reaparecen.

   Este script impide que eso llegue a un despliegue por descuido.

   NUNCA imprime el valor de una variable, solo si está presente o no.

   ESCAPE PARA COMPROBAR COMPILACIÓN
   ---------------------------------
   Para verificar únicamente que el proyecto compila, sin credenciales:

       SCIVERSE_SKIP_ENV_CHECK=1 npm run build

   El bundle resultante NO sirve para desplegar: le faltará la lógica de
   Supabase. El script lo advierte de forma explícita.
   ========================================================================== */

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

/** Lee un .env sin dependencias externas. No devuelve valores al exterior. */
function readEnvFile(file) {
  const full = path.join(ROOT, file);
  if (!fs.existsSync(full)) return {};
  const out = {};
  for (const rawLine of fs.readFileSync(full, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key) out[key] = value;
  }
  return out;
}

// Mismo orden de precedencia que usa Vite.
const fromFiles = {
  ...readEnvFile(".env"),
  ...readEnvFile(".env.production"),
  ...readEnvFile(".env.local"),
};

const has = (name) => {
  const value = process.env[name] ?? fromFiles[name];
  return typeof value === "string" && value.trim().length > 0;
};

/** Requisitos. `anyOf` acepta cualquiera de las alternativas. */
const REQUIRED = [
  {
    name: "VITE_SUPABASE_URL",
    why: "Sin ella el cliente de Supabase es null y se elimina toda la autenticación.",
  },
  {
    anyOf: ["VITE_SUPABASE_PUBLISHABLE_KEY", "VITE_SUPABASE_ANON_KEY"],
    why: "Se necesita la clave pública de Supabase (publishable o anon).",
  },
];

if (process.env.SCIVERSE_SKIP_ENV_CHECK === "1") {
  console.warn(
    "\n⚠️  SCIVERSE_SKIP_ENV_CHECK=1 — comprobación de entorno omitida.\n" +
      "   Este build sirve SOLO para verificar que el proyecto compila.\n" +
      "   NO lo despliegues: le faltará toda la lógica de Supabase.\n"
  );
  process.exit(0);
}

const missing = [];
for (const rule of REQUIRED) {
  if (rule.anyOf) {
    if (!rule.anyOf.some(has)) missing.push({ label: rule.anyOf.join(" o "), why: rule.why });
  } else if (!has(rule.name)) {
    missing.push({ label: rule.name, why: rule.why });
  }
}

if (missing.length > 0) {
  console.error("\n\x1b[31m✖ Faltan variables de entorno necesarias para construir SciVerse\x1b[0m\n");
  for (const item of missing) {
    console.error(`  Missing required environment variable:\n    ${item.label}`);
    console.error(`    → ${item.why}\n`);
  }
  console.error("  Sin ellas, Vite resuelve el cliente de Supabase a null y Rollup elimina");
  console.error("  el registro, el login, la recuperación y el guardado. El sitio se vería");
  console.error("  bien pero no funcionaría.\n");
  console.error("  Qué hacer:");
  console.error("    • En local  → copia .env.example a .env.local y complétalo.");
  console.error("    • En Vercel → Settings → Environment Variables.");
  console.error("    • Solo para comprobar que compila:");
  console.error("        SCIVERSE_SKIP_ENV_CHECK=1 npm run build\n");
  process.exit(1);
}

console.log("✓ Variables de entorno presentes. Continuando con el build.");

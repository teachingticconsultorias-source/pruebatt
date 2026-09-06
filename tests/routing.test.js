import { describe, it, expect } from "vitest";
import fs from "node:fs";

import adminRouter from "../api/admin/[action].js";
import paymentsRouter from "../api/payments/[action].js";

/* ============================================================================
   RUTAS AGRUPADAS

   Vercel Hobby permite 12 Serverless Functions y cada fichero suelto bajo
   `/api` cuenta como una. Los diez endpoints de administración y los dos del
   docente se agruparon en dos rutas dinámicas.

   Lo que hay que demostrar aquí es que agrupar NO cambió los contratos: cada
   URL pública sigue llegando a su manejador, con su método y su autorización
   intactos, y lo que no está en el mapa no existe.
   ========================================================================== */

/** Respuesta mínima con la superficie que usan los manejadores. */
function fakeRes() {
  const r = {
    statusCode: null,
    body: null,
    headers: {},
    setHeader(k, v) { r.headers[k] = v; },
    status(code) { r.statusCode = code; return r; },
    json(payload) { r.body = payload; return r; },
  };
  return r;
}

/** Petición sin sesión: basta para saber a qué manejador llegó. */
function req(action, method = "GET", extra = {}) {
  return { method, query: { action }, headers: {}, ...extra };
}

const ADMIN_GET  = ["summary", "docentes", "docente", "audit", "payments", "commerce"];
const ADMIN_POST = ["actions", "payment-actions", "commerce-actions", "payment-qr"];

describe("rutas · el panel de administración sigue teniendo diez puertas", () => {
  it("cada ruta de lectura llega a su manejador y pide sesión", async () => {
    for (const ruta of ADMIN_GET) {
      const res = fakeRes();
      await adminRouter(req(ruta, "GET"), res);
      // 401, no 404: la petición llegó al manejador y fue él quien la paró.
      expect(res.statusCode, ruta).toBe(401);
      expect(res.body?.code, ruta).toBe("AUTH_REQUIRED");
    }
  });

  it("cada ruta de escritura llega a su manejador y pide sesión", async () => {
    for (const ruta of ADMIN_POST) {
      const res = fakeRes();
      await adminRouter(req(ruta, "POST", { body: {} }), res);
      expect(res.statusCode, ruta).toBe(401);
      expect(res.body?.code, ruta).toBe("AUTH_REQUIRED");
    }
  });

  it("el método sigue importando: un GET a una ruta de escritura da 405", async () => {
    for (const ruta of ADMIN_POST) {
      const res = fakeRes();
      await adminRouter(req(ruta, "GET"), res);
      expect(res.statusCode, ruta).toBe(405);
      expect(res.body?.code, ruta).toBe("METHOD_NOT_ALLOWED");
    }
  });

  it("un POST a una ruta de lectura sigue dando 405", async () => {
    const res = fakeRes();
    await adminRouter(req("summary", "POST", { body: {} }), res);
    expect(res.statusCode).toBe(405);
  });

  it("lo que no está en el mapa no existe", async () => {
    for (const ruta of ["", "usuarios", "summary/../actions", "SUMMARY"]) {
      const res = fakeRes();
      await adminRouter(req(ruta, "GET"), res);
      expect(res.statusCode, ruta).toBe(404);
    }
  });

  it("no se puede llegar a nada por la cadena de prototipos", async () => {
    // Por esto el mapa se consulta con hasOwnProperty y no con `RUTAS[x]`:
    // `constructor` y `toString` existen en cualquier objeto.
    for (const ruta of ["constructor", "__proto__", "toString", "hasOwnProperty"]) {
      const res = fakeRes();
      await adminRouter(req(ruta, "GET"), res);
      expect(res.statusCode, ruta).toBe(404);
      expect(res.body?.code, ruta).toBe("NOT_FOUND");
    }
  });
});

describe("rutas · los dos endpoints del docente", () => {
  it("/api/payments/mine llega a su manejador", async () => {
    const res = fakeRes();
    await paymentsRouter(req("mine", "GET"), res);
    expect(res.statusCode).toBe(401);
  });

  it("/api/payments/request llega a su manejador", async () => {
    const res = fakeRes();
    await paymentsRouter(req("request", "POST", { body: { plan: "pro" } }), res);
    expect(res.statusCode).toBe(401);
  });

  it("mine no acepta POST ni request acepta GET", async () => {
    const a = fakeRes();
    await paymentsRouter(req("mine", "POST", { body: {} }), a);
    expect(a.statusCode).toBe(405);

    const b = fakeRes();
    await paymentsRouter(req("request", "GET"), b);
    expect(b.statusCode).toBe(405);
  });

  it("cualquier otra cosa es 404", async () => {
    const res = fakeRes();
    await paymentsRouter(req("aprobar", "POST", { body: {} }), res);
    expect(res.statusCode).toBe(404);
  });
});

/* ============================================================================
   EL LÍMITE DE VERCEL HOBBY

   Este test es el que impide que el fallo vuelva: si alguien añade ficheros
   sueltos bajo /api sin pensarlo, salta aquí y no en el deployment.
   ========================================================================== */
describe("rutas · presupuesto de Serverless Functions", () => {
  /** Entrypoints reales: todo lo que hay bajo /api sin prefijo `_`. */
  function entrypoints(dir = "api", base = "") {
    const out = [];
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name.startsWith("_")) continue; // Vercel ignora `_` : no son funciones
      const ruta = `${dir}/${e.name}`;
      if (e.isDirectory()) out.push(...entrypoints(ruta, `${base}${e.name}/`));
      else if (e.name.endsWith(".js")) out.push(`${base}${e.name}`);
    }
    return out;
  }

  it("cabemos en el plan Hobby con margen", () => {
    const total = entrypoints().length;
    expect(total, `entrypoints: ${entrypoints().join(", ")}`).toBeLessThanOrEqual(12);
    // El objetivo acordado es 10, para dejar sitio a lo que venga.
    expect(total).toBeLessThanOrEqual(10);
  });

  it("los manejadores y las librerías NO son entrypoints", () => {
    const rutas = entrypoints();
    expect(rutas.some((r) => r.includes("_lib/"))).toBe(false);
    expect(rutas.some((r) => r.includes("_handlers/"))).toBe(false);
    // Y siguen existiendo donde deben.
    expect(fs.existsSync("api/_handlers/admin/summary.js")).toBe(true);
    expect(fs.existsSync("api/_lib/errors.js")).toBe(true);
  });

  it("los generadores de IA siguen siendo funciones independientes", () => {
    // A propósito: cada uno tiene su propio tiempo de ejecución, sus logs y
    // su manejo de créditos. Agruparlos habría hecho más difícil diagnosticar
    // un timeout de Gemini, que es justo lo que hay que poder diagnosticar.
    for (const f of ["generate-session.js", "generate-session-resource.js",
                     "generate-linked-worksheet.js", "generate-project-steam.js"]) {
      expect(entrypoints(), f).toContain(f);
    }
  });

  it("el panel legacy sigue en pie hasta que se retire ADMIN_SECRET", () => {
    expect(entrypoints()).toContain("list-docentes.js");
  });

  it("el endpoint huérfano de cuota ya no ocupa sitio", () => {
    expect(fs.existsSync("api/generate-with-quota.js")).toBe(false);
    // Nadie lo llamaba: ni el frontend ni ningún otro endpoint.
    const fuentes = [
      "App.jsx", "main.jsx", "AdminPanel.jsx",
    ].filter((f) => fs.existsSync(f)).map((f) => fs.readFileSync(f, "utf8")).join("\n");
    expect(fuentes).not.toContain("generate-with-quota");
  });
});

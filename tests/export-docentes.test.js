import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";

import handler from "../api/_handlers/admin/export-docentes.js";
import { COLUMNAS, construirLibro, describirFiltros, nombreDeArchivo,
  prepararFila, resumirDocentes } from "../lib/admin/exportar-docentes.js";

/* ============================================================================
   EXPORTAR LA LISTA DE DOCENTES

   El fichero se lleva nombres, correos y teléfonos FUERA del sistema. Lo que
   se fija aquí es que no salga de cualquier manera: que el gate lo decida la
   base y no la pantalla, que `support` no vea teléfonos ni en el archivo, que
   los filtros que viajan sean los que la persona puso, y que el .xlsx tenga la
   forma que hace que se pueda usar de verdad.
   ========================================================================== */

const ITEM = {
  user_id: "u1", nombres: "María", apellidos: "Quispe", ie: "I.E. San Carlos",
  nivel: "secundaria", celular: "0951234567", activo: true,
  created_at: "2026-03-14T10:22:00Z", email: "m@example.pe", email_confirmado: true,
  ultimo_acceso: "2026-09-14T18:02:00Z", plan: "pro", plan_nombre: "Pro",
  plan_desde: "2026-08-01", plan_hasta: "2026-11-01", limite_semanal: 40,
  usadas_semana: 12, generaciones_total: 187, ultima_generacion: "2026-09-15T14:30:00Z",
};

/** Ejecuta el handler real registrando qué RPC se llamó y con qué cuerpo. */
async function llamar(query, { rol = "admin", esAdmin = true } = {}) {
  const rpcs = [];
  vi.stubGlobal("fetch", vi.fn(async (url, o = {}) => {
    const j = (b, s = 200) => ({ ok: s < 400, status: s, json: async () => b });
    const u = String(url);
    if (u.includes("/auth/v1/user")) return j({ id: "admin-1" });
    if (u.includes("/rest/v1/rpc/")) {
      const nombre = u.split("/rpc/")[1].split("?")[0];
      const cuerpo = o.body ? JSON.parse(o.body) : {};
      rpcs.push({ nombre, cuerpo });
      if (nombre === "current_admin") return j({ is_admin: esAdmin, role: rol });
      if (nombre === "admin_export_docentes") {
        return j({ generado_en: "2026-09-15T12:00:00", filas: 1, rol,
          items: [rol === "support" ? { ...ITEM, celular: null } : ITEM] });
      }
      return j({ ok: true });
    }
    throw new Error(`Red inesperada: ${u}`);
  }));
  const res = { setHeader() {}, status(n) { this.statusCode = n; return this; }, json(d) { this.body = d; return this; } };
  await handler({ method: "GET", query, headers: { authorization: "Bearer jwt" } }, res);
  return { estado: res.statusCode ?? 200, body: res.body, rpcs };
}

beforeEach(() => {
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-key");
  vi.stubEnv("VITE_SUPABASE_URL", "https://supabase.test");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "anon");
  for (const m of ["log", "warn", "error"]) vi.spyOn(console, m).mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("Export de docentes · el gate lo decide la base", () => {
  it("un usuario con sesión pero SIN rol de admin recibe 403", async () => {
    const { estado, body, rpcs } = await llamar({}, { esAdmin: false });
    expect(estado).toBe(403);
    // Y no se llegó a pedir ni una fila.
    expect(rpcs.map((r) => r.nombre)).not.toContain("admin_export_docentes");
    expect(String(body?.error)).not.toMatch(/docente|correo|celular/i);
  });

  it("y la decisión se toma preguntando a la base, no mirando el cuerpo", async () => {
    const { rpcs } = await llamar({});
    const primera = rpcs[0];
    // `current_admin` se llama ANTES que nada, y con el token del usuario.
    expect(primera.nombre).toBe("current_admin");
    expect(rpcs.findIndex((r) => r.nombre === "admin_export_docentes"))
      .toBeGreaterThan(rpcs.findIndex((r) => r.nombre === "current_admin"));
  });

  it("el actor que viaja al RPC es el del token, no uno del cliente", async () => {
    // Si el cuerpo pudiera elegir el actor, la auditoría registraría a quien
    // el atacante quisiera.
    const { rpcs } = await llamar({ actor: "otro-usuario", p_actor: "otro-usuario" });
    const exportar = rpcs.find((r) => r.nombre === "admin_export_docentes");
    expect(exportar.cuerpo.p_actor).toBe("admin-1");
  });

  it("sólo GET", async () => {
    const res = { setHeader() {}, status(n) { this.statusCode = n; return this; }, json(d) { this.body = d; return this; } };
    await handler({ method: "POST", query: {}, headers: {} }, res);
    expect(res.statusCode).toBe(405);
  });
});

describe("Export de docentes · los filtros que viajan son los de la pantalla", () => {
  it("cada filtro llega al RPC con su nombre", async () => {
    const { rpcs } = await llamar({
      search: "quispe", plan: "pro", desde: "2026-01-01", hasta: "2026-09-30",
      nivel: "secundaria", confirmado: "true", activo: "false",
    });
    const { cuerpo } = rpcs.find((r) => r.nombre === "admin_export_docentes");
    expect(cuerpo).toMatchObject({
      p_search: "quispe", p_plan: "pro", p_desde: "2026-01-01", p_hasta: "2026-09-30",
      p_nivel: "secundaria", p_confirmado: true, p_activo: false,
    });
  });

  it("lo que no se pone viaja en null: null significa «no filtrar»", async () => {
    const { rpcs } = await llamar({});
    const { cuerpo } = rpcs.find((r) => r.nombre === "admin_export_docentes");
    for (const clave of ["p_search", "p_plan", "p_desde", "p_hasta", "p_nivel", "p_confirmado", "p_activo"]) {
      expect(cuerpo[clave], clave).toBeNull();
    }
  });

  it("y lo que llega mal se ignora en vez de viajar a la consulta", async () => {
    const { rpcs } = await llamar({
      plan: "carísimo", nivel: "universidad", desde: "ayer", hasta: "2026/09/30", confirmado: "quizá",
    });
    const { cuerpo } = rpcs.find((r) => r.nombre === "admin_export_docentes");
    expect(cuerpo.p_plan).toBeNull();
    expect(cuerpo.p_nivel).toBeNull();
    expect(cuerpo.p_desde).toBeNull();
    expect(cuerpo.p_hasta).toBeNull();
    expect(cuerpo.p_confirmado).toBeNull();
  });
});

describe("Export de docentes · el teléfono y el rol", () => {
  it("con rol support el archivo NO lleva la columna de teléfono", async () => {
    const { body } = await llamar({}, { rol: "support" });
    const blob = await construirLibro(body.items, { rol: "support", incluirCelular: false });
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(await blob.arrayBuffer()));
    const titulos = [];
    wb.getWorksheet("Docentes").getRow(1).eachCell((c) => titulos.push(c.value));
    expect(titulos).not.toContain("Teléfono / WhatsApp");
    // Y la hoja de resumen lo dice, para que nadie crea que no hay teléfonos.
    const resumen = [];
    wb.getWorksheet("Resumen").eachRow((f) => resumen.push(String(f.getCell(1).value)));
    expect(resumen).toContain("Teléfono");
  });

  it("con rol admin sí la lleva, y como TEXTO para no perder el cero inicial", async () => {
    const blob = await construirLibro([ITEM], { rol: "admin", incluirCelular: true });
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(await blob.arrayBuffer()));
    const hoja = wb.getWorksheet("Docentes");
    const i = COLUMNAS.findIndex((c) => c.clave === "celular") + 1;
    expect(hoja.getColumn(i).numFmt).toBe("@");
    expect(hoja.getRow(2).getCell(i).value).toBe("0951234567");
    expect(typeof hoja.getRow(2).getCell(i).value).toBe("string");
  });

  it("el recorte se pide en las DOS capas, no en una sola", () => {
    const fuente = fs.readFileSync("api/_handlers/admin/export-docentes.js", "utf8");
    expect(fuente).toContain("scopeForRole");
    const migracion = fs.readFileSync("supabase/migrations/016_export_docentes.sql", "utf8");
    expect(migracion).toContain("case when v_role = 'support' then null else d.celular end");
  });
});

describe("Export de docentes · el .xlsx se puede usar de verdad", () => {
  let hoja, resumen;
  beforeEach(async () => {
    const blob = await construirLibro([ITEM, { ...ITEM, user_id: "u2", plan: "free", plan_nombre: "Free", nivel: "primaria", activo: false }],
      { filtros: { plan: "pro" }, rol: "admin", incluirCelular: true });
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(await blob.arrayBuffer()));
    hoja = wb.getWorksheet("Docentes");
    resumen = wb.getWorksheet("Resumen");
  });

  it("la cabecera se congela y filtra", () => {
    expect(hoja.views[0].state).toBe("frozen");
    expect(hoja.views[0].ySplit).toBe(1);
    expect(hoja.autoFilter).toBeTruthy();
  });

  it("la cabecera va en negrita y blanco sobre el azul del sistema", () => {
    const celda = hoja.getRow(1).getCell(1);
    expect(celda.font.bold).toBe(true);
    expect(celda.font.color.argb).toBe("FFFFFFFF");
    expect(celda.fill.fgColor.argb).toBe("FF0B2E4F");
  });

  it("los anchos no son todos iguales", () => {
    const anchos = COLUMNAS.map((_, i) => hoja.getColumn(i + 1).width);
    expect(new Set(anchos).size).toBeGreaterThan(1);
  });

  it("las fechas son fechas, no cadenas que lo parezcan", () => {
    const i = COLUMNAS.findIndex((c) => c.clave === "created_at") + 1;
    expect(hoja.getColumn(i).numFmt).toBe("dd/mm/yyyy");
    expect(hoja.getRow(2).getCell(i).value).toBeInstanceOf(Date);
  });

  it("las filas se alternan para poder leerlas", () => {
    expect(hoja.getRow(2).getCell(1).fill?.fgColor?.argb).toBe("FFF2F7FB");
    expect(hoja.getRow(3).getCell(1).fill?.fgColor?.argb).toBeUndefined();
  });

  it("y hay una segunda hoja con los conteos", () => {
    const filas = [];
    resumen.eachRow((f) => filas.push([String(f.getCell(1).value ?? ""), f.getCell(2).value]));
    const etiquetas = filas.map((f) => f[0]);
    for (const e of ["Docentes exportados", "Plan Pro", "Plan Free", "POR NIVEL", "POR PLAN", "Filtros aplicados"]) {
      expect(etiquetas, e).toContain(e);
    }
    expect(filas.find((f) => f[0] === "Docentes exportados")[1]).toBe(2);
  });
});

describe("Export de docentes · los detalles que se notan al abrirlo", () => {
  it("el nombre del archivo lleva la fecha", () => {
    expect(nombreDeArchivo(new Date("2026-09-15T12:00:00Z"))).toBe("docentes-sciverse-2026-09-15.xlsx");
  });

  it("los filtros vacíos NO se describen como puestos", () => {
    // `"" != null` es verdadero: sin esto, un export sin filtrar decía
    // «Correo confirmado: No · Estado: Inactivo».
    expect(describirFiltros({ confirmado: "", activo: "", plan: "" }))
      .toBe("Sin filtros: todos los docentes");
    expect(describirFiltros({ confirmado: "false" })).toContain("Correo confirmado: No");
  });

  it("el resumen cuenta Pro y Free por el plan efectivo", () => {
    const r = resumirDocentes([ITEM, { ...ITEM, plan: "free" }, { ...ITEM, plan: null }]);
    expect(r.total).toBe(3);
    expect(r.pro).toBe(1);
    expect(r.free).toBe(2);
  });

  it("una fila sin datos opcionales no rompe nada", () => {
    const f = prepararFila({ nombres: "Ana", apellidos: "", email: null });
    expect(f.nombre_completo).toBe("Ana");
    expect(f.plan_hasta).toBeNull();
    expect(f.ultima_generacion).toBeNull();
    expect(f.generaciones_total).toBe(0);
  });

  it("ExcelJS entra por import dinámico, no en el bundle de las docentes", () => {
    const fuente = fs.readFileSync("lib/admin/exportar-docentes.js", "utf8");
    expect(fuente).toContain('await import("exceljs")');
    expect(fuente).not.toMatch(/^import .*exceljs/m);
    // Y el panel carga el módulo entero también en diferido.
    const panel = fs.readFileSync("components/admin/AdminApp.jsx", "utf8");
    expect(panel).toContain('await import("../../lib/admin/exportar-docentes.js")');
  });

  it("no hay Function nueva: entra por la ruta agrupada", () => {
    const router = fs.readFileSync("api/admin/[action].js", "utf8");
    expect(router).toContain('"export-docentes"');
    const sueltas = fs.readdirSync("api").filter((f) => f.endsWith(".js"));
    expect(sueltas).not.toContain("export-docentes.js");
  });
});

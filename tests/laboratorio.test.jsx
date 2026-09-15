import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import JSZip from "jszip";
import { Packer } from "docx";

import handler from "../api/generate-session-resource.js";
import { buildDocument } from "../lib/docx/exporters.js";
import { BLOQUES_DOCENTE, BLOQUES_FICHA, MOMENTOS_INDAGACION, ROTULO_DOCENTE,
  ROTULO_FICHA, fichaEstudianteChildren, guiaDocenteChildren, labGuideChildren,
  laboratorioBloques } from "../lib/docx/plantillas/laboratorio.js";
import { DESTINO_POR_CAMPO, INTRO_POR_CAMPO, construirContextoKantu, tieneTema } from "../lib/kantu/contexto.js";
import { esOracion, revisarProposito } from "../lib/ui/validaciones.js";
import { CAPACIDADES_POR_DEFECTO, permiteGuiaDocente } from "../api/_lib/entitlements.js";
import { formLab, labGuide } from "./fixtures/word.js";

/* ============================================================================
   GUÍA DE LABORATORIO

   Un solo recurso con DOS documentos dentro. Lo que se comprueba aquí es que
   el dato del formulario llega al prompt, que el presupuesto está medido y no
   puesto a ojo, y que el DOCX reproduce las secciones de las dos plantillas
   oficiales de PLANTILLAS/SCIVERSE/GUÍA DE LABORATORIO/.
   ========================================================================== */

async function unpack(doc) {
  const zip = await JSZip.loadAsync(await Packer.toBuffer(doc));
  return zip.file("word/document.xml").async("string");
}
const tablas = xml => xml.match(/<w:tbl>[\s\S]*?<\/w:tbl>/g) || [];
const documento = () => buildDocument("lab_guide", { form: formLab, resource: labGuide, profile: { ie: "IE Demostración" } });

/** Ejecuta el endpoint real y devuelve el prompt que recibió Gemini. */
async function promptDeGemini(cuerpo) {
  let prompt = "", config = null;
  vi.stubGlobal("fetch", vi.fn(async (url, options = {}) => {
    const json = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });
    if (String(url).includes("/auth/v1/user")) return json({ id: "docente-lab" });
    if (String(url).includes("/rest/v1/rpc/")) return json({ ok: true, consumption_id: "c1", remaining: 9, status: "started" });
    if (String(url).includes("generativelanguage.googleapis.com")) {
      const enviado = JSON.parse(options.body);
      config = enviado.generationConfig;
      prompt = enviado.contents.map(c => c.parts.map(p => p.text).join("\n")).join("\n");
      return json({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify(labGuide) }] } }],
        usageMetadata: { candidatesTokenCount: 1801 } });
    }
    throw new Error(`Red inesperada: ${url}`);
  }));
  const res = { setHeader() {}, status(n) { this.statusCode = n; return this; }, json(d) { this.body = d; return this; } };
  await handler({ method: "POST", body: cuerpo,
    headers: { authorization: "Bearer jwt", "idempotency-key": "laboratorio-test-0001" } }, res);
  return { prompt, config, respuesta: res.body };
}

beforeEach(() => {
  vi.stubEnv("GEMINI_API_KEY", "test-key");
  vi.stubEnv("GEMINI_MAIN_MODEL", "gemini-test");
  vi.stubEnv("VITE_SUPABASE_URL", "https://supabase.test");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "test-anon");
  for (const m of ["log", "warn", "error"]) vi.spyOn(console, m).mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("Laboratorio · del formulario al prompt", () => {
  it("viaja por el endpoint de recursos, sin Function nueva", () => {
    const funciones = fs.readdirSync("api").filter(f => f.endsWith(".js"));
    expect(funciones).not.toContain("generate-lab-guide.js");
    const endpoint = fs.readFileSync("api/generate-session-resource.js", "utf8");
    expect(endpoint).toContain("lab_guide:");
  });

  it("los cuatro campos propios del laboratorio llegan a Gemini", async () => {
    const { prompt } = await promptDeGemini({ type: "lab_guide", form: formLab });
    // Sin estos cuatro, el modelo propone reactivos que no existen en un
    // colegio público y procedimientos que no caben en la hora.
    expect(prompt).toContain(formLab.materialesDisponibles);
    expect(prompt).toContain(formLab.tipoExperimento);
    expect(prompt).toContain(formLab.medidasSeguridad);
    expect(prompt).toContain("Integrantes por equipo: 4");
    expect(prompt).toContain("Duración de la sesión: 90 minutos");
  });

  it("el contexto curricular sigue llegando igual que en los demás recursos", async () => {
    const { prompt } = await promptDeGemini({ type: "lab_guide", form: formLab });
    for (const valor of [formLab.nivel, formLab.grado, formLab.area, formLab.tema,
      formLab.proposito, formLab.competencia]) {
      expect(prompt, valor).toContain(valor);
    }
    for (const cap of formLab.capacidades) expect(prompt).toContain(cap);
  });

  it("el presupuesto está medido, no puesto a ojo", async () => {
    const { config } = await promptDeGemini({ type: "lab_guide", form: formLab });
    // 1801 tokens de salida medidos sobre un ejemplar completo + razonamiento
    // en `low`. Con `medium` (2901) y 4500 se pasaría, como le pasó a
    // `sequence` en producción.
    expect(config.maxOutputTokens).toBe(6000);
    expect(config.thinkingConfig?.thinkingLevel).toBe("low");
  });

  it("el prompt prohíbe lo que no cabe en un laboratorio escolar", async () => {
    const { prompt } = await promptDeGemini({ type: "lab_guide", form: formLab });
    expect(prompt).toContain("sustancias peligrosas");
    expect(prompt).toContain("escuela pública peruana");
    expect(prompt).toContain("NO generes la hipótesis ni las variables");
  });

  it("cobra un crédito, como cualquier otra generación", async () => {
    const llamadas = [];
    vi.stubGlobal("fetch", vi.fn(async (url, options = {}) => {
      const json = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });
      if (String(url).includes("/rest/v1/rpc/")) {
        llamadas.push(String(url).split("/rpc/")[1]);
        return json({ ok: true, consumption_id: "c1", remaining: 9, status: "started" });
      }
      if (String(url).includes("/auth/v1/user")) return json({ id: "docente-lab" });
      if (String(url).includes("generativelanguage")) {
        return json({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify(labGuide) }] } }],
          usageMetadata: { candidatesTokenCount: 1801 } });
      }
      throw new Error(`Red inesperada: ${url}`);
    }));
    const res = { setHeader() {}, status(n) { this.statusCode = n; return this; }, json(d) { this.body = d; return this; } };
    await handler({ method: "POST", body: { type: "lab_guide", form: formLab },
      headers: { authorization: "Bearer jwt", "idempotency-key": "laboratorio-credito-1" } }, res);
    expect(llamadas).toContain("consume_ai_credit");
    expect(res.statusCode ?? 200).toBe(200);
  });
});

describe("Laboratorio · el DOCX reproduce las dos plantillas", () => {
  it("la ficha del estudiante trae sus cinco secciones", async () => {
    const xml = await unpack(documento());
    for (const seccion of ["I. ENCABEZADO Y DATOS GENERALES", "II. PROPÓSITO DE LA PRÁCTICA",
      "III. MIS COMPROMISOS DE SEGURIDAD", "IV. MATERIALES Y REACTIVOS",
      "V. PASOS PARA LA INDAGACIÓN"]) {
      expect(xml, seccion).toContain(seccion);
    }
    expect(xml).toContain("Ficha del Estudiante");
  });

  it("la guía del docente trae sus nueve secciones romanas", async () => {
    const xml = await unpack(documento());
    for (const seccion of ["I. DATOS GENERALES", "II. VÍNCULO CURRICULAR",
      "III. PROPÓSITO Y PREGUNTA DE INDAGACIÓN", "IV. PREPARACIÓN PREVIA DEL DOCENTE",
      "V. GESTIÓN DEL TIEMPO SUGERIDA", "VI. ORIENTACIONES POR MOMENTO DE LA INDAGACIÓN",
      "VII. SOLUCIONARIO DE REFERENCIA", "VIII. ORIENTACIONES DUA",
      "IX. INSTRUMENTO DE EVALUACIÓN: RÚBRICA ANALÍTICA"]) {
      expect(xml, seccion).toContain(seccion);
    }
    expect(xml).toContain("Guía del Docente");
  });

  it("las dos partes van en un solo documento, separadas por salto de página", async () => {
    const xml = await unpack(documento());
    expect((xml.match(/w:type="page"/g) || [])).toHaveLength(1);
    // Vertical de principio a fin, como las dos plantillas oficiales.
    expect(xml.match(/w:orient="portrait"/g)).toBeTruthy();
    expect(xml).not.toContain('w:orient="landscape"');
  });

  it("los cinco momentos de la indagación llevan su barra navy", async () => {
    const xml = await unpack(documento());
    for (const momento of MOMENTOS_INDAGACION) expect(xml, momento).toContain(momento);
    expect(xml).toContain('w:fill="0B2E4F"');
  });

  it("las normas de seguridad son casillas sobre el fondo ámbar del pack", async () => {
    const xml = await unpack(documento());
    expect(xml).toContain('w:fill="FFF4DE"');
    expect((xml.match(/☐/g) || []).length).toBeGreaterThanOrEqual(labGuide.normasSeguridad.length);
  });

  it("la hipótesis y las variables del estudiante van EN BLANCO", async () => {
    const xml = await unpack(documento());
    // Las escribe él en clase: ése es el ejercicio.
    expect(xml).toContain("Nuestra hipótesis:");
    expect(xml).toContain("Variable independiente (causa)");
    expect(xml).toContain("Variable dependiente (efecto)");
    // La hipótesis modelo existe, pero en la guía de la docente y advertida.
    expect(xml).toContain("no se entrega a los estudiantes");
    expect(xml).toContain(labGuide.guiaDocente.hipotesisModelo);
  });

  it("la cuadrícula del gráfico es cuadrada y es la única altura exacta", async () => {
    const xml = await unpack(documento());
    const grid = tablas(xml).find(t => (t.match(/<w:gridCol/g) || []).length === 16);
    expect(grid).toBeTruthy();
    expect(grid).toContain('w:hRule="exact"');
    const alto = grid.match(/<w:trHeight w:val="(\d+)"/)[1];
    const ancho = grid.match(/<w:gridCol w:w="(\d+)"/)[1];
    expect(alto).toBe(ancho);
    // Ninguna otra tabla fija altura exacta: todo lo demás crece.
    expect((xml.match(/w:hRule="exact"/g) || []).length).toBe((grid.match(/w:hRule="exact"/g) || []).length);
  });

  it("los encabezados de la tabla de datos son los que generó el modelo", async () => {
    const xml = await unpack(documento());
    for (const columna of labGuide.columnasRegistro) expect(xml).toContain(columna);
    // Nada de «Columna 1», que es el marcador de la plantilla en blanco.
    expect(xml).not.toContain("Columna 1");
  });

  it("la gestión del tiempo y las orientaciones repiten cabecera y no se cortan", async () => {
    const xml = await unpack(documento());
    expect(xml).toContain("Observación para el docente");
    expect(xml).toContain("<w:tblHeader");
    for (const fila of labGuide.guiaDocente.gestionTiempo) expect(xml).toContain(fila.momento);
    for (const o of labGuide.guiaDocente.orientaciones) {
      expect(xml).toContain(o.queObservar);
      expect(xml).toContain(o.comoIntervenir);
    }
  });

  it("la rúbrica usa la misma tabla de cinco columnas AD→C que el resto", async () => {
    const xml = await unpack(documento());
    expect(xml).toMatch(/Criterio[\s\S]*Logro destacado \(AD\)[\s\S]*Logrado \(A\)[\s\S]*En proceso \(B\)[\s\S]*En inicio \(C\)/);
    expect(xml).toContain('w:fill="6BB3E0"');
  });

  it("NO inventa el estándar de aprendizaje, igual que la sesión", async () => {
    const xml = await unpack(documento());
    expect(xml).not.toContain("Estándar de aprendizaje");
    expect(xml).not.toMatch(/Por completar|N\/A|Generado por IA/);
  });

  it("identidad y limpieza, como cualquier otro documento", async () => {
    const xml = await unpack(documento());
    expect(xml).toContain('w:ascii="Calibri"');
    expect(xml).not.toMatch(/undefined|\[object Object\]|\bnull\b|\*\*|##|`|\|/);
    expect(xml).not.toContain("_____");
    for (const m of xml.matchAll(/<w:sz w:val="(\d+)"/g)) expect(Number(m[1])).toBeGreaterThanOrEqual(20);
  });

  it("un recurso incompleto no rompe el documento", async () => {
    // La biblioteca puede abrir algo guardado con un esquema anterior.
    const xml = await unpack(buildDocument("lab_guide", { form: {}, resource: { titulo: "Práctica mínima" } }));
    expect(xml).toContain("Práctica mínima");
    expect(xml).toContain("GUÍA DE LABORATORIO");
    expect(xml).not.toMatch(/undefined|\[object Object\]/);
  });
});

describe("Laboratorio · plan, biblioteca y catálogo", () => {
  it("es Free completa: nada la gatea hoy", () => {
    const endpoint = fs.readFileSync("api/generate-session-resource.js", "utf8");
    expect(endpoint).not.toContain("permiteGuiaDocente");
    expect(CAPACIDADES_POR_DEFECTO.free.lab_teacher_guide).toBe(false);
  });

  it("la capacidad queda preparada para mover la guía del docente a Pro", () => {
    // Declarada y probada, pero sin conectar: activarla es llamar a esta
    // función desde el endpoint, sin volver a tocar el esquema.
    expect(permiteGuiaDocente(CAPACIDADES_POR_DEFECTO.pro)).toBe(true);
    expect(permiteGuiaDocente(CAPACIDADES_POR_DEFECTO.free)).toBe(false);
    expect(permiteGuiaDocente(undefined)).toBe(false);
  });

  it("la migración 013 acepta el tipo y la 011 avisa de que no se ejecute", () => {
    const m013 = fs.readFileSync("supabase/migrations/013_lab_guide_material.sql", "utf8");
    expect(m013).toContain("'lab_guide'");
    expect(m013).toContain("'wordsearch'");
    // La 011 no incluye lab_guide EN SU CHECK: correrla después lo borraría.
    const m011 = fs.readFileSync("supabase/migrations/011_wordsearch_material.sql", "utf8");
    expect(m011).toContain("SUPERSEDIDA POR 013");
    const constraint011 = m011.slice(m011.indexOf("add constraint"));
    expect(constraint011).not.toContain("lab_guide");
    expect(constraint011).toContain("'wordsearch'");
  });

  it("la biblioteca sabe pintar el tipo nuevo", () => {
    const biblioteca = fs.readFileSync("components/library/Library.jsx", "utf8");
    expect(biblioteca).toContain("lab_guide:");
    expect(biblioteca).toContain("Guía de laboratorio");
  });

  it("la herramienta está en el catálogo y enrutada", () => {
    const tools = fs.readFileSync("config/tools.js", "utf8");
    expect(tools).toContain('id: "lab-guide"');
    expect(tools).toContain('status: "available"');
    const app = fs.readFileSync("App.jsx", "utf8");
    expect(app).toContain('creation==="lab-guide"?<LabGuideGenerator');
    // Con su guarda de doble clic y su guardado inyectado.
    const componente = fs.readFileSync("components/LabGuideGenerator.jsx", "utf8");
    expect(componente).toContain("const [unaVez] = useAccionUnica();");
    expect(componente).toContain("unaVez(generar)");
    expect(componente).toContain("onGuardar?.(");
  });
});

/* ============================================================================
   LAS DOS MITADES, CADA UNA UNA VEZ

   El documento son dos plantillas oficiales dentro de un solo .docx. Lo que se
   fija aquí es lo que no puede variar: que cada rótulo salga EXACTAMENTE una
   vez, que la ficha vaya primero, que las separe un único salto de página y
   que la suma de los bloques declarados sea exactamente lo que se compone.

   Esa última comprobación es la que impide que vuelva a pasar lo del troceado
   de la sesión: allí la maqueta y el reparto por secciones se calculaban por
   separado, uno leyendo el texto del otro, y cuando la lectura dejó de
   funcionar nadie se enteró porque ninguna prueba comparaba las dos cifras.
   ========================================================================== */
describe("Laboratorio · la estructura del documento", () => {
  const opciones = { form: formLab, resource: labGuide, profile: { ie: "IE Demostración" } };

  it("los dieciséis bloques traen contenido y ninguno se queda fuera", () => {
    const bloques = laboratorioBloques(opciones);
    // Ni un bloque declarado sin construir, ni uno construido sin declarar.
    expect(Object.keys(bloques).sort()).toEqual([...BLOQUES_FICHA, ...BLOQUES_DOCENTE].sort());
    for (const clave of [...BLOQUES_FICHA, ...BLOQUES_DOCENTE]) {
      expect(bloques[clave].length, `${clave} vacío`).toBeGreaterThan(0);
    }
  });

  it("la composición se arma DESDE los bloques: hijos = suma + el salto", () => {
    const bloques = laboratorioBloques(opciones);
    const suma = (claves) => claves.reduce((n, c) => n + bloques[c].length, 0);

    expect(fichaEstudianteChildren(opciones).length).toBe(suma(BLOQUES_FICHA));
    expect(guiaDocenteChildren(opciones).length).toBe(suma(BLOQUES_DOCENTE));
    // El único hijo que no sale de un bloque es el salto de página.
    expect(labGuideChildren(opciones).length)
      .toBe(suma(BLOQUES_FICHA) + suma(BLOQUES_DOCENTE) + 1);
  });

  it("un bloque sin datos desaparece entero, sin dejar encabezado huérfano", () => {
    // Una práctica de observación sin normas de seguridad ni rúbrica.
    const pelada = { ...labGuide, normasSeguridad: [], guiaDocente: { ...labGuide.guiaDocente, rubrica: [] } };
    const bloques = laboratorioBloques({ ...opciones, resource: pelada });
    expect(bloques.ficha_seguridad).toEqual([]);
    expect(bloques.docente_rubrica).toEqual([]);
    // Y la cuenta sigue cuadrando: no quedan huecos a medias.
    const suma = [...BLOQUES_FICHA, ...BLOQUES_DOCENTE].reduce((n, c) => n + bloques[c].length, 0);
    expect(labGuideChildren({ ...opciones, resource: pelada }).length).toBe(suma + 1);
  });

  it("cada rótulo aparece UNA sola vez, y la ficha va antes que la guía", async () => {
    const xml = await unpack(documento());
    const texto = [...xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join("");
    const veces = (frase) => texto.split(frase).length - 1;

    expect(veces(ROTULO_FICHA), ROTULO_FICHA).toBe(1);
    expect(veces(ROTULO_DOCENTE), ROTULO_DOCENTE).toBe(1);
    expect(texto.indexOf(ROTULO_FICHA)).toBeLessThan(texto.indexOf(ROTULO_DOCENTE));
    // Un solo salto de página: uno por mitad dejaría una página en blanco.
    expect((xml.match(/<w:br w:type="page"\/>/g) || []).length).toBe(1);
  });

  it("y debajo de cada rótulo van sus secciones, no las de la otra mitad", async () => {
    const xml = await unpack(documento());
    const texto = [...xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join("");
    const ficha = texto.slice(texto.indexOf(ROTULO_FICHA), texto.indexOf(ROTULO_DOCENTE));
    const guia = texto.slice(texto.indexOf(ROTULO_DOCENTE));

    // Cinco secciones en la ficha, nueve romanas en la guía.
    for (const s of ["I. ENCABEZADO Y DATOS GENERALES", "II. PROPÓSITO DE LA PRÁCTICA",
      "III. MIS COMPROMISOS DE SEGURIDAD", "IV. MATERIALES Y REACTIVOS",
      "V. PASOS PARA LA INDAGACIÓN"]) {
      expect(ficha, s).toContain(s);
      expect(guia, `${s} se coló en la guía`).not.toContain(s);
    }
    for (const s of ["I. DATOS GENERALES", "II. VÍNCULO CURRICULAR",
      "III. PROPÓSITO Y PREGUNTA DE INDAGACIÓN", "IV. PREPARACIÓN PREVIA DEL DOCENTE",
      "V. GESTIÓN DEL TIEMPO SUGERIDA", "VI. ORIENTACIONES POR MOMENTO",
      "VII. SOLUCIONARIO DE REFERENCIA", "VIII. ORIENTACIONES DUA",
      "IX. INSTRUMENTO DE EVALUACIÓN"]) {
      expect(guia, s).toContain(s);
    }
  });

  it("el título que escribe la docente manda sobre el que propone el modelo", async () => {
    const propio = "El agua que sube sola por un tallo";
    const xml = await unpack(buildDocument("lab_guide", {
      form: { ...formLab, titulo: propio }, resource: labGuide, profile: {} }));
    expect(xml).toContain(propio);
    expect(xml).not.toContain(labGuide.titulo);
  });
});

/* ============================================================================
   EL FORMULARIO: SUGERIR Y VALIDAR

   Dos huecos que tenía respecto del resto de generadores: no se podía pedir
   título a Kantu, y el propósito aceptaba una palabra suelta. Lo segundo no es
   cosmético: gastaba una generación de la semana para devolver una guía
   genérica.
   ========================================================================== */
describe("Laboratorio · el propósito tiene que ser una oración", () => {
  it("rechaza la palabra suelta que pasó en producción", () => {
    expect(revisarProposito("DEMOSTRAR")).toMatch(/una oración/i);
    expect(revisarProposito("densidad")).toBeTruthy();
    expect(revisarProposito("   ")).toMatch(/Escribe el propósito/);
  });

  it("y no se deja engañar por caracteres sin palabras", () => {
    expect(esOracion("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA")).toBe(false);
    expect(esOracion("... ¿¿¿ --- ,,, ;;; ((( )))")).toBe(false);
    expect(esOracion("1 2 3 4 5 6 7 8 9 10 11 12")).toBe(false);
  });

  it("acepta un propósito corto pero real: el listón no juzga la redacción", () => {
    expect(revisarProposito("Medir la densidad de tres líquidos.")).toBeNull();
    expect(revisarProposito(labGuide.proposito)).toBeNull();
  });

  it("el formulario lo usa en los dos sitios por donde se puede pasar", () => {
    const componente = fs.readFileSync("components/LabGuideGenerator.jsx", "utf8");
    // El paso 2, y otra vez antes de generar: al paso 3 se llega también
    // pulsando el indicador de pasos, que no ejecuta `siguiente()`.
    expect((componente.match(/revisarProposito\(form\.proposito\)/g) || []).length).toBe(2);
  });
});

describe("Laboratorio · Kantu sugiere el título", () => {
  it("la herramienta tiene su contexto, con lo que hay EN el laboratorio", () => {
    const contexto = construirContextoKantu("laboratorio", {
      ...formLab, titulo: "", tipoExperimento: "Medición y registro de datos",
      materialesDisponibles: "probetas, balanza", medidasSeguridad: "mandil; lentes" });
    const claves = contexto.map((c) => c.clave);
    for (const clave of ["tema", "grado", "area", "tipoExperimento", "materialesDisponibles"]) {
      expect(claves, clave).toContain(clave);
    }
    // Los vacíos no viajan: el título está por escribirse, ése es el encargo.
    expect(claves).not.toContain("titulo");
    // Y hay tema, así que Kantu tiene de dónde anclar la propuesta.
    expect(tieneTema(contexto)).toBe(true);
  });

  it("el servidor acepta el campo y le da instrucciones propias", () => {
    const endpoint = fs.readFileSync("api/generate-session.js", "utf8");
    const sugeribles = endpoint.slice(endpoint.indexOf("CAMPOS_SUGERIBLES"), endpoint.indexOf("const CHALLENGE_SCHEMA"));
    expect(sugeribles).toContain('"tituloPractica"');
    // Con reglas, no con el genérico: un título no es un párrafo.
    expect(endpoint).toContain("tituloPractica:");
    const instruccion = endpoint.slice(endpoint.indexOf("tituloPractica:\n"));
    expect(instruccion.slice(0, 400)).toMatch(/una sola línea/i);
  });

  it("la propuesta cae en «titulo», que es el campo que existe en el formulario", () => {
    expect(DESTINO_POR_CAMPO.tituloPractica).toBe("titulo");
    expect(INTRO_POR_CAMPO.tituloPractica).toBeTruthy();
    const componente = fs.readFileSync("components/LabGuideGenerator.jsx", "utf8");
    expect(componente).toContain('botonKantu("tituloPractica"');
    expect(componente).toContain('botonKantu("proposito"');
    // Por el modal, nunca escribiendo directamente sobre el formulario.
    expect(componente).toContain("<SuggestionModal");
    expect(componente).toContain("DESTINO_POR_CAMPO[campo] || campo");
  });

  it("y el título escrito viaja al prompt para que el modelo no lo «mejore»", () => {
    const endpoint = fs.readFileSync("api/generate-session-resource.js", "utf8");
    expect(endpoint).toContain("tituloPedido: form.titulo");
    expect(endpoint).toContain("copiado sin cambiarlo");
  });
});

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

import {
  ALIAS_DE_AREA, AREAS_PRIMARIA, AREAS_SECUNDARIA, TODAS_LAS_AREAS,
  areaAlCambiarNivel, areasDeNivel, descripcionDeArea, esAreaValida,
  getAreasByLevel, normalizarArea,
} from "../config/curriculum.js";

/* ============================================================================
   ÁREAS CURRICULARES DE SECUNDARIA

   Había UNA lista de seis áreas para los dos niveles. A una docente de
   Secundaria le faltaban cinco áreas oficiales y le sobraba «Personal Social»,
   que en Secundaria no existe.

   Lo que se comprueba aquí no es que el catálogo esté escrito, sino que sea el
   único: que los selectores lo consuman, que las áreas nuevas tengan
   competencias y capacidades —sin ellas el formulario no deja avanzar— y que
   un material antiguo guardado como «Historia» siga abriendo.
   ========================================================================== */

const raiz = path.resolve(".");
const leer = (f) => fs.readFileSync(path.join(raiz, f), "utf8");
const app = leer("App.jsx");

/** El cuerpo de un objeto literal de App.jsx, sin el resto del fichero. */
function bloque(nombre) {
  const inicio = app.indexOf(`const ${nombre} = {`);
  expect(inicio, `no existe ${nombre}`).toBeGreaterThan(-1);
  const fin = app.indexOf("\n};", inicio);
  return app.slice(inicio, fin);
}

const ETIQUETAS_SECUNDARIA = AREAS_SECUNDARIA.map((a) => a.label);

describe("catálogo de Secundaria", () => {
  it("devuelve exactamente 11 áreas", () => {
    expect(getAreasByLevel("Secundaria")).toHaveLength(11);
    expect(areasDeNivel("Secundaria")).toHaveLength(11);
  });

  it("incluye las cuatro áreas de nombre largo que faltaban", () => {
    for (const etiqueta of [
      "Desarrollo Personal, Ciudadanía y Cívica (DPCC)",
      "Castellano como Segunda Lengua",
      "Inglés como Lengua Extranjera",
      "Educación para el Trabajo",
    ]) {
      expect(ETIQUETAS_SECUNDARIA).toContain(etiqueta);
    }
  });

  it("conserva las áreas que ya estaban", () => {
    for (const etiqueta of [
      "Ciencia y Tecnología", "Comunicación", "Matemática", "Arte y Cultura",
      "Ciencias Sociales", "Educación Física", "Educación Religiosa",
    ]) {
      expect(ETIQUETAS_SECUNDARIA).toContain(etiqueta);
    }
  });

  it("NO convierte cursos en áreas", () => {
    // Biología es contenido de Ciencia y Tecnología, no un área: meterla como
    // tal rompería la alineación, porque las competencias se definen por área.
    for (const curso of [
      "Biología", "Física", "Química", "Historia", "Geografía", "Economía",
      "Literatura", "Lengua", "Emprendimiento",
    ]) {
      expect(ETIQUETAS_SECUNDARIA).not.toContain(curso);
      expect(TODAS_LAS_AREAS).not.toContain(curso);
    }
  });

  it("no repite opciones ni deja huecos", () => {
    for (const nivel of ["Primaria", "Secundaria"]) {
      const etiquetas = areasDeNivel(nivel);
      expect(new Set(etiquetas).size).toBe(etiquetas.length);
    }
    const ids = AREAS_SECUNDARIA.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("ningún campo puede pintarse como undefined, null ni [object Object]", () => {
    for (const area of [...AREAS_SECUNDARIA, ...AREAS_PRIMARIA]) {
      for (const campo of ["id", "label", "shortLabel", "description"]) {
        expect(typeof area[campo], `${area.id}.${campo}`).toBe("string");
        expect(area[campo].trim().length).toBeGreaterThan(0);
      }
      expect(String(area.label)).not.toContain("[object Object]");
      expect(descripcionDeArea(area.label).length).toBeGreaterThan(0);
    }
  });

  it("no mezcla los dos niveles", () => {
    expect(esAreaValida("Secundaria", "Personal Social")).toBe(false);
    expect(esAreaValida("Primaria", "Personal Social")).toBe(true);
    expect(esAreaValida("Primaria", "Ciencias Sociales")).toBe(false);
    expect(esAreaValida("Secundaria", "Ciencias Sociales")).toBe(true);
  });
});

describe("nivel y grado", () => {
  it("los cinco grados de Secundaria reciben el mismo catálogo", () => {
    // El catálogo depende del NIVEL, no del grado: no hay ninguna vía por la
    // que 3.º vea menos áreas que 1.º.
    for (const grado of ["1.º", "2.º", "3.º", "4.º", "5.º"]) {
      expect(areasDeNivel("Secundaria")).toEqual(ETIQUETAS_SECUNDARIA);
      expect(grado).toBeTruthy();
    }
    expect(app).toContain('const grades = form.nivel === "Primaria" ? ["1.º", "2.º", "3.º", "4.º", "5.º", "6.º"] : ["1.º", "2.º", "3.º", "4.º", "5.º"]');
  });

  it("cambiar de grado no toca el área", () => {
    // `update("grado", ...)` sólo escribe la clave que recibe.
    expect(app).toContain('const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));');
    expect(app).toContain('onChange={e=>update("grado",e.target.value)}');
  });

  it("cambiar de nivel conserva el área si sigue siendo válida", () => {
    expect(areaAlCambiarNivel("Secundaria", "Ciencia y Tecnología")).toBe("Ciencia y Tecnología");
    expect(areaAlCambiarNivel("Primaria", "Matemática")).toBe("Matemática");
  });

  it("cambiar de nivel traduce el área que no existe en el destino", () => {
    expect(areaAlCambiarNivel("Secundaria", "Personal Social"))
      .toBe("Desarrollo Personal, Ciudadanía y Cívica (DPCC)");
    expect(areaAlCambiarNivel("Primaria", "Ciencias Sociales")).toBe("Personal Social");
    // Y nunca devuelve algo que el selector no pueda mostrar.
    expect(esAreaValida("Primaria", areaAlCambiarNivel("Primaria", "Inglés como Lengua Extranjera"))).toBe(true);
    expect(esAreaValida("Secundaria", areaAlCambiarNivel("Secundaria", "loquesea"))).toBe(true);
  });
});

describe("materiales antiguos", () => {
  it("traduce los cursos guardados a su área actual", () => {
    expect(normalizarArea("Biología")).toBe("Ciencia y Tecnología");
    expect(normalizarArea("Física")).toBe("Ciencia y Tecnología");
    expect(normalizarArea("Química")).toBe("Ciencia y Tecnología");
    expect(normalizarArea("Historia")).toBe("Ciencias Sociales");
    expect(normalizarArea("Geografía")).toBe("Ciencias Sociales");
    expect(normalizarArea("Economía")).toBe("Ciencias Sociales");
    expect(normalizarArea("Literatura")).toBe("Comunicación");
  });

  it("devuelve intacto lo que no sabe traducir", () => {
    // Un material viejo tiene que seguir abriendo aunque su área ya no exista.
    expect(normalizarArea("Taller de danzas")).toBe("Taller de danzas");
    expect(normalizarArea("")).toBe("");
    expect(normalizarArea(null)).toBe("");
    expect(normalizarArea(undefined)).toBe("");
  });

  it("no inventa conversiones ambiguas", () => {
    // «Ciudadanía» podría ser DPCC o Ciencias Sociales según el año: traducirla
    // sería adivinar.
    expect(ALIAS_DE_AREA).not.toHaveProperty("Ciudadanía");
    expect(normalizarArea("Ciudadanía")).toBe("Ciudadanía");
  });

  it("la biblioteca busca por el área guardada y por la actual, sin reescribir nada", () => {
    const biblioteca = leer("components/library/Library.jsx");
    expect(biblioteca).toContain("normalizarArea(item.area)");
    // Mostrar sigue mostrando lo guardado: no se altera ningún registro.
    expect(biblioteca).toContain("item.area].filter(Boolean)");
    expect(biblioteca).not.toMatch(/update\([^)]*area/);
  });
});

describe("una sola fuente de verdad", () => {
  it("App.jsx ya no tiene su propia lista de áreas", () => {
    expect(app).not.toContain("const GENERATOR_AREAS");
    expect(app).not.toContain("GENERATOR_AREAS.map");
  });

  it("los cinco selectores de área usan el catálogo por nivel", () => {
    const selectores = app.match(/areasDeNivel\(form\.nivel\)\.map/g) || [];
    expect(selectores).toHaveLength(5);
  });

  it("cada área de Secundaria tiene competencias CNEB", () => {
    // Sin entrada aquí, `competenciasDeArea(area)[0]` sería undefined y el
    // formulario quedaría sin competencia que enviar.
    const competencias = bloque("GENERATOR_COMPETENCIES");
    for (const etiqueta of ETIQUETAS_SECUNDARIA) {
      const clave = /[ ,()]/.test(etiqueta) ? `"${etiqueta}":` : `${etiqueta}:`;
      expect(competencias, `sin competencias: ${etiqueta}`).toContain(clave);
    }
  });

  it("cada competencia tiene capacidades", () => {
    // Sin capacidades, la validación del paso 2 («selecciona al menos una
    // capacidad») no se podría satisfacer nunca y el área sería inservible.
    const competencias = bloque("GENERATOR_COMPETENCIES");
    const capacidades = bloque("GENERATOR_CAPACITIES");
    // De cada linea se descarta la clave (el area) y se leen los valores:
    // la competencia es lo que va dentro del corchete.
    const nombradas = competencias.split("\n").flatMap((linea) => {
      const corchete = linea.indexOf(": [");
      return corchete === -1 ? [] : (linea.slice(corchete).match(/"[^"]{25,}"/g) || []);
    });
    expect(nombradas.length).toBeGreaterThan(20);
    for (const nombre of new Set(nombradas)) {
      expect(capacidades, `sin capacidades: ${nombre}`).toContain(`${nombre}:`);
    }
  });
});

describe("lo que consume el área", () => {
  it("la generación recibe el área seleccionada", () => {
    const servidor = leer("api/generate-session.js");
    expect(servidor).toContain("Área: ${form.area}");
    // Clase completa manda el formulario entero en cada módulo, así que el
    // área viaja igual en alignment, sequence, assessment y annexes.
    expect(app).toContain('JSON.stringify({ mode: "module", module: moduleName, form: intento.form, previous })');
  });

  it("el servidor entiende las áreas nuevas sin llamar a nadie", () => {
    const servidor = leer("api/generate-session.js");
    expect(servidor).toContain('import { normalizarArea } from "../config/curriculum.js"');
    for (const etiqueta of [
      "Desarrollo Personal, Ciudadanía y Cívica (DPCC)", "Ciencias Sociales",
      "Educación Física", "Educación Religiosa",
    ]) {
      expect(servidor).toContain(`"${etiqueta}":`);
    }
  });

  it("Kantu manda el área y no añade ninguna llamada", () => {
    const contexto = leer("lib/kantu/contexto.js");
    expect(contexto).toContain("area");
    const hook = leer("lib/kantu/useSugerencia.js");
    // Una sugerencia sigue siendo UNA petición: el catálogo se resuelve en el
    // navegador, no preguntándole a Gemini qué áreas hay.
    expect((hook.match(/await fetch\(/g) || [])).toHaveLength(1);
    expect(hook).not.toContain("curriculum");
  });

  it("Word imprime el área completa", () => {
    const exportadores = leer("lib/docx/exporters.js");
    expect(exportadores).toContain('["Área", form.area || ""]');
    // El valor es siempre una cadena: no hay forma de que salga [object Object].
    for (const area of AREAS_SECUNDARIA) expect(typeof area.label).toBe("string");
    expect(ETIQUETAS_SECUNDARIA).toContain("Desarrollo Personal, Ciudadanía y Cívica (DPCC)");
  });

  it("clase completa conserva su recuperación modular", () => {
    // Este bloque no debía tocar el fix anterior.
    const modulos = leer("lib/sesion/modulos.js");
    expect(modulos).toContain('export const MODULOS_SESION = ["alignment", "sequence", "assessment", "annexes"]');
    expect(app).toContain("const desde = failedModule;");
    expect(app).toContain("sesionEnCurso.current = { form: { ...form }, parciales: {} };");
  });
});

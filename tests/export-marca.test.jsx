import { describe, it, expect, beforeAll } from "vitest";
import fs from "node:fs";
import JSZip from "jszip";
import { Document, Packer, Paragraph, TextRun } from "docx";

import {
  MARCA_SCIVERSE, MODOS, POSICIONES, TIPOS_CON_PLANTILLA, admitePlantilla, coloresDe,
  explicarModo, marcaSinPlantilla, modoEfectivo, normalizarHex, normalizarMarca,
  normalizarPosicion, tieneMarcaSimple,
} from "../lib/export/marca.js";
import {
  MARCADORES, MARCADORES_MINIMOS, MAX_PLANTILLA_BYTES, comprobarPatcheables,
  construirPatches, detectarMarcadores, explicarMarcadorCompartido,
  marcadoresConTextoAlLado, marcadoresFaltantes, plantillaUtilizable,
  rellenarPlantilla, validarPlantilla,
} from "../lib/export/plantilla.js";
import { buildDocument, configurarMarca } from "../lib/docx/exporters.js";
import { COLOR, COLOR_SCIVERSE, TINTA_SOBRE_RUBRICA, aplicarMarca, restablecerMarca } from "../lib/docx/tema.js";
import { THEME } from "../lib/docx/core.js";
import { sessionBloques, sessionChildren } from "../lib/docx/plantillas/sesion.js";
import { form, instrument, session } from "./fixtures/word.js";

/* ============================================================================
   PERSONALIZAR EXPORT

   Tres modos, y lo que importa de cada uno:

     · que el modo guardado NO es el que manda — manda el resuelto, con sus
       respaldos, porque un plan puede caducar y un fichero puede borrarse;
     · que los colores del colegio se aplican Y se deshacen;
     · que una plantilla ajena se valida antes de aceptarla;
     · que el gate de Pro vive en la base, no en el navegador.
   ========================================================================== */

const unpack = async (doc) => {
  const zip = await JSZip.loadAsync(await Packer.toBuffer(doc));
  return zip.file("word/document.xml").async("string");
};

let plantillaBase;
beforeAll(() => {
  plantillaBase = fs.readFileSync("public/plantillas/plantilla-base-sciverse.docx");
});

describe("Marca · el modelo", () => {
  it("normaliza el color a seis dígitos sin almohadilla", () => {
    expect(normalizarHex("#7a1f2b")).toBe("7A1F2B");
    expect(normalizarHex("7A1F2B")).toBe("7A1F2B");
    // Un color inválido no se «arregla»: se ignora y manda el de SciVerse, que
    // al menos se sabe que contrasta.
    for (const malo of ["rojo", "#GGG", "#12345", "", null, undefined, "#1234567"]) {
      expect(normalizarHex(malo), String(malo)).toBeNull();
    }
  });

  it("normaliza la posición y acepta las tres del pack", () => {
    expect(POSICIONES).toEqual(["izquierda", "centro", "derecha"]);
    expect(normalizarPosicion("centro")).toBe("centro");
    expect(normalizarPosicion("arriba")).toBe("izquierda");
  });

  it("una docente sin fila exporta en formato de SciVerse", () => {
    const marca = normalizarMarca(null);
    expect(marca).toEqual(MARCA_SCIVERSE);
    expect(modoEfectivo(marca)).toBe("estandar");
    expect(coloresDe(marca)).toBeNull();
  });

  it("lee la fila de la base con sus nombres de columna", () => {
    const marca = normalizarMarca({
      modo: "colegio", logo_path: "u1/logo.png", logo_posicion: "derecha",
      color_primario: "7a1f2b", color_acento: "#C0392B", plantilla_marcadores: ["titulo"],
    });
    expect(marca.modo).toBe("colegio");
    expect(marca.logoPath).toBe("u1/logo.png");
    expect(marca.logoPosicion).toBe("derecha");
    expect(marca.colorPrimario).toBe("7A1F2B");
    expect(marca.colorAcento).toBe("C0392B");
    expect(tieneMarcaSimple(marca)).toBe(true);
  });

  it("MODOS es la lista cerrada que acepta el CHECK vigente, el de la 014", () => {
    expect(MODOS).toEqual(["estandar", "colegio", "plantilla"]);
    // La 012 creó la tabla con `nitia`; la 014 renombra ese valor. Se mira la
    // vigente, no la primera: una migración aplicada es historia y no se
    // reescribe, así que la 012 conserva el nombre con el que se ejecutó.
    const vigente = fs.readFileSync("supabase/migrations/014_rename_modo_estandar.sql", "utf8");
    const desde = vigente.indexOf("add constraint export_branding_modo_check");
    const check = vigente.slice(desde, vigente.indexOf(";", desde));
    for (const modo of MODOS) expect(check, modo).toContain(`'${modo}'`);
    expect(check).not.toContain("'nitia'");
  });

  it("y la 014 renombra las filas antes de volver a poner el CHECK", () => {
    const m = fs.readFileSync("supabase/migrations/014_rename_modo_estandar.sql", "utf8");
    const quita = m.indexOf("drop constraint if exists export_branding_modo_check");
    const renombra = m.indexOf("set modo = 'estandar' where modo = 'nitia'");
    const pone = m.indexOf("add constraint export_branding_modo_check");
    expect(quita).toBeGreaterThan(-1);
    expect(renombra).toBeGreaterThan(quita);
    expect(pone).toBeGreaterThan(renombra);
    // El default se quita antes que el CHECK: Postgres lo valida al recrearlo.
    expect(m.indexOf("alter column modo drop default")).toBeLessThan(quita);
  });
});

describe("Marca · los respaldos, que es lo que evita quedarse sin documento", () => {
  const conPlantilla = normalizarMarca({ modo: "plantilla", plantilla_path: "u1/p.docx",
    logo_path: "u1/logo.png", color_primario: "7A1F2B" });

  it("plantilla elegida y plan vigente: se usa", () => {
    expect(modoEfectivo(conPlantilla, { puedePlantilla: true })).toBe("plantilla");
  });

  it("plantilla elegida SIN plan: baja a formato de colegio, no falla", () => {
    expect(modoEfectivo(conPlantilla, { puedePlantilla: false })).toBe("colegio");
    expect(explicarModo(conPlantilla, { puedePlantilla: false })).toContain("Tu plan actual no incluye");
  });

  it("plantilla elegida pero el fichero ya no está: baja igual", () => {
    const sinFichero = { ...conPlantilla, plantillaPath: null };
    expect(modoEfectivo(sinFichero, { puedePlantilla: true })).toBe("colegio");
    expect(explicarModo(sinFichero, { puedePlantilla: true })).toContain("No encontramos tu plantilla");
  });

  it("sin plantilla y sin nada del colegio: cae hasta SciVerse", () => {
    const vacia = normalizarMarca({ modo: "plantilla" });
    expect(modoEfectivo(vacia, { puedePlantilla: true })).toBe("estandar");
    const colegioVacio = normalizarMarca({ modo: "colegio" });
    expect(modoEfectivo(colegioVacio)).toBe("estandar");
  });

  it("cada explicación dice por qué, sin jerga", () => {
    for (const marca of [MARCA_SCIVERSE, conPlantilla, normalizarMarca({ modo: "colegio", logo_path: "x" })]) {
      for (const puede of [true, false]) {
        const texto = explicarModo(marca, { puedePlantilla: puede });
        expect(texto.length).toBeGreaterThan(20);
        expect(texto).not.toMatch(/null|undefined|modo|RLS|bucket|403/i);
      }
    }
  });
});

describe("Marca · el formato del colegio en el documento", () => {
  it("aplica los colores del colegio y NO deja los de SciVerse", async () => {
    const marca = normalizarMarca({ modo: "colegio", color_primario: "7A1F2B", color_acento: "C0392B" });
    const xml = await unpack(buildDocument("session", { form, resource: session, marca }));
    expect(xml).toContain("7A1F2B");
    expect(xml).toContain("C0392B");
    expect(xml).not.toContain(COLOR_SCIVERSE.navy);
  });

  it("y los deshace: el siguiente documento vuelve a SciVerse", async () => {
    const xml = await unpack(buildDocument("session", { form, resource: session }));
    expect(xml).toContain(COLOR_SCIVERSE.navy);
    expect(xml).not.toContain("7A1F2B");
    // La paleta activa del módulo tampoco queda contaminada.
    expect(COLOR.navy).toBe(COLOR_SCIVERSE.navy);
  });

  it("los colores que no son de marca no se tocan nunca", () => {
    aplicarMarca({ primario: "7A1F2B", acento: "C0392B" });
    expect(COLOR.fondo).toBe(COLOR_SCIVERSE.fondo);
    expect(COLOR.seguridad).toBe(COLOR_SCIVERSE.seguridad);
    expect(COLOR.rubrica.ad).toBe(COLOR_SCIVERSE.rubrica.ad);
    restablecerMarca();
    expect(COLOR.navy).toBe(COLOR_SCIVERSE.navy);
  });

  it("el modo estandar NO tiñe, aunque haya colores guardados", async () => {
    const marca = normalizarMarca({ modo: "estandar", color_primario: "7A1F2B" });
    const xml = await unpack(buildDocument("session", { form, resource: session, marca }));
    expect(xml).toContain(COLOR_SCIVERSE.navy);
    expect(xml).not.toContain("7A1F2B");
  });

  it("quien eligió plantilla y no la tiene SÍ conserva sus colores", async () => {
    // Es la caída deliberada: sin fichero se baja a «colegio», y si había
    // colores guardados se usan. Perderlos además del .docx sería castigar
    // dos veces por el mismo problema.
    const marca = normalizarMarca({ modo: "plantilla", color_primario: "7A1F2B" });
    expect(modoEfectivo(marca, { puedePlantilla: true })).toBe("colegio");
    const xml = await unpack(buildDocument("session", { form, resource: session, marca }));
    expect(xml).toContain("7A1F2B");
  });

  it("pero sin colores ni logo, cae limpio a SciVerse", async () => {
    const marca = normalizarMarca({ modo: "plantilla" });
    const xml = await unpack(buildDocument("session", { form, resource: session, marca }));
    expect(xml).toContain(COLOR_SCIVERSE.navy);
  });
});

describe("Plantilla propia · validación antes de aceptarla", () => {
  it("rechaza lo que no es .docx", () => {
    expect(validarPlantilla({ name: "plan.pdf", size: 1000 }).ok).toBe(false);
    expect(validarPlantilla({ name: "plan.doc", size: 1000 }).ok).toBe(false);
    expect(validarPlantilla(null).ok).toBe(false);
  });

  it("rechaza un ejecutable renombrado a .docx", () => {
    // Un .docx es un ZIP y todo ZIP empieza por PK\\x03\\x04. La extensión no
    // prueba nada: se miran los bytes.
    const mz = new Uint8Array([0x4d, 0x5a, 0x90, 0x00]);
    const resultado = validarPlantilla({ name: "virus.docx", size: 4 }, mz);
    expect(resultado.ok).toBe(false);
    expect(resultado.error).toContain("no se puede abrir");
  });

  it("rechaza por tamaño con el número concreto", () => {
    const grande = validarPlantilla({ name: "p.docx", size: MAX_PLANTILLA_BYTES + 1 });
    expect(grande.ok).toBe(false);
    expect(grande.error).toContain("5 MB");
    expect(MAX_PLANTILLA_BYTES).toBe(5 * 1024 * 1024);
  });

  it("acepta la plantilla base que generamos nosotros", async () => {
    expect(validarPlantilla({ name: "plantilla.docx", size: plantillaBase.length }, plantillaBase).ok).toBe(true);
    const detectados = await detectarMarcadores(plantillaBase);
    expect(detectados.length).toBe(MARCADORES.length);
    expect(plantillaUtilizable(detectados)).toBe(true);
    expect(marcadoresFaltantes(detectados)).toEqual([]);
  });

  it("dice qué marcas faltan, no «plantilla inválida»", () => {
    expect(marcadoresFaltantes(["area", "fecha"])).toEqual(MARCADORES_MINIMOS);
    expect(plantillaUtilizable(["titulo"])).toBe(false);
    expect(plantillaUtilizable(MARCADORES_MINIMOS)).toBe(true);
  });

  it("un .docx sin marcas no revienta: devuelve lista vacía", async () => {
    const vacio = await Packer.toBuffer(buildDocument("session", { form, resource: session }));
    const detectados = await detectarMarcadores(vacio);
    expect(Array.isArray(detectados)).toBe(true);
    expect(plantillaUtilizable(detectados)).toBe(false);
  });
});

describe("Plantilla propia · el relleno", () => {
  it("mete el contenido REAL dentro del documento del colegio", async () => {
    const hijos = sessionChildren({ form, resource: session, profile: { ie: "IE Demostración" } });
    const patches = construirPatches({
      lineas: { titulo: session.titulo, area: form.area, ie: "IE Demostración" },
      bloques: { secuencia: hijos.slice(0, 40) },
    }, TextRun);
    const salida = await rellenarPlantilla({ data: plantillaBase, patches, outputType: "nodebuffer" });
    const xml = await (await JSZip.loadAsync(salida)).file("word/document.xml").async("string");

    expect(xml).toContain(session.titulo);
    expect(xml).toContain(form.area);
    // Las tablas siguen siendo tablas de Word, no texto pegado.
    expect((xml.match(/<w:tbl>/g) || []).length).toBeGreaterThan(3);
    // Y el marcador se consumió.
    expect(xml).not.toContain("{{titulo}}");
  });

  it("TODO marcador declarado recibe parche, aunque no tenga contenido", async () => {
    // Un marcador declarado y no parcheado se queda LITERAL en el documento.
    // Le pasaría a una sesión sin anexos o a un proyecto STEAM, que sólo llena
    // uno de los ocho bloques.
    const patches = construirPatches({ lineas: {}, bloques: {} }, TextRun, Paragraph);
    expect(Object.keys(patches)).toHaveLength(MARCADORES.length);

    const bytes = fs.readFileSync("public/plantillas/plantilla-base-sciverse.docx");
    const salida = await rellenarPlantilla({ data: bytes, patches, outputType: "nodebuffer" });
    const xml = await (await JSZip.loadAsync(salida)).file("word/document.xml").async("string");
    expect(xml).not.toMatch(/\{\{[a-z_]+\}\}/);
  });

  it("la clase completa también pasa por la plantilla del colegio", () => {
    const exportador = fs.readFileSync("lib/docx/exporters.js", "utf8");
    const completa = exportador.slice(exportador.indexOf("export async function downloadCompleteClass"));
    expect(completa).toContain("rellenarConPlantilla");
    expect(completa).toContain("rubrica");
  });
});

describe("Export · el resolvedor de marca", () => {
  it("sin registrar, todo sale en formato de SciVerse", async () => {
    // Es lo que deben hacer las pruebas de OOXML y lo que debe pasar si la
    // marca no carga: nunca dejar a la docente sin documento.
    configurarMarca(null);
    const xml = await unpack(buildDocument("session", { form, resource: session }));
    expect(xml).toContain(COLOR_SCIVERSE.navy);
  });

  it("el exportador NO importa Supabase", () => {
    // Si lo hiciera, las pruebas de OOXML necesitarían sesión y variables de
    // entorno para armar un documento.
    const exportador = fs.readFileSync("lib/docx/exporters.js", "utf8");
    expect(exportador).not.toContain("supabaseClient");
    expect(exportador).toContain("configurarMarca");
  });
});

describe("Export · el gate de Pro vive en la base", () => {
  const migracion = fs.readFileSync("supabase/migrations/012_export_branding.sql", "utf8");

  it("la política de subida consulta el plan, no sólo la carpeta", () => {
    const subir = migracion.slice(migracion.indexOf('create policy "Mi marca de export · subir"'),
      migracion.indexOf('create policy "Mi marca de export · cambiar"'));
    expect(subir).toContain("storage.foldername(name))[1] = auth.uid()::text");
    expect(subir).toContain("public.puede_plantilla_propia()");
  });

  it("leer y borrar sólo exigen propiedad: no se secuestra un fichero", () => {
    const leer = migracion.slice(migracion.indexOf('create policy "Mi marca de export · leer"'),
      migracion.indexOf('create policy "Mi marca de export · subir"'));
    expect(leer).toContain("auth.uid()::text");
    expect(leer).not.toContain("puede_plantilla_propia");
  });

  it("la capacidad se lee de plans.features, sin 'pro' a fuego", () => {
    expect(migracion).toContain("docx_custom_template");
    const funcion = migracion.slice(migracion.indexOf("create or replace function public.puede_plantilla_propia"));
    expect(funcion).toContain("features ->> 'docx_custom_template'");
    expect(funcion).toContain("security definer");
    // Falla cerrado: sin sesión, sin plan o sin capacidad, false.
    expect(funcion).toContain("false)");
  });

  it("el bucket es privado y sólo admite docx e imágenes", () => {
    expect(migracion).toContain("'export-templates'");
    expect(migracion).toContain("false, 5242880");
    expect(migracion).toContain("wordprocessingml.document");
    expect(migracion).toContain("image/png");
  });

  it("la tabla lleva RLS y sus cuatro políticas", () => {
    expect(migracion).toContain("alter table public.export_branding enable row level security");
    for (const accion of ["for select", "for insert", "for update", "for delete"]) {
      expect(migracion, accion).toContain(accion);
    }
  });

  it("no toca datos de producción: el borrado de la clave muerta va comentado", () => {
    const limpieza = migracion.slice(migracion.indexOf("RETIRAR LA CAPACIDAD MUERTA"));
    expect(limpieza).toContain("--   update public.plans");
    expect(migracion).not.toMatch(/^update public\.plans\s*\n\s*set features = features - /m);
  });
});

/* ============================================================================
   EL FALLO DE LA PLANTILLA PROPIA, Y LO QUE LO IMPIDE VOLVER

   Sintoma en produccion: ocho de los diecisiete marcadores llegaban literales
   al documento —«{{secuencia}}» visible— y el resultado mezclaba el texto de
   ayuda de la plantilla con los datos reales.

   Dos causas distintas, ninguna donde parecia:

     1. `bloquesPorMarcador` troceaba la sesion leyendo el texto de los
        parrafos YA CONSTRUIDOS. Los objetos de `docx` no exponen su texto asi:
        la deteccion devolvia null para los 95 hijos, los ocho cubos salian
        vacios y `construirPatches` los descartaba. Cero parches de bloque.
        La prueba anterior pasaba porque le daba los hijos a mano, saltandose
        justo la parte rota.

     2. La plantilla base era un MANUAL con marcadores intercalados. Al
        rellenarla, los parrafos con marcador se sustituian y los de ayuda
        sobrevivian. De ahi la mezcla.

   Y una tercera cosa que NO era cierta: que un marcador de bloque pegado a
   texto haga fallar el parche. Medido sobre docx@9.7.1, `PatchType.DOCUMENT`
   reemplaza el PARRAFO ENTERO y se come lo que hubiera al lado. No falla:
   borra. Por eso se valida, pero por perdida de contenido, no por fallo.
   ========================================================================== */
describe("Plantilla propia · el troceado por marcador", () => {
  const opciones = { form, resource: session, profile: { ie: "IE Demostración" } };

  it("los ocho bloques traen contenido, no cubos vacíos", () => {
    const bloques = sessionBloques(opciones);
    const deBloque = MARCADORES.filter((m) => m.tipo === "bloque").map((m) => m.clave);
    expect(Object.keys(bloques).sort()).toEqual([...deBloque].sort());
    for (const clave of deBloque) {
      expect(bloques[clave].length, `${clave} vacío`).toBeGreaterThan(0);
    }
  });

  it("la maqueta se compone de los mismos bloques: no pueden separarse", () => {
    const bloques = sessionBloques(opciones);
    const hijos = sessionChildren(opciones);
    const dentro = Object.values(bloques).reduce((n, v) => n + v.length, 0);
    // Título, subtítulo y los cinco encabezados de sección que añade la
    // maqueta; el resto de hijos sale de los bloques.
    expect(hijos.length).toBe(dentro + 7);
  });

  it("y produce los diecisiete parches, no nueve", () => {
    const patches = construirPatches({
      lineas: { titulo: session.titulo, docente: "X", ie: "Y", nivel: form.nivel,
        grado: form.grado, area: form.area, fecha: form.fecha, duracion: form.duracion, region: form.region },
      bloques: sessionBloques(opciones),
    }, TextRun);
    expect(Object.keys(patches)).toHaveLength(MARCADORES.length);
  });
});

describe("Plantilla propia · la plantilla base sale limpia", () => {
  let bytes;
  beforeAll(() => { bytes = fs.readFileSync("public/plantillas/plantilla-base-sciverse.docx"); });

  it("trae los diecisiete marcadores y todos son sustituibles", async () => {
    const detectados = await detectarMarcadores(bytes);
    expect(detectados).toHaveLength(MARCADORES.length);
    const { rotos } = await comprobarPatcheables(bytes, detectados, { Paragraph, TextRun });
    expect(rotos).toEqual([]);
  });

  it("ningún marcador de bloque comparte párrafo con otro texto", async () => {
    // Incluida la página de instrucciones: escribir «{{secuencia}}» en una
    // frase de ayuda la convertiría en un marcador real y al rellenar se
    // comería la explicación. Pasó al generar la primera versión.
    expect(await marcadoresConTextoAlLado(bytes)).toEqual([]);
  });

  it("rellenada sin tocarla, NO deja ni un marcador literal", async () => {
    const patches = construirPatches({
      lineas: { titulo: session.titulo, docente: "Docente", ie: "IE", nivel: form.nivel,
        grado: form.grado, area: form.area, fecha: form.fecha, duracion: form.duracion, region: form.region },
      bloques: sessionBloques({ form, resource: session, profile: { ie: "IE" }, rubrica: instrument }),
    }, TextRun);
    const salida = await rellenarPlantilla({ data: bytes, patches, outputType: "nodebuffer" });
    const xml = await (await JSZip.loadAsync(salida)).file("word/document.xml").async("string");
    expect(xml).not.toMatch(/\{\{[a-z_]+\}\}/);
  });

  it("y el contenido REAL está dentro, en tablas de Word", async () => {
    const patches = construirPatches({
      lineas: { titulo: session.titulo, area: form.area },
      bloques: sessionBloques({ form, resource: session, profile: { ie: "IE" }, rubrica: instrument }),
    }, TextRun);
    const salida = await rellenarPlantilla({ data: bytes, patches, outputType: "nodebuffer" });
    const xml = await (await JSZip.loadAsync(salida)).file("word/document.xml").async("string");
    for (const valor of [session.titulo, session.proposito,
      session.desempenosPrecisados[0].desempeno, session.criteriosDetallados[0].criterio,
      session.enfoquesTransversales[0].actitudObservable, "Inicio · 15 minutos",
      session.orientacionesDUA[0], instrument.criterios[0].logroDestacado]) {
      expect(xml, valor.slice(0, 30)).toContain(valor);
    }
    expect((xml.match(/<w:tbl>/g) || []).length).toBeGreaterThanOrEqual(6);
  });

  it("no repite encabezados: los tres bloques autoencabezados no llevan otro encima", async () => {
    const patches = construirPatches({
      lineas: { titulo: session.titulo },
      bloques: sessionBloques({ form, resource: session, profile: {} }),
    }, TextRun);
    const salida = await rellenarPlantilla({ data: bytes, patches, outputType: "nodebuffer" });
    const xml = await (await JSZip.loadAsync(salida)).file("word/document.xml").async("string");
    expect((xml.match(/SECUENCIA DIDÁCTICA/g) || [])).toHaveLength(1);
  });
});

describe("Plantilla propia · la validación de subida", () => {
  it("rechaza un marcador de bloque que comparte párrafo", async () => {
    const mala = new Document({ sections: [{ children: [
      new Paragraph({ children: [new TextRun("{{titulo}}")] }),
      new Paragraph({ children: [new TextRun("Datos del aula {{datos_generales}} aquí")] }),
      new Paragraph({ children: [new TextRun("{{secuencia}}")] }),
    ] }] });
    const bytes = await Packer.toBuffer(mala);
    const compartidos = await marcadoresConTextoAlLado(bytes);
    expect(compartidos).toEqual(["datos_generales"]);
    const aviso = explicarMarcadorCompartido("datos_generales");
    expect(aviso).toContain("{{datos_generales}}");
    expect(aviso).toContain("SOLA");
    // Y dice POR QUÉ: no es un capricho, es que se borraría el texto.
    expect(aviso).toContain("borraría");
  });

  it("también cuando dos bloques comparten el mismo párrafo", async () => {
    const mala = new Document({ sections: [{ children: [
      new Paragraph({ children: [new TextRun("{{criterios}}{{enfoques}}")] }),
    ] }] });
    const compartidos = await marcadoresConTextoAlLado(await Packer.toBuffer(mala));
    expect(compartidos.sort()).toEqual(["criterios", "enfoques"]);
  });

  it("y cuando un bloque comparte párrafo con un marcador de línea", async () => {
    const mala = new Document({ sections: [{ children: [
      new Paragraph({ children: [new TextRun("{{area}} {{secuencia}}")] }),
    ] }] });
    expect(await marcadoresConTextoAlLado(await Packer.toBuffer(mala))).toEqual(["secuencia"]);
  });

  it("acepta un marcador de línea dentro de una frase: ahí sí vale", async () => {
    const buena = new Document({ sections: [{ children: [
      new Paragraph({ children: [new TextRun("Área curricular: {{area}} — Fecha: {{fecha}}")] }),
      new Paragraph({ children: [new TextRun("{{secuencia}}")] }),
    ] }] });
    expect(await marcadoresConTextoAlLado(await Packer.toBuffer(buena))).toEqual([]);
  });

  it("el parcheo de prueba no toca el fichero original", async () => {
    const bytes = fs.readFileSync("public/plantillas/plantilla-base-sciverse.docx");
    const antes = bytes.length;
    await comprobarPatcheables(bytes, await detectarMarcadores(bytes), { Paragraph, TextRun });
    expect(bytes.length).toBe(antes);
    // Y la plantilla sigue siendo válida después de sondearla.
    expect((await detectarMarcadores(bytes)).length).toBe(MARCADORES.length);
  });

  it("el hook rechaza antes de subir, no después de exportar", () => {
    const hook = fs.readFileSync("lib/export/useMarcaExport.js", "utf8");
    const subir = hook.slice(hook.indexOf("const subirPlantilla"));
    // Las tres comprobaciones ocurren ANTES de `subirArchivo`.
    const indiceSubida = subir.indexOf("await subirArchivo");
    for (const comprobacion of ["marcadoresFaltantes", "comprobarPatcheables", "marcadoresConTextoAlLado"]) {
      const donde = subir.indexOf(comprobacion);
      expect(donde, comprobacion).toBeGreaterThan(-1);
      expect(donde, `${comprobacion} después de subir`).toBeLessThan(indiceSubida);
    }
  });
});

/* ============================================================================
   HASTA DÓNDE LLEGA LA PLANTILLA DEL COLEGIO

   El contrato de marcadores tiene forma de sesión. Medido sobre estos mismos
   ejemplares: sesión y clase completa llenan los ocho bloques; un proyecto
   STEAM llena uno y deja siete encabezados del colegio vacíos, y debajo repite
   su propio título y su propia tabla de datos.

   Así que el modo se acota y el resto de tipos cae a `colegio`. Lo que se fija
   aquí es que la caída ocurra —y que sea a COLEGIO, no a SciVerse—: perder la
   plantilla no puede costarle además al colegio su logo y sus colores.
   ========================================================================== */
describe("Plantilla propia · el alcance por tipo de documento", () => {
  const conPlantilla = normalizarMarca({ modo: "plantilla", plantilla_path: "u1/p.docx",
    logo_path: "u1/logo.png", color_primario: "7A1F2B", color_acento: "C9A227" });
  const vigente = { puedePlantilla: true };

  it("sesión y clase completa sí; el resto no", () => {
    expect(TIPOS_CON_PLANTILLA).toEqual(["session", "complete"]);
    for (const tipo of ["session", "complete"]) {
      expect(admitePlantilla(tipo), tipo).toBe(true);
    }
    for (const tipo of ["project", "project_steam", "rubric", "checklist", "rating_scale",
      "observation_guide", "worksheet", "reading", "challenge", "wordsearch", "lab_guide"]) {
      expect(admitePlantilla(tipo), tipo).toBe(false);
    }
  });

  it("el guion y el guion bajo son el mismo tipo", () => {
    // `downloadResource` recibe «project-steam» de unos sitios y
    // «project_steam» de otros; `buildSections` ya normaliza igual.
    expect(admitePlantilla("project-steam")).toBe(admitePlantilla("project_steam"));
    expect(admitePlantilla("lab-guide")).toBe(false);
  });

  it("sin tipo NO se acota: la pantalla de ajustes habla del modo en general", () => {
    expect(admitePlantilla(null)).toBe(true);
    expect(admitePlantilla("")).toBe(true);
    expect(modoEfectivo(conPlantilla, vigente)).toBe("plantilla");
    expect(explicarModo(conPlantilla, vigente)).toContain("plantilla .docx de tu colegio");
  });

  it("con un tipo que el contrato no cubre, el modo baja a COLEGIO", () => {
    expect(modoEfectivo(conPlantilla, { ...vigente, tipo: "session" })).toBe("plantilla");
    expect(modoEfectivo(conPlantilla, { ...vigente, tipo: "complete" })).toBe("plantilla");
    for (const tipo of ["project_steam", "rubric", "lab_guide", "wordsearch"]) {
      expect(modoEfectivo(conPlantilla, { ...vigente, tipo }), tipo).toBe("colegio");
    }
  });

  it("y ese documento SÍ recibe el logo y los colores del colegio", () => {
    // El fallo que esto ataja: `coloresDe` devolvía null en modo plantilla, así
    // que un STEAM de un colegio con plantilla salía sin marca NINGUNA — ni
    // plantilla, ni logo, ni colores. Peor que no haber configurado nada.
    expect(coloresDe(conPlantilla, { ...vigente, tipo: "project_steam" }))
      .toEqual({ primario: "7A1F2B", acento: "C9A227" });
  });

  it("y lo que SÍ va a la plantilla se construye sin identidad ninguna", () => {
    // Dentro del .docx del colegio no entra ni el navy de SciVerse ni el granate
    // del propio colegio: el diseño ya lo trae el documento anfitrión.
    expect(coloresDe(conPlantilla, { ...vigente, tipo: "session" })).toEqual({ neutra: true });
    expect(coloresDe(conPlantilla, vigente)).toEqual({ neutra: true });
  });

  it("sin nada del colegio que aplicar, cae hasta SciVerse y no a medias", () => {
    const soloPlantilla = normalizarMarca({ modo: "plantilla", plantilla_path: "u1/p.docx" });
    expect(modoEfectivo(soloPlantilla, vigente)).toBe("plantilla");
    expect(modoEfectivo(soloPlantilla, { ...vigente, tipo: "rubric" })).toBe("estandar");
  });

  it("el exportador cierra la puerta ANTES de intentar rellenar", () => {
    const exportador = fs.readFileSync("lib/docx/exporters.js", "utf8");
    const descarga = exportador.slice(exportador.indexOf("export async function downloadResource"),
      exportador.indexOf("export async function downloadCompleteClass"));
    // La condición del tipo va primero: ni se leen los bytes de la plantilla.
    expect(descarga).toMatch(/if \(admitePlantilla\(type\) &&/);
    // Y la clase completa mantiene la suya, que sí está cubierta.
    const completa = exportador.slice(exportador.indexOf("export async function downloadCompleteClass"));
    expect(completa).toContain("rellenarConPlantilla");
  });

  it("los colores del colegio llegan al documento de verdad, no sólo al cálculo", () => {
    const exportador = fs.readFileSync("lib/docx/exporters.js", "utf8");
    // `buildDocument` tiene que decirle a `coloresDe` QUÉ está construyendo.
    expect(exportador).toContain("puedePlantilla: options.puedePlantilla, tipo: type");
    // Y la clase completa, que no pasa por `buildDocument`, se pinta sola.
    const completa = exportador.slice(exportador.indexOf("export function buildCompleteClass"));
    expect(completa).toContain('tipo: "complete"');
    expect(completa).toContain("fijarMarcaDeDocumento(marca)");
    // Con su `finally`: un documento a medias no deja colores pegados.
    expect(completa.slice(0, completa.indexOf("\n}"))).toContain("restablecerMarca()");
  });

  it("si la plantilla falla A MITAD, el repuesto conserva la marca del colegio", () => {
    // El fichero estaba y el plan estaba: `almacen.js` ya no puede degradarlo.
    // Sin esto el documento de repuesto salía con los colores de SciVerse y el
    // colegio perdía su identidad justo cuando algo le había fallado.
    const respaldo = marcaSinPlantilla(conPlantilla);
    expect(respaldo.modo).toBe("colegio");
    expect(coloresDe(respaldo, { ...vigente, tipo: "session" }))
      .toEqual({ primario: "7A1F2B", acento: "C9A227" });
    // El resto de la marca no se toca: sigue siendo la misma fila.
    expect(respaldo.logoPath).toBe(conPlantilla.logoPath);
    expect(respaldo.plantillaPath).toBe(conPlantilla.plantillaPath);

    // Y no degrada lo que no hay que degradar.
    expect(marcaSinPlantilla(MARCA_SCIVERSE)).toBe(MARCA_SCIVERSE);
    expect(marcaSinPlantilla(null)).toBeNull();
  });

  it("los dos puntos de descarga usan ese respaldo en su catch", () => {
    const exportador = fs.readFileSync("lib/docx/exporters.js", "utf8");
    expect((exportador.match(/marca = marcaSinPlantilla\(marca\);/g) || []).length).toBe(2);
  });

  it("un STEAM con plantilla configurada sale con los colores del colegio", async () => {
    const doc = buildDocument("project_steam", {
      form, resource: { titulo: "Guardianes del agua", reto: "¿Cómo cuidamos el agua?" },
      profile: {}, marca: conPlantilla, puedePlantilla: true });
    const xml = await (await JSZip.loadAsync(await Packer.toBuffer(doc)))
      .file("word/document.xml").async("string");
    expect(xml).toContain("7A1F2B");
    expect(xml).not.toContain(COLOR_SCIVERSE.navy);
  });
});

describe("Plantilla propia · la pantalla lo dice antes de que se note", () => {
  const pantalla = () => fs.readFileSync("components/account/ExportSection.jsx", "utf8");

  it("la tarjeta declara su alcance, y no en letra pequeña al final", () => {
    const fuente = pantalla();
    const tarjeta = fuente.slice(fuente.indexOf('titulo: "Mi plantilla .docx"'));
    const alcance = tarjeta.slice(0, tarjeta.indexOf("];"));
    expect(alcance).toContain("Sesión de aprendizaje");
    expect(alcance).toContain("Clase completa");
    // Se pinta dentro de la cabecera, junto a la descripción.
    expect(fuente).toContain("export-card__alcance");
  });

  it("la intro ya no promete que se aplica a todo", () => {
    const fuente = pantalla();
    const intro = fuente.slice(fuente.indexOf("export-branding__intro"));
    expect(intro.slice(0, 500)).toContain("sólo a la sesión y a la clase completa");
  });

  it("y el pie explica qué pasa con los demás documentos", () => {
    const fuente = pantalla();
    const pie = fuente.slice(fuente.lastIndexOf("export-branding__nota", fuente.indexOf("Nunca te quedas")));
    expect(fuente).toContain("proyecto STEAM o una rúbrica");
    // Sin perder lo que ya decía sobre quedarse sin plantilla.
    expect(pie).toContain("Nunca te quedas sin poder exportar");
  });

  it("y dice que el contenido va neutro, que es lo que se ve al abrirlo", () => {
    const fuente = pantalla();
    expect(fuente).toContain("en negro y sin colores propios");
    expect(fuente).toMatch(/tablas de borde simple y sin\s+fondos de color/);
    expect(fuente).toContain("No lleva los colores de SciVerse ni los que hayas elegido");
  });

  it("el estilo del alcance existe: si no, el párrafo se lee como descripción", () => {
    const css = fs.readFileSync("components/account/account.css", "utf8");
    expect(css).toContain(".export-card__alcance");
  });
});

/* ============================================================================
   DENTRO DE LA PLANTILLA DEL COLEGIO NO ENTRA NUESTRA IDENTIDAD

   El .docx es del colegio y nosotros sólo ponemos el contenido dentro. Ese
   contenido no puede traer colores propios: insertar tablas con el navy de
   SciVerse en el membrete de otra institución es justo lo que el docente quiso
   evitar al subir el suyo. Tampoco valen los colores del colegio —ya los trae
   su plantilla, y deducirlos daría un segundo azul parecido pero distinto—.

   Se mide sobre un anfitrión SIN un solo color, para que todo hexadecimal que
   aparezca en la salida lo hayamos puesto nosotros. La plantilla base
   descargable no sirve para esto: su propio esqueleto ya lleva nuestros
   colores.
   ========================================================================== */
describe("Plantilla propia · el contenido insertado va neutro", () => {
  const marca = normalizarMarca({ modo: "plantilla", plantilla_path: "u1/p.docx",
    logo_path: "u1/logo.png", color_primario: "7A1F2B", color_acento: "C9A227" });

  /** Todos los hexadecimales de la paleta de SciVerse, aplanados. */
  const HEX_SCIVERSE = [...new Set(Object.values(COLOR_SCIVERSE)
    .flatMap((v) => (typeof v === "object" && v ? Object.values(v) : [v]))
    .filter((v) => typeof v === "string" && /^[0-9A-F]{6}$/.test(v)))];

  const lineas = { titulo: session.titulo, docente: "Docente", ie: "IE", nivel: form.nivel,
    grado: form.grado, area: form.area, fecha: form.fecha, duracion: form.duracion, region: form.region };

  /** Un anfitrión sin color: sólo los diecisiete marcadores. */
  async function anfitrionEnBlanco() {
    return Packer.toBuffer(new Document({ sections: [{ children:
      MARCADORES.map((m) => new Paragraph({ children: [new TextRun(`{{${m.clave}}}`)] })) }] }));
  }

  async function rellenarCon(paleta) {
    aplicarMarca(paleta);
    let patches;
    try {
      patches = construirPatches({ lineas,
        bloques: sessionBloques({ form, resource: session, profile: { ie: "IE" }, rubrica: instrument }),
      }, TextRun, Paragraph);
    } finally {
      restablecerMarca();
    }
    const salida = await rellenarPlantilla({ data: await anfitrionEnBlanco(), patches, outputType: "nodebuffer" });
    return (await JSZip.loadAsync(salida)).file("word/document.xml").async("string");
  }

  it("la paleta neutra no deja NI UN hexadecimal de SciVerse", async () => {
    const xml = await rellenarCon(coloresDe(marca, { puedePlantilla: true, tipo: "complete" }));
    for (const hex of HEX_SCIVERSE) {
      expect(new RegExp(hex, "i").test(xml), `queda ${hex}`).toBe(false);
    }
  });

  it("ni los colores del propio colegio: los pone su plantilla, no nosotros", async () => {
    const xml = await rellenarCon(coloresDe(marca, { puedePlantilla: true, tipo: "session" }));
    expect(xml).not.toMatch(/7A1F2B/i);
    expect(xml).not.toMatch(/C9A227/i);
  });

  it("el único color que queda es el negro del texto", async () => {
    const xml = await rellenarCon({ neutra: true });
    const hex = [...new Set((xml.match(/w:(?:fill|color)="([0-9A-Fa-f]{6})"/g) || [])
      .map((m) => m.match(/"([0-9A-Fa-f]{6})"/)[1].toUpperCase()))];
    expect(hex).toEqual(["000000"]);
  });

  it("ningún relleno: ni cabeceras, ni celdas, ni recuadros", async () => {
    const xml = await rellenarCon({ neutra: true });
    // Un `w:shd` con fill vacío NO es lo mismo que no tener `w:shd`: se omite
    // el nodo entero, o Word pinta un fondo sobre el diseño del colegio.
    expect(xml).not.toContain("<w:shd ");
  });

  it("y los bordes son los automáticos de Word, no los azules de SciVerse", async () => {
    const xml = await rellenarCon({ neutra: true });
    expect((xml.match(/w:color="auto"/g) || []).length).toBeGreaterThan(0);
  });

  it("pero la maqueta de siempre NO se vuelve gris: el formato propio se conserva", async () => {
    const xml = await rellenarCon(null);
    expect(xml).toContain(COLOR_SCIVERSE.navy);
    expect(xml).toContain(COLOR_SCIVERSE.azul);
    expect(xml).toContain("<w:shd ");
    // Y el modo colegio sigue pintando los suyos.
    const delColegio = await rellenarCon({ primario: "7A1F2B", acento: "C9A227" });
    expect(delColegio).toMatch(/7A1F2B/i);
    expect(delColegio).toMatch(/C9A227/i);
  });

  it("la ruta de plantilla aplica la paleta ELLA MISMA, no la hereda", () => {
    // `rellenarConPlantilla` no pasa por `buildDocument`. Sin su propio
    // `aplicarMarca` los bloques salían con el navy de SciVerse y se incrustaban
    // tal cual en el membrete del colegio: el bug que esto cierra.
    const exportador = fs.readFileSync("lib/docx/exporters.js", "utf8");
    const relleno = exportador.slice(exportador.indexOf("async function rellenarConPlantilla"),
      exportador.indexOf("/** Descarga un blob ya construido"));
    expect(relleno).toContain("aplicarMarca(coloresDe(marca");
    expect(relleno).toContain('tipo: type');
    // Con su `finally`: los colores no se quedan pegados al siguiente.
    expect(relleno).toContain("restablecerMarca()");
  });

  it("los alias en inglés de THEME leen la paleta viva, no una foto", () => {
    // Eran un objeto literal evaluado al importar, así que `THEME.border`
    // seguía siendo el azul de SciVerse aunque el documento fuera de un colegio.
    aplicarMarca({ neutra: true });
    try {
      expect(THEME.border).toBe("auto");
      expect(THEME.ink).toBe("000000");
      expect(THEME.fill).toBeNull();
    } finally {
      restablecerMarca();
    }
    expect(THEME.border).toBe(COLOR_SCIVERSE.borde);
    expect(THEME.ink).toBe(COLOR_SCIVERSE.texto);
  });

  it("y la tinta de la rúbrica no se queda en blanco sobre nada", () => {
    // Sin relleno, el blanco de «Logro destacado» sería texto invisible.
    aplicarMarca({ neutra: true });
    try {
      for (const nivel of ["ad", "a", "b", "c"]) {
        expect(TINTA_SOBRE_RUBRICA[nivel], nivel).toBe("000000");
      }
    } finally {
      restablecerMarca();
    }
    expect(TINTA_SOBRE_RUBRICA.ad).toBe(COLOR_SCIVERSE.blanco);
    expect(TINTA_SOBRE_RUBRICA.c).toBe(COLOR_SCIVERSE.texto);
  });
});

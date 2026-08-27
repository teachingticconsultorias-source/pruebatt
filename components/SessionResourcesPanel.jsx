// components/SessionResourcesPanel.jsx
import React, { useMemo, useState } from "react";
import {
  FileText,
  ClipboardCheck,
  ListChecks,
  Gauge,
  Sparkles,
  Eye,
  Download,
  X,
  Loader2,
  CheckCircle2
} from "lucide-react";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  ShadingType,
  AlignmentType,
  PageOrientation,
  Header,
  Footer,
  PageNumber
} from "docx";
import { supabase } from "../supabaseClient.js";
import "../session-resources.css";

const BRAND = {
  green: "0F625D",
  teal: "168B84",
  pale: "E5F6F3",
  pale2: "F4FBFA",
  yellow: "FFF4C4",
  ink: "173331",
  muted: "617B78",
  border: "9ECBC6",
  white: "FFFFFF"
};

const resourceMeta = {
  worksheet: {
    label: "Ficha de aprendizaje",
    description: "Una ficha lista para trabajar directamente con tus estudiantes.",
    icon: FileText,
    materialType: "worksheet"
  },
  rubric: {
    label: "Rúbrica",
    description: "Criterios y descriptores progresivos AD, A, B y C.",
    icon: ClipboardCheck,
    materialType: "rubric"
  },
  checklist: {
    label: "Lista de cotejo",
    description: "Criterios observables con Sí, No y Observaciones.",
    icon: ListChecks,
    materialType: "checklist"
  },
  rating_scale: {
    label: "Escala de valoración",
    description: "Valora el desempeño por frecuencia o nivel de logro.",
    icon: Gauge,
    materialType: "rating_scale"
  }
};

function safe(value) {
  return String(value ?? "").trim();
}

function run(text, opts = {}) {
  return new TextRun({
    text: safe(text),
    bold: Boolean(opts.bold),
    italics: Boolean(opts.italics),
    color: opts.color || BRAND.ink,
    size: opts.size || 19,
    font: "Arial"
  });
}

function para(text = "", opts = {}) {
  return new Paragraph({
    alignment: opts.alignment,
    spacing: {
      before: opts.before ?? 0,
      after: opts.after ?? 90,
      line: opts.line ?? 260
    },
    children: [run(text, opts)]
  });
}

function rich(runs, opts = {}) {
  return new Paragraph({
    alignment: opts.alignment,
    spacing: {
      before: opts.before ?? 0,
      after: opts.after ?? 90,
      line: opts.line ?? 260
    },
    children: runs
  });
}

const borders = {
  top: { style: BorderStyle.SINGLE, size: 5, color: BRAND.border },
  bottom: { style: BorderStyle.SINGLE, size: 5, color: BRAND.border },
  left: { style: BorderStyle.SINGLE, size: 5, color: BRAND.border },
  right: { style: BorderStyle.SINGLE, size: 5, color: BRAND.border },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: BRAND.border },
  insideVertical: { style: BorderStyle.SINGLE, size: 4, color: BRAND.border }
};

function cell(content, width, opts = {}) {
  const children = (Array.isArray(content) ? content : [content]).map(item =>
    item instanceof Paragraph
      ? item
      : para(item, {
          bold: opts.bold,
          color: opts.color,
          alignment: opts.alignment,
          size: opts.size || 16,
          after: 20
        })
  );

  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    shading: opts.fill
      ? { type: ShadingType.CLEAR, fill: opts.fill }
      : undefined,
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
    children
  });
}

function table(rows, widths, totalWidth = 9638) {
  return new Table({
    width: { size: totalWidth, type: WidthType.DXA },
    columnWidths: widths,
    borders,
    rows
  });
}

function lineSpace(lines = 2) {
  return Array.from({ length: lines }, () =>
    para("____________________________________________________________", {
      color: "A4B7B5",
      size: 15,
      after: 55
    })
  );
}

function docHeader() {
  return new Header({
    children: [
      rich(
        [
          run("SciVerse", { bold: true, size: 22, color: BRAND.teal }),
          run(" · una iniciativa de Teaching TIC", {
            size: 15,
            color: BRAND.muted
          })
        ],
        { alignment: AlignmentType.CENTER, after: 55 }
      ),
      para("", { after: 20 })
    ]
  });
}

function docFooter() {
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          run("Teaching TIC · Página ", { size: 13, color: BRAND.muted }),
          new TextRun({
            children: [PageNumber.CURRENT],
            font: "Arial",
            size: 13,
            color: BRAND.muted
          })
        ]
      })
    ]
  });
}

function studentInfoTable(form = {}) {
  return table(
    [
      new TableRow({
        children: [
          cell("NOMBRE", 1400, { fill: BRAND.pale, bold: true }),
          cell("", 3300),
          cell("FECHA", 1200, { fill: BRAND.pale, bold: true }),
          cell("", 3738)
        ]
      }),
      new TableRow({
        children: [
          cell("GRADO", 1400, { fill: BRAND.pale, bold: true }),
          cell(safe(form.grado), 3300),
          cell("ÁREA", 1200, { fill: BRAND.pale, bold: true }),
          cell(safe(form.area), 3738)
        ]
      })
    ],
    [1400, 3300, 1200, 3738]
  );
}

function teacherInfoTable(form = {}, profile = {}) {
  const teacher =
    [profile.nombres, profile.apellidos].filter(Boolean).join(" ") ||
    profile.nombre ||
    "";

  return table(
    [
      new TableRow({
        children: [
          cell("DOCENTE", 1500, { fill: BRAND.pale, bold: true }),
          cell(teacher, 3600),
          cell("I.E.", 1100, { fill: BRAND.pale, bold: true }),
          cell(profile.ie || profile.institucion || form.institucion || "", 3438)
        ]
      }),
      new TableRow({
        children: [
          cell("ÁREA", 1500, { fill: BRAND.pale, bold: true }),
          cell(form.area || "", 3600),
          cell("GRADO", 1100, { fill: BRAND.pale, bold: true }),
          cell(form.grado || "", 3438)
        ]
      })
    ],
    [1500, 3600, 1100, 3438]
  );
}

function worksheetChildren(resource, form) {
  const children = [
    para((resource.tipoFicha || "FICHA DE APRENDIZAJE").toUpperCase(), {
      bold: true,
      color: BRAND.teal,
      size: 18,
      alignment: AlignmentType.CENTER,
      after: 45
    }),
    para(resource.titulo, {
      bold: true,
      color: BRAND.ink,
      size: 29,
      alignment: AlignmentType.CENTER,
      after: 55
    }),
    ...(resource.subtitulo
      ? [
          para(resource.subtitulo, {
            color: BRAND.muted,
            size: 17,
            alignment: AlignmentType.CENTER,
            after: 150
          })
        ]
      : []),
    studentInfoTable(form),
    para("¿QUÉ APRENDEREMOS?", {
      bold: true,
      color: BRAND.teal,
      size: 19,
      before: 170,
      after: 55
    }),
    para(resource.proposito, { size: 18, after: 100 }),
    ...(resource.indicacionGeneral
      ? [
          para(resource.indicacionGeneral, {
            italics: true,
            color: BRAND.muted,
            size: 16,
            after: 120
          })
        ]
      : [])
  ];

  (resource.secciones || []).forEach((section, sectionIndex) => {
    children.push(
      para(`${sectionIndex + 1}. ${section.titulo}`, {
        bold: true,
        color: BRAND.teal,
        size: 20,
        before: 150,
        after: 45
      })
    );

    if (section.indicacion) {
      children.push(
        para(section.indicacion, { color: BRAND.muted, size: 16, after: 80 })
      );
    }

    (section.items || []).forEach((item, itemIndex) => {
      if (item.tipo === "texto") {
        children.push(para(item.texto, { size: 18, after: 90 }));
        return;
      }

      if (item.tipo === "lista" || item.tipo === "pasos") {
        if (item.texto) {
          children.push(
            para(item.texto, { bold: true, size: 17, after: 45 })
          );
        }
        (item.opciones || []).forEach((option, optionIndex) => {
          children.push(
            para(
              item.tipo === "pasos"
                ? `${optionIndex + 1}. ${option}`
                : `• ${option}`,
              { size: 17, after: 45 }
            )
          );
        });
        return;
      }

      if (item.tipo === "tabla" && (item.columnas || []).length) {
        if (item.texto) {
          children.push(
            para(item.texto, { bold: true, size: 17, after: 55 })
          );
        }

        const cols = item.columnas.length;
        const width = Math.floor(9638 / cols);
        const rows = [
          new TableRow({
            children: item.columnas.map(col =>
              cell(col, width, {
                fill: BRAND.teal,
                color: BRAND.white,
                bold: true,
                alignment: AlignmentType.CENTER
              })
            )
          })
        ];

        const rawRows =
          (item.filas || []).length > 0
            ? item.filas
            : Array.from({ length: 3 }, () => Array(cols).fill(""));

        rawRows.forEach(row => {
          rows.push(
            new TableRow({
              children: Array.from({ length: cols }, (_, index) =>
                cell(row?.[index] || "", width, { size: 15 })
              )
            })
          );
        });

        children.push(table(rows, Array(cols).fill(width)));
        children.push(para("", { after: 80 }));
        return;
      }

      const prefix = `${itemIndex + 1}. `;
      children.push(
        para(`${prefix}${item.texto}`, {
          bold: true,
          size: 17,
          after: 50
        })
      );
      children.push(...lineSpace(item.tipo === "respuesta_larga" ? 4 : 2));
    });
  });

  if (resource.cierre) {
    children.push(
      para(resource.cierre.titulo || "REFLEXIONAMOS", {
        bold: true,
        color: BRAND.teal,
        size: 20,
        before: 160,
        after: 55
      })
    );
    (resource.cierre.preguntas || []).forEach((question, index) => {
      children.push(
        para(`${index + 1}. ${question}`, {
          bold: true,
          size: 17,
          after: 45
        })
      );
      children.push(...lineSpace(2));
    });
  }

  return children;
}

function rubricChildren(resource, form, profile) {
  const widths = [2200, 2900, 1135, 1135, 1135, 1133];
  const rows = [
    new TableRow({
      children: [
        cell("CAPACIDAD", widths[0], {
          fill: BRAND.teal,
          color: BRAND.white,
          bold: true,
          alignment: AlignmentType.CENTER
        }),
        cell("CRITERIO", widths[1], {
          fill: BRAND.teal,
          color: BRAND.white,
          bold: true,
          alignment: AlignmentType.CENTER
        }),
        cell("AD", widths[2], {
          fill: BRAND.teal,
          color: BRAND.white,
          bold: true,
          alignment: AlignmentType.CENTER
        }),
        cell("A", widths[3], {
          fill: BRAND.teal,
          color: BRAND.white,
          bold: true,
          alignment: AlignmentType.CENTER
        }),
        cell("B", widths[4], {
          fill: BRAND.teal,
          color: BRAND.white,
          bold: true,
          alignment: AlignmentType.CENTER
        }),
        cell("C", widths[5], {
          fill: BRAND.teal,
          color: BRAND.white,
          bold: true,
          alignment: AlignmentType.CENTER
        })
      ]
    })
  ];

  (resource.criterios || []).forEach((item, index) => {
    const fill = index % 2 ? BRAND.pale2 : BRAND.white;
    rows.push(
      new TableRow({
        children: [
          cell(item.capacidad, widths[0], { fill, bold: true, size: 13 }),
          cell(item.criterio, widths[1], { fill, bold: true, size: 13 }),
          cell(item.destacado, widths[2], { fill, size: 12 }),
          cell(item.esperado, widths[3], { fill, size: 12 }),
          cell(item.proceso, widths[4], { fill, size: 12 }),
          cell(item.inicio, widths[5], { fill, size: 12 })
        ]
      })
    );
  });

  return [
    para(resource.titulo || "RÚBRICA DE EVALUACIÓN", {
      bold: true,
      color: BRAND.teal,
      size: 25,
      alignment: AlignmentType.CENTER,
      after: 130
    }),
    teacherInfoTable(form, profile),
    para("COMPETENCIA", {
      bold: true,
      color: BRAND.teal,
      size: 17,
      before: 130,
      after: 35
    }),
    para(resource.competencia, { size: 16, after: 70 }),
    para("EVIDENCIA", {
      bold: true,
      color: BRAND.teal,
      size: 17,
      after: 35
    }),
    para(resource.evidencia, { size: 16, after: 100 }),
    table(rows, widths)
  ];
}

function checklistChildren(resource, form, profile) {
  const widths = [2600, 4100, 700, 700, 1538];
  const rows = [
    new TableRow({
      children: [
        cell("CAPACIDAD", widths[0], {
          fill: BRAND.teal,
          color: BRAND.white,
          bold: true,
          alignment: AlignmentType.CENTER
        }),
        cell("CRITERIO", widths[1], {
          fill: BRAND.teal,
          color: BRAND.white,
          bold: true,
          alignment: AlignmentType.CENTER
        }),
        cell("SÍ", widths[2], {
          fill: BRAND.teal,
          color: BRAND.white,
          bold: true,
          alignment: AlignmentType.CENTER
        }),
        cell("NO", widths[3], {
          fill: BRAND.teal,
          color: BRAND.white,
          bold: true,
          alignment: AlignmentType.CENTER
        }),
        cell("OBSERVACIONES", widths[4], {
          fill: BRAND.teal,
          color: BRAND.white,
          bold: true,
          alignment: AlignmentType.CENTER
        })
      ]
    })
  ];

  (resource.criterios || []).forEach((item, index) => {
    const fill = index % 2 ? BRAND.pale2 : BRAND.white;
    rows.push(
      new TableRow({
        children: [
          cell(item.capacidad, widths[0], { fill, size: 14 }),
          cell(item.criterio, widths[1], { fill, bold: true, size: 14 }),
          cell("☐", widths[2], {
            fill,
            size: 18,
            alignment: AlignmentType.CENTER
          }),
          cell("☐", widths[3], {
            fill,
            size: 18,
            alignment: AlignmentType.CENTER
          }),
          cell("", widths[4], { fill })
        ]
      })
    );
  });

  return [
    para(resource.titulo || "LISTA DE COTEJO", {
      bold: true,
      color: BRAND.teal,
      size: 25,
      alignment: AlignmentType.CENTER,
      after: 130
    }),
    teacherInfoTable(form, profile),
    para("COMPETENCIA", {
      bold: true,
      color: BRAND.teal,
      size: 17,
      before: 130,
      after: 35
    }),
    para(resource.competencia, { size: 16, after: 70 }),
    para("EVIDENCIA", {
      bold: true,
      color: BRAND.teal,
      size: 17,
      after: 35
    }),
    para(resource.evidencia, { size: 16, after: 100 }),
    table(rows, widths)
  ];
}

function ratingScaleChildren(resource, form, profile) {
  const levels =
    (resource.niveles || []).length === 4
      ? resource.niveles
      : ["Inicio", "En proceso", "Logrado", "Destacado"];

  const criterionWidth = 4700;
  const levelWidth = Math.floor((9638 - criterionWidth) / levels.length);
  const widths = [criterionWidth, ...levels.map(() => levelWidth)];

  const rows = [
    new TableRow({
      children: [
        cell("CRITERIOS / INDICADORES", criterionWidth, {
          fill: BRAND.teal,
          color: BRAND.white,
          bold: true,
          alignment: AlignmentType.CENTER
        }),
        ...levels.map(level =>
          cell(level.toUpperCase(), levelWidth, {
            fill: BRAND.teal,
            color: BRAND.white,
            bold: true,
            size: 13,
            alignment: AlignmentType.CENTER
          })
        )
      ]
    })
  ];

  (resource.criterios || []).forEach((item, index) => {
    const fill = index % 2 ? BRAND.pale2 : BRAND.white;
    rows.push(
      new TableRow({
        children: [
          cell(item.criterio, criterionWidth, {
            fill,
            bold: true,
            size: 14
          }),
          ...levels.map(() =>
            cell("○", levelWidth, {
              fill,
              size: 20,
              alignment: AlignmentType.CENTER
            })
          )
        ]
      })
    );
  });

  return [
    para(resource.titulo || "ESCALA DE VALORACIÓN", {
      bold: true,
      color: BRAND.teal,
      size: 25,
      alignment: AlignmentType.CENTER,
      after: 130
    }),
    teacherInfoTable(form, profile),
    para("COMPETENCIA", {
      bold: true,
      color: BRAND.teal,
      size: 17,
      before: 130,
      after: 35
    }),
    para(resource.competencia, { size: 16, after: 70 }),
    para("EVIDENCIA", {
      bold: true,
      color: BRAND.teal,
      size: 17,
      after: 35
    }),
    para(resource.evidencia, { size: 16, after: 100 }),
    table(rows, widths),
    para("OBSERVACIONES DEL DOCENTE", {
      bold: true,
      color: BRAND.teal,
      size: 16,
      before: 130,
      after: 45
    }),
    ...lineSpace(3)
  ];
}

async function downloadResourceWord(type, resource, form, profile) {
  let children;
  let landscape = false;

  if (type === "worksheet") {
    children = worksheetChildren(resource, form);
  } else if (type === "rubric") {
    children = rubricChildren(resource, form, profile);
    landscape = true;
  } else if (type === "checklist") {
    children = checklistChildren(resource, form, profile);
    landscape = true;
  } else {
    children = ratingScaleChildren(resource, form, profile);
    landscape = true;
  }

  const doc = new Document({
    creator: "Teaching TIC Consultorías S.A.C.",
    title: resource.titulo || resourceMeta[type].label,
    styles: {
      default: {
        document: {
          run: {
            font: "Arial",
            size: 18,
            color: BRAND.ink
          },
          paragraph: {
            spacing: { after: 80, line: 260 }
          }
        }
      }
    },
    sections: [
      {
        properties: {
          page: {
            size: {
              width: landscape ? 16838 : 11906,
              height: landscape ? 11906 : 16838,
              orientation: landscape
                ? PageOrientation.LANDSCAPE
                : PageOrientation.PORTRAIT
            },
            margin: landscape
              ? { top: 520, right: 520, bottom: 520, left: 520 }
              : { top: 850, right: 1000, bottom: 850, left: 1000 }
          }
        },
        headers: { default: docHeader() },
        footers: { default: docFooter() },
        children
      }
    ]
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const filename = `${resourceMeta[type].label} - ${
    safe(resource.titulo || form.tema || "SciVerse")
  }`
    .replace(/[\\/:*?"<>|]+/g, "-")
    .slice(0, 120);

  anchor.href = url;
  anchor.download = `${filename}.docx`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30000);
}

function PreviewContent({ type, resource }) {
  if (!resource) return null;

  if (type === "worksheet") {
    return (
      <div className="sr-preview-sheet">
        <span className="sr-preview-kicker">{resource.tipoFicha}</span>
        <h2>{resource.titulo}</h2>
        <p className="sr-preview-purpose">{resource.proposito}</p>

        {(resource.secciones || []).map((section, index) => (
          <section key={`${section.titulo}-${index}`}>
            <h3>{index + 1}. {section.titulo}</h3>
            <p>{section.indicacion}</p>
            {(section.items || []).map((item, itemIndex) => (
              <div className="sr-preview-item" key={itemIndex}>
                {item.texto && <strong>{item.texto}</strong>}
                {(item.opciones || []).length > 0 && (
                  <ul>
                    {item.opciones.map((option, optionIndex) => (
                      <li key={optionIndex}>{option}</li>
                    ))}
                  </ul>
                )}
                {(item.tipo === "pregunta" ||
                  item.tipo === "respuesta_larga") && (
                  <div className="sr-answer-lines">
                    <span />
                    <span />
                    {item.tipo === "respuesta_larga" && <span />}
                  </div>
                )}
                {item.tipo === "tabla" && (item.columnas || []).length > 0 && (
                  <div className="sr-mini-table">
                    <div className="sr-mini-row sr-mini-head">
                      {item.columnas.map((col, colIndex) => (
                        <span key={colIndex}>{col}</span>
                      ))}
                    </div>
                    {(item.filas || [[], [], []]).map((row, rowIndex) => (
                      <div className="sr-mini-row" key={rowIndex}>
                        {item.columnas.map((_, colIndex) => (
                          <span key={colIndex}>{row?.[colIndex] || ""}</span>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </section>
        ))}
      </div>
    );
  }

  const levels =
    type === "rubric"
      ? ["AD", "A", "B", "C"]
      : type === "checklist"
        ? ["Sí", "No", "Observaciones"]
        : resource.niveles || [];

  return (
    <div className="sr-preview-sheet sr-preview-sheet--wide">
      <h2>{resource.titulo}</h2>
      <p><strong>Evidencia:</strong> {resource.evidencia}</p>

      <div className="sr-preview-table">
        <div
          className="sr-preview-tr sr-preview-th"
          style={{
            gridTemplateColumns: `minmax(240px, 2fr) repeat(${levels.length}, minmax(90px, 1fr))`
          }}
        >
          <span>Criterio</span>
          {levels.map(level => <span key={level}>{level}</span>)}
        </div>

        {(resource.criterios || []).map((item, index) => (
          <div
            className="sr-preview-tr"
            key={index}
            style={{
              gridTemplateColumns: `minmax(240px, 2fr) repeat(${levels.length}, minmax(90px, 1fr))`
            }}
          >
            <span>{item.criterio}</span>

            {type === "rubric" ? (
              <>
                <span>{item.destacado}</span>
                <span>{item.esperado}</span>
                <span>{item.proceso}</span>
                <span>{item.inicio}</span>
              </>
            ) : (
              levels.map(level => (
                <span className="sr-mark-cell" key={level}>○</span>
              ))
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SessionResourcesPanel({
  session,
  form = {},
  profile = {},
  onCreditsChange,
  onUpgrade
}) {
  const [generated, setGenerated] = useState({});
  const [loadingType, setLoadingType] = useState("");
  const [error, setError] = useState("");
  const [previewType, setPreviewType] = useState("");
  const [numberCriteria, setNumberCriteria] = useState(4);
  const [scaleType, setScaleType] = useState("logro");

  const hasSession = useMemo(
    () => Boolean(session && Object.keys(session).length),
    [session]
  );

  if (!hasSession) return null;

  async function saveMaterial(type, resource) {
    if (!supabase) return;

    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) return;

    const meta = resourceMeta[type];

    const { error: saveError } = await supabase
      .from("materiales_docente")
      .insert({
        user_id: user.id,
        tipo: meta.materialType,
        titulo: resource.titulo || meta.label,
        nivel: form.nivel || null,
        grado: form.grado || null,
        area: form.area || null,
        tema: form.tema || session?.titulo || null,
        contenido: {
          resourceType: type,
          resource,
          sourceSessionTitle: session?.titulo || form.tema || ""
        }
      });

    if (saveError) {
      console.error("No se pudo guardar el recurso:", saveError);
      throw new Error(
        "El recurso se generó, pero no se pudo guardar en Mis creaciones."
      );
    }

    window.dispatchEvent(
      new CustomEvent("sciverse:material-created", {
        detail: { type }
      })
    );
  }

  async function generate(type) {
    setError("");
    setLoadingType(type);

    try {
      if (!supabase) {
        throw new Error("Supabase no está configurado.");
      }

      const {
        data: { session: authSession }
      } = await supabase.auth.getSession();

      if (!authSession?.access_token) {
        throw new Error("Inicia sesión para generar el recurso.");
      }

      const response = await fetch("/api/generate-session-resource", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authSession.access_token}`
        },
        body: JSON.stringify({
          type,
          session,
          form,
          profile,
          options: {
            numeroCriterios: numberCriteria,
            scaleType
          }
        })
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 429 && onUpgrade) {
          onUpgrade();
        }
        throw new Error(data?.error || "No se pudo generar el recurso.");
      }

      setGenerated(current => ({
        ...current,
        [type]: data.resource
      }));

      await saveMaterial(type, data.resource);

      window.dispatchEvent(
        new CustomEvent("sciverse:credit-used", {
          detail: data._credits
        })
      );

      if (onCreditsChange) onCreditsChange(data._credits);
      setPreviewType(type);
    } catch (err) {
      setError(err?.message || "No se pudo generar el recurso.");
    } finally {
      setLoadingType("");
    }
  }

  return (
    <section className="session-resources">
      <div className="sr-heading">
        <div>
          <span className="sr-eyebrow">
            <Sparkles size={15} />
            Recursos de tu sesión
          </span>
          <h2>Crea los materiales que usarás con tus estudiantes</h2>
          <p>
            SciVerse toma la información de la sesión que acabas de generar
            para crear recursos coherentes y listos para descargar.
          </p>
        </div>

        <span className="sr-credit-note">
          Cada generación usa 1 crédito
        </span>
      </div>

      <div className="sr-options">
        <label>
          Criterios de evaluación
          <select
            value={numberCriteria}
            onChange={event => setNumberCriteria(Number(event.target.value))}
          >
            {[3, 4, 5, 6, 7, 8].map(value => (
              <option value={value} key={value}>
                {value}
              </option>
            ))}
          </select>
        </label>

        <label>
          Escala de valoración
          <select
            value={scaleType}
            onChange={event => setScaleType(event.target.value)}
          >
            <option value="logro">Nivel de logro</option>
            <option value="frecuencia">Frecuencia</option>
          </select>
        </label>
      </div>

      {error && <div className="sr-error">{error}</div>}

      <div className="sr-grid">
        {Object.entries(resourceMeta).map(([type, meta]) => {
          const Icon = meta.icon;
          const resource = generated[type];
          const loading = loadingType === type;

          return (
            <article className="sr-card" key={type}>
              <div className="sr-icon">
                <Icon size={23} />
              </div>

              <div className="sr-card-body">
                <div className="sr-title-row">
                  <h3>{meta.label}</h3>
                  {resource && (
                    <span className="sr-created">
                      <CheckCircle2 size={14} />
                      Creado
                    </span>
                  )}
                </div>

                <p>{meta.description}</p>
              </div>

              {!resource ? (
                <button
                  className="sr-primary"
                  type="button"
                  disabled={Boolean(loadingType)}
                  onClick={() => generate(type)}
                >
                  {loading ? (
                    <>
                      <Loader2 className="sr-spin" size={17} />
                      Creando...
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} />
                      Crear {meta.label.toLowerCase()}
                    </>
                  )}
                </button>
              ) : (
                <div className="sr-actions">
                  <button
                    type="button"
                    onClick={() => setPreviewType(type)}
                  >
                    <Eye size={16} />
                    Vista previa
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      downloadResourceWord(type, resource, form, profile)
                    }
                  >
                    <Download size={16} />
                    Word
                  </button>

                  <button
                    className="sr-regenerate"
                    type="button"
                    disabled={Boolean(loadingType)}
                    onClick={() => generate(type)}
                    title="Generar una nueva versión usa 1 crédito"
                  >
                    <Sparkles size={15} />
                    Nueva versión
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </div>

      {previewType && generated[previewType] && (
        <div
          className="sr-modal-backdrop"
          onMouseDown={event => {
            if (event.target === event.currentTarget) setPreviewType("");
          }}
        >
          <div className="sr-modal">
            <div className="sr-modal-head">
              <div>
                <span>Vista previa</span>
                <h3>{resourceMeta[previewType].label}</h3>
              </div>

              <button type="button" onClick={() => setPreviewType("")}>
                <X size={20} />
              </button>
            </div>

            <div className="sr-modal-content">
              <PreviewContent
                type={previewType}
                resource={generated[previewType]}
              />
            </div>

            <div className="sr-modal-footer">
              <button
                type="button"
                className="sr-download"
                onClick={() =>
                  downloadResourceWord(
                    previewType,
                    generated[previewType],
                    form,
                    profile
                  )
                }
              >
                <Download size={17} />
                Descargar Word
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

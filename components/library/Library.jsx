import React, { useMemo, useState } from "react";
import {
  Search, Plus, Eye, Download, Copy, Trash2, FileText, BookOpen,
  ClipboardList, CheckCircle2, ListChecks, Cog, Users, Star, X,
} from "lucide-react";

import Button from "../ui/Button.jsx";
import { Badge, EmptyState, SkeletonGrid } from "../ui/Feedback.jsx";

/* ==========================================================================
   BIBLIOTECA

   Conserva íntegro el comportamiento del bloque P0:
     • el listado NO trae `contenido` (pesaba 1-3 MB por carga)
     • `onOpen` y `onDownload` lo cargan bajo demanda (withContent)
   Aquí solo cambia la presentación.
   ========================================================================== */

/** Icono y etiqueta por tipo. Cubre los 9 tipos que la aplicación escribe
 *  más los dos que el endpoint soporta, no solo 5 como antes. */
export const MATERIAL_TYPES = {
  session:           { label: "Sesión de aprendizaje", short: "Sesiones",    icon: BookOpen,      tone: "brand" },
  project:           { label: "Proyecto STEAM",        short: "Proyectos",   icon: Cog,           tone: "info" },
  rubric:            { label: "Rúbrica",               short: "Rúbricas",    icon: ClipboardList, tone: "brand" },
  checklist:         { label: "Lista de cotejo",       short: "Cotejo",      icon: CheckCircle2,  tone: "brand" },
  rating_scale:      { label: "Escala de valoración",  short: "Escalas",     icon: ListChecks,    tone: "brand" },
  observation_guide: { label: "Guía de observación",   short: "Observación", icon: Eye,           tone: "brand" },
  worksheet:         { label: "Ficha de trabajo",      short: "Fichas",      icon: FileText,      tone: "amber" },
  reading:           { label: "Ficha de lectura",      short: "Lecturas",    icon: BookOpen,      tone: "amber" },
  questionnaire:     { label: "Cuestionario",          short: "Cuestionarios", icon: FileText,    tone: "amber" },
  challenge:         { label: "Reto grupal",           short: "Retos",       icon: Users,         tone: "accent" },
};

export function labelForType(tipo) {
  return MATERIAL_TYPES[tipo]?.label || "Material";
}

const SORTS = [
  { id: "recientes", label: "Más recientes" },
  { id: "antiguos", label: "Más antiguos" },
  { id: "titulo", label: "Título A-Z" },
];

export default function Library({
  materials = [],
  loading = false,
  savedResources = [],
  templates = [],
  formatDate,
  onCreate,
  onNavigate,
  onOpen,
  onDownload,
  onDuplicate,
  onDelete,
  onOpenSaved,
  onRemoveSaved,
  onDownloadTemplate,
}) {
  const [tab, setTab] = useState("creaciones");
  const [search, setSearch] = useState("");
  const [type, setType] = useState("todos");
  const [sort, setSort] = useState("recientes");

  /** Los chips se derivan de los tipos REALMENTE presentes, no de una lista
   *  fija que podía quedar desalineada con la base de datos. */
  const availableTypes = useMemo(() => {
    const counts = new Map();
    materials.forEach((item) => counts.set(item.tipo, (counts.get(item.tipo) || 0) + 1));
    return [...counts.entries()]
      .filter(([key]) => MATERIAL_TYPES[key])
      .sort((a, b) => b[1] - a[1]);
  }, [materials]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = materials.filter((item) => {
      if (type !== "todos" && item.tipo !== type) return false;
      if (!term) return true;
      return `${item.titulo || ""} ${item.tema || ""} ${item.area || ""} ${item.grado || ""}`
        .toLowerCase()
        .includes(term);
    });
    return list.sort((a, b) => {
      if (sort === "titulo") return (a.titulo || "").localeCompare(b.titulo || "", "es");
      const da = new Date(a.created_at).getTime();
      const db = new Date(b.created_at).getTime();
      return sort === "antiguos" ? da - db : db - da;
    });
  }, [materials, search, type, sort]);

  const hasFilters = search.trim() !== "" || type !== "todos";

  const TABS = [
    { id: "creaciones", label: "Mis creaciones", count: materials.length },
    { id: "guardados", label: "Guardados", count: savedResources.length },
    { id: "plantillas", label: "Plantillas", count: templates.length },
  ];

  return (
    <div className="lib">
      {/* ============================================================ HEADER */}
      <header className="lib__head">
        <div>
          <Badge tone="brand">Tu espacio docente</Badge>
          <h1>Mi biblioteca</h1>
          <p>
            {loading
              ? "Cargando tus materiales…"
              : materials.length
                ? `${materials.length} ${materials.length === 1 ? "material creado" : "materiales creados"}. Ábrelos, descárgalos o duplícalos cuando los necesites.`
                : "Aquí aparecerá todo lo que crees con Kantu."}
          </p>
        </div>
        <Button variant="primary" icon={Plus} onClick={() => onCreate("complete")}>
          Crear material
        </Button>
      </header>

      {/* ============================================================== TABS */}
      <nav className="lib__tabs" role="tablist" aria-label="Secciones de la biblioteca">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={tab === item.id ? "is-active" : ""}
            onClick={() => setTab(item.id)}
          >
            {item.label}
            <span>{item.count}</span>
          </button>
        ))}
      </nav>

      {/* ======================================================= CREACIONES */}
      {tab === "creaciones" && (
        <>
          {materials.length > 0 && (
            <div className="lib__filters">
              <label className="lib__search">
                <Search size={16} aria-hidden="true" />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar por título, tema, área o grado"
                  aria-label="Buscar en mi biblioteca"
                />
                {search && (
                  <button type="button" onClick={() => setSearch("")} aria-label="Limpiar búsqueda">
                    <X size={15} />
                  </button>
                )}
              </label>

              <label className="lib__sort">
                <span className="sv-sr-only">Ordenar por</span>
                <select value={sort} onChange={(event) => setSort(event.target.value)}>
                  {SORTS.map((option) => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                  ))}
                </select>
              </label>
            </div>
          )}

          {availableTypes.length > 1 && (
            <div className="lib__chips" role="group" aria-label="Filtrar por tipo">
              <button
                type="button"
                className={type === "todos" ? "is-active" : ""}
                aria-pressed={type === "todos"}
                onClick={() => setType("todos")}
              >
                Todos <span>{materials.length}</span>
              </button>
              {availableTypes.map(([key, count]) => (
                <button
                  key={key}
                  type="button"
                  className={type === key ? "is-active" : ""}
                  aria-pressed={type === key}
                  onClick={() => setType(key)}
                >
                  {MATERIAL_TYPES[key].short} <span>{count}</span>
                </button>
              ))}
            </div>
          )}

          {loading ? (
            <SkeletonGrid count={6} />
          ) : visible.length ? (
            <div className="lib__grid">
              {visible.map((item) => {
                const meta = MATERIAL_TYPES[item.tipo] || { label: "Material", icon: FileText, tone: "neutral" };
                const Icon = meta.icon;
                return (
                  <article key={item.id} className="lib__card">
                    <header>
                      <span className={`lib__cardicon lib__cardicon--${meta.tone}`} aria-hidden="true">
                        <Icon size={18} />
                      </span>
                      <Badge tone={meta.tone}>{meta.label}</Badge>
                    </header>

                    <button type="button" className="lib__cardtitle" onClick={() => onOpen(item)}>
                      {item.titulo}
                    </button>

                    <p className="lib__cardmeta">
                      {[item.grado || item.nivel, item.area].filter(Boolean).join(" · ") || "Sin área asignada"}
                    </p>
                    {formatDate && <time className="lib__carddate">{formatDate(item.created_at)}</time>}

                    <footer>
                      <Button variant="secondary" size="sm" icon={Eye} onClick={() => onOpen(item)}>
                        Abrir
                      </Button>
                      <button type="button" onClick={() => onDownload(item)} title="Descargar en Word" aria-label={`Descargar ${item.titulo} en Word`}>
                        <Download size={16} />
                      </button>
                      <button type="button" onClick={() => onDuplicate(item)} title="Duplicar" aria-label={`Duplicar ${item.titulo}`}>
                        <Copy size={16} />
                      </button>
                      <button type="button" className="is-danger" onClick={() => onDelete(item)} title="Eliminar" aria-label={`Eliminar ${item.titulo}`}>
                        <Trash2 size={16} />
                      </button>
                    </footer>
                  </article>
                );
              })}
            </div>
          ) : hasFilters ? (
            <EmptyState
              illustration="/illustrations/empty-search.svg"
              title="No encontramos materiales con esos filtros"
              description="Prueba con otras palabras o quita el filtro de tipo."
              action={
                <Button variant="secondary" onClick={() => { setSearch(""); setType("todos"); }}>
                  Limpiar filtros
                </Button>
              }
            />
          ) : (
            <EmptyState
              illustration="/illustrations/empty-library.svg"
              title="Todavía no tienes materiales"
              description="Cuando crees tu primer recurso con Kantu, aparecerá aquí para que puedas retomarlo y descargarlo cuando lo necesites."
              action={
                <Button variant="primary" icon={Plus} onClick={() => onCreate("complete")}>
                  Crear mi primer material
                </Button>
              }
              secondaryAction={
                <Button variant="outline" onClick={() => onNavigate("actividades")}>
                  Explorar actividades
                </Button>
              }
            />
          )}
        </>
      )}

      {/* ======================================================== GUARDADOS */}
      {tab === "guardados" && (
        savedResources.length ? (
          <div className="lib__grid">
            {savedResources.map((item) => (
              <article key={item.id} className="lib__card">
                <header>
                  <span className="lib__cardicon lib__cardicon--amber" aria-hidden="true"><Star size={18} /></span>
                  <Badge tone="amber">{item.kind === "activity" ? "Actividad STEAM" : "Reto grupal"}</Badge>
                </header>
                <button type="button" className="lib__cardtitle" onClick={() => onOpenSaved(item)}>
                  {item.title}
                </button>
                <p className="lib__cardmeta">{item.subtitle}</p>
                <footer>
                  <Button variant="secondary" size="sm" icon={Eye} onClick={() => onOpenSaved(item)}>Abrir</Button>
                  <button type="button" className="is-danger" onClick={() => onRemoveSaved(item)} title="Quitar de guardados" aria-label={`Quitar ${item.title} de guardados`}>
                    <Trash2 size={16} />
                  </button>
                </footer>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            illustration="/illustrations/empty-generic.svg"
            title="Aún no guardaste recursos"
            description="En Actividades y Retos encontrarás el botón Guardar para reunir aquí lo que quieras aplicar después."
            action={<Button variant="primary" onClick={() => onNavigate("actividades")}>Explorar actividades</Button>}
            secondaryAction={<Button variant="outline" onClick={() => onNavigate("retos")}>Ver retos</Button>}
          />
        )
      )}

      {/* ======================================================== PLANTILLAS */}
      {tab === "plantillas" && (
        <>
          <p className="lib__note">
            Formatos editables con la identidad de SciVerse. Los instrumentos personalizados se crean con Kantu.
          </p>
          <div className="lib__grid">
            {templates.map((template) => {
              const Icon = template.icon || FileText;
              return (
                <article key={template.id} className="lib__card">
                  <header>
                    <span className="lib__cardicon lib__cardicon--neutral" aria-hidden="true"><Icon size={18} /></span>
                    <Badge tone="neutral">Plantilla Word</Badge>
                  </header>
                  <h3 className="lib__cardtitle as-static">{template.title}</h3>
                  <p className="lib__cardmeta">{template.desc}</p>
                  <footer>
                    <Button variant="secondary" size="sm" icon={Download} onClick={() => onDownloadTemplate(template)}>
                      Descargar
                    </Button>
                  </footer>
                </article>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

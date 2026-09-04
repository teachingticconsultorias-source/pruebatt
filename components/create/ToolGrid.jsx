import React from "react";
import { ArrowRight, Lock } from "lucide-react";
import { Badge } from "../ui/Feedback.jsx";
import { useUI } from "../ui/UIProvider.jsx";
import { TOOL_GROUPS, COMING_SOON_COPY } from "../../config/tools.js";

/* ==========================================================================
   REJILLA DE HERRAMIENTAS

   Un solo componente para el estudio de creación y el catálogo de
   herramientas: si divergieran, acabaríamos manteniendo dos sistemas
   visuales para la misma información.

   Las herramientas sin backend se muestran, pero marcadas como
   "Próximamente" y con el modal centralizado. Nunca se presentan como si
   funcionaran.
   ========================================================================== */

export default function ToolGrid({ onCreate, onNavigate, groups = TOOL_GROUPS }) {
  const { openComingSoon } = useUI();

  function activate(tool) {
    if (tool.status === "soon" || tool.action === "soon") {
      openComingSoon(COMING_SOON_COPY[tool.id] || { title: tool.name });
      return;
    }
    if (tool.action === "navigate" && tool.target) {
      onNavigate?.(tool.target);
      return;
    }
    onCreate?.(tool.id);
  }

  return (
    <div className="tools">
      {groups.map((group) => (
        <section key={group.id} className="tools__group" aria-labelledby={`tools-${group.id}`}>
          <div className="tools__grouphead">
            <h2 id={`tools-${group.id}`}>{group.title}</h2>
            <p>{group.desc}</p>
          </div>

          <div className="tools__grid">
            {group.tools.map((tool) => {
              const Icon = tool.icon;
              const soon = tool.status === "soon";
              return (
                <button
                  key={tool.id}
                  type="button"
                  className={`tools__card${soon ? " is-soon" : ""}`}
                  onClick={() => activate(tool)}
                >
                  <span className="tools__icon" aria-hidden="true">
                    <Icon size={21} />
                  </span>

                  <span className="tools__body">
                    <span className="tools__name">
                      {tool.name}
                      {tool.badge && <Badge tone={tool.badge.tone}>{tool.badge.label}</Badge>}
                      {soon && <Badge tone="neutral" icon={Lock}>Próximamente</Badge>}
                    </span>
                    <span className="tools__desc">{tool.desc}</span>
                  </span>

                  <span className="tools__go" aria-hidden="true">
                    <ArrowRight size={16} />
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

import React from "react";
import {
  ArrowRight, Sparkles, FileText, ClipboardList, Search, CalendarDays,
  BookOpen, Clock, Download, Eye, FolderOpen, ShieldCheck, GraduationCap, Users,
} from "lucide-react";

import Button from "../ui/Button.jsx";
import { Badge, EmptyState, Skeleton } from "../ui/Feedback.jsx";

/* ==========================================================================
   HOME DOCENTE

   El dashboard anterior solo respondía "¿qué puedo crear?": título, banner y
   cuatro categorías equivalentes. No había forma de retomar el trabajo, que
   es lo que una docente necesita al volver el martes a terminar lo del lunes.

   Ahora responde, en este orden:
     1. ¿En qué estaba trabajando?   → Continuar donde lo dejaste
     2. ¿Qué hago ahora?             → una acción principal, no cuatro iguales
     3. ¿Qué más puedo crear?        → accesos secundarios
     4. ¿Qué tengo guardado?         → materiales recientes con descarga directa
   ========================================================================== */

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Buenos días";
  if (hour < 19) return "Buenas tardes";
  return "Buenas noches";
}

const QUICK_ACTIONS = [
  { id: "worksheet-v2", label: "Ficha de trabajo", desc: "Preguntas listas para imprimir", icon: FileText },
  { id: "rubric", label: "Instrumento", desc: "Rúbrica o lista de cotejo", icon: ClipboardList },
  { id: "project-v2", label: "Proyecto STEAM", desc: "De 1 a 4 semanas", icon: CalendarDays },
  { id: "wordsearch", label: "Sopa de letras", desc: "Con solucionario", icon: Search },
];

export default function Dashboard({
  profile,
  materials = [],
  loading = false,
  typeLabel = {},
  formatDate,
  onCreate,
  onNavigate,
  onOpenMaterial,
  onDownloadMaterial,
  onOpenAccount,
}) {
  const firstName = (profile?.nombres || "").split(" ")[0] || "Docente";
  const level = profile?.nivel === "secundaria" ? "secundaria" : "primaria";
  const last = materials[0];
  const recent = materials.slice(0, 5);

  return (
    <div className="dash">
      {/* ========================================================= SALUDO */}
      <header className="dash__hello">
        <div>
          <p className="dash__greet">{greeting()}, {firstName} 👋</p>
          <h1 className="dash__title">¿Qué preparamos hoy para tus estudiantes de {level}?</h1>
        </div>
        <Badge tone="brand" icon={ShieldCheck}>Alineado al CNEB</Badge>
      </header>

      {/* ======================================== CONTINUAR DONDE LO DEJASTE */}
      {loading ? (
        <section className="dash__continue is-loading">
          <Skeleton w={44} h={44} radius="var(--radius-md)" />
          <div style={{ flex: 1 }}>
            <Skeleton w="42%" h={13} />
            <Skeleton w="66%" h={19} />
          </div>
        </section>
      ) : (
        last && (
          <section className="dash__continue" aria-labelledby="dash-continue">
            <span className="dash__continueicon" aria-hidden="true"><FileText size={22} /></span>
            <div className="dash__continuebody">
              <p id="dash-continue" className="sv-label">Continuar donde lo dejaste</p>
              <h2>{last.titulo}</h2>
              <p className="dash__continuemeta">
                {typeLabel[last.tipo] || "Material"}
                {last.grado ? ` · ${last.grado}` : ""}
                {last.area ? ` · ${last.area}` : ""}
                {formatDate ? ` · ${formatDate(last.created_at)}` : ""}
              </p>
            </div>
            <div className="dash__continueactions">
              <Button variant="secondary" size="sm" icon={Eye} onClick={() => onOpenMaterial(last)}>
                Abrir
              </Button>
              <Button variant="ghost" size="sm" icon={Download} onClick={() => onDownloadMaterial(last)}>
                Word
              </Button>
            </div>
          </section>
        )
      )}

      {/* ================================================= ACCIÓN PRINCIPAL */}
      <section className="dash__primary">
        <div className="dash__primarycopy">
          <Badge tone="amber" icon={Sparkles}>Recomendado</Badge>
          <h2>Crea tu clase completa</h2>
          <p>
            Kantu genera la sesión de aprendizaje, un instrumento de evaluación y el
            material para tus estudiantes en un mismo recorrido.
          </p>
          <ul className="dash__primarysteps">
            <li><BookOpen size={14} /> Sesión</li>
            <li><ClipboardList size={14} /> Instrumento</li>
            <li><FileText size={14} /> Material</li>
          </ul>
          <Button variant="primary" size="lg" iconRight={ArrowRight} onClick={() => onCreate("complete")}>
            Crear clase completa
          </Button>
        </div>
        <img className="dash__primarykantu" src="/mascot/kantu-material.webp" alt="" width="150" loading="lazy" />
      </section>

      {/* ================================================= ACCIONES RÁPIDAS */}
      <section aria-labelledby="dash-quick">
        <div className="dash__sectionhead">
          <h2 id="dash-quick">Crea algo puntual</h2>
          <button type="button" className="dash__seeall" onClick={() => onNavigate("crear")}>
            Ver todo <ArrowRight size={14} />
          </button>
        </div>
        <div className="dash__quick">
          {QUICK_ACTIONS.map((action) => {
            const Icon = action.icon;
            return (
              <button key={action.id} type="button" className="dash__quickcard" onClick={() => onCreate(action.id)}>
                <span aria-hidden="true"><Icon size={20} /></span>
                <strong>{action.label}</strong>
                <small>{action.desc}</small>
              </button>
            );
          })}
        </div>
      </section>

      {/* =============================================== MATERIALES RECIENTES */}
      <section aria-labelledby="dash-recent">
        <div className="dash__sectionhead">
          <h2 id="dash-recent">Tus últimos materiales</h2>
          {materials.length > 0 && (
            <button type="button" className="dash__seeall" onClick={() => onNavigate("biblioteca")}>
              Ver biblioteca <ArrowRight size={14} />
            </button>
          )}
        </div>

        {loading ? (
          <ul className="dash__recent">
            {[0, 1, 2].map((i) => (
              <li key={i} className="dash__recentitem">
                <Skeleton w={36} h={36} radius="var(--radius-md)" />
                <div style={{ flex: 1 }}><Skeleton w="55%" h={15} /><Skeleton w="35%" h={12} /></div>
              </li>
            ))}
          </ul>
        ) : recent.length ? (
          <ul className="dash__recent">
            {recent.map((item) => (
              <li key={item.id} className="dash__recentitem">
                <span className="dash__recenticon" aria-hidden="true"><FileText size={17} /></span>
                <button type="button" className="dash__recentmain" onClick={() => onOpenMaterial(item)}>
                  <strong>{item.titulo}</strong>
                  <small>
                    {typeLabel[item.tipo] || "Material"}
                    {item.grado ? ` · ${item.grado}` : ""}
                    {item.area ? ` · ${item.area}` : ""}
                  </small>
                </button>
                {formatDate && <time>{formatDate(item.created_at)}</time>}
                <button
                  type="button"
                  className="dash__recentdl"
                  onClick={() => onDownloadMaterial(item)}
                  aria-label={`Descargar ${item.titulo} en Word`}
                >
                  <Download size={16} />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            illustration="/illustrations/empty-library.svg"
            title="Todavía no tienes materiales"
            description="Cuando crees tu primer recurso con Kantu, aparecerá aquí para que puedas retomarlo y descargarlo cuando lo necesites."
            action={
              <Button variant="primary" iconRight={ArrowRight} onClick={() => onCreate("complete")}>
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
      </section>

      {/* ========================================================= NOVEDADES */}
      <section className="dash__side">
        <article className="dash__card">
          <span className="dash__cardicon dash__cardicon--teal" aria-hidden="true"><Users size={20} /></span>
          <h3>Retos grupales</h3>
          <p>Dinámicas con roles, reglas y producto final para trabajar en equipo.</p>
          <Button variant="ghost" size="sm" iconRight={ArrowRight} onClick={() => onNavigate("retos")}>
            Explorar retos
          </Button>
        </article>

        <article className="dash__card">
          <span className="dash__cardicon dash__cardicon--amber" aria-hidden="true"><GraduationCap size={20} /></span>
          <h3>Capacitación</h3>
          <p>Sesiones en vivo de Teaching TIC con constancia digital para tu portafolio.</p>
          <Button variant="ghost" size="sm" iconRight={ArrowRight} onClick={() => onOpenAccount("capacitacion")}>
            Ver capacitación
          </Button>
        </article>

        <article className="dash__card">
          <span className="dash__cardicon dash__cardicon--coral" aria-hidden="true"><FolderOpen size={20} /></span>
          <h3>Actividades STEAM</h3>
          <p>Banco de experiencias listas para llevar al aula, con evidencias y criterios.</p>
          <Button variant="ghost" size="sm" iconRight={ArrowRight} onClick={() => onNavigate("actividades")}>
            Ver actividades
          </Button>
        </article>
      </section>
    </div>
  );
}

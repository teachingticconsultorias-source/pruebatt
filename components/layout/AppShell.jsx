import React, { useEffect, useState } from "react";
import {
  LayoutDashboard, Wand2, FolderOpen, ClipboardList, Users, GraduationCap, Wrench,
  User, LogOut, ChevronRight, ChevronLeft, MoreHorizontal, X, CreditCard, Award,
} from "lucide-react";

import CreditsIndicator from "../CreditsIndicator.jsx";
import Button from "../ui/Button.jsx";
import { useUI } from "../ui/UIProvider.jsx";
import { whatsappLink } from "../../config/plans.js";

/* ==========================================================================
   APP SHELL — sidebar de escritorio · topbar · navegación móvil

   Sustituye a los tres bloques que había sueltos dentro de SciVerseApp.
   Cambios de fondo:
     • La barra superior ya no duplica la marca ni el botón de cerrar sesión
       (antes estaban a la vez en la lateral y en la superior).
     • La navegación agrupa por intención: CREAR / ORGANIZAR / APRENDER.
     • El móvil gana acceso a Mi cuenta y Cerrar sesión mediante "Más",
       que antes solo existían en la lateral oculta bajo 900px.
     • Los créditos son visibles de forma permanente.
   ========================================================================== */

const NAV_GROUPS = [
  {
    items: [{ id: "inicio", label: "Inicio", icon: LayoutDashboard }],
  },
  {
    title: "Crear",
    items: [
      { id: "crear", label: "Crear recurso", icon: Wand2 },
      { id: "herramientas", label: "Herramientas", icon: Wrench },
      { id: "actividades", label: "Actividades STEAM", icon: ClipboardList },
      { id: "retos", label: "Retos grupales", icon: Users },
    ],
  },
  {
    title: "Organizar",
    items: [{ id: "biblioteca", label: "Mi biblioteca", icon: FolderOpen }],
  },
];

const MOBILE_ITEMS = [
  { id: "inicio", label: "Inicio", icon: LayoutDashboard },
  { id: "crear", label: "Crear", icon: Wand2 },
  { id: "actividades", label: "Actividades", icon: ClipboardList },
  { id: "biblioteca", label: "Biblioteca", icon: FolderOpen },
];

const SECTION_TITLES = {
  inicio: "Inicio",
  crear: "Crear recurso",
  herramientas: "Herramientas",
  actividades: "Actividades STEAM",
  retos: "Retos grupales",
  biblioteca: "Mi biblioteca",
};

export default function AppShell({
  profile,
  plan,
  activeSection,
  onNavigate,
  onOpenAccount,
  onLogout,
  children,
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const { openComingSoon } = useUI();

  const initials =
    `${(profile?.nombres?.[0] || "D").toUpperCase()}${(profile?.apellidos?.[0] || "").toUpperCase()}`;
  const fullName = [profile?.nombres, profile?.apellidos].filter(Boolean).join(" ") || "Docente";

  // Escape cierra la hoja "Más".
  useEffect(() => {
    if (!moreOpen) return undefined;
    const onKey = (event) => event.key === "Escape" && setMoreOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [moreOpen]);

  function go(section) {
    onNavigate(section);
    setMoreOpen(false);
  }

  return (
    <div className="shell">
      <a href="#shell-main" className="shell__skip">Saltar al contenido</a>

      {/* ============================================================ SIDEBAR */}
      <aside className="shell__side">
        <button type="button" className="shell__brand" onClick={() => go("inicio")}>
          <img src="/brand/isotipo.svg" alt="" width="34" height="34" />
          <span>
            <strong>SciVerse</strong>
            <small>Teaching TIC</small>
          </span>
        </button>

        <nav className="shell__nav" aria-label="Navegación del panel docente">
          {NAV_GROUPS.map((group, index) => (
            <div key={group.title || index} className="shell__group">
              {group.title && <p className="shell__grouptitle">{group.title}</p>}
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`shell__link${active ? " is-active" : ""}`}
                    aria-current={active ? "page" : undefined}
                    onClick={() => go(item.id)}
                  >
                    <Icon size={18} aria-hidden="true" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          ))}

          <div className="shell__group">
            <p className="shell__grouptitle">Aprender</p>
            <button
              type="button"
              className="shell__link"
              onClick={() => { onOpenAccount("capacitacion"); setMoreOpen(false); }}
            >
              <GraduationCap size={18} aria-hidden="true" />
              <span>Capacitación</span>
            </button>
          </div>
        </nav>

        <div className="shell__bottom">
          <CreditsIndicator compact />

          <a
            className="shell__plan"
            href={whatsappLink("Hola Teaching TIC, deseo mejorar mi plan de SciVerse.")}
            target="_blank"
            rel="noreferrer"
          >
            <Award size={16} aria-hidden="true" />
            <span>
              <small>Plan actual</small>
              <strong>{plan || "Gratuito"}</strong>
            </span>
            <ChevronRight size={15} aria-hidden="true" />
          </a>

          <button type="button" className="shell__user" onClick={() => onOpenAccount("perfil")}>
            <span className="shell__avatar" aria-hidden="true">{initials}</span>
            <span className="shell__userinfo">
              <strong>{fullName}</strong>
              <small>{profile?.correo || "Mi cuenta"}</small>
            </span>
          </button>

          <button type="button" className="shell__logout" onClick={onLogout}>
            <LogOut size={16} aria-hidden="true" /> Cerrar sesión
          </button>
        </div>
      </aside>

      {/* ============================================================= TOPBAR */}
      <header className="shell__top">
        <div className="shell__topbrand">
          <img src="/brand/isotipo.svg" alt="" width="28" height="28" />
          <strong>SciVerse</strong>
        </div>
        <p className="shell__crumb">{SECTION_TITLES[activeSection] || "Panel docente"}</p>
        <div className="shell__topactions">
          <span className="shell__topcredits"><CreditsIndicator compact /></span>
          <button
            type="button"
            className="shell__avatarbtn"
            onClick={() => onOpenAccount("perfil")}
            aria-label="Abrir mi cuenta"
          >
            <span className="shell__avatar" aria-hidden="true">{initials}</span>
          </button>
        </div>
      </header>

      {/* =============================================================== MAIN */}
      <main className="shell__main" id="shell-main">{children}</main>

      {/* ======================================================= NAV MÓVIL */}
      <nav className="shell__mobile" aria-label="Navegación móvil">
        {MOBILE_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = activeSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className={active ? "is-active" : ""}
              aria-current={active ? "page" : undefined}
              onClick={() => go(item.id)}
            >
              <Icon size={19} aria-hidden="true" />
              <span>{item.label}</span>
            </button>
          );
        })}
        <button
          type="button"
          className={moreOpen ? "is-active" : ""}
          aria-expanded={moreOpen}
          onClick={() => setMoreOpen((open) => !open)}
        >
          <MoreHorizontal size={19} aria-hidden="true" />
          <span>Más</span>
        </button>
      </nav>

      {/* Hoja "Más": el móvil no tenía acceso a cuenta ni a cerrar sesión. */}
      {moreOpen && (
        <div className="shell__sheet" role="dialog" aria-modal="true" aria-label="Más opciones">
          <div className="shell__sheetback" onClick={() => setMoreOpen(false)} />
          <div className="shell__sheetpanel">
            <div className="shell__sheethead">
              <span className="shell__avatar" aria-hidden="true">{initials}</span>
              <div>
                <strong>{fullName}</strong>
                <small>{profile?.correo}</small>
              </div>
              <button type="button" onClick={() => setMoreOpen(false)} aria-label="Cerrar">
                <X size={20} />
              </button>
            </div>

            <CreditsIndicator />

            <div className="shell__sheetlinks">
              <button type="button" onClick={() => go("herramientas")}>
                <Wrench size={18} /> Herramientas <ChevronRight size={16} />
              </button>
              <button type="button" onClick={() => go("retos")}>
                <Users size={18} /> Retos grupales <ChevronRight size={16} />
              </button>
              <button type="button" onClick={() => { onOpenAccount("perfil"); setMoreOpen(false); }}>
                <User size={18} /> Mi cuenta <ChevronRight size={16} />
              </button>
              <button type="button" onClick={() => { onOpenAccount("capacitacion"); setMoreOpen(false); }}>
                <GraduationCap size={18} /> Capacitación <ChevronRight size={16} />
              </button>
              <button type="button" onClick={() => { onOpenAccount("plan"); setMoreOpen(false); }}>
                <CreditCard size={18} /> Mi plan <ChevronRight size={16} />
              </button>
            </div>

            <Button variant="outline" fullWidth icon={LogOut} onClick={onLogout}>
              Cerrar sesión
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

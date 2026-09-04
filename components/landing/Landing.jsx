import React, { useEffect, useRef, useState } from "react";
import {
  ArrowRight, Menu, X, Sparkles, ShieldCheck, Clock, FileText, ClipboardList,
  BookOpen, Users, Cog, Search, CheckCircle2, HelpCircle, MessageCircle,
  Facebook, Download, Wand2, Layers, GraduationCap, Target, ChevronDown,
} from "lucide-react";

import Button from "../ui/Button.jsx";
import { Badge } from "../ui/Feedback.jsx";
import { useUI } from "../ui/UIProvider.jsx";
import { PLANS, INSTITUTIONAL_PLAN, CONTACT, whatsappLink } from "../../config/plans.js";

/* ==========================================================================
   LANDING PÚBLICA

   Reescrita por completo. Cambios respecto a la anterior:
     • Los precios dejan de estar escondidos en un modal (invisibles para
       buscadores) y tienen sección propia con ancla #planes.
     • Titular con las palabras que un docente busca de verdad:
       "sesiones de aprendizaje", "CNEB", "Word".
     • Secciones nuevas: el problema, cómo funciona en 3 pasos, alineación
       al CNEB (el diferenciador) y bloque institucional.
     • Testimonios inventados retirados: la auditoría los marcó como riesgo
       de veracidad publicitaria. En su lugar, casos de uso reales del
       producto, sin atribuirlos a personas.
   ========================================================================== */

const NAV_LINKS = [
  { href: "#como-funciona", label: "Cómo funciona" },
  { href: "#herramientas", label: "Herramientas" },
  { href: "#cneb", label: "Para docentes" },
  { href: "#planes", label: "Planes" },
  { href: "#preguntas", label: "Preguntas" },
];

const STEPS = [
  {
    icon: ClipboardList,
    title: "Cuéntale tu clase a Kantu",
    text: "Nivel, grado, área, competencia y el tema que vas a trabajar. Lo que ya sabes de tu aula.",
  },
  {
    icon: Wand2,
    title: "Kantu construye la sesión",
    text: "Propósito, criterios, evidencia y la secuencia didáctica con los procesos de tu área.",
  },
  {
    icon: Download,
    title: "Descárgala en Word",
    text: "Con tablas y formato, lista para editar y entregar a tu institución.",
  },
];

const TOOLS = [
  { icon: BookOpen, name: "Sesión de aprendizaje", text: "Propósito, criterios, evidencia y secuencia completa.", tone: "brand" },
  { icon: ClipboardList, name: "Rúbrica analítica", text: "Descriptores progresivos por cada criterio.", tone: "brand" },
  { icon: CheckCircle2, name: "Lista de cotejo", text: "Indicadores observables para registrar en clase.", tone: "brand" },
  { icon: Layers, name: "Escala de valoración", text: "Por nivel de logro o por frecuencia.", tone: "brand" },
  { icon: FileText, name: "Ficha de trabajo", text: "Actividades listas para imprimir y repartir.", tone: "brand" },
  { icon: BookOpen, name: "Ficha de lectura", text: "Texto original con preguntas por nivel de comprensión.", tone: "brand" },
  { icon: Cog, name: "Proyecto STEAM", text: "Ruta de 1 a 4 semanas con producto final.", tone: "brand" },
  { icon: Search, name: "Sopa de letras", text: "Con solucionario, lista para el aula.", tone: "brand" },
  { icon: Users, name: "Retos grupales", text: "Roles, reglas, producto y criterios observables.", tone: "brand" },
];

const CNEB_POINTS = [
  "Competencias y capacidades con su redacción oficial, sin parafrasear",
  "Procesos didácticos propios de cada área: indagación, diseño tecnológico, los tres momentos de la lectura, resolución de problemas",
  "Los tres momentos de la sesión con sus procesos pedagógicos",
  "Criterios de evaluación como acciones observables, derivados de la capacidad",
  "Enfoques transversales y orientaciones DUA cuando corresponden",
];

const FAQS = [
  ["¿Qué puedo crear con SciVerse?", "Sesiones de aprendizaje, proyectos STEAM, rúbricas, listas de cotejo, escalas de valoración, fichas de trabajo y de lectura, retos grupales y sopas de letras. Todo descargable en Word."],
  ["¿Necesito saber de inteligencia artificial?", "No. Completas un formulario con lo que ya sabes de tu clase —nivel, grado, área, competencia y tema— y Kantu se encarga del resto."],
  ["¿Los recursos están alineados al CNEB?", "Las propuestas se construyen sobre el Currículo Nacional del Perú y los procesos didácticos de cada área. Todo contenido generado con IA debe ser revisado y adaptado por el docente antes de aplicarlo."],
  ["¿Funciona para primaria y secundaria?", "Sí. Durante el registro eliges tu nivel y SciVerse abre automáticamente los materiales correspondientes."],
  ["¿Puedo descargar los materiales en Word?", "Sí. Las sesiones, rúbricas y listas de cotejo se descargan como documentos con tablas y formato, listos para editar."],
  ["¿Mis materiales son privados?", "Sí. Cada docente ve únicamente su propia biblioteca."],
  ["¿Cómo se activa mi cuenta?", "Después de registrarte recibes un correo de confirmación. Al abrir el enlace ya puedes iniciar sesión."],
  ["¿Cómo pago con Plin o Yape?", "Selecciona un plan y te llevamos a WhatsApp para coordinar el pago con Teaching TIC y activar tu acceso."],
  ["¿El pago se renueva automáticamente?", "No. Los pagos por Plin o Yape no se renuevan solos: tú decides cuándo renovar."],
  ["¿La inteligencia artificial puede equivocarse?", "Sí. SciVerse es una herramienta de apoyo. El docente debe revisar el contenido antes de llevarlo al aula."],
];

/* -------------------------------------------------------------------------- */

function useScrolled(threshold = 12) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);
  return scrolled;
}

/** Vista previa del producto dibujada en el propio DOM: nada de capturas
 *  desactualizadas de una interfaz que se está rediseñando. */
function ProductPreview() {
  return (
    <div className="lp-preview" aria-hidden="true">
      <div className="lp-preview__bar">
        <span /><span /><span />
        <small>SciVerse · Sesión de aprendizaje</small>
      </div>
      <div className="lp-preview__body">
        <div className="lp-preview__doc">
          <span className="lp-preview__eyebrow">SESIÓN GENERADA</span>
          <strong>Los ecosistemas de mi región</strong>
          <p>4.º de primaria · Ciencia y Tecnología · 90 minutos</p>
          <div className="lp-preview__chips">
            <i>Indaga</i><i>Explica</i><i>DUA</i>
          </div>
          <div className="lp-preview__rows">
            <span><b /><em style={{ width: "84%" }} /></span>
            <span><b /><em style={{ width: "68%" }} /></span>
            <span><b /><em style={{ width: "76%" }} /></span>
          </div>
        </div>
        <div className="lp-preview__side">
          <div className="lp-preview__step is-done"><CheckCircle2 size={13} /> Alineación curricular</div>
          <div className="lp-preview__step is-done"><CheckCircle2 size={13} /> Secuencia didáctica</div>
          <div className="lp-preview__step is-done"><CheckCircle2 size={13} /> Criterios de evaluación</div>
          <div className="lp-preview__step"><Sparkles size={13} /> Anexos para el aula</div>
          <div className="lp-preview__cta"><Download size={13} /> Descargar Word</div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

export default function Landing({ onRegister, onLogin }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);
  const scrolled = useScrolled();
  const { openComingSoon } = useUI();
  const menuRef = useRef(null);

  // Escape cierra el menú móvil.
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (event) => event.key === "Escape" && setMenuOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  function choosePlan(plan) {
    if (plan.id === "gratuito") return onRegister();
    window.open(
      whatsappLink(
        `Hola Teaching TIC, deseo adquirir el Plan ${plan.name} de SciVerse por S/${plan.price}. ¿Me comparten los datos para pagar por Plin o Yape?`
      ),
      "_blank",
      "noopener,noreferrer"
    );
  }

  function contactInstitutional() {
    window.open(
      whatsappLink(
        "Hola Teaching TIC, represento a una institución educativa y deseo información sobre SciVerse para todo el equipo docente."
      ),
      "_blank",
      "noopener,noreferrer"
    );
  }

  return (
    <div className="lp">
      {/* ================================================================ NAV */}
      <header className={`lp-nav${scrolled ? " is-scrolled" : ""}`}>
        <div className="lp-nav__inner">
          <a href="#inicio" className="lp-nav__brand" aria-label="SciVerse, inicio">
            <img src="/brand/isotipo.svg" alt="" width="36" height="36" />
            <span>
              <strong>SciVerse</strong>
              <small>una iniciativa de Teaching TIC</small>
            </span>
          </a>

          <nav className="lp-nav__links" aria-label="Navegación principal">
            {NAV_LINKS.map((link) => (
              <a key={link.href} href={link.href}>{link.label}</a>
            ))}
          </nav>

          <div className="lp-nav__actions">
            <Button variant="ghost" size="sm" onClick={onLogin}>Ingresar</Button>
            <Button variant="primary" size="sm" onClick={onRegister}>Crear cuenta</Button>
          </div>

          <button
            type="button"
            className="lp-nav__toggle"
            aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={menuOpen}
            aria-controls="lp-mobile-menu"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {menuOpen && (
          <div className="lp-nav__mobile" id="lp-mobile-menu" ref={menuRef}>
            <nav aria-label="Navegación móvil">
              {NAV_LINKS.map((link) => (
                <a key={link.href} href={link.href} onClick={() => setMenuOpen(false)}>
                  {link.label}
                  <ArrowRight size={15} />
                </a>
              ))}
            </nav>
            <div className="lp-nav__mobile-actions">
              <Button variant="outline" fullWidth onClick={() => { setMenuOpen(false); onLogin(); }}>Ingresar</Button>
              <Button variant="primary" fullWidth onClick={() => { setMenuOpen(false); onRegister(); }}>Crear cuenta gratis</Button>
            </div>
          </div>
        )}
      </header>

      <main id="inicio">
        {/* ============================================================= HERO */}
        <section className="lp-hero">
          <div className="lp-hero__copy">
            <Badge tone="brand" icon={Sparkles}>Plataforma educativa peruana</Badge>
            <h1 className="lp-hero__title">
              Tus sesiones de aprendizaje alineadas al <span>CNEB</span>, en minutos.
            </h1>
            <p className="lp-hero__sub">
              Crea sesiones, rúbricas, fichas y proyectos STEAM listos para descargar en Word.
              Diseñado con los procesos didácticos de cada área, para docentes de primaria y
              secundaria del Perú.
            </p>
            <div className="lp-hero__actions">
              <Button variant="primary" size="lg" iconRight={ArrowRight} onClick={onRegister}>
                Crear mi primera sesión gratis
              </Button>
              <Button as="a" href="#como-funciona" variant="outline" size="lg">
                Ver cómo funciona
              </Button>
            </div>
            <ul className="lp-hero__trust">
              <li><CheckCircle2 size={15} /> Gratis para empezar</li>
              <li><CheckCircle2 size={15} /> Sin tarjeta</li>
              <li><CheckCircle2 size={15} /> En español</li>
            </ul>
          </div>

          <div className="lp-hero__visual">
            <ProductPreview />
            <img className="lp-hero__kantu" src="/mascot/kantu-session.webp" alt="Kantu, la vicuña científica que acompaña a los docentes en SciVerse" loading="eager" width="150" />
          </div>
        </section>

        {/* ========================================================== PROBLEMA */}
        <section className="lp-problem">
          <div className="lp-problem__inner">
            <div className="lp-problem__stat">
              <Clock size={30} />
            </div>
            <div>
              <h2>Programar una sesión completa toma cerca de 40 minutos.</h2>
              <p>
                Propósito, criterios, evidencia, secuencia didáctica, instrumento de evaluación.
                Multiplícalo por las sesiones de tu semana — y además hay que enseñar.
                <strong> SciVerse hace el primer borrador; tú aportas el criterio.</strong>
              </p>
            </div>
          </div>
        </section>

        {/* ==================================================== CÓMO FUNCIONA */}
        <section className="lp-section" id="como-funciona">
          <div className="lp-section__head">
            <Badge tone="brand">Cómo funciona</Badge>
            <h2 className="sv-h1">Tres pasos, menos de tres minutos</h2>
            <p>No necesitas aprender nada nuevo: describes tu clase como se la contarías a una colega.</p>
          </div>
          <ol className="lp-steps">
            {STEPS.map((step, index) => {
              const Icon = step.icon;
              return (
                <li key={step.title} className="lp-step">
                  <span className="lp-step__num">{index + 1}</span>
                  <span className="lp-step__icon"><Icon size={22} /></span>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </li>
              );
            })}
          </ol>
        </section>

        {/* ====================================================== HERRAMIENTAS */}
        <section className="lp-section lp-section--sunken" id="herramientas">
          <div className="lp-section__head">
            <Badge tone="brand">Herramientas</Badge>
            <h2 className="sv-h1">Todo lo que preparas cada semana</h2>
            <p>Cada recurso se guarda en tu biblioteca y puedes descargarlo cuando lo necesites.</p>
          </div>
          <div className="lp-tools">
            {TOOLS.map((tool) => {
              const Icon = tool.icon;
              return (
                <article key={tool.name} className="lp-tool">
                  <span className="lp-tool__icon"><Icon size={20} /></span>
                  <h3>{tool.name}</h3>
                  <p>{tool.text}</p>
                </article>
              );
            })}
          </div>
        </section>

        {/* ============================================================= CNEB */}
        <section className="lp-section" id="cneb">
          <div className="lp-cneb">
            <div className="lp-cneb__copy">
              <Badge tone="amber" icon={ShieldCheck}>El diferenciador</Badge>
              <h2 className="sv-h1">No es un generador de textos genérico</h2>
              <p className="lp-cneb__lead">
                SciVerse conoce el Currículo Nacional del Perú. Por eso lo que genera se parece
                a lo que tu institución espera recibir.
              </p>
              <ul className="lp-cneb__list">
                {CNEB_POINTS.map((point) => (
                  <li key={point}><CheckCircle2 size={17} /> {point}</li>
                ))}
              </ul>
              <p className="lp-cneb__note">
                <ShieldCheck size={15} /> Todo contenido generado con IA debe ser revisado y
                adaptado por el docente antes de aplicarlo en el aula.
              </p>
            </div>
            <aside className="lp-cneb__card">
              <span className="sv-label">Ejemplo de salida</span>
              <h3>Criterios de evaluación</h3>
              <ul>
                <li><strong>Indaga</strong> — Formula preguntas sobre el ecosistema de su localidad y propone una hipótesis verificable.</li>
                <li><strong>Explica</strong> — Describe la relación entre seres vivos y su entorno usando evidencia recogida en campo.</li>
                <li><strong>Diseña</strong> — Elabora una propuesta para cuidar un espacio natural cercano y justifica sus decisiones.</li>
              </ul>
              <p className="lp-cneb__cardnote">
                Criterios derivados de la capacidad, con verbo observable y condición de calidad.
              </p>
            </aside>
          </div>
        </section>

        {/* =========================================================== PLANES */}
        <section className="lp-section lp-section--sunken" id="planes">
          <div className="lp-section__head">
            <Badge tone="brand">Planes</Badge>
            <h2 className="sv-h1">Empieza gratis. Cambia cuando lo necesites.</h2>
            <p>Pago por Plin o Yape a nombre de Teaching TIC. La activación se confirma por WhatsApp.</p>
          </div>

          <div className="lp-plans">
            {PLANS.map((plan) => (
              <article key={plan.id} className={`lp-plan${plan.featured ? " is-featured" : ""}`}>
                {plan.featured && <span className="lp-plan__flag"><Sparkles size={12} /> Más elegido</span>}
                <h3>{plan.name}</h3>
                <p className="lp-plan__tagline">{plan.tagline}</p>
                <p className="lp-plan__price">
                  <small>S/</small>{plan.price}
                  <span>{plan.period}</span>
                </p>
                <ul>
                  {plan.benefits.map((benefit) => (
                    <li key={benefit}><CheckCircle2 size={16} /> {benefit}</li>
                  ))}
                </ul>
                <Button
                  variant={plan.featured ? "primary" : "secondary"}
                  fullWidth
                  iconRight={ArrowRight}
                  onClick={() => choosePlan(plan)}
                >
                  {plan.id === "gratuito" ? "Crear cuenta gratis" : `Elegir plan ${plan.name.toLowerCase()}`}
                </Button>
              </article>
            ))}

            <article className="lp-plan lp-plan--institutional">
              <Badge tone="neutral" icon={GraduationCap}>Instituciones</Badge>
              <h3>{INSTITUTIONAL_PLAN.name}</h3>
              <p className="lp-plan__tagline">{INSTITUTIONAL_PLAN.tagline}</p>
              <p className="lp-plan__price lp-plan__price--quote">A consultar</p>
              <ul>
                {INSTITUTIONAL_PLAN.benefits.map((benefit) => (
                  <li key={benefit}><CheckCircle2 size={16} /> {benefit}</li>
                ))}
              </ul>
              <Button variant="outline" fullWidth iconRight={ArrowRight} onClick={contactInstitutional}>
                Solicitar propuesta
              </Button>
            </article>
          </div>
        </section>

        {/* ======================================================== PREGUNTAS */}
        <section className="lp-section" id="preguntas">
          <div className="lp-section__head">
            <Badge tone="brand" icon={HelpCircle}>Preguntas frecuentes</Badge>
            <h2 className="sv-h1">Antes de crear tu cuenta</h2>
          </div>
          <div className="lp-faq">
            {FAQS.map(([question, answer], index) => {
              const open = openFaq === index;
              return (
                <div key={question} className={`lp-faq__item${open ? " is-open" : ""}`}>
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => setOpenFaq(open ? null : index)}
                  >
                    <span>{question}</span>
                    <ChevronDown size={18} />
                  </button>
                  {open && <p>{answer}</p>}
                </div>
              );
            })}
          </div>
        </section>

        {/* ======================================================== CTA FINAL */}
        <section className="lp-final">
          <img src="/mascot/kantu-material.webp" alt="" loading="lazy" width="120" />
          <Badge tone="brand" icon={Target}>Tu próxima clase</Badge>
          <h2>Tu próxima sesión puede estar lista en tres minutos.</h2>
          <p>Crea tu cuenta gratis y prueba SciVerse con la clase que tengas más cerca.</p>
          <Button variant="primary" size="lg" iconRight={ArrowRight} onClick={onRegister}>
            Crear mi cuenta gratis
          </Button>
        </section>
      </main>

      {/* ============================================================= FOOTER */}
      <footer className="lp-footer">
        <div className="lp-footer__inner">
          <div className="lp-footer__brand">
            <a href="#inicio" className="lp-nav__brand" aria-label="SciVerse, inicio">
              <img src="/brand/isotipo.svg" alt="" width="36" height="36" />
              <span><strong>SciVerse</strong><small>una iniciativa de Teaching TIC</small></span>
            </a>
            <p>Tecnología educativa para experiencias STEAM accesibles, creativas y contextualizadas al Perú.</p>
            <div className="lp-footer__social">
              <a href={CONTACT.facebook} target="_blank" rel="noreferrer" aria-label="Facebook de Teaching TIC"><Facebook size={17} /></a>
              <a href={whatsappLink("Hola Teaching TIC, tengo una consulta sobre SciVerse.")} target="_blank" rel="noreferrer" aria-label="WhatsApp de Teaching TIC"><MessageCircle size={17} /></a>
            </div>
          </div>

          <nav className="lp-footer__col" aria-label="Producto">
            <h4>Producto</h4>
            <a href="#como-funciona">Cómo funciona</a>
            <a href="#herramientas">Herramientas</a>
            <a href="#cneb">Alineación CNEB</a>
            <a href="#planes">Planes</a>
          </nav>

          <nav className="lp-footer__col" aria-label="Soporte">
            <h4>Soporte</h4>
            <a href="#preguntas">Preguntas frecuentes</a>
            <a href={whatsappLink("Hola Teaching TIC, necesito ayuda con SciVerse.")} target="_blank" rel="noreferrer">Ayuda por WhatsApp</a>
            <button type="button" onClick={onLogin}>Ingresar</button>
            <button type="button" onClick={onRegister}>Crear cuenta</button>
          </nav>

          <nav className="lp-footer__col" aria-label="Legal">
            <h4>Legal</h4>
            <button type="button" onClick={() => openComingSoon({ title: "Términos y condiciones", description: "Estamos publicando esta página con su enlace permanente. Mientras tanto, puedes solicitarnos el documento por WhatsApp." })}>Términos y condiciones</button>
            <button type="button" onClick={() => openComingSoon({ title: "Política de privacidad", description: "Estamos publicando esta página con su enlace permanente. Mientras tanto, puedes solicitarnos el documento por WhatsApp." })}>Política de privacidad</button>
            <button type="button" onClick={() => openComingSoon({ title: "Política de uso de IA", description: "Estamos publicando esta página con su enlace permanente. Mientras tanto, puedes solicitarnos el documento por WhatsApp." })}>Política de uso de IA</button>
            <button type="button" onClick={() => openComingSoon({ title: "Libro de Reclamaciones", description: "Estamos habilitando el Libro de Reclamaciones virtual con su enlace permanente, como exige la normativa peruana. Mientras tanto puedes escribirnos por WhatsApp o al correo de contacto." })}>Libro de Reclamaciones</button>
          </nav>

          <div className="lp-footer__col">
            <h4>Contacto</h4>
            <p className="lp-footer__legal">{CONTACT.company}<br />RUC {CONTACT.ruc}</p>
            <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>
            <a href={whatsappLink("Hola Teaching TIC.")} target="_blank" rel="noreferrer">{CONTACT.phoneLabel}</a>
          </div>
        </div>
        <p className="lp-footer__bottom">© {new Date().getFullYear()} Teaching TIC Consultorías S.A.C. Todos los derechos reservados.</p>
      </footer>
    </div>
  );
}

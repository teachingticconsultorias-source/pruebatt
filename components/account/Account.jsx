import React, { useState } from "react";
import {
  User, School, CreditCard, GraduationCap, ShieldCheck, Link2,
  Video, BadgeCheck, BookOpen, Palette, HardDrive, Pencil, Check,
} from "lucide-react";

import Modal from "../ui/Modal.jsx";
import Button from "../ui/Button.jsx";
import { Badge, Alert, EmptyState } from "../ui/Feedback.jsx";
import { useUI } from "../ui/UIProvider.jsx";
import CreditsIndicator from "../CreditsIndicator.jsx";
import { PLANS, whatsappLink } from "../../config/plans.js";

/* ==========================================================================
   MI CUENTA

   La lógica de guardado se recibe por prop y NO se modifica: sigue siendo
   supabase.auth.updateUser, igual que antes.

   Lo que cambia:
     • Las cifras de uso inventadas ("Generaciones con IA 0 / 1") ya se
       habían sustituido por CreditsIndicator real en el bloque P0. Aquí se
       integra con la sección de plan para que la información no aparezca
       repetida en tres sitios.
     • "Referidos" se retira de la navegación: generaba un enlace ?ref= que
       NADIE lee y mostraba estadísticas fijas en 0. Era una función
       simulada presentada como real.
     • Seguridad y Preferencias se muestran como Próximamente honesto, en
       lugar de omitirlas o fingir que guardan algo.
   ========================================================================== */

const TABS = [
  { id: "perfil", label: "Perfil", icon: User },
  { id: "plan", label: "Plan y uso", icon: CreditCard },
  { id: "capacitacion", label: "Capacitación", icon: GraduationCap },
  { id: "seguridad", label: "Seguridad", icon: ShieldCheck },
  { id: "integraciones", label: "Integraciones", icon: Link2 },
];

export default function Account({
  profile,
  dbProfile,
  initialTab = "perfil",
  onClose,
  onSaveProfile,
}) {
  const [tab, setTab] = useState(initialTab);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);
  const [form, setForm] = useState({
    nombres: profile.nombres || "",
    apellidos: profile.apellidos || "",
    ie: profile.ie || "",
    celular: profile.celular || "",
    nivel: profile.nivel || "primaria",
  });

  const { openComingSoon, toast } = useUI();

  const initials =
    `${(profile.nombres?.[0] || "D").toUpperCase()}${(profile.apellidos?.[0] || "").toUpperCase()}`;
  const fullName = [profile.nombres, profile.apellidos].filter(Boolean).join(" ") || "Docente";
  const plan = dbProfile?.plan || "gratuito";
  const joined = profile.createdAt
    ? new Intl.DateTimeFormat("es-PE", { day: "numeric", month: "long", year: "numeric" }).format(new Date(profile.createdAt))
    : null;

  async function handleSave() {
    setSaving(true);
    setNotice(null);
    const result = await onSaveProfile(form);
    setSaving(false);
    if (result?.ok) {
      setEditing(false);
      toast({ tone: "success", title: "Perfil actualizado" });
      setNotice({
        tone: "info",
        text: "Algunos datos, como el nombre que aparece en los documentos Word, se actualizan del todo al volver a iniciar sesión.",
      });
    } else {
      setNotice({ tone: "danger", text: result?.message || "No pudimos guardar los cambios." });
    }
  }

  return (
    <Modal size="lg" onClose={onClose} title="Mi cuenta" description="Tu perfil, tu plan y los beneficios de Teaching TIC.">
      <div className="acc">
        <nav className="acc__tabs" role="tablist" aria-label="Secciones de mi cuenta">
          {TABS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                className={tab === item.id ? "is-active" : ""}
                onClick={() => { setTab(item.id); setNotice(null); }}
              >
                <Icon size={16} aria-hidden="true" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="acc__panel">
          {/* ==================================================== PERFIL */}
          {tab === "perfil" && (
            <>
              <div className="acc__identity">
                <span className="acc__avatar" aria-hidden="true">{initials}</span>
                <div>
                  <h3>{fullName}</h3>
                  <p>{profile.correo}</p>
                  <div className="acc__idbadges">
                    <Badge tone="brand">Docente</Badge>
                    <Badge tone="neutral">{profile.nivel === "secundaria" ? "Secundaria" : "Primaria"}</Badge>
                    <Badge tone={plan === "gratuito" ? "neutral" : "success"}>Plan {plan}</Badge>
                  </div>
                </div>
              </div>

              {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}

              {editing ? (
                <div className="acc__form">
                  <label>Nombres
                    <input value={form.nombres} onChange={(e) => setForm({ ...form, nombres: e.target.value })} />
                  </label>
                  <label>Apellidos
                    <input value={form.apellidos} onChange={(e) => setForm({ ...form, apellidos: e.target.value })} />
                  </label>
                  <label className="is-wide">Institución educativa
                    <input value={form.ie} onChange={(e) => setForm({ ...form, ie: e.target.value })} />
                  </label>
                  <label>Celular
                    <input value={form.celular} onChange={(e) => setForm({ ...form, celular: e.target.value })} type="tel" />
                  </label>
                  <label>Nivel
                    <select value={form.nivel} onChange={(e) => setForm({ ...form, nivel: e.target.value })}>
                      <option value="primaria">Primaria</option>
                      <option value="secundaria">Secundaria</option>
                    </select>
                  </label>
                  <div className="acc__formactions is-wide">
                    <Button variant="ghost" onClick={() => { setEditing(false); setNotice(null); }}>Cancelar</Button>
                    <Button variant="primary" icon={Check} loading={saving} loadingText="Guardando…" onClick={handleSave}>
                      Guardar cambios
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <dl className="acc__rows">
                    <div><dt>Nombre completo</dt><dd>{fullName}</dd></div>
                    <div><dt>Correo</dt><dd>{profile.correo}</dd></div>
                    <div><dt>Nivel</dt><dd className="is-capitalize">{profile.nivel || "primaria"}</dd></div>
                    <div><dt>Institución</dt><dd>{profile.ie || <span className="acc__empty">Sin institución asignada</span>}</dd></div>
                    <div><dt>Celular</dt><dd>{profile.celular || <span className="acc__empty">Sin celular</span>}</dd></div>
                    {joined && <div><dt>Miembro desde</dt><dd>{joined}</dd></div>}
                  </dl>
                  <Button variant="secondary" icon={Pencil} onClick={() => setEditing(true)}>Editar mis datos</Button>
                </>
              )}
            </>
          )}

          {/* ====================================================== PLAN */}
          {tab === "plan" && (
            <>
              <div className="acc__planhead">
                <div>
                  <span className="sv-label">Plan actual</span>
                  <h3 className="is-capitalize">{plan}</h3>
                </div>
                <Badge tone={plan === "gratuito" ? "neutral" : "success"}>
                  {plan === "gratuito" ? "Sin costo" : "Activo"}
                </Badge>
              </div>

              {/* Única fuente de uso: la API de créditos. */}
              <CreditsIndicator />

              <div className="acc__plans">
                {PLANS.filter((item) => item.id !== plan).map((item) => (
                  <article key={item.id} className={item.featured ? "is-featured" : ""}>
                    <h4>{item.name}</h4>
                    <p className="acc__planprice"><small>S/</small>{item.price}<span>{item.period}</span></p>
                    <ul>{item.benefits.slice(0, 4).map((benefit) => <li key={benefit}>{benefit}</li>)}</ul>
                    <Button
                      as="a"
                      variant={item.featured ? "primary" : "secondary"}
                      size="sm"
                      fullWidth
                      href={whatsappLink(`Hola Teaching TIC, deseo adquirir el Plan ${item.name} de SciVerse por S/${item.price}.`)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Elegir plan {item.name.toLowerCase()}
                    </Button>
                  </article>
                ))}
              </div>

              <Alert tone="info" icon={CreditCard} title="Pago por Plin o Yape">
                La activación se confirma por WhatsApp con Teaching TIC. No hay renovación automática.
              </Alert>
            </>
          )}

          {/* =============================================== CAPACITACIÓN */}
          {tab === "capacitacion" && (
            <>
              <div className="acc__trainhero">
                <Badge tone="amber" icon={GraduationCap}>Beneficio Teaching TIC</Badge>
                <h3>Centro de aprendizaje</h3>
                <p>Capacítate en vivo con especialistas y fortalece tu portafolio docente.</p>
              </div>

              <div className="acc__trainpoints">
                <div><span><Video size={17} /></span><div><strong>Capacitación en vivo</strong><p>Aprende, practica y resuelve tus dudas con el equipo.</p></div></div>
                <div><span><BadgeCheck size={17} /></span><div><strong>Constancia digital</strong><p>Lista para tu CV y tu portafolio docente.</p></div></div>
                <div><span><BookOpen size={17} /></span><div><strong>Aplicación en el aula</strong><p>IA, STEAM y recursos alineados al CNEB.</p></div></div>
              </div>

              {/* No se inventan cursos ni fechas: no hay catálogo real todavía. */}
              <EmptyState
                tone="compact"
                icon={GraduationCap}
                title="Todavía no hay sesiones programadas"
                description="Cuando abramos la próxima capacitación aparecerá aquí con su fecha y su enlace de inscripción. Mientras tanto puedes escribirnos para reservar tu cupo."
                action={
                  <Button
                    as="a"
                    variant="primary"
                    href={whatsappLink("Hola Teaching TIC, deseo información sobre la próxima capacitación de SciVerse.")}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Consultar por WhatsApp
                  </Button>
                }
              />
            </>
          )}

          {/* ================================================= SEGURIDAD */}
          {tab === "seguridad" && (
            <>
              <dl className="acc__rows">
                <div><dt>Correo de acceso</dt><dd>{profile.correo}</dd></div>
                <div><dt>Contraseña</dt><dd>••••••••</dd></div>
              </dl>
              <div className="acc__soonlist">
                <button type="button" onClick={() => openComingSoon({
                  title: "Cambiar contraseña desde la cuenta",
                  description: "Estamos habilitando el cambio de contraseña sin salir de tu cuenta.",
                  detail: "Mientras tanto puedes usar «¿Olvidaste tu contraseña?» en la pantalla de inicio de sesión: ese flujo sí funciona.",
                })}>
                  <ShieldCheck size={17} /> Cambiar contraseña
                </button>
                <button type="button" onClick={() => openComingSoon({
                  title: "Descargar mis datos",
                  description: "Estamos preparando la exportación de tu perfil y tus materiales en un archivo descargable.",
                })}>
                  <HardDrive size={17} /> Descargar mis datos
                </button>
                <button type="button" onClick={() => openComingSoon({
                  title: "Eliminar mi cuenta",
                  description: "Estamos habilitando la eliminación de cuenta con borrado completo de tus datos.",
                  detail: "Si necesitas eliminarla ahora, escríbenos por WhatsApp y lo hacemos por ti.",
                })}>
                  <User size={17} /> Eliminar mi cuenta
                </button>
              </div>
            </>
          )}

          {/* ============================================== INTEGRACIONES */}
          {tab === "integraciones" && (
            <>
              <p className="acc__intro">Próximamente podrás enviar tus materiales directamente a otras plataformas.</p>
              <div className="acc__integrations">
                {[
                  { name: "Google Drive", text: "Guarda tus sesiones y fichas en Drive", icon: HardDrive },
                  { name: "Canva", text: "Edita tus recursos con diseños visuales", icon: Palette },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.name}>
                      <span><Icon size={19} /></span>
                      <div><strong>{item.name}</strong><p>{item.text}</p></div>
                      <Badge tone="neutral">Próximamente</Badge>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}

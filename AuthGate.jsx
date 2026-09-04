import React, { useEffect, useState } from "react";
import {
  ArrowLeft, BookOpen, Check, CheckCircle2, Eye, EyeOff, GraduationCap,
  LockKeyhole, Mail, Phone, RefreshCw, School, ShieldCheck, Sparkles, User,
} from "lucide-react";
import { supabase } from "./supabaseClient.js";
import Button from "./components/ui/Button.jsx";
import Splash from "./components/ui/Splash.jsx";
import { useUI } from "./components/ui/UIProvider.jsx";
import "./components/auth/auth.css";

const EMPTY_FORM = {
  nombres: "",
  apellidos: "",
  ie: "",
  celular: "",
  nivel: "",
  correo: "",
  password: "",
  confirmPassword: "",
  acceptedTerms: false,
};

export default function AuthGate({ LandingComponent, children }) {
  const [checking, setChecking] = useState(true);
  const [profile, setProfile] = useState(null);
  const [view, setView] = useState("landing");
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const { openComingSoon } = useUI();

  // Etapa visual del registro. NO divide el envío: el submit sigue siendo
  // único y compatible con el backend actual.
  const registerStage =
    form.nombres && form.apellidos && form.ie ? (form.nivel && form.correo && form.password ? 3 : 2) : 1;

  useEffect(() => {
    if (!supabase) {
      setChecking(false);
      return undefined;
    }

    const applySession = (session) => {
      if (!session?.user) {
        setProfile(null);
        setChecking(false);
        return;
      }
      const metadata = session.user.user_metadata || {};
      setProfile({
        nombres: metadata.nombres || "Docente",
        apellidos: metadata.apellidos || "",
        ie: metadata.ie || "",
        celular: metadata.celular || "",
        nivel: metadata.nivel || "primaria",
        correo: session.user.email,
        userId: session.user.id,
        createdAt: session.user.created_at,
      });
      setChecking(false);
    };

    supabase.auth.getSession().then(({ data }) => applySession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setView("new-password");
        setProfile(null);
        setChecking(false);
        return;
      }
      applySession(session);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  // Cuenta atrás para no permitir reenvíos en ráfaga.
  useEffect(() => {
    if (resendCooldown <= 0) return undefined;
    const timer = window.setTimeout(() => setResendCooldown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendCooldown]);

  async function resendConfirmation() {
    if (!supabase || resendCooldown > 0) return;
    const email = form.correo.trim().toLowerCase();
    if (!email) return setError("Escribe el correo con el que te registraste.");
    setSaving(true);
    setError("");
    const { error: resendError } = await supabase.auth.resend({ type: "signup", email });
    setSaving(false);
    if (resendError) {
      setError("No pudimos reenviar el correo. Espera un momento e inténtalo otra vez.");
      return;
    }
    setNotice(`Volvimos a enviar el enlace a ${email}.`);
    setResendCooldown(60);
  }

  const changeView = (next) => {
    setError("");
    setNotice("");
    setView(next);
    window.scrollTo({ top: 0, behavior: "instant" });
  };

  async function register(e) {
    e.preventDefault();
    if (!supabase) return setError("Falta configurar VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY en Vercel. Después debes hacer un nuevo despliegue.");
    if (!form.nombres.trim() || !form.apellidos.trim() || !form.ie.trim() || !form.correo.trim() || !form.nivel) {
      return setError("Completa tus datos y selecciona si enseñas en primaria o secundaria.");
    }
    if (form.password.length < 8) return setError("La contraseña debe tener como mínimo 8 caracteres.");
    if (form.password !== form.confirmPassword) return setError("Las contraseñas no coinciden.");
    if (!form.acceptedTerms) return setError("Debes aceptar los términos y la política de privacidad.");

    setSaving(true);
    setError("");
    const { data, error: authError } = await supabase.auth.signUp({
      email: form.correo.trim().toLowerCase(),
      password: form.password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          nombres: form.nombres.trim(),
          apellidos: form.apellidos.trim(),
          ie: form.ie.trim(),
          celular: form.celular.trim(),
          nivel: form.nivel,
        },
      },
    });
    setSaving(false);

    if (authError) {
      const knownAccount = /already|registered|exists/i.test(authError.message || "");
      const unauthorizedEmail = /not authorized|unauthorized/i.test(authError.message || "");
      setError(knownAccount
        ? "Este correo ya está registrado. Inicia sesión o recupera tu contraseña."
        : unauthorizedEmail
          ? "Supabase todavía no puede enviar correos a esta dirección. Configura un servicio SMTP o prueba con el correo administrador del proyecto."
          : "No pudimos crear tu cuenta. Revisa los datos e inténtalo nuevamente.");
      return;
    }
    if (!data.session) {
      setNotice(`Enviamos un enlace de confirmación a ${form.correo.trim()}.`);
      setView("confirmation");
    }
  }

  async function login(e) {
    e.preventDefault();
    if (!supabase) return setError("Falta configurar VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY en Vercel. Después debes hacer un nuevo despliegue.");
    setSaving(true);
    setError("");
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: form.correo.trim().toLowerCase(),
      password: form.password,
    });
    setSaving(false);
    if (authError) {
      setError(/confirm/i.test(authError.message || "")
        ? "Primero confirma tu correo desde el mensaje que te enviamos."
        : "Correo o contraseña incorrectos.");
    }
  }

  async function recover(e) {
    e.preventDefault();
    if (!supabase || !form.correo.trim()) return setError("Escribe el correo con el que te registraste.");
    setSaving(true);
    setError("");
    const { error: authError } = await supabase.auth.resetPasswordForEmail(
      form.correo.trim().toLowerCase(),
      { redirectTo: `${window.location.origin}/?restablecer=1` },
    );
    setSaving(false);
    if (authError) setError("No pudimos enviar el correo de recuperación.");
    else setNotice("Te enviamos un enlace para recuperar tu contraseña.");
  }

  async function updatePassword(e) {
    e.preventDefault();
    if (form.password.length < 8) return setError("La contraseña debe tener como mínimo 8 caracteres.");
    if (form.password !== form.confirmPassword) return setError("Las contraseñas no coinciden.");
    setSaving(true);
    const { error: authError } = await supabase.auth.updateUser({ password: form.password });
    setSaving(false);
    if (authError) setError("No pudimos actualizar la contraseña. Solicita otro enlace.");
    else {
      setNotice("Tu contraseña fue actualizada correctamente.");
      setView("login");
      await supabase.auth.signOut();
    }
  }

  async function logout() {
    if (supabase) await supabase.auth.signOut();
    setProfile(null);
    setForm(EMPTY_FORM);
    setView("landing");
  }

  /* --------------------------------------------------------------- RENDER */

  if (checking) return <Splash done={false} />;
  if (profile) return children(profile, logout);
  if (view === "landing") {
    return <LandingComponent onRegister={() => changeView("register")} onLogin={() => changeView("login")} />;
  }

  const isRegister = view === "register";
  const isLogin = view === "login";
  const isRecovery = view === "recovery";
  const isNewPassword = view === "new-password";
  const isConfirmation = view === "confirmation";
  const submit = isRegister ? register : isLogin ? login : isRecovery ? recover : updatePassword;

  const strength = passwordStrength(form.password);

  const HEADINGS = {
    register: { title: "Crea tu cuenta docente", sub: "Empieza gratis. Sin tarjeta." },
    login: { title: "Bienvenida de nuevo", sub: "Ingresa para continuar donde lo dejaste." },
    recovery: { title: "Recupera tu acceso", sub: "Te enviaremos un enlace a tu correo." },
    "new-password": { title: "Crea una nueva contraseña", sub: "Elige una que no uses en otro sitio." },
    confirmation: { title: "Revisa tu correo", sub: "Solo falta confirmar tu cuenta." },
  };
  const heading = HEADINGS[view] || HEADINGS.login;

  return (
    <main className="auth">
      {/* ------------------------------------------------- PANEL DE MARCA */}
      <aside className="auth__brandside" aria-hidden="true">
        <div className="auth__brandtop">
          <img src="/brand/isotipo-white.svg" alt="" width="40" height="40" />
          <span>
            <strong>SciVerse</strong>
            <small>una iniciativa de Teaching TIC</small>
          </span>
        </div>

        <div className="auth__brandcopy">
          <p className="auth__eyebrow">
            <Sparkles size={13} /> Plataforma educativa peruana
          </p>
          <h2>Más tiempo para enseñar. Menos tiempo programando.</h2>
          <ul>
            <li><CheckCircle2 size={17} /> Sesiones alineadas al CNEB en minutos</li>
            <li><CheckCircle2 size={17} /> Rúbricas, fichas y proyectos STEAM</li>
            <li><CheckCircle2 size={17} /> Descarga en Word lista para entregar</li>
          </ul>
        </div>

        <img className="auth__kantu" src="/mascot/kantu-material.webp" alt="" width="132" loading="lazy" />
        <small className="auth__company">Teaching TIC Consultorías S.A.C. · RUC 20607945331</small>
      </aside>

      {/* ---------------------------------------------------- FORMULARIO */}
      <section className="auth__panel">
        <div className="auth__card">
          <a
            href="#inicio"
            className="auth__back"
            onClick={(event) => { event.preventDefault(); changeView("landing"); }}
          >
            <ArrowLeft size={15} /> Volver al inicio
          </a>

          <div className="auth__mobilebrand">
            <img src="/brand/isotipo.svg" alt="" width="34" height="34" />
            <strong>SciVerse</strong>
          </div>

          {(isRegister || isLogin) && (
            <div className="auth__tabs" role="tablist" aria-label="Acceso a SciVerse">
              <button
                type="button" role="tab" aria-selected={isLogin}
                className={isLogin ? "is-active" : ""}
                onClick={() => changeView("login")}
              >
                Iniciar sesión
              </button>
              <button
                type="button" role="tab" aria-selected={isRegister}
                className={isRegister ? "is-active" : ""}
                onClick={() => changeView("register")}
              >
                Crear cuenta
              </button>
            </div>
          )}

          <h1 className="auth__title">{heading.title}</h1>
          <p className="auth__sub">{heading.sub}</p>

          {/* ------------------------------------------- CONFIRMAR CORREO */}
          {isConfirmation ? (
            <div className="auth__confirm">
              <img src="/illustrations/mail-sent.svg" alt="" width="200" loading="lazy" />
              <p className="auth__confirmmsg">{notice}</p>
              <p className="auth__confirmhint">
                Si no lo encuentras, revisa tu carpeta de <strong>spam</strong> o{" "}
                <strong>correo no deseado</strong>.
              </p>

              {error && <p role="alert" className="auth__error">{error}</p>}

              <div className="auth__confirmactions">
                <Button variant="primary" fullWidth onClick={() => changeView("login")}>
                  Ya confirmé mi cuenta
                </Button>
                <Button
                  variant="outline"
                  fullWidth
                  onClick={resendConfirmation}
                  loading={saving}
                  loadingText="Enviando…"
                  disabled={resendCooldown > 0}
                  icon={RefreshCw}
                >
                  {resendCooldown > 0 ? `Reenviar en ${resendCooldown}s` : "Reenviar correo de confirmación"}
                </Button>
                <button type="button" className="auth__link" onClick={() => changeView("register")}>
                  ¿Te equivocaste de correo? Corrígelo
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={submit} className="auth__form" noValidate={false}>
              {/* Indicador de progreso: el registro pide bastantes datos y
                  conviene que se vea que tiene final. El envío sigue siendo
                  único, compatible con el backend actual. */}
              {isRegister && (
                <ol className="auth__progress" aria-label="Progreso del registro">
                  <li className={registerStage >= 1 ? "is-done" : ""}>Tu cuenta</li>
                  <li className={registerStage >= 2 ? "is-done" : ""}>Tu perfil</li>
                  <li className={registerStage >= 3 ? "is-done" : ""}>Listo</li>
                </ol>
              )}

              {isRegister && (
                <div className="auth__row">
                  <AuthInput label="Nombres" value={form.nombres} onChange={(v) => setForm({ ...form, nombres: v })} placeholder="Ej. María" autoComplete="given-name" icon={User} />
                  <AuthInput label="Apellidos" value={form.apellidos} onChange={(v) => setForm({ ...form, apellidos: v })} placeholder="Ej. Pérez López" autoComplete="family-name" />
                </div>
              )}

              {isRegister && (
                <AuthInput label="Institución educativa" value={form.ie} onChange={(v) => setForm({ ...form, ie: v })} placeholder="Nombre de tu colegio" icon={School} />
              )}

              {isRegister && (
                <AuthInput label="Celular" hint="Opcional" value={form.celular} onChange={(v) => setForm({ ...form, celular: v })} placeholder="999 999 999" type="tel" autoComplete="tel" required={false} icon={Phone} />
              )}

              {isRegister && (
                <fieldset className="auth__levels">
                  <legend>¿En qué nivel enseñas?</legend>
                  <div>
                    <LevelChoice active={form.nivel === "primaria"} icon={BookOpen} title="Primaria" description="1.° a 6.° grado" tone="amber" onClick={() => setForm({ ...form, nivel: "primaria" })} />
                    <LevelChoice active={form.nivel === "secundaria"} icon={GraduationCap} title="Secundaria" description="1.° a 5.° grado" tone="teal" onClick={() => setForm({ ...form, nivel: "secundaria" })} />
                  </div>
                </fieldset>
              )}

              {!isNewPassword && (
                <AuthInput label="Correo electrónico" value={form.correo} onChange={(v) => setForm({ ...form, correo: v })} placeholder="docente@correo.com" type="email" autoComplete="email" icon={Mail} />
              )}

              {!isRecovery && (
                <AuthInput
                  label={isNewPassword ? "Nueva contraseña" : "Contraseña"}
                  value={form.password}
                  onChange={(v) => setForm({ ...form, password: v })}
                  placeholder="Mínimo 8 caracteres"
                  type="password"
                  autoComplete={isLogin ? "current-password" : "new-password"}
                  minLength={8}
                  icon={LockKeyhole}
                  revealable
                />
              )}

              {/* Medidor de fortaleza: solo cuando se está creando una
                  contraseña, no al iniciar sesión. */}
              {(isRegister || isNewPassword) && form.password && (
                <div className={`auth__strength is-${strength.level}`}>
                  <span aria-hidden="true"><i style={{ width: `${strength.pct}%` }} /></span>
                  <small>{strength.label}</small>
                </div>
              )}

              {(isRegister || isNewPassword) && (
                <AuthInput
                  label="Confirmar contraseña"
                  value={form.confirmPassword}
                  onChange={(v) => setForm({ ...form, confirmPassword: v })}
                  placeholder="Escríbela otra vez"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  icon={LockKeyhole}
                  revealable
                  error={
                    form.confirmPassword && form.password !== form.confirmPassword
                      ? "Las contraseñas no coinciden."
                      : null
                  }
                />
              )}

              {isRegister && (
                <label className="auth__consent">
                  <input
                    type="checkbox"
                    checked={form.acceptedTerms}
                    onChange={(event) => setForm({ ...form, acceptedTerms: event.target.checked })}
                  />
                  <span>
                    Acepto los{" "}
                    <button type="button" onClick={() => openComingSoon({ title: "Términos y condiciones", description: "Estamos publicando esta página con su enlace permanente. Puedes solicitarnos el documento por WhatsApp." })}>
                      términos y condiciones
                    </button>{" "}
                    y la{" "}
                    <button type="button" onClick={() => openComingSoon({ title: "Política de privacidad", description: "Estamos publicando esta página con su enlace permanente. Puedes solicitarnos el documento por WhatsApp." })}>
                      política de privacidad
                    </button>{" "}
                    de Teaching TIC.
                  </span>
                </label>
              )}

              {error && <p role="alert" className="auth__error">{error}</p>}
              {notice && !isConfirmation && <p role="status" className="auth__notice">{notice}</p>}

              <Button
                type="submit"
                variant="primary"
                size="lg"
                fullWidth
                loading={saving}
                loadingText="Procesando…"
                icon={isRegister ? User : isLogin ? LockKeyhole : Mail}
              >
                {isRegister ? "Crear mi cuenta" : isLogin ? "Iniciar sesión" : isRecovery ? "Enviar enlace" : "Guardar contraseña"}
              </Button>

              {isLogin && (
                <button type="button" className="auth__link" onClick={() => changeView("recovery")}>
                  ¿Olvidaste tu contraseña?
                </button>
              )}
              {isRecovery && (
                <button type="button" className="auth__link" onClick={() => changeView("login")}>
                  Volver a iniciar sesión
                </button>
              )}
            </form>
          )}

          {!isConfirmation && !isNewPassword && (
            <p className="auth__switch">
              {isRegister ? "¿Ya tienes una cuenta? " : "¿Aún no tienes cuenta? "}
              <button type="button" onClick={() => changeView(isRegister ? "login" : "register")}>
                {isRegister ? "Inicia sesión" : "Regístrate gratis"}
              </button>
            </p>
          )}

          <p className="auth__security">
            <ShieldCheck size={14} /> Tus datos se usan únicamente para gestionar tu cuenta.
          </p>
        </div>
      </section>
    </main>
  );
}

/* ------------------------------------------------------------------ PIEZAS */

/** Fuerza de la contraseña. Orientativo: la validación real es length >= 8. */
function passwordStrength(password = "") {
  if (!password) return { level: "none", pct: 0, label: "" };
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^\w\s]/.test(password)) score += 1;

  if (password.length < 8) return { level: "weak", pct: 20, label: "Muy corta: mínimo 8 caracteres" };
  if (score <= 2) return { level: "weak", pct: 35, label: "Débil: combina mayúsculas y números" };
  if (score === 3) return { level: "medium", pct: 65, label: "Aceptable" };
  return { level: "strong", pct: 100, label: "Segura" };
}

function LevelChoice({ active, icon: Icon, title, description, tone, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`auth__level auth__level--${tone}${active ? " is-active" : ""}`}
    >
      <Icon size={20} aria-hidden="true" />
      <strong>{title}</strong>
      <span>{description}</span>
      {active && <Check size={15} className="auth__levelcheck" aria-hidden="true" />}
    </button>
  );
}

function AuthInput({
  label, value, onChange, placeholder, type = "text", autoComplete,
  minLength, required = true, icon: Icon, hint, error, revealable = false,
}) {
  const [revealed, setRevealed] = useState(false);
  const inputType = revealable && revealed ? "text" : type;

  return (
    <label className={`auth__field${error ? " has-error" : ""}`}>
      <span className="auth__label">
        {label}
        {hint && <em>{hint}</em>}
      </span>
      <span className="auth__control">
        {Icon && <Icon size={17} className="auth__fieldicon" aria-hidden="true" />}
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          type={inputType}
          autoComplete={autoComplete}
          minLength={minLength}
          required={required}
          aria-invalid={error ? true : undefined}
        />
        {revealable && (
          <button
            type="button"
            className="auth__reveal"
            onClick={() => setRevealed((current) => !current)}
            aria-label={revealed ? "Ocultar contraseña" : "Mostrar contraseña"}
          >
            {revealed ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        )}
      </span>
      {error && <em className="auth__fielderror">{error}</em>}
    </label>
  );
}

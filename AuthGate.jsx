import React, { useEffect, useState } from "react";
import { BookOpen, CheckCircle2, GraduationCap, Loader2, LockKeyhole, Microscope, User } from "lucide-react";
import { supabase } from "./supabaseClient.js";

const COLORS = {
  bg: "#FAFEFE",
  surface: "#FFFFFF",
  text: "#102A2E",
  muted: "#64777A",
  teal: "#35B9AD",
  line: "#D7E9E7",
  danger: "#C2410C",
};

const EMPTY_FORM = {
  nombres: "",
  apellidos: "",
  ie: "",
  celular: "",
  nivel: "",
  correo: "",
  password: "",
  confirmPassword: "",
};

export default function AuthGate({ LandingComponent, children }) {
  const [checking, setChecking] = useState(true);
  const [profile, setProfile] = useState(null);
  const [view, setView] = useState("landing");
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

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

  const changeView = (next) => {
    setError("");
    setNotice("");
    setView(next);
    window.scrollTo({ top: 0, behavior: "instant" });
  };

  async function register(e) {
    e.preventDefault();
    if (!supabase) return setError("Falta conectar Supabase en Vercel.");
    if (!form.nombres.trim() || !form.apellidos.trim() || !form.ie.trim() || !form.correo.trim() || !form.nivel) {
      return setError("Completa tus datos y selecciona si enseñas en primaria o secundaria.");
    }
    if (form.password.length < 8) return setError("La contraseña debe tener como mínimo 8 caracteres.");
    if (form.password !== form.confirmPassword) return setError("Las contraseñas no coinciden.");

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
    if (!supabase) return setError("Falta conectar Supabase en Vercel.");
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

  if (checking) {
    return <div className="min-h-screen flex items-center justify-center" style={{ background: COLORS.bg }}><Loader2 className="animate-spin" color={COLORS.teal} /></div>;
  }
  if (profile) return children(profile, logout);
  if (view === "landing") return <LandingComponent onRegister={() => changeView("register")} />;

  const isRegister = view === "register";
  const isLogin = view === "login";
  const isRecovery = view === "recovery";
  const isNewPassword = view === "new-password";
  const submit = isRegister ? register : isLogin ? login : isRecovery ? recover : updatePassword;

  return (
    <main className="min-h-screen flex items-center justify-center px-5 py-10" style={{ background: COLORS.bg, color: COLORS.text }}>
      <section className="w-full max-w-md rounded-2xl p-7 shadow-sm" style={{ background: COLORS.surface, border: `1px solid ${COLORS.line}` }}>
        {view !== "new-password" && <button type="button" onClick={() => changeView("landing")} className="text-xs mb-5" style={{ color: COLORS.muted }}>← Volver a la página principal</button>}
        <div className="flex items-center gap-2 mb-2">
          <Microscope size={22} color={COLORS.teal} />
          <strong className="text-lg">SciVerse <span style={{ color: COLORS.muted, fontWeight: 400 }}>Docentes</span></strong>
        </div>
        <p className="text-sm mb-6" style={{ color: COLORS.muted }}>
          {isRegister && "Crea tu cuenta para acceder a las herramientas de Teaching TIC."}
          {isLogin && "Ingresa con tu correo y contraseña."}
          {isRecovery && "Recibe un enlace para recuperar tu acceso."}
          {isNewPassword && "Crea una nueva contraseña para tu cuenta."}
          {view === "confirmation" && "Solo falta confirmar tu correo para activar la cuenta."}
        </p>

        {view === "confirmation" ? (
          <div className="text-center py-4">
            <CheckCircle2 size={50} color={COLORS.teal} className="mx-auto mb-4" />
            <h1 className="text-xl font-semibold mb-2">Revisa tu correo</h1>
            <p className="text-sm mb-5" style={{ color: COLORS.muted }}>{notice}</p>
            <button type="button" onClick={() => changeView("login")} className="w-full rounded-lg py-2.5 text-sm font-semibold" style={{ background: COLORS.teal, color: "#072E2B" }}>Ya confirmé mi cuenta</button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            {isRegister && <div className="grid grid-cols-2 gap-3">
              <AuthInput value={form.nombres} onChange={(v) => setForm({ ...form, nombres: v })} placeholder="Nombres" autoComplete="given-name" />
              <AuthInput value={form.apellidos} onChange={(v) => setForm({ ...form, apellidos: v })} placeholder="Apellidos" autoComplete="family-name" />
            </div>}
            {isRegister && <AuthInput value={form.ie} onChange={(v) => setForm({ ...form, ie: v })} placeholder="Institución educativa (IE)" />}
            {isRegister && <AuthInput value={form.celular} onChange={(v) => setForm({ ...form, celular: v })} placeholder="Celular" type="tel" autoComplete="tel" required={false} />}
            {isRegister && <fieldset>
              <legend className="text-sm font-semibold mb-2">¿En qué nivel enseñas?</legend>
              <div className="grid grid-cols-2 gap-3">
                <LevelChoice
                  active={form.nivel === "primaria"}
                  icon={BookOpen}
                  title="Primaria"
                  description="1.° a 6.° grado"
                  color="#FFBB00"
                  onClick={() => setForm({ ...form, nivel: "primaria" })}
                />
                <LevelChoice
                  active={form.nivel === "secundaria"}
                  icon={GraduationCap}
                  title="Secundaria"
                  description="1.° a 5.° grado"
                  color="#1F9E98"
                  onClick={() => setForm({ ...form, nivel: "secundaria" })}
                />
              </div>
            </fieldset>}
            {!isNewPassword && <AuthInput value={form.correo} onChange={(v) => setForm({ ...form, correo: v })} placeholder="Correo electrónico" type="email" autoComplete="email" />}
            {!isRecovery && <AuthInput value={form.password} onChange={(v) => setForm({ ...form, password: v })} placeholder={isNewPassword ? "Nueva contraseña" : "Contraseña (mínimo 8 caracteres)"} type="password" autoComplete={isLogin ? "current-password" : "new-password"} minLength={8} />}
            {(isRegister || isNewPassword) && <AuthInput value={form.confirmPassword} onChange={(v) => setForm({ ...form, confirmPassword: v })} placeholder="Repite tu contraseña" type="password" autoComplete="new-password" minLength={8} />}

            {error && <p role="alert" className="text-xs" style={{ color: COLORS.danger }}>{error}</p>}
            {notice && <p role="status" className="text-xs" style={{ color: COLORS.teal }}>{notice}</p>}

            <button type="submit" disabled={saving} className="w-full inline-flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold" style={{ background: COLORS.teal, color: "#072E2B", opacity: saving ? 0.7 : 1 }}>
              {saving ? <Loader2 size={16} className="animate-spin" /> : isRegister ? <User size={16} /> : <LockKeyhole size={16} />}
              {saving ? "Procesando..." : isRegister ? "Crear mi cuenta" : isLogin ? "Iniciar sesión" : isRecovery ? "Enviar enlace" : "Guardar contraseña"}
            </button>
            {isLogin && <button type="button" onClick={() => changeView("recovery")} className="w-full text-xs" style={{ color: COLORS.muted }}>¿Olvidaste tu contraseña?</button>}
          </form>
        )}

        {view !== "confirmation" && !isNewPassword && <div className="mt-5 pt-4 text-center text-sm" style={{ borderTop: `1px solid ${COLORS.line}`, color: COLORS.muted }}>
          {isRegister ? "¿Ya tienes una cuenta? " : "¿Aún no tienes una cuenta? "}
          <button type="button" onClick={() => changeView(isRegister ? "login" : "register")} className="font-semibold" style={{ color: COLORS.teal }}>{isRegister ? "Inicia sesión" : "Regístrate"}</button>
        </div>}
      </section>
    </main>
  );
}

function LevelChoice({ active, icon: Icon, title, description, color, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="rounded-xl p-3 text-left transition-all"
      style={{
        border: `2px solid ${active ? color : COLORS.line}`,
        background: active ? `${color}18` : COLORS.surface,
        boxShadow: active ? `0 0 0 2px ${color}20` : "none",
      }}
    >
      <Icon size={20} color={color} className="mb-2" />
      <strong className="block text-sm">{title}</strong>
      <span className="text-xs" style={{ color: COLORS.muted }}>{description}</span>
    </button>
  );
}

function AuthInput({ value, onChange, placeholder, type = "text", autoComplete, minLength, required = true }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      type={type}
      autoComplete={autoComplete}
      minLength={minLength}
      required={required}
      className="w-full rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2"
      style={{ background: "rgba(15,61,58,0.05)", border: `1px solid ${COLORS.line}`, color: COLORS.text }}
    />
  );
}

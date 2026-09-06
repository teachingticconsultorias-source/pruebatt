import React, { useCallback, useEffect, useState } from "react";
import { CreditCard, Check, Clock, XCircle, CheckCircle2, Info } from "lucide-react";

import { supabase } from "../../supabaseClient.js";
import Button from "../ui/Button.jsx";
import Modal from "../ui/Modal.jsx";
import { Badge, Alert, Skeleton } from "../ui/Feedback.jsx";
import { useUI } from "../ui/UIProvider.jsx";
import CreditsIndicator from "../CreditsIndicator.jsx";

/* ==========================================================================
   MI PLAN · lado del docente

   El catálogo y las instrucciones de pago vienen de la base, no del código.
   Si el equipo todavía no ha configurado el método de pago, se dice
   claramente en vez de enseñar un número de cuenta inventado: un dato de
   pago falso es peor que no tener ninguno.

   Al solicitar un plan, el navegador envía SOLO el código. El importe lo fija
   el servidor leyendo `public.plans`.
   ========================================================================== */

const ESTADOS = {
  pending:   { texto: "En revisión", tono: "amber",   icono: Clock },
  approved:  { texto: "Aprobada",    tono: "success", icono: CheckCircle2 },
  rejected:  { texto: "Rechazada",   tono: "danger",  icono: XCircle },
  cancelled: { texto: "Cancelada",   tono: "neutral", icono: XCircle },
};

const METODOS = [
  ["yape", "Yape"],
  ["plin", "Plin"],
  ["transferencia", "Transferencia"],
  ["efectivo", "Efectivo"],
  ["otro", "Otro"],
];

function soles(centimos, moneda = "PEN") {
  const valor = (Number(centimos) || 0) / 100;
  return (moneda === "PEN" ? "S/ " : moneda + " ") + valor.toFixed(2);
}

function fecha(valor) {
  if (!valor) return "—";
  const d = new Date(valor);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });
}

export default function PlanSection() {
  const [planActual, setPlanActual] = useState(null);
  const [catalogo, setCatalogo] = useState([]);
  const [ajustes, setAjustes] = useState(null);
  const [solicitudes, setSolicitudes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [eligiendo, setEligiendo] = useState(null);

  const cargar = useCallback(async () => {
    if (!supabase) { setCargando(false); return; }
    setCargando(true);
    setError("");
    try {
      const { data: sesion } = await supabase.auth.getSession();
      const token = sesion?.session?.access_token;

      const [mi, planes, cfg, historial] = await Promise.all([
        supabase.rpc("get_my_plan"),
        supabase.from("plans").select("code,name,description,ai_weekly_limit,price_cents,currency,billing_period_months")
          .eq("is_active", true).order("sort_order"),
        supabase.from("payment_settings").select("*").maybeSingle(),
        token
          ? fetch("/api/payments/mine", { headers: { Authorization: "Bearer " + token } })
              .then((r) => (r.headers.get("content-type") || "").includes("json") ? r.json() : null)
              .catch(() => null)
          : Promise.resolve(null),
      ]);

      setPlanActual(mi?.data || null);
      setCatalogo(planes?.data || []);
      setAjustes(cfg?.data || null);
      setSolicitudes(historial?.items || []);
    } catch {
      setError("No pudimos cargar tu plan. Inténtalo de nuevo.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  if (cargando) {
    return (
      <div className="plansec">
        <Skeleton w="45%" h={22} />
        <Skeleton w="100%" h={80} />
        <Skeleton w="100%" h={140} />
      </div>
    );
  }

  if (error) return <Alert tone="danger" title="Algo salió mal">{error}</Alert>;

  const codigoActual = planActual?.plan || "free";
  const mejorables = catalogo.filter((p) => p.code !== codigoActual && p.price_cents > 0);
  const pendiente = solicitudes.find((s) => s.estado === "pending");

  return (
    <div className="plansec">
      {/* ------------------------------------------------------- PLAN ACTUAL */}
      <div className="acc__planhead">
        <div>
          <span className="sv-label">Plan actual</span>
          <h3>{planActual?.plan_name || "Gratuito"}</h3>
        </div>
        <Badge tone={codigoActual === "free" ? "neutral" : "success"}>
          {codigoActual === "free" ? "Sin costo" : "Activo"}
        </Badge>
      </div>

      {planActual?.ends_at && (
        <p className="plansec__vence">
          Vence el <strong>{fecha(planActual.ends_at)}</strong>.
        </p>
      )}

      {/* Única fuente de uso: la API de créditos. */}
      <CreditsIndicator />

      {/* --------------------------------------------------- SOLICITUD ABIERTA */}
      {pendiente && (
        <Alert tone="info" icon={Clock} title="Tu solicitud está en revisión">
          Pediste el plan <strong>{pendiente.plan_nombre}</strong> por {soles(pendiente.monto_centimos, pendiente.moneda)}.
          Te avisaremos apenas la revisemos.
        </Alert>
      )}

      {/* ------------------------------------------------------- MEJORAR PLAN */}
      {mejorables.length > 0 && !pendiente && (
        <section className="plansec__mejorar">
          <h4>Mejorar plan</h4>
          <div className="acc__plans">
            {mejorables.map((p) => (
              <article key={p.code}>
                <h4>{p.name}</h4>
                <p className="acc__planprice">
                  <small>{p.currency === "PEN" ? "S/" : p.currency}</small>
                  {(p.price_cents / 100).toFixed(0)}
                  <span>{p.billing_period_months === 1 ? "al mes" : `cada ${p.billing_period_months} meses`}</span>
                </p>
                <ul>
                  <li><Check size={13} aria-hidden="true" /> {p.ai_weekly_limit} creaciones por semana</li>
                  {p.description && <li><Check size={13} aria-hidden="true" /> {p.description}</li>}
                </ul>
                <Button variant="primary" size="sm" fullWidth onClick={() => setEligiendo(p)}>
                  Solicitar plan
                </Button>
              </article>
            ))}
          </div>
        </section>
      )}

      {mejorables.length === 0 && !pendiente && (
        <Alert tone="info" icon={Info} title="Aún no hay planes de pago disponibles">
          Estamos terminando de prepararlos. Por ahora sigues con el plan gratuito.
        </Alert>
      )}

      {/* ----------------------------------------------------------- HISTORIAL */}
      {solicitudes.length > 0 && (
        <section className="plansec__historial">
          <h4>Tus solicitudes</h4>
          <ul>
            {solicitudes.map((s) => {
              const e = ESTADOS[s.estado] || ESTADOS.cancelled;
              const Icono = e.icono;
              return (
                <li key={s.id}>
                  <span className="plansec__hicono" aria-hidden="true"><Icono size={15} /></span>
                  <div>
                    <strong>{s.plan_nombre}</strong>
                    <small>{soles(s.monto_centimos, s.moneda)} · {fecha(s.solicitado)}</small>
                  </div>
                  <Badge tone={e.tono}>{e.texto}</Badge>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {eligiendo && (
        <ModalSolicitud
          plan={eligiendo}
          ajustes={ajustes}
          onCerrar={() => setEligiendo(null)}
          onHecho={() => { setEligiendo(null); cargar(); }}
        />
      )}
    </div>
  );
}

/* ======================================================================= */

function ModalSolicitud({ plan, ajustes, onCerrar, onHecho }) {
  const { toast } = useUI();
  const [metodo, setMetodo] = useState(ajustes?.method || "yape");
  const [referencia, setReferencia] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  const configurado = Boolean(ajustes?.is_configured);

  async function solicitar() {
    setEnviando(true);
    setError("");
    try {
      const { data: sesion } = await supabase.auth.getSession();
      const token = sesion?.session?.access_token;

      const res = await fetch("/api/payments/request", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        // Solo el código del plan: el precio lo pone el servidor.
        body: JSON.stringify({ plan: plan.code, method: metodo, reference: referencia.trim() || null }),
      });

      const tipo = res.headers.get("content-type") || "";
      if (!tipo.includes("application/json")) {
        throw new Error("El servicio no está disponible en este momento.");
      }
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "No pudimos registrar tu solicitud.");

      toast({
        tone: "success",
        title: "Solicitud enviada",
        description: "La revisaremos y te avisaremos apenas esté lista.",
      });
      onHecho();
    } catch (e) {
      setError(e.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal
      open
      onClose={enviando ? undefined : onCerrar}
      dismissible={!enviando}
      title={`Solicitar plan ${plan.name}`}
      description={`${soles(plan.price_cents, plan.currency)} · ${plan.ai_weekly_limit} creaciones por semana`}
      icon={CreditCard}
      actions={
        <>
          <Button variant="ghost" onClick={onCerrar} disabled={enviando}>Cancelar</Button>
          <Button variant="primary" loading={enviando} onClick={solicitar}>
            Enviar solicitud
          </Button>
        </>
      }
    >
      <div className="plansec__form">
        {configurado ? (
          <div className="plansec__instrucciones">
            <h5>Cómo pagar</h5>
            <p>{ajustes.instructions}</p>
            {ajustes.receiver_name && <p><strong>A nombre de:</strong> {ajustes.receiver_name}</p>}
            {ajustes.account_number && <p><strong>Número:</strong> {ajustes.account_number}</p>}
            {ajustes.whatsapp && <p><strong>Consultas:</strong> {ajustes.whatsapp}</p>}
          </div>
        ) : (
          <Alert tone="amber" icon={Info} title="Método de pago aún no configurado">
            Puedes enviar tu solicitud igualmente: nos pondremos en contacto contigo
            para indicarte cómo completar el pago.
          </Alert>
        )}

        <label>Método de pago
          <select value={metodo} onChange={(e) => setMetodo(e.target.value)}>
            {METODOS.map(([valor, etiqueta]) => (
              <option key={valor} value={valor}>{etiqueta}</option>
            ))}
          </select>
        </label>

        <label>Número de operación <small>(opcional, si ya pagaste)</small>
          <input value={referencia} maxLength={80} placeholder="Ej.: 00123456"
                 onChange={(e) => setReferencia(e.target.value)} />
        </label>

        {error && <p className="plansec__error" role="alert">{error}</p>}
      </div>
    </Modal>
  );
}

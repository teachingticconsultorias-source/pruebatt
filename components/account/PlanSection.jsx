import React, { useCallback, useEffect, useState } from "react";
import {
  CreditCard, Check, Clock, XCircle, CheckCircle2, Info, Copy,
  QrCode, MessageCircle, Sparkles,
} from "lucide-react";

import { supabase } from "../../supabaseClient.js";
import Button from "../ui/Button.jsx";
import Modal from "../ui/Modal.jsx";
import { Badge, Alert, Skeleton } from "../ui/Feedback.jsx";
import { useUI } from "../ui/UIProvider.jsx";
import CreditsIndicator from "../CreditsIndicator.jsx";

/* ==========================================================================
   MI PLAN · lado del docente

   TODO lo comercial viene de la base: catálogo, precio, límite, métodos de
   pago, receptor, número, QR e instrucciones. En este fichero no hay ni un
   precio ni un número de teléfono escrito a mano, y no debe haberlo: el
   equipo los cambia desde Administración y la docente los ve al recargar.

   Al solicitar un plan el navegador envía SOLO el código. El importe lo fija
   el servidor leyendo `public.plans`.

   Nunca se muestran las notas internas de administración: la API del docente
   (`my_payment_requests`) directamente no las devuelve.
   ========================================================================== */

const BUCKET = "payment-assets";

const ESTADOS = {
  pending:   { texto: "Pendiente", tono: "amber",   icono: Clock },
  approved:  { texto: "Aprobada",  tono: "success", icono: CheckCircle2 },
  rejected:  { texto: "Rechazada", tono: "danger",  icono: XCircle },
  cancelled: { texto: "Cancelada", tono: "neutral", icono: XCircle },
};

function soles(centimos, moneda = "PEN") {
  const valor = (Number(centimos) || 0) / 100;
  return (moneda === "PEN" ? "S/ " : moneda + " ") + valor.toFixed(2);
}

function fecha(valor) {
  if (!valor) return "—";
  const d = new Date(valor);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("es-PE", { day: "2-digit", month: "long", year: "numeric" });
}

function periodo(meses) {
  if (!meses) return "sin vencimiento";
  return meses === 1 ? "al mes" : `cada ${meses} meses`;
}

export default function PlanSection() {
  const [planActual, setPlanActual] = useState(null);
  const [catalogo, setCatalogo] = useState([]);
  const [ajustes, setAjustes] = useState(null);
  const [metodos, setMetodos] = useState([]);
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

      const [mi, planes, cfg, mets, historial] = await Promise.all([
        supabase.rpc("get_my_plan"),
        supabase.from("plans")
          .select("code,name,description,benefits,ai_weekly_limit,price_cents,currency,billing_period_months")
          .eq("is_active", true).order("sort_order"),
        supabase.from("payment_settings").select("*").maybeSingle(),
        supabase.from("payment_methods")
          .select("code,label,receiver_name,account_number,instructions,qr_path")
          .eq("is_enabled", true).order("sort_order"),
        token
          ? fetch("/api/payments/mine", { headers: { Authorization: "Bearer " + token } })
              .then((r) => (r.headers.get("content-type") || "").includes("json") ? r.json() : null)
              .catch(() => null)
          : Promise.resolve(null),
      ]);

      setPlanActual(mi?.data || null);
      setCatalogo(planes?.data || []);
      setAjustes(cfg?.data || null);
      setMetodos(mets?.data || []);
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
  const esGratuito = codigoActual === "free";
  const miPlan = catalogo.find((p) => p.code === codigoActual);
  const mejorables = catalogo.filter((p) => p.code !== codigoActual && p.price_cents > 0);
  const pendiente = solicitudes.find((s) => s.estado === "pending");
  const ultima = solicitudes[0];

  // El interruptor general manda: si el equipo cerró los pagos manuales, no
  // se ofrece nada aunque el catálogo tenga planes de pago.
  const pagosAbiertos = ajustes?.manual_payments_enabled !== false;
  const sePuedeMejorar = pagosAbiertos && mejorables.length > 0 && !pendiente;

  return (
    <div className="plansec">
      {/* ------------------------------------------------------- PLAN ACTUAL */}
      <div className="acc__planhead">
        <div>
          <span className="sv-label">Plan actual</span>
          <h3>{planActual?.plan_name || "Gratuito"}</h3>
        </div>
        <Badge tone={esGratuito ? "neutral" : "success"}>
          {esGratuito ? "Sin costo" : "Activo"}
        </Badge>
      </div>

      <div className="plansec__resumen">
        <div>
          <span className="sv-label">Creaciones con IA</span>
          <strong>{planActual?.limit ?? miPlan?.ai_weekly_limit ?? 5} por semana</strong>
        </div>
        {!esGratuito && miPlan && (
          <div>
            <span className="sv-label">Precio</span>
            <strong>
              {soles(miPlan.price_cents, miPlan.currency)}{" "}
              <small>{periodo(miPlan.billing_period_months)}</small>
            </strong>
          </div>
        )}
        {planActual?.ends_at && (
          <div>
            <span className="sv-label">Vence</span>
            <strong>{fecha(planActual.ends_at)}</strong>
          </div>
        )}
      </div>

      {/* Única fuente del uso real de la semana: la API de créditos. */}
      <CreditsIndicator />

      {/* --------------------------------------------------- SOLICITUD ABIERTA */}
      {pendiente && (
        <Alert tone="info" icon={Clock} title="Solicitud enviada">
          Estamos verificando tu pago del plan <strong>{pendiente.plan_nombre}</strong>{" "}
          ({soles(pendiente.monto_centimos, pendiente.moneda)}). Te avisaremos
          cuando tu plan esté activo.
        </Alert>
      )}

      {/* La última rechazada merece una explicación, sin enseñar notas internas. */}
      {!pendiente && ultima?.estado === "rejected" && (
        <Alert tone="warning" icon={XCircle} title="Tu última solicitud no se pudo verificar">
          Puedes volver a enviarla comprobando que el número de operación sea el
          correcto. Si crees que hay un error, escríbenos.
        </Alert>
      )}

      {/* ------------------------------------------------------- MEJORAR PLAN */}
      {sePuedeMejorar && (
        <section className="plansec__mejorar">
          <h4>{esGratuito ? "Mejorar plan" : "Cambiar de plan"}</h4>
          <div className="acc__plans">
            {mejorables.map((p) => (
              <article key={p.code}>
                <h4>{p.name}</h4>
                <p className="acc__planprice">
                  <small>{p.currency === "PEN" ? "S/" : p.currency}</small>
                  {(p.price_cents / 100).toFixed(0)}
                  <span>{periodo(p.billing_period_months)}</span>
                </p>
                <ul>
                  <li><Check size={13} aria-hidden="true" /> {p.ai_weekly_limit} creaciones por semana</li>
                  {(p.benefits || []).map((b, i) => (
                    <li key={i}><Check size={13} aria-hidden="true" /> {b}</li>
                  ))}
                  {(!p.benefits || p.benefits.length === 0) && p.description && (
                    <li><Check size={13} aria-hidden="true" /> {p.description}</li>
                  )}
                </ul>
                <Button variant="primary" size="sm" fullWidth icon={Sparkles}
                        onClick={() => setEligiendo(p)}>
                  Mejorar a {p.name}
                </Button>
              </article>
            ))}
          </div>
        </section>
      )}

      {!pagosAbiertos && esGratuito && (
        <Alert tone="info" icon={Info} title="Los planes de pago están en pausa">
          Volvemos a abrirlos pronto. Mientras tanto, sigues con el plan gratuito.
        </Alert>
      )}

      {pagosAbiertos && mejorables.length === 0 && !pendiente && esGratuito && (
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
          metodos={metodos}
          onCerrar={() => setEligiendo(null)}
          onHecho={() => { setEligiendo(null); cargar(); }}
        />
      )}
    </div>
  );
}

/* ==========================================================================
   FLUJO DE PAGO

   Elegir método → ver a quién y a qué número → copiar → escanear el QR →
   leer las instrucciones → anotar la operación → enviar.

   Si el equipo todavía no ha configurado el método de pago, se dice
   claramente en vez de enseñar un número inventado: un dato de pago falso es
   peor que no tener ninguno.
   ========================================================================== */

function ModalSolicitud({ plan, ajustes, metodos, onCerrar, onHecho }) {
  const { toast } = useUI();
  const disponibles = metodos || [];
  const [metodo, setMetodo] = useState(disponibles[0]?.code || "yape");
  const [referencia, setReferencia] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [copiado, setCopiado] = useState(false);

  const elegido = disponibles.find((m) => m.code === metodo) || null;
  const configurado = Boolean(ajustes?.is_configured) && disponibles.length > 0;
  const qr = useQrUrl(elegido?.qr_path);

  async function copiarNumero() {
    if (!elegido?.account_number) return;
    try {
      await navigator.clipboard.writeText(elegido.account_number);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Sin portapapeles (contexto no seguro o permiso denegado): el número
      // sigue en pantalla para copiarlo a mano, así que no se avisa de nada.
    }
  }

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
        description: "Estamos verificando tu pago. Te avisaremos cuando tu plan esté activo.",
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
      description={`${soles(plan.price_cents, plan.currency)} ${periodo(plan.billing_period_months)} · ${plan.ai_weekly_limit} creaciones por semana`}
      icon={CreditCard}
      actions={
        <>
          <Button variant="ghost" onClick={onCerrar} disabled={enviando}>Cancelar</Button>
          {/* `loading` ya lo deshabilita: el doble clic no llega a salir. */}
          <Button variant="primary" loading={enviando} onClick={solicitar}>
            Enviar solicitud
          </Button>
        </>
      }
    >
      <div className="plansec__form">
        {!configurado ? (
          <Alert tone="warning" icon={Info} title="Método de pago aún no configurado">
            Puedes enviar tu solicitud igualmente: nos pondremos en contacto
            contigo para indicarte cómo completar el pago.
          </Alert>
        ) : (
          <>
            {/* ---- 1 · elegir método ---- */}
            <fieldset className="plansec__metodos">
              <legend>Paga con</legend>
              {disponibles.map((m) => (
                <label key={m.code} className={"plansec__metodo" + (metodo === m.code ? " is-active" : "")}>
                  <input type="radio" name="metodo-pago" value={m.code}
                         checked={metodo === m.code}
                         onChange={() => { setMetodo(m.code); setCopiado(false); }} />
                  <span>{m.label}</span>
                </label>
              ))}
            </fieldset>

            {/* ---- 2, 3 y 4 · receptor, número y copiar ---- */}
            {elegido && (
              <div className="plansec__datos">
                <div>
                  <span className="sv-label">A nombre de</span>
                  <strong>{elegido.receiver_name}</strong>
                </div>
                <div>
                  <span className="sv-label">Número</span>
                  <strong className="plansec__numero">{elegido.account_number}</strong>
                </div>
                <Button variant="outline" size="sm" icon={copiado ? Check : Copy}
                        onClick={copiarNumero}>
                  {copiado ? "Copiado" : "Copiar número"}
                </Button>
              </div>
            )}

            {/* ---- 5 · QR ---- */}
            {elegido?.qr_path && (
              <div className="plansec__qr">
                {qr ? (
                  <img src={qr} alt={`Código QR para pagar con ${elegido.label}`} />
                ) : (
                  <Skeleton w={160} h={160} radius="var(--radius-md)" />
                )}
                <small><QrCode size={12} aria-hidden="true" /> Escanéalo desde tu app de {elegido.label}.</small>
              </div>
            )}

            {/* ---- 6 · instrucciones ---- */}
            <div className="plansec__instrucciones">
              <h5>Cómo pagar</h5>
              <p>{ajustes.instructions}</p>
              {elegido?.instructions && <p>{elegido.instructions}</p>}
              {ajustes.whatsapp && (
                <p>
                  <MessageCircle size={13} aria-hidden="true" />{" "}
                  <strong>Coordinación por WhatsApp:</strong> {ajustes.whatsapp}
                </p>
              )}
            </div>
          </>
        )}

        {/* ---- 7 · referencia ---- */}
        <label>Número de operación <small>(opcional, si ya pagaste)</small>
          <input value={referencia} maxLength={80} placeholder="Ej.: 00123456"
                 onChange={(e) => setReferencia(e.target.value)} />
          <small>Nos ayuda a encontrar tu pago más rápido.</small>
        </label>

        {error && <p className="plansec__error" role="alert">{error}</p>}
      </div>
    </Modal>
  );
}

/**
 * Firma una URL temporal del QR.
 *
 * El bucket es privado: la lectura se autoriza con la sesión de la propia
 * docente, no con una URL pública que cualquiera pudiera enlazar.
 */
function useQrUrl(path) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    let vivo = true;
    setUrl(null);
    if (!path || !supabase) return undefined;

    supabase.storage.from(BUCKET).createSignedUrl(path, 600)
      .then(({ data }) => { if (vivo) setUrl(data?.signedUrl || null); })
      .catch(() => { if (vivo) setUrl(null); });

    return () => { vivo = false; };
  }, [path]);

  return url;
}

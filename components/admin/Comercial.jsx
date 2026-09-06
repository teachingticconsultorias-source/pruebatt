// components/admin/Comercial.jsx
//
// Administración → Planes  ·  Administración → Configuración de pagos
//
// El objetivo del bloque es que el precio, el límite de IA y los datos de
// pago se cambien desde aquí y no entrando a Supabase. Por eso todo lo que
// se ve en pantalla viene de `/api/admin/commerce`: no hay ni un precio, ni
// un número, ni un nombre de receptor escrito en este fichero.
//
// `support` ve estas pantallas en modo lectura. Los botones desaparecen,
// pero eso es comodidad, no seguridad: quien decide es el backend, y la RPC
// lo vuelve a comprobar contra `admin_users`.

import React, { useEffect, useRef, useState } from "react";
import {
  Tags, Settings, Pencil, RefreshCw, QrCode, Upload, Trash2, Check,
  Info, Users, Wallet, MessageCircle, EyeOff,
} from "lucide-react";

import { supabase } from "../../supabaseClient.js";
import Button from "../ui/Button.jsx";
import Modal from "../ui/Modal.jsx";
import { Badge, Alert, EmptyState, Skeleton } from "../ui/Feedback.jsx";
import { useUI } from "../ui/UIProvider.jsx";
import { fecha, soles, enviar, useCarga, Dato, CargandoTabla, ErrorEstado } from "./shared.jsx";

const RUTA = "/api/admin/commerce";
const BUCKET = "payment-assets";
const MAX_QR_BYTES = 2 * 1024 * 1024;
const TIPOS_QR = ["image/png", "image/jpeg", "image/webp"];

/* ==========================================================================
   PLANES
   ========================================================================== */

export function Planes({ token, onRole, onDenegado }) {
  const { data, error, cargando, recargar } = useCarga(RUTA, token, onDenegado);
  const [editando, setEditando] = useState(null);

  useEffect(() => { if (data?.role) onRole?.(data.role); }, [data, onRole]);

  if (cargando) return <CargandoTabla />;
  if (error) return <ErrorEstado mensaje={error} onReintentar={recargar} />;

  const planes = data?.plans || [];
  const puedeEditar = Boolean(data?.puedeEditar);

  return (
    <>
      <header className="adm__head">
        <div>
          <p className="adm__eyebrow">Planes</p>
          <h1>Qué se ofrece y a qué precio</h1>
          <p className="adm__sub">
            Lo que cambies aquí lo ve la docente en su próxima visita. No hace
            falta desplegar nada.
          </p>
        </div>
        <Button variant="ghost" size="sm" icon={RefreshCw} onClick={recargar}>Actualizar</Button>
      </header>

      {!puedeEditar && (
        <Alert tone="info" icon={Info} title="Estás viendo la configuración">
          Tu rol permite consultarla. Cambiar precios y límites es cosa de
          administración.
        </Alert>
      )}

      {planes.length === 0 ? (
        <EmptyState title="No hay planes en el catálogo"
                    description="Algo va mal: debería existir al menos el plan gratuito." />
      ) : (
        <section className="adm__planes">
          {planes.map((p) => (
            <article key={p.code} className={"adm__plan" + (p.is_active ? "" : " is-off")}>
              <header>
                <div>
                  <h2>{p.name}</h2>
                  <code>{p.code}</code>
                </div>
                <Badge tone={p.is_active ? "success" : "neutral"}>
                  {p.is_active ? "Activo" : "Oculto"}
                </Badge>
              </header>

              <p className="adm__planprecio">
                <strong>{soles(p.price_cents, p.currency)}</strong>
                <span>
                  {p.price_cents === 0
                    ? "sin costo"
                    : p.months === 1 ? "al mes" : `cada ${p.months} meses`}
                </span>
              </p>

              <p className="adm__planlimite">
                <Wallet size={14} aria-hidden="true" />
                {p.ai_limit} creaciones con IA por semana
              </p>

              {p.description && <p className="adm__muted">{p.description}</p>}

              {Array.isArray(p.benefits) && p.benefits.length > 0 && (
                <ul className="adm__planbenef">
                  {p.benefits.map((b, i) => (
                    <li key={i}><Check size={13} aria-hidden="true" /> {b}</li>
                  ))}
                </ul>
              )}

              <footer>
                <span className="adm__planmeta">
                  <Users size={13} aria-hidden="true" />
                  {p.suscritos} {p.suscritos === 1 ? "docente" : "docentes"}
                  {" · "}orden {p.sort_order}
                </span>
                {puedeEditar && (
                  <Button variant="outline" size="sm" icon={Pencil}
                          onClick={() => setEditando(p)}>
                    Editar
                  </Button>
                )}
              </footer>
            </article>
          ))}
        </section>
      )}

      {editando && (
        <ModalPlan
          plan={editando}
          token={token}
          onCerrar={() => setEditando(null)}
          onHecho={() => { setEditando(null); recargar(); }}
        />
      )}
    </>
  );
}

/* ------------------------------------------------------------------------ */

function ModalPlan({ plan, token, onCerrar, onHecho }) {
  const { toast } = useUI();
  const [f, setF] = useState({
    name: plan.name || "",
    description: plan.description || "",
    benefits: (plan.benefits || []).join("\n"),
    // Se edita en soles, se envía en céntimos: nadie debería teclear "2000"
    // para decir veinte soles.
    precio: (Number(plan.price_cents || 0) / 100).toFixed(2),
    currency: plan.currency || "PEN",
    months: plan.months ?? "",
    ai: String(plan.ai_limit ?? 0),
    is_active: Boolean(plan.is_active),
    sort_order: String(plan.sort_order ?? 0),
  });
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  const esFree = plan.code === "free";
  const set = (k) => (e) => setF((v) => ({
    ...v, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value,
  }));

  const precioCentimos = Math.round(Number(String(f.precio).replace(",", ".")) * 100);
  const valido = f.name.trim() !== "" && Number.isFinite(precioCentimos) && precioCentimos >= 0;

  // Cambiar el límite afecta a quien ya está dentro; conviene decirlo.
  const cambiaLimite = Number(f.ai) !== Number(plan.ai_limit);
  const cambiaPrecio = precioCentimos !== Number(plan.price_cents);

  async function guardar() {
    setEnviando(true);
    setError("");
    try {
      const r = await enviar("/api/admin/commerce-actions", {
        action: "update_plan",
        code: plan.code,
        reason: motivo.trim() || null,
        patch: {
          name: f.name.trim(),
          description: f.description.trim(),
          benefits: f.benefits.split("\n").map((x) => x.trim()).filter(Boolean),
          price_cents: precioCentimos,
          currency: f.currency,
          billing_period_months: String(f.months).trim() === "" ? null : Number(f.months),
          ai_weekly_limit: Number(f.ai),
          is_active: f.is_active,
          sort_order: Number(f.sort_order),
        },
      }, token);

      toast({
        tone: "success",
        title: r?.sin_cambios ? "No había nada que cambiar." : "Plan actualizado.",
        description: r?.sin_cambios ? undefined : "Las docentes lo verán al recargar.",
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
      title={`Editar plan ${plan.name}`}
      description="El código no se toca: es la clave por la que apuntan las suscripciones y las solicitudes ya existentes."
      icon={Tags}
      size="lg"
      actions={
        <>
          <Button variant="ghost" onClick={onCerrar} disabled={enviando}>Cancelar</Button>
          <Button variant="primary" loading={enviando} disabled={!valido} onClick={guardar}>
            Guardar cambios
          </Button>
        </>
      }
    >
      <div className="adm__form">
        <div className="adm__grid2">
          <label>Nombre comercial
            <input value={f.name} maxLength={60} onChange={set("name")} />
          </label>
          <label>Código <small>(no se puede cambiar)</small>
            <input value={plan.code} readOnly disabled />
          </label>
        </div>

        <div className="adm__grid3">
          <label>Precio
            <input type="number" min="0" step="0.10" value={f.precio}
                   disabled={esFree} onChange={set("precio")} />
            <small>{esFree ? "El gratuito no puede tener precio." : soles(precioCentimos, f.currency)}</small>
          </label>
          <label>Moneda
            <select value={f.currency} disabled={esFree} onChange={set("currency")}>
              <option value="PEN">PEN · soles</option>
              <option value="USD">USD · dólares</option>
            </select>
          </label>
          <label>Duración
            <input type="number" min="1" max="36" value={f.months}
                   placeholder="Vacío = sin vencimiento" onChange={set("months")} />
            <small>en meses</small>
          </label>
        </div>

        <div className="adm__grid2">
          <label>Creaciones con IA por semana
            <input type="number" min="0" max="10000" value={f.ai} onChange={set("ai")} />
            <small>Es el límite que aplica el servidor, no un texto.</small>
          </label>
          <label>Orden de visualización
            <input type="number" min="0" max="999" value={f.sort_order} onChange={set("sort_order")} />
            <small>Menor primero.</small>
          </label>
        </div>

        <label>Descripción corta
          <textarea value={f.description} maxLength={240} rows={2} onChange={set("description")} />
        </label>

        <label>Beneficios <small>(uno por línea, máximo 8)</small>
          <textarea value={f.benefits} rows={4} onChange={set("benefits")}
                    placeholder={"100 creaciones con IA por semana\nExportación a Word"} />
        </label>

        <label className="adm__check">
          <input type="checkbox" checked={f.is_active} disabled={esFree}
                 onChange={set("is_active")} />
          <span>
            Visible para las docentes
            <small>
              {esFree
                ? "El gratuito no se puede ocultar: es al que vuelve todo el mundo si algo falla."
                : "Si lo ocultas, deja de poder solicitarse."}
            </small>
          </span>
        </label>

        {cambiaLimite && plan.suscritos > 0 && (
          <Alert tone="warning" icon={Info} title="Afecta a quien ya está dentro">
            {plan.suscritos} {plan.suscritos === 1 ? "docente pasa" : "docentes pasan"} de{" "}
            {plan.ai_limit} a {f.ai} creaciones por semana en cuanto guardes.
          </Alert>
        )}

        {cambiaPrecio && (
          <Alert tone="info" icon={Info} title="Las solicitudes ya enviadas no cambian">
            Cada solicitud guardó el importe del día en que se hizo. El precio
            nuevo se aplica a partir de ahora.
          </Alert>
        )}

        <label>Motivo <small>(queda en la auditoría)</small>
          <textarea value={motivo} maxLength={300} rows={2}
                    placeholder="Ej.: ajuste de precio acordado en reunión del 5 de setiembre"
                    onChange={(e) => setMotivo(e.target.value)} />
        </label>

        {error && <p className="adm__error" role="alert">{error}</p>}
      </div>
    </Modal>
  );
}

/* ==========================================================================
   CONFIGURACIÓN DE PAGOS
   ========================================================================== */

export function ConfiguracionPagos({ token, onRole, onDenegado }) {
  const { data, error, cargando, recargar } = useCarga(RUTA, token, onDenegado);
  const [editandoMetodo, setEditandoMetodo] = useState(null);
  const [editandoGeneral, setEditandoGeneral] = useState(false);

  useEffect(() => { if (data?.role) onRole?.(data.role); }, [data, onRole]);

  if (cargando) return <CargandoTabla />;
  if (error) return <ErrorEstado mensaje={error} onReintentar={recargar} />;

  const s = data?.settings || {};
  const metodos = data?.methods || [];
  const puedeEditar = Boolean(data?.puedeEditar);
  const habilitados = metodos.filter((m) => m.is_enabled);

  return (
    <>
      <header className="adm__head">
        <div>
          <p className="adm__eyebrow">Configuración de pagos</p>
          <h1>Cómo paga una docente</h1>
          <p className="adm__sub">
            Esto es exactamente lo que ve al pulsar «Solicitar plan».
          </p>
        </div>
        <Button variant="ghost" size="sm" icon={RefreshCw} onClick={recargar}>Actualizar</Button>
      </header>

      {!puedeEditar && (
        <Alert tone="info" icon={Info} title="Estás viendo la configuración">
          Tu rol permite consultarla, no cambiarla.
        </Alert>
      )}

      {!s.manual_payments_enabled && (
        <Alert tone="warning" icon={EyeOff} title="Los pagos manuales están apagados">
          Ninguna docente puede solicitar un plan ahora mismo. La configuración
          se conserva intacta.
        </Alert>
      )}

      {s.manual_payments_enabled && habilitados.length === 0 && (
        <Alert tone="warning" icon={Info} title="No hay ningún método habilitado">
          Con los pagos abiertos pero sin métodos, la docente no sabría dónde
          pagar. Habilita al menos uno.
        </Alert>
      )}

      {/* ------------------------------------------------------------ GENERAL */}
      <section className="adm__block">
        <div className="adm__blockhead">
          <h2><Settings size={17} aria-hidden="true" /> Ajustes generales</h2>
          {puedeEditar && (
            <Button variant="outline" size="sm" icon={Pencil}
                    onClick={() => setEditandoGeneral(true)}>
              Editar
            </Button>
          )}
        </div>

        <div className="adm__pagodatos">
          <Dato etiqueta="Pagos manuales"
                valor={s.manual_payments_enabled ? "Habilitados" : "Apagados"} />
          <Dato etiqueta="Estado de la configuración"
                valor={s.is_configured ? "Configurada" : "Sin configurar"} />
          <Dato etiqueta="WhatsApp de coordinación"
                valor={s.whatsapp || "Sin definir todavía"} />
          <Dato etiqueta="Última actualización" valor={fecha(s.updated_at, true)} />
        </div>

        <div className="adm__instrucciones">
          <span className="sv-label">Lo que lee la docente</span>
          <p>{s.instructions || "Todavía no hay instrucciones escritas."}</p>
        </div>
      </section>

      {/* ------------------------------------------------------------ MÉTODOS */}
      <section className="adm__block">
        <div className="adm__blockhead">
          <h2><Wallet size={17} aria-hidden="true" /> Métodos de pago</h2>
        </div>

        <div className="adm__metodos">
          {metodos.map((m) => (
            <MetodoTarjeta
              key={m.code}
              metodo={m}
              token={token}
              puedeEditar={puedeEditar}
              onEditar={() => setEditandoMetodo(m)}
              onCambio={recargar}
            />
          ))}
        </div>
      </section>

      {editandoGeneral && (
        <ModalAjustes
          ajustes={s}
          token={token}
          onCerrar={() => setEditandoGeneral(false)}
          onHecho={() => { setEditandoGeneral(false); recargar(); }}
        />
      )}

      {editandoMetodo && (
        <ModalMetodo
          metodo={editandoMetodo}
          token={token}
          onCerrar={() => setEditandoMetodo(null)}
          onHecho={() => { setEditandoMetodo(null); recargar(); }}
        />
      )}
    </>
  );
}

/* ------------------------------------------------------------------------ */

function MetodoTarjeta({ metodo, token, puedeEditar, onEditar, onCambio }) {
  const url = useQrUrl(metodo.qr_path);

  return (
    <article className={"adm__metodo" + (metodo.is_enabled ? "" : " is-off")}>
      <header>
        <div>
          <h3>{metodo.label}</h3>
          <code>{metodo.code}</code>
        </div>
        <Badge tone={metodo.is_enabled ? "success" : "neutral"}>
          {metodo.is_enabled ? "Habilitado" : "Deshabilitado"}
        </Badge>
      </header>

      <div className="adm__metododatos">
        <Dato etiqueta="Receptor" valor={metodo.receiver_name} />
        <Dato etiqueta="Número" valor={metodo.account_number} />
      </div>

      {metodo.instructions && <p className="adm__muted">{metodo.instructions}</p>}

      <div className="adm__qr">
        {url ? (
          <img src={url} alt={`Código QR de ${metodo.label}`} />
        ) : metodo.qr_path ? (
          <Skeleton w={132} h={132} radius="var(--radius-md)" />
        ) : (
          <div className="adm__qrvacio">
            <QrCode size={26} aria-hidden="true" />
            <span>Sin QR</span>
          </div>
        )}
        <div className="adm__qrmeta">
          <small>
            {metodo.qr_path
              ? `Actualizado ${fecha(metodo.qr_updated_at, true)}`
              : "La docente verá el número, pero no un código para escanear."}
          </small>
          {puedeEditar && (
            <SubirQR metodo={metodo} token={token} onCambio={onCambio} />
          )}
        </div>
      </div>

      {puedeEditar && (
        <footer>
          <Button variant="outline" size="sm" icon={Pencil} onClick={onEditar}>
            Editar datos
          </Button>
        </footer>
      )}
    </article>
  );
}

/**
 * Firma una URL temporal del QR.
 *
 * El bucket es privado: no hay URL pública que pegar. Se firma con la sesión
 * de quien mira, que es exactamente el permiso que debe tener.
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

/* ------------------------------------------------------------------------ */

function SubirQR({ metodo, token, onCambio }) {
  const { toast } = useUI();
  const input = useRef(null);
  const [subiendo, setSubiendo] = useState(false);

  async function elegido(e) {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite volver a elegir el mismo fichero
    if (!file) return;

    // Comprobación local para dar respuesta inmediata. La de verdad es la del
    // servidor, que mira los bytes y no se fía de este `file.type`.
    if (!TIPOS_QR.includes(file.type)) {
      toast({ tone: "danger", title: "Formato no admitido",
              description: "El QR debe ser PNG, JPG o WEBP." });
      return;
    }
    if (file.size > MAX_QR_BYTES) {
      toast({ tone: "danger", title: "Imagen demasiado pesada",
              description: "El máximo son 2 MB." });
      return;
    }

    setSubiendo(true);
    try {
      const data = await new Promise((ok, fail) => {
        const fr = new FileReader();
        fr.onload = () => ok(String(fr.result));
        fr.onerror = () => fail(new Error("No pudimos leer el archivo."));
        fr.readAsDataURL(file);
      });

      await enviar("/api/admin/payment-qr", { method: metodo.code, data }, token);
      toast({ tone: "success", title: "QR actualizado.",
              description: `Ya se muestra en ${metodo.label}.` });
      onCambio();
    } catch (err) {
      toast({ tone: "danger", title: "No pudimos subir el QR", description: err.message });
    } finally {
      setSubiendo(false);
    }
  }

  async function quitar() {
    setSubiendo(true);
    try {
      await enviar("/api/admin/payment-qr", { method: metodo.code, remove: true }, token);
      toast({ tone: "success", title: "QR retirado." });
      onCambio();
    } catch (err) {
      toast({ tone: "danger", title: "No pudimos retirarlo", description: err.message });
    } finally {
      setSubiendo(false);
    }
  }

  return (
    <div className="adm__qracciones">
      <input ref={input} type="file" accept={TIPOS_QR.join(",")} hidden onChange={elegido} />
      <Button variant="secondary" size="sm" icon={Upload} loading={subiendo}
              onClick={() => input.current?.click()}>
        {metodo.qr_path ? "Reemplazar" : "Cargar QR"}
      </Button>
      {metodo.qr_path && (
        <Button variant="ghost" size="sm" icon={Trash2} disabled={subiendo} onClick={quitar}>
          Quitar
        </Button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------ */

function ModalAjustes({ ajustes, token, onCerrar, onHecho }) {
  const { toast } = useUI();
  const [f, setF] = useState({
    instructions: ajustes.instructions || "",
    whatsapp: ajustes.whatsapp || "",
    manual_payments_enabled: Boolean(ajustes.manual_payments_enabled),
    is_configured: Boolean(ajustes.is_configured),
  });
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  const set = (k) => (e) => setF((v) => ({
    ...v, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value,
  }));

  const apagando = ajustes.manual_payments_enabled && !f.manual_payments_enabled;

  async function guardar() {
    setEnviando(true);
    setError("");
    try {
      const r = await enviar("/api/admin/commerce-actions", {
        action: "update_settings",
        reason: motivo.trim() || null,
        patch: {
          instructions: f.instructions.trim(),
          whatsapp: f.whatsapp.trim(),
          manual_payments_enabled: f.manual_payments_enabled,
          is_configured: f.is_configured,
        },
      }, token);

      toast({ tone: "success",
              title: r?.sin_cambios ? "No había nada que cambiar." : "Configuración guardada." });
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
      title="Ajustes generales de pago"
      description="Lo común a todos los métodos. Lo particular de Yape o Plin se edita en su tarjeta."
      icon={Settings}
      variant={apagando ? "warning" : "default"}
      actions={
        <>
          <Button variant="ghost" onClick={onCerrar} disabled={enviando}>Cancelar</Button>
          <Button variant={apagando ? "danger" : "primary"} loading={enviando} onClick={guardar}>
            Guardar
          </Button>
        </>
      }
    >
      <div className="adm__form">
        <label>Instrucciones para la docente
          <textarea value={f.instructions} maxLength={600} rows={3} onChange={set("instructions")}
                    placeholder="Qué tiene que hacer, paso a paso." />
          <small>Se muestra tal cual en el flujo de pago.</small>
        </label>

        <label>WhatsApp de coordinación <small>(opcional)</small>
          <input value={f.whatsapp} maxLength={24} onChange={set("whatsapp")}
                 placeholder="Déjalo vacío si todavía no hay uno oficial" />
          <small>
            <MessageCircle size={12} aria-hidden="true" />{" "}
            Si está vacío, la aplicación simplemente no menciona WhatsApp.
          </small>
        </label>

        <label className="adm__check">
          <input type="checkbox" checked={f.manual_payments_enabled}
                 onChange={set("manual_payments_enabled")} />
          <span>
            Aceptar pagos manuales
            <small>Si lo apagas, nadie puede solicitar un plan. No se borra nada.</small>
          </span>
        </label>

        <label className="adm__check">
          <input type="checkbox" checked={f.is_configured} onChange={set("is_configured")} />
          <span>
            La configuración está lista
            <small>
              Mientras esté desmarcada, la docente ve un aviso en vez de datos
              de pago. Es preferible eso a enseñar un número equivocado.
            </small>
          </span>
        </label>

        {apagando && (
          <Alert tone="warning" icon={EyeOff} title="Vas a cerrar la venta">
            Las solicitudes que ya estén pendientes siguen ahí y se pueden
            aprobar. Sólo se impide crear nuevas.
          </Alert>
        )}

        <label>Motivo <small>(queda en la auditoría)</small>
          <textarea value={motivo} maxLength={300} rows={2} onChange={(e) => setMotivo(e.target.value)} />
        </label>

        {error && <p className="adm__error" role="alert">{error}</p>}
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------------ */

function ModalMetodo({ metodo, token, onCerrar, onHecho }) {
  const { toast } = useUI();
  const [f, setF] = useState({
    label: metodo.label || "",
    receiver_name: metodo.receiver_name || "",
    account_number: metodo.account_number || "",
    instructions: metodo.instructions || "",
    is_enabled: Boolean(metodo.is_enabled),
    sort_order: String(metodo.sort_order ?? 0),
  });
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  const set = (k) => (e) => setF((v) => ({
    ...v, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value,
  }));

  const completo = f.receiver_name.trim() !== "" && f.account_number.trim() !== "";
  const valido = f.label.trim() !== "" && (!f.is_enabled || completo);

  async function guardar() {
    setEnviando(true);
    setError("");
    try {
      const r = await enviar("/api/admin/commerce-actions", {
        action: "update_method",
        code: metodo.code,
        reason: motivo.trim() || null,
        patch: {
          label: f.label.trim(),
          receiver_name: f.receiver_name.trim(),
          account_number: f.account_number.trim(),
          instructions: f.instructions.trim(),
          is_enabled: f.is_enabled,
          sort_order: Number(f.sort_order),
        },
      }, token);

      toast({ tone: "success",
              title: r?.sin_cambios ? "No había nada que cambiar." : `${f.label} actualizado.` });
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
      title={`Editar ${metodo.label}`}
      description="Cada método guarda su propio receptor y su propio número. Hoy pueden coincidir; mañana no tienen por qué."
      icon={Wallet}
      actions={
        <>
          <Button variant="ghost" onClick={onCerrar} disabled={enviando}>Cancelar</Button>
          <Button variant="primary" loading={enviando} disabled={!valido} onClick={guardar}>
            Guardar
          </Button>
        </>
      }
    >
      <div className="adm__form">
        <div className="adm__grid2">
          <label>Nombre visible
            <input value={f.label} maxLength={40} onChange={set("label")} />
          </label>
          <label>Orden
            <input type="number" min="0" max="999" value={f.sort_order} onChange={set("sort_order")} />
          </label>
        </div>

        <div className="adm__grid2">
          <label>Nombre del receptor
            <input value={f.receiver_name} maxLength={80} onChange={set("receiver_name")}
                   placeholder="A nombre de quién llega el pago" />
          </label>
          <label>Número
            <input value={f.account_number} maxLength={40} onChange={set("account_number")}
                   placeholder="Solo dígitos, espacios o guiones" />
          </label>
        </div>

        <label>Nota propia de este método <small>(opcional)</small>
          <textarea value={f.instructions} maxLength={400} rows={2} onChange={set("instructions")}
                    placeholder="Se muestra debajo de las instrucciones generales." />
        </label>

        <label className="adm__check">
          <input type="checkbox" checked={f.is_enabled} onChange={set("is_enabled")} />
          <span>
            Ofrecer este método
            <small>Hace falta receptor y número para poder habilitarlo.</small>
          </span>
        </label>

        {f.is_enabled && !completo && (
          <Alert tone="warning" icon={Info} title="Faltan datos">
            Sin receptor ni número, la docente no sabría a dónde pagar.
          </Alert>
        )}

        <label>Motivo <small>(queda en la auditoría)</small>
          <textarea value={motivo} maxLength={300} rows={2} onChange={(e) => setMotivo(e.target.value)} />
        </label>

        {error && <p className="adm__error" role="alert">{error}</p>}
      </div>
    </Modal>
  );
}

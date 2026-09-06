import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard, Users, Search, ChevronLeft, ChevronRight, ArrowLeft,
  ShieldCheck, ShieldAlert, LogOut, RefreshCw, Mail, MailCheck, Clock,
  GraduationCap, Sparkles, FolderOpen, AlertCircle, Ban, CheckCircle2,
  CalendarPlus, ArrowRightLeft, History, Receipt, ThumbsUp, ThumbsDown,
} from "lucide-react";

import { supabase } from "../../supabaseClient.js";
import Button from "../ui/Button.jsx";
import { Skeleton, EmptyState, Badge, Alert } from "../ui/Feedback.jsx";
import Modal from "../ui/Modal.jsx";
import { useUI } from "../ui/UIProvider.jsx";

/* ==========================================================================
   PANEL ADMINISTRATIVO · SOLO LECTURA

   La autorización NO vive aquí. Este componente sólo decide qué enseñar;
   quien decide qué se puede ver es el backend, contra `admin_users`. Si
   alguien abre esta pantalla sin ser administrador, las peticiones devuelven
   403 y se muestra la pantalla de acceso denegado.

   No hay ADMIN_SECRET, ni claves en la URL: se entra con la sesión normal.
   ========================================================================== */

const PAGE_SIZE = 25;

function fecha(valor, conHora = false) {
  if (!valor) return "—";
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-PE", {
    day: "2-digit", month: "short", year: "numeric",
    ...(conHora ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

function desde(valor) {
  if (!valor) return "Nunca";
  const dias = Math.floor((Date.now() - new Date(valor).getTime()) / 86_400_000);
  if (Number.isNaN(dias)) return "—";
  if (dias === 0) return "Hoy";
  if (dias === 1) return "Ayer";
  if (dias < 30) return `Hace ${dias} días`;
  if (dias < 365) return `Hace ${Math.floor(dias / 30)} meses`;
  return `Hace ${Math.floor(dias / 365)} años`;
}

/** Llamada autenticada. Nunca deja escapar el detalle técnico. */
async function pedir(ruta, token) {
  const res = await fetch(ruta, { headers: { Authorization: `Bearer ${token}` } });

  if (res.status === 401) throw Object.assign(new Error("Tu sesión venció. Vuelve a entrar."), { code: "AUTH" });
  if (res.status === 403) throw Object.assign(new Error("Esta sección es solo para el equipo de SciVerse."), { code: "FORBIDDEN" });

  const tipo = res.headers.get("content-type") || "";
  if (!tipo.includes("application/json")) {
    throw new Error("El servicio no está disponible en este momento.");
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || "No pudimos cargar la información.");
  return data;
}

/** Ejecuta una acción administrativa. Devuelve el JSON o lanza con mensaje. */
async function ejecutar(accion, token) {
  const res = await fetch("/api/admin/actions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(accion),
  });

  const tipo = res.headers.get("content-type") || "";
  if (!tipo.includes("application/json")) {
    throw new Error("El servicio no está disponible en este momento.");
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || "No pudimos completar la acción.");
  return data;
}

/* ======================================================================= */

export default function AdminApp() {
  const [session, setSession] = useState(null);
  const [cargandoSesion, setCargandoSesion] = useState(true);
  const [vista, setVista] = useState("resumen");
  const [docenteAbierto, setDocenteAbierto] = useState(null);
  const [role, setRole] = useState(null);
  const [denegado, setDenegado] = useState(false);

  useEffect(() => {
    if (!supabase) { setCargandoSesion(false); return undefined; }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data?.session || null);
      setCargandoSesion(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub?.subscription?.unsubscribe();
  }, []);

  const token = session?.access_token;

  if (cargandoSesion) {
    return <div className="adm adm--center"><Skeleton w={240} h={20} /></div>;
  }

  if (!supabase) {
    return (
      <div className="adm adm--center">
        <Alert tone="danger" title="Panel no disponible">
          El servicio no está configurado en este entorno.
        </Alert>
      </div>
    );
  }

  if (!session) return <PantallaEntrada />;
  if (denegado) return <PantallaDenegado onSalir={() => supabase.auth.signOut()} />;

  return (
    <div className="adm">
      <aside className="adm__side">
        <div className="adm__brand">
          <img src="/brand/isotipo.svg" alt="" width="30" height="30" />
          <span><strong>SciVerse</strong><small>Administración</small></span>
        </div>

        <nav className="adm__nav" aria-label="Secciones de administración">
          <button
            type="button"
            className={`adm__link${vista === "resumen" ? " is-active" : ""}`}
            onClick={() => { setVista("resumen"); setDocenteAbierto(null); }}
          >
            <LayoutDashboard size={17} aria-hidden="true" /> Resumen
          </button>
          <button
            type="button"
            className={`adm__link${vista === "docentes" ? " is-active" : ""}`}
            onClick={() => { setVista("docentes"); setDocenteAbierto(null); }}
          >
            <Users size={17} aria-hidden="true" /> Docentes
          </button>
          <button
            type="button"
            className={`adm__link${vista === "pagos" ? " is-active" : ""}`}
            onClick={() => { setVista("pagos"); setDocenteAbierto(null); }}
          >
            <Receipt size={17} aria-hidden="true" /> Pagos
          </button>
        </nav>

        <div className="adm__sidefoot">
          {role && (
            <p className="adm__role">
              <ShieldCheck size={14} aria-hidden="true" /> {role}
            </p>
          )}
          <p className="adm__who">{session.user?.email}</p>
          <Button variant="outline" size="sm" fullWidth icon={LogOut}
                  onClick={() => supabase.auth.signOut()}>
            Cerrar sesión
          </Button>
        </div>
      </aside>

      <main className="adm__main">
        {docenteAbierto ? (
          <DetalleDocente
            userId={docenteAbierto}
            token={token}
            role={role}
            onVolver={() => setDocenteAbierto(null)}
            onDenegado={() => setDenegado(true)}
          />
        ) : vista === "resumen" ? (
          <Resumen token={token} onRole={setRole} onDenegado={() => setDenegado(true)} />
        ) : vista === "pagos" ? (
          <Pagos token={token} role={role} onRole={setRole}
                 onDenegado={() => setDenegado(true)} />
        ) : (
          <ListaDocentes
            token={token}
            onRole={setRole}
            onAbrir={setDocenteAbierto}
            onDenegado={() => setDenegado(true)}
          />
        )}
      </main>
    </div>
  );
}

/* ======================================================================= */

function PantallaEntrada() {
  const [correo, setCorreo] = useState("");
  const [clave, setClave] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function entrar(e) {
    e.preventDefault();
    setEnviando(true);
    setError("");
    const { error: err } = await supabase.auth.signInWithPassword({
      email: correo.trim().toLowerCase(),
      password: clave,
    });
    setEnviando(false);
    if (err) setError("Correo o contraseña incorrectos.");
  }

  return (
    <div className="adm adm--center">
      <form className="adm__login" onSubmit={entrar}>
        <img src="/brand/isotipo.svg" alt="" width="40" height="40" />
        <h1>Administración</h1>
        <p>Entra con tu cuenta de SciVerse.</p>

        <label>Correo
          <input type="email" value={correo} autoComplete="username" required
                 onChange={(e) => setCorreo(e.target.value)} />
        </label>
        <label>Contraseña
          <input type="password" value={clave} autoComplete="current-password" required
                 onChange={(e) => setClave(e.target.value)} />
        </label>

        {error && <p className="adm__error" role="alert">{error}</p>}

        <Button type="submit" variant="primary" fullWidth loading={enviando}>
          Entrar
        </Button>
      </form>
    </div>
  );
}

function PantallaDenegado({ onSalir }) {
  return (
    <div className="adm adm--center">
      <div className="adm__denied">
        <ShieldAlert size={34} aria-hidden="true" />
        <h1>Acceso restringido</h1>
        <p>Esta sección es solo para el equipo de SciVerse. Si crees que es un error, escríbenos.</p>
        <Button variant="outline" icon={LogOut} onClick={onSalir}>Salir</Button>
      </div>
    </div>
  );
}

/* ======================================================================= */

function useCarga(ruta, token, onDenegado) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    if (!token) return;
    setCargando(true);
    setError("");
    try {
      setData(await pedir(ruta, token));
    } catch (e) {
      if (e.code === "FORBIDDEN") onDenegado?.();
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, [ruta, token, onDenegado]);

  useEffect(() => { cargar(); }, [cargar]);
  return { data, error, cargando, recargar: cargar };
}

/* ======================================================================= */

function Resumen({ token, onRole, onDenegado }) {
  const { data, error, cargando, recargar } = useCarga("/api/admin/summary", token, onDenegado);

  useEffect(() => { if (data?.role) onRole?.(data.role); }, [data, onRole]);

  if (cargando) return <CargandoTarjetas />;
  if (error) return <ErrorEstado mensaje={error} onReintentar={recargar} />;

  const s = data?.summary || {};
  const planes = Object.entries(s.por_plan || {});

  const tarjetas = [
    { titulo: "Docentes registrados", valor: s.docentes_total, pie: `${s.nuevos_semana ?? 0} esta semana`, icono: Users },
    { titulo: "Correo confirmado", valor: s.email_confirmados, pie: `${s.email_pendientes ?? 0} pendientes`, icono: MailCheck },
    { titulo: "Cuentas activas", valor: s.docentes_activos, pie: `${s.docentes_inactivos ?? 0} inactivas`, icono: ShieldCheck },
    { titulo: "Generaciones esta semana", valor: s.generaciones_semana, pie: `${s.generaciones_devueltas_semana ?? 0} devueltas`, icono: Sparkles },
    { titulo: "Materiales creados", valor: s.materiales_total, pie: `${s.materiales_semana ?? 0} esta semana`, icono: FolderOpen },
    { titulo: "Con el límite agotado", valor: s.con_limite_agotado, pie: "esta semana", icono: AlertCircle },
  ];

  return (
    <>
      <header className="adm__head">
        <div>
          <p className="adm__eyebrow">Resumen</p>
          <h1>Cómo va SciVerse</h1>
          <p className="adm__sub">Semana del {fecha(s.semana_actual)}</p>
        </div>
        <Button variant="ghost" size="sm" icon={RefreshCw} onClick={recargar}>Actualizar</Button>
      </header>

      <section className="adm__cards">
        {tarjetas.map((t) => {
          const Icono = t.icono;
          return (
            <article key={t.titulo} className="adm__card">
              <span className="adm__cardicon" aria-hidden="true"><Icono size={18} /></span>
              <strong>{t.valor ?? 0}</strong>
              <p>{t.titulo}</p>
              <small>{t.pie}</small>
            </article>
          );
        })}
      </section>

      <section className="adm__block">
        <h2>Distribución por plan</h2>
        {planes.length === 0 ? (
          <p className="adm__muted">Todavía no hay suscripciones registradas.</p>
        ) : (
          <ul className="adm__plans">
            {planes.map(([code, n]) => (
              <li key={code}>
                <Badge tone={code === "free" ? "neutral" : "brand"}>{code}</Badge>
                <strong>{n}</strong>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

/* ======================================================================= */

function ListaDocentes({ token, onRole, onAbrir, onDenegado }) {
  const [pagina, setPagina] = useState(1);
  const [texto, setTexto] = useState("");
  const [busqueda, setBusqueda] = useState("");

  const ruta = useMemo(() => {
    const p = new URLSearchParams({ page: String(pagina), pageSize: String(PAGE_SIZE) });
    if (busqueda) p.set("search", busqueda);
    return `/api/admin/docentes?${p.toString()}`;
  }, [pagina, busqueda]);

  const { data, error, cargando, recargar } = useCarga(ruta, token, onDenegado);

  useEffect(() => { if (data?.role) onRole?.(data.role); }, [data, onRole]);

  function buscar(e) {
    e.preventDefault();
    setPagina(1);
    setBusqueda(texto.trim());
  }

  const items = data?.items || [];
  const total = data?.total ?? 0;
  const paginas = data?.pages ?? 1;

  return (
    <>
      <header className="adm__head">
        <div>
          <p className="adm__eyebrow">Docentes</p>
          <h1>{total} {total === 1 ? "docente" : "docentes"}</h1>
        </div>
        <form className="adm__search" onSubmit={buscar} role="search">
          <Search size={16} aria-hidden="true" />
          <input
            type="search"
            value={texto}
            maxLength={80}
            placeholder="Nombre, correo o institución"
            aria-label="Buscar docentes"
            onChange={(e) => setTexto(e.target.value)}
          />
          <Button type="submit" variant="secondary" size="sm">Buscar</Button>
        </form>
      </header>

      {cargando ? (
        <CargandoTabla />
      ) : error ? (
        <ErrorEstado mensaje={error} onReintentar={recargar} />
      ) : items.length === 0 ? (
        <EmptyState
          title={busqueda ? "Sin resultados" : "Todavía no hay docentes"}
          description={busqueda
            ? `No encontramos a nadie que coincida con «${busqueda}».`
            : "Cuando alguien se registre, aparecerá aquí."}
          action={busqueda
            ? <Button variant="outline" onClick={() => { setTexto(""); setBusqueda(""); }}>Ver todos</Button>
            : null}
        />
      ) : (
        <>
          <div className="adm__tablewrap">
            <table className="adm__table">
              <thead>
                <tr>
                  <th>Docente</th><th>Correo</th><th>Estado</th>
                  <th>Plan</th><th>Uso IA</th><th>Último acceso</th><th>Registro</th>
                </tr>
              </thead>
              <tbody>
                {items.map((d) => (
                  <tr key={d.user_id} tabIndex={0} role="button"
                      onClick={() => onAbrir(d.user_id)}
                      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onAbrir(d.user_id)}>
                    <td>
                      <strong>{d.nombres} {d.apellidos}</strong>
                      <small>{d.ie} · {d.nivel}</small>
                    </td>
                    <td>
                      <span className="adm__mail">{d.email || "—"}</span>
                      {d.email_confirmado
                        ? <Badge tone="success" icon={MailCheck}>Confirmado</Badge>
                        : <Badge tone="amber" icon={Mail}>Pendiente</Badge>}
                    </td>
                    <td>{d.activo
                      ? <Badge tone="success">Activa</Badge>
                      : <Badge tone="danger">Inactiva</Badge>}</td>
                    <td><Badge tone={d.plan === "free" ? "neutral" : "brand"}>{d.plan}</Badge></td>
                    <td className="adm__usage">
                      <span>{d.usadas_semana} / {d.limite_semanal}</span>
                      <i style={{ width: `${Math.min(100, (d.usadas_semana / Math.max(d.limite_semanal, 1)) * 100)}%` }} />
                    </td>
                    <td>{desde(d.ultimo_acceso)}</td>
                    <td>{fecha(d.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* En móvil la tabla no cabe: la misma información como tarjetas. */}
          <ul className="adm__cardlist">
            {items.map((d) => (
              <li key={d.user_id}>
                <button type="button" onClick={() => onAbrir(d.user_id)}>
                  <div className="adm__cardlisthead">
                    <strong>{d.nombres} {d.apellidos}</strong>
                    <Badge tone={d.plan === "free" ? "neutral" : "brand"}>{d.plan}</Badge>
                  </div>
                  <small>{d.email}</small>
                  <div className="adm__cardlistmeta">
                    <span>{d.ie}</span>
                    <span>{d.usadas_semana}/{d.limite_semanal} IA</span>
                    <span>{desde(d.ultimo_acceso)}</span>
                  </div>
                </button>
              </li>
            ))}
          </ul>

          {paginas > 1 && (
            <nav className="adm__pager" aria-label="Paginación">
              <Button variant="outline" size="sm" icon={ChevronLeft}
                      disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>
                Anterior
              </Button>
              <span>Página {pagina} de {paginas}</span>
              <Button variant="outline" size="sm" iconRight={ChevronRight}
                      disabled={pagina >= paginas} onClick={() => setPagina((p) => p + 1)}>
                Siguiente
              </Button>
            </nav>
          )}
        </>
      )}
    </>
  );
}

/* ======================================================================= */

function DetalleDocente({ userId, token, role, onVolver, onDenegado }) {
  const { data, error, cargando, recargar } =
    useCarga(`/api/admin/docente?userId=${encodeURIComponent(userId)}`, token, onDenegado);
  // `support` es de solo lectura. Ocultar los botones es comodidad: quien
  // rechaza de verdad es el backend, que exige rol `admin` como mínimo.
  const puedeGestionar = role === "admin" || role === "superadmin";
  const [accion, setAccion] = useState(null);

  if (cargando) return <CargandoTarjetas />;
  if (error) {
    return (
      <>
        <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={onVolver}>Volver</Button>
        <ErrorEstado mensaje={error} onReintentar={recargar} />
      </>
    );
  }

  const { perfil = {}, cuenta = {}, plan = {}, generaciones = {}, materiales = {}, historial_planes = [] } = data || {};

  return (
    <>
      <header className="adm__head">
        <div>
          <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={onVolver}>Volver</Button>
          <h1>{perfil.nombres} {perfil.apellidos}</h1>
          <p className="adm__sub">{perfil.ie} · {perfil.nivel}</p>
        </div>
      </header>

      <div className="adm__detail">
        <section className="adm__panel">
          <h2><GraduationCap size={16} aria-hidden="true" /> Perfil</h2>
          <Dato etiqueta="Nombre" valor={`${perfil.nombres || ""} ${perfil.apellidos || ""}`} />
          <Dato etiqueta="Institución" valor={perfil.ie} />
          <Dato etiqueta="Nivel" valor={perfil.nivel} />
          {"celular" in perfil && <Dato etiqueta="Celular" valor={perfil.celular || "—"} />}
          <Dato etiqueta="Registro" valor={fecha(perfil.created_at)} />
        </section>

        <section className="adm__panel">
          <h2><Mail size={16} aria-hidden="true" /> Cuenta</h2>
          <Dato etiqueta="Correo" valor={cuenta.email} />
          <Dato etiqueta="Confirmado"
                valor={cuenta.email_confirmado
                  ? <Badge tone="success">Sí</Badge>
                  : <Badge tone="amber">Pendiente</Badge>} />
          <Dato etiqueta="Último acceso" valor={`${desde(cuenta.ultimo_acceso)} · ${fecha(cuenta.ultimo_acceso, true)}`} />
          <Dato etiqueta="Estado"
                valor={cuenta.activo
                  ? <Badge tone="success">Activa</Badge>
                  : <Badge tone="danger">Inactiva</Badge>} />
        </section>

        <section className="adm__panel">
          <h2><ShieldCheck size={16} aria-hidden="true" /> Plan</h2>
          <Dato etiqueta="Plan actual" valor={<Badge tone={plan.code === "free" ? "neutral" : "brand"}>{plan.nombre || plan.code}</Badge>} />
          <Dato etiqueta="Desde" valor={fecha(plan.desde)} />
          <Dato etiqueta="Hasta" valor={plan.hasta ? fecha(plan.hasta) : "Sin vencimiento"} />
          <Dato etiqueta="Créditos" valor={`${plan.usadas ?? 0} usados · ${plan.disponibles ?? 0} disponibles de ${plan.limite_semanal ?? 0}`} />
          {plan.por_fallback && (
            <Alert tone="amber" title="Sin suscripción registrada">
              Se resuelve como gratuito porque no tiene fila de suscripción activa.
            </Alert>
          )}
        </section>

        <section className="adm__panel">
          <h2><Sparkles size={16} aria-hidden="true" /> Uso de IA</h2>
          <Dato etiqueta="Generaciones" valor={`${generaciones.total ?? 0} en total`} />
          <Dato etiqueta="Devueltas" valor={`${generaciones.devueltas ?? 0}`} />
          {(generaciones.recientes || []).length === 0 ? (
            <p className="adm__muted">Todavía no ha generado nada.</p>
          ) : (
            <ul className="adm__timeline">
              {generaciones.recientes.map((g, i) => (
                <li key={i}>
                  <Clock size={13} aria-hidden="true" />
                  {fecha(g.fecha, true)}
                  {g.devuelta && <Badge tone="amber">Crédito devuelto</Badge>}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="adm__panel adm__panel--wide">
          <h2><FolderOpen size={16} aria-hidden="true" /> Materiales</h2>
          <Dato etiqueta="Total" valor={`${materiales.total ?? 0}`} />
          {(materiales.recientes || []).length === 0 ? (
            <p className="adm__muted">Todavía no ha guardado materiales.</p>
          ) : (
            <ul className="adm__matlist">
              {materiales.recientes.map((m, i) => (
                <li key={i}>
                  <strong>{m.titulo}</strong>
                  <small>{m.tipo}{m.area ? ` · ${m.area}` : ""}{m.grado ? ` · ${m.grado}` : ""}</small>
                  <time>{fecha(m.fecha)}</time>
                </li>
              ))}
            </ul>
          )}
        </section>

        {historial_planes.length > 0 && (
          <section className="adm__panel adm__panel--wide">
            <h2>Historial de planes</h2>
            <ul className="adm__matlist">
              {historial_planes.map((h, i) => (
                <li key={i}>
                  <strong>{h.plan}</strong>
                  <small>{h.estado} · {h.origen}</small>
                  <time>{fecha(h.desde)}{h.hasta ? ` → ${fecha(h.hasta)}` : ""}</time>
                </li>
              ))}
            </ul>
          </section>
        )}
        {puedeGestionar && (
          <section className="adm__panel adm__panel--wide adm__acciones">
            <h2><ShieldCheck size={16} aria-hidden="true" /> Administrar cuenta</h2>
            <p className="adm__muted">
              Cada acción queda registrada con tu nombre, la fecha y el motivo.
            </p>
            <div className="adm__botonera">
              {cuenta.activo ? (
                <Button variant="danger" size="sm" icon={Ban}
                        onClick={() => setAccion({ tipo: "suspend" })}>
                  Suspender cuenta
                </Button>
              ) : (
                <Button variant="secondary" size="sm" icon={CheckCircle2}
                        onClick={() => setAccion({ tipo: "reactivate" })}>
                  Reactivar cuenta
                </Button>
              )}
              <Button variant="outline" size="sm" icon={ArrowRightLeft}
                      onClick={() => setAccion({ tipo: "change_plan" })}>
                Cambiar plan
              </Button>
              <Button variant="outline" size="sm" icon={CalendarPlus}
                      disabled={!plan.hasta}
                      onClick={() => setAccion({ tipo: "extend_plan" })}>
                Extender vigencia
              </Button>
            </div>
            {!plan.hasta && (
              <p className="adm__muted">
                El plan actual no vence, así que no hay vigencia que extender.
              </p>
            )}
          </section>
        )}

        <HistorialAdmin userId={userId} token={token} onDenegado={onDenegado} />
      </div>

      {accion && (
        <ModalAccion
          accion={accion}
          docente={`${perfil.nombres || ""} ${perfil.apellidos || ""}`.trim()}
          planActual={plan}
          userId={userId}
          token={token}
          onCerrar={() => setAccion(null)}
          onHecho={() => { setAccion(null); recargar(); }}
        />
      )}
    </>
  );
}

/* ======================================================================= */

/** Auditoría de este docente. Se carga aparte para no retrasar la ficha. */
function HistorialAdmin({ userId, token, onDenegado }) {
  const { data } = useCarga(
    `/api/admin/audit?userId=${encodeURIComponent(userId)}`, token, onDenegado);
  const lineas = data?.items || [];
  if (!lineas.length) return null;

  return (
    <section className="adm__panel adm__panel--wide">
      <h2><History size={16} aria-hidden="true" /> Historial administrativo</h2>
      <ul className="adm__matlist">
        {lineas.map((l, i) => (
          <li key={i}>
            <strong>{ETIQUETA_ACCION[l.accion] || l.accion}</strong>
            <small>{l.actor} · {l.rol}{l.motivo ? ` · ${l.motivo}` : ""}</small>
            <time>{fecha(l.fecha, true)}</time>
          </li>
        ))}
      </ul>
    </section>
  );
}

const ETIQUETA_ACCION = {
  ADMIN_SUSPENDED_USER: "Cuenta suspendida",
  ADMIN_REACTIVATED_USER: "Cuenta reactivada",
  ADMIN_CHANGED_PLAN: "Plan cambiado",
  ADMIN_EXTENDED_PLAN: "Vigencia extendida",
};

/* ======================================================================= */

/* ==========================================================================
   PAGOS

   Los pendientes van arriba: son las únicas solicitudes con alguien
   esperando al otro lado. El importe se muestra tal como quedó guardado en la
   solicitud, no como esté hoy el catálogo: si el precio cambió, el historial
   debe seguir diciendo lo que se pidió.
   ========================================================================== */

const ESTADO_PAGO = {
  pending:   { texto: "Pendiente", tono: "amber" },
  approved:  { texto: "Aprobado",  tono: "success" },
  rejected:  { texto: "Rechazado", tono: "danger" },
  cancelled: { texto: "Cancelado", tono: "neutral" },
};

function soles(centimos, moneda = "PEN") {
  const valor = (Number(centimos) || 0) / 100;
  return (moneda === "PEN" ? "S/ " : moneda + " ") + valor.toFixed(2);
}

function Pagos({ token, role, onRole, onDenegado }) {
  const [estado, setEstado] = useState("pending");
  const [texto, setTexto] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [pagina, setPagina] = useState(1);
  const [revisando, setRevisando] = useState(null);

  const puedeRevisar = role === "admin" || role === "superadmin";

  const ruta = useMemo(() => {
    const q = new URLSearchParams({ page: String(pagina), pageSize: String(PAGE_SIZE) });
    if (estado) q.set("status", estado);
    if (busqueda) q.set("search", busqueda);
    return "/api/admin/payments?" + q.toString();
  }, [estado, busqueda, pagina]);

  const { data, error, cargando, recargar } = useCarga(ruta, token, onDenegado);
  useEffect(() => { if (data?.role) onRole?.(data.role); }, [data, onRole]);

  const items = data?.items || [];
  const paginas = data?.pages ?? 1;
  const pendientes = data?.pendientes ?? 0;

  return (
    <>
      <header className="adm__head">
        <div>
          <p className="adm__eyebrow">Pagos</p>
          <h1>{pendientes} {pendientes === 1 ? "solicitud pendiente" : "solicitudes pendientes"}</h1>
        </div>
        <form
          className="adm__search"
          role="search"
          onSubmit={(e) => { e.preventDefault(); setPagina(1); setBusqueda(texto.trim()); }}
        >
          <Search size={16} aria-hidden="true" />
          <input
            type="search" value={texto} maxLength={80}
            placeholder="Docente o correo" aria-label="Buscar solicitudes"
            onChange={(e) => setTexto(e.target.value)}
          />
          <Button type="submit" variant="secondary" size="sm">Buscar</Button>
        </form>
      </header>

      <div className="adm__filtros" role="group" aria-label="Filtrar por estado">
        {[["pending", "Pendientes"], ["approved", "Aprobados"],
          ["rejected", "Rechazados"], ["", "Todos"]].map(([valor, etiqueta]) => (
          <button
            key={etiqueta} type="button"
            className={"adm__chip" + (estado === valor ? " is-active" : "")}
            onClick={() => { setEstado(valor); setPagina(1); }}
          >
            {etiqueta}
          </button>
        ))}
      </div>

      {cargando ? (
        <CargandoTabla />
      ) : error ? (
        <ErrorEstado mensaje={error} onReintentar={recargar} />
      ) : items.length === 0 ? (
        <EmptyState
          title={estado === "pending" ? "Nada por revisar" : "Sin solicitudes"}
          description={estado === "pending"
            ? "Cuando una docente solicite un plan, aparecerá aquí."
            : "No hay solicitudes que coincidan con este filtro."}
        />
      ) : (
        <>
          <ul className="adm__pagos">
            {items.map((r) => {
              const e = ESTADO_PAGO[r.estado] || ESTADO_PAGO.cancelled;
              return (
                <li key={r.id} className="adm__pago">
                  <div className="adm__pagohead">
                    <div>
                      <strong>{r.docente}</strong>
                      <small>{r.email} · {r.ie}</small>
                    </div>
                    <Badge tone={e.tono}>{e.texto}</Badge>
                  </div>

                  <div className="adm__pagodatos">
                    <Dato etiqueta="Plan" valor={r.plan_nombre} />
                    <Dato etiqueta="Monto" valor={soles(r.monto_centimos, r.moneda)} />
                    <Dato etiqueta="Método" valor={r.metodo} />
                    <Dato etiqueta="Referencia" valor={r.referencia || "—"} />
                    <Dato etiqueta="Solicitado" valor={fecha(r.solicitado, true)} />
                    {r.revisado && (
                      <Dato
                        etiqueta="Revisado"
                        valor={fecha(r.revisado, true) + (r.revisor ? " · " + r.revisor : "")}
                      />
                    )}
                    {r.notas && <Dato etiqueta="Notas internas" valor={r.notas} />}
                  </div>

                  {r.estado === "pending" && puedeRevisar && (
                    <div className="adm__botonera">
                      <Button variant="primary" size="sm" icon={ThumbsUp}
                              onClick={() => setRevisando({ tipo: "approve", r })}>
                        Aprobar
                      </Button>
                      <Button variant="outline" size="sm" icon={ThumbsDown}
                              onClick={() => setRevisando({ tipo: "reject", r })}>
                        Rechazar
                      </Button>
                    </div>
                  )}
                  {r.estado === "pending" && !puedeRevisar && (
                    <p className="adm__muted">Tu rol permite consultar, no revisar.</p>
                  )}
                </li>
              );
            })}
          </ul>

          {paginas > 1 && (
            <nav className="adm__pager" aria-label="Paginación">
              <Button variant="outline" size="sm" icon={ChevronLeft}
                      disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>
                Anterior
              </Button>
              <span>Página {pagina} de {paginas}</span>
              <Button variant="outline" size="sm" iconRight={ChevronRight}
                      disabled={pagina >= paginas} onClick={() => setPagina((p) => p + 1)}>
                Siguiente
              </Button>
            </nav>
          )}
        </>
      )}

      {revisando && (
        <ModalPago
          revision={revisando}
          token={token}
          onCerrar={() => setRevisando(null)}
          onHecho={() => { setRevisando(null); recargar(); }}
        />
      )}
    </>
  );
}

function ModalPago({ revision, token, onCerrar, onHecho }) {
  const aprobar = revision.tipo === "approve";
  const r = revision.r;
  const { toast } = useUI();
  const [notas, setNotas] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  async function confirmar() {
    setEnviando(true);
    setError("");
    try {
      const res = await fetch("/api/admin/payment-actions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({
          action: revision.tipo, requestId: r.id, notes: notas.trim() || null,
        }),
      });

      const tipo = res.headers.get("content-type") || "";
      if (!tipo.includes("application/json")) {
        throw new Error("El servicio no está disponible en este momento.");
      }
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "No pudimos completar la acción.");

      toast({
        tone: "success",
        title: aprobar ? "Pago aprobado y plan activado." : "Solicitud rechazada.",
      });
      onHecho();
    } catch (e) {
      setError(e.message);
    } finally {
      setEnviando(false);
    }
  }

  const meses = r.meses ? r.meses + (r.meses === 1 ? " mes" : " meses") : "sin vencimiento";

  return (
    <Modal
      open
      onClose={enviando ? undefined : onCerrar}
      dismissible={!enviando}
      title={aprobar ? "Aprobar pago" : "Rechazar solicitud"}
      description={aprobar
        ? r.docente + " pasará al plan " + r.plan_nombre + " por " + meses + ", a partir de hoy."
        : r.docente + " seguirá con el plan que tiene ahora. Nada cambia salvo el estado de esta solicitud."}
      icon={aprobar ? ThumbsUp : ThumbsDown}
      variant={aprobar ? "success" : "warning"}
      actions={
        <>
          <Button variant="ghost" onClick={onCerrar} disabled={enviando}>Cancelar</Button>
          <Button variant={aprobar ? "primary" : "danger"} loading={enviando}
                  disabled={!aprobar && !notas.trim()} onClick={confirmar}>
            {aprobar ? "Aprobar y activar" : "Rechazar"}
          </Button>
        </>
      }
    >
      <div className="adm__form">
        <div className="adm__resumenpago">
          <Dato etiqueta="Docente" valor={r.docente} />
          <Dato etiqueta="Plan" valor={r.plan_nombre} />
          <Dato etiqueta="Monto" valor={soles(r.monto_centimos, r.moneda)} />
          <Dato etiqueta="Método" valor={r.metodo} />
          <Dato etiqueta="Referencia" valor={r.referencia || "—"} />
        </div>

        <label>
          {aprobar ? "Notas internas (opcional)" : "Motivo del rechazo"}
          <textarea
            value={notas} maxLength={300} rows={2}
            placeholder={aprobar
              ? "Ej.: comprobante verificado en Yape"
              : "Ej.: no encontramos el pago con esa referencia"}
            onChange={(e) => setNotas(e.target.value)}
          />
          <small>
            {aprobar
              ? "Solo la ve el equipo. La docente no verá esta nota."
              : "Obligatorio. Solo lo ve el equipo."}
          </small>
        </label>

        {error && <p className="adm__error" role="alert">{error}</p>}
      </div>
    </Modal>
  );
}

/* ==========================================================================
   MODAL DE CONFIRMACIÓN

   Cada acción dice EXACTAMENTE qué va a pasar —«pasará al plan Mensual hasta
   el 6 de octubre»— y no un genérico «¿estás seguro?». Suspender pide además
   escribir el nombre: es la única de las cuatro que corta el servicio.
   ========================================================================== */
const TEXTOS = {
  suspend: {
    titulo: "Suspender cuenta",
    icono: Ban,
    variante: "danger",
    boton: "Suspender",
    efecto: (n) => `${n} dejará de poder generar contenido con IA de inmediato. Podrá entrar, pero no crear nada. Se puede revertir cuando quieras.`,
    exito: "Cuenta suspendida.",
  },
  reactivate: {
    titulo: "Reactivar cuenta",
    icono: CheckCircle2,
    variante: "default",
    boton: "Reactivar",
    efecto: (n) => `${n} volverá a poder generar contenido con los créditos de su plan.`,
    exito: "Cuenta reactivada.",
  },
  change_plan: {
    titulo: "Cambiar de plan",
    icono: ArrowRightLeft,
    variante: "default",
    boton: "Cambiar plan",
    efecto: () => "La suscripción actual se cerrará y se creará una nueva. El historial se conserva.",
    exito: "Plan actualizado correctamente.",
  },
  extend_plan: {
    titulo: "Extender vigencia",
    icono: CalendarPlus,
    variante: "default",
    boton: "Extender",
    efecto: () => "Se añadirán meses a la fecha de vencimiento del plan actual.",
    exito: "Vigencia extendida.",
  },
};

function ModalAccion({ accion, docente, planActual, userId, token, onCerrar, onHecho }) {
  const t = TEXTOS[accion.tipo];
  const { toast } = useUI();
  const [motivo, setMotivo] = useState("");
  const [plan, setPlan] = useState(planActual?.code || "free");
  const [meses, setMeses] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [planes, setPlanes] = useState([]);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  const exigeNombre = accion.tipo === "suspend";
  const nombreOk = !exigeNombre || confirmacion.trim().toLowerCase() === docente.toLowerCase();

  useEffect(() => {
    if (accion.tipo !== "change_plan" || !supabase) return;
    supabase.from("plans").select("code,name,billing_period_months")
      .eq("is_active", true).order("sort_order")
      .then(({ data }) => setPlanes(data || []));
  }, [accion.tipo]);

  async function confirmar() {
    setEnviando(true);
    setError("");
    try {
      const r = await ejecutar({
        action: accion.tipo,
        userId,
        reason: motivo.trim() || null,
        ...(accion.tipo === "change_plan" ? { plan, months: meses || null } : {}),
        ...(accion.tipo === "extend_plan" ? { months: meses } : {}),
      }, token);

      // La firma real es { tone, title, description }.
      toast?.({
        tone: "success",
        title: r?.sin_cambios ? "No había nada que cambiar." : t.exito,
      });
      onHecho();
    } catch (e) {
      setError(e.message);
    } finally {
      setEnviando(false);
    }
  }

  const puedeEnviar = nombreOk &&
    (accion.tipo !== "extend_plan" || Number(meses) >= 1);

  return (
    <Modal
      open
      onClose={enviando ? undefined : onCerrar}
      dismissible={!enviando}
      title={t.titulo}
      description={t.efecto(docente || "Este docente")}
      icon={t.icono}
      variant={t.variante}
      actions={
        <>
          <Button variant="ghost" onClick={onCerrar} disabled={enviando}>Cancelar</Button>
          <Button
            variant={t.variante === "danger" ? "danger" : "primary"}
            loading={enviando}
            disabled={!puedeEnviar}
            onClick={confirmar}
          >
            {t.boton}
          </Button>
        </>
      }
    >
      <div className="adm__form">
        {accion.tipo === "change_plan" && (
          <>
            <label>Plan
              <select value={plan} onChange={(e) => setPlan(e.target.value)}>
                {planes.length === 0 && <option value="free">Gratuito</option>}
                {planes.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
              </select>
            </label>
            <label>Duración en meses
              <input type="number" min="1" max="36" value={meses}
                     placeholder="Vacío = sin vencimiento"
                     onChange={(e) => setMeses(e.target.value)} />
            </label>
            {planes.length <= 1 && (
              <Alert tone="info" title="Solo hay un plan en el catálogo">
                Cuando definas los planes de pago aparecerán aquí para elegir.
              </Alert>
            )}
          </>
        )}

        {accion.tipo === "extend_plan" && (
          <label>Meses a añadir
            <input type="number" min="1" max="36" value={meses} autoFocus
                   onChange={(e) => setMeses(e.target.value)} />
          </label>
        )}

        <label>Motivo <small>(queda en la auditoría)</small>
          <textarea value={motivo} maxLength={300} rows={2}
                    placeholder="Ej.: pago verificado por WhatsApp"
                    onChange={(e) => setMotivo(e.target.value)} />
        </label>

        {exigeNombre && (
          <label>Para confirmar, escribe <strong>{docente}</strong>
            <input value={confirmacion} autoComplete="off"
                   onChange={(e) => setConfirmacion(e.target.value)} />
          </label>
        )}

        {error && <p className="adm__error" role="alert">{error}</p>}
      </div>
    </Modal>
  );
}

/* ======================================================================= */

function Dato({ etiqueta, valor }) {
  return (
    <div className="adm__dato">
      <span>{etiqueta}</span>
      <div>{valor ?? "—"}</div>
    </div>
  );
}

function CargandoTarjetas() {
  return (
    <div className="adm__cards">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <article key={i} className="adm__card">
          <Skeleton w={32} h={32} radius="var(--radius-md)" />
          <Skeleton w="50%" h={26} /><Skeleton w="75%" h={13} />
        </article>
      ))}
    </div>
  );
}

function CargandoTabla() {
  return (
    <div className="adm__loadrows">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i}><Skeleton w="30%" h={15} /><Skeleton w="55%" h={12} /></div>
      ))}
    </div>
  );
}

function ErrorEstado({ mensaje, onReintentar }) {
  return (
    <div className="adm__errorstate">
      <AlertCircle size={26} aria-hidden="true" />
      <p>{mensaje}</p>
      <Button variant="outline" size="sm" icon={RefreshCw} onClick={onReintentar}>
        Reintentar
      </Button>
    </div>
  );
}

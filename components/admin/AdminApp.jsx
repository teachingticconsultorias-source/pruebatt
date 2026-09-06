import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard, Users, Search, ChevronLeft, ChevronRight, ArrowLeft,
  ShieldCheck, ShieldAlert, LogOut, RefreshCw, Mail, MailCheck, Clock,
  GraduationCap, Sparkles, FolderOpen, AlertCircle,
} from "lucide-react";

import { supabase } from "../../supabaseClient.js";
import Button from "../ui/Button.jsx";
import { Skeleton, EmptyState, Badge, Alert } from "../ui/Feedback.jsx";

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
            onVolver={() => setDocenteAbierto(null)}
            onDenegado={() => setDenegado(true)}
          />
        ) : vista === "resumen" ? (
          <Resumen token={token} onRole={setRole} onDenegado={() => setDenegado(true)} />
        ) : (
          <ListaDocentes
            token={token}
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

function ListaDocentes({ token, onAbrir, onDenegado }) {
  const [pagina, setPagina] = useState(1);
  const [texto, setTexto] = useState("");
  const [busqueda, setBusqueda] = useState("");

  const ruta = useMemo(() => {
    const p = new URLSearchParams({ page: String(pagina), pageSize: String(PAGE_SIZE) });
    if (busqueda) p.set("search", busqueda);
    return `/api/admin/docentes?${p.toString()}`;
  }, [pagina, busqueda]);

  const { data, error, cargando, recargar } = useCarga(ruta, token, onDenegado);

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

function DetalleDocente({ userId, token, onVolver, onDenegado }) {
  const { data, error, cargando, recargar } =
    useCarga(`/api/admin/docente?userId=${encodeURIComponent(userId)}`, token, onDenegado);

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
      </div>
    </>
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

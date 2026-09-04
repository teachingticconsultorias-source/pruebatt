import React, { useState } from "react";
import { Loader2, Users, Lock, ChevronLeft, ChevronRight, Search } from "lucide-react";

const C_BG = "#FAFEFE";
const C_SURFACE = "#FFFFFF";
const C_LINE = "rgba(15,61,58,0.14)";
const C_TEXT = "#0F2E2C";
const C_MUTED = "#5B7876";
const C_TEAL = "#3EC6C0";

const PAGE_SIZE = 50;

export default function AdminPanel() {
  const [secret, setSecret] = useState("");
  const [authed, setAuthed] = useState(false);
  const [docentes, setDocentes] = useState(null);
  const [meta, setMeta] = useState({ page: 0, total: 0, hasMore: false });
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // El secreto viaja SIEMPRE en la cabecera Authorization, nunca en la URL.
  async function load({ page = 0, term = search, key = secret } = {}) {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (term.trim()) params.set("search", term.trim());

      const res = await fetch(`/api/list-docentes?${params.toString()}`, {
        headers: { Authorization: `Bearer ${key}` },
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setDocentes(null);
        setAuthed(false);
        throw new Error(
          res.status === 401
            ? "Clave incorrecta."
            : res.status === 429
              ? "Demasiados intentos. Espera un momento."
              : data.error || "No se pudo cargar la lista."
        );
      }

      setDocentes(data.docentes || []);
      setMeta({ page: data.page ?? 0, total: data.total ?? 0, hasMore: !!data.hasMore });
      setAuthed(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function handleLogin(e) {
    e.preventDefault();
    load({ page: 0 });
  }

  function handleSearch(e) {
    e.preventDefault();
    load({ page: 0 });
  }

  return (
    <div style={{ background: C_BG, color: C_TEXT, minHeight: "100vh", fontFamily: "'Inter', sans-serif" }} className="px-6 py-12">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-2 mb-6">
          <Users size={20} color={C_TEAL} />
          <h1 className="text-xl font-semibold">Docentes registrados en SciVerse</h1>
        </div>

        {!authed && (
          <form onSubmit={handleLogin} className="flex gap-2 max-w-sm">
            <input
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="Clave de administrador"
              autoComplete="current-password"
              className="flex-1 rounded-lg px-3 py-2.5 text-sm outline-none"
              style={{ background: "rgba(15,61,58,0.05)", border: `1px solid ${C_LINE}`, color: C_TEXT }}
            />
            <button
              type="submit"
              disabled={loading || !secret}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold"
              style={{ background: C_TEAL, color: "#0B2B29", opacity: loading || !secret ? 0.7 : 1 }}
            >
              {loading ? <Loader2 size={15} className="animate-spin" /> : <Lock size={15} />}
              Entrar
            </button>
          </form>
        )}

        {error && <p role="alert" className="text-sm mt-3" style={{ color: "#FB6542" }}>{error}</p>}

        {authed && docentes && (
          <>
            <form onSubmit={handleSearch} className="flex gap-2 mb-4 max-w-md">
              <label className="flex-1 flex items-center gap-2 rounded-lg px-3" style={{ background: "rgba(15,61,58,0.05)", border: `1px solid ${C_LINE}` }}>
                <Search size={15} color={C_MUTED} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por nombre, correo o institución"
                  className="flex-1 py-2.5 text-sm outline-none bg-transparent"
                  style={{ color: C_TEXT }}
                />
              </label>
              <button type="submit" disabled={loading} className="rounded-lg px-4 py-2.5 text-sm font-semibold" style={{ background: C_SURFACE, border: `1px solid ${C_LINE}`, color: C_TEXT }}>
                Buscar
              </button>
            </form>

            <div className="flex items-center justify-between mb-3 text-sm" style={{ color: C_MUTED }}>
              <span>
                {meta.total} {meta.total === 1 ? "docente" : "docentes"}
                {meta.total > PAGE_SIZE && ` · página ${meta.page + 1}`}
              </span>
              {loading && <Loader2 size={15} className="animate-spin" />}
            </div>

            <div className="rounded-xl overflow-x-auto" style={{ border: `1px solid ${C_LINE}` }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: C_SURFACE, borderBottom: `1px solid ${C_LINE}` }}>
                    <th className="text-left px-4 py-2.5">Nombres</th>
                    <th className="text-left px-4 py-2.5">Apellidos</th>
                    <th className="text-left px-4 py-2.5">IE</th>
                    <th className="text-left px-4 py-2.5">Correo</th>
                    <th className="text-left px-4 py-2.5">Nivel</th>
                    <th className="text-left px-4 py-2.5">Plan</th>
                    <th className="text-left px-4 py-2.5">Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {docentes.map((d) => (
                    <tr key={d.id} style={{ borderBottom: `1px solid ${C_LINE}`, opacity: d.activo === false ? 0.5 : 1 }}>
                      <td className="px-4 py-2.5">{d.nombres}</td>
                      <td className="px-4 py-2.5">{d.apellidos}</td>
                      <td className="px-4 py-2.5">{d.ie}</td>
                      <td className="px-4 py-2.5">{d.correo}</td>
                      <td className="px-4 py-2.5" style={{ color: C_MUTED }}>{d.nivel || "—"}</td>
                      <td className="px-4 py-2.5" style={{ color: C_MUTED }}>{d.plan || "—"}</td>
                      <td className="px-4 py-2.5" style={{ color: C_MUTED }}>
                        {d.created_at ? new Date(d.created_at).toLocaleDateString("es-PE") : "—"}
                      </td>
                    </tr>
                  ))}
                  {docentes.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-center" style={{ color: C_MUTED }}>
                        No hay docentes que coincidan.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {(meta.page > 0 || meta.hasMore) && (
              <div className="flex items-center justify-between mt-4">
                <button
                  onClick={() => load({ page: meta.page - 1 })}
                  disabled={meta.page === 0 || loading}
                  className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm"
                  style={{ background: C_SURFACE, border: `1px solid ${C_LINE}`, color: C_TEXT, opacity: meta.page === 0 ? 0.4 : 1 }}
                >
                  <ChevronLeft size={15} /> Anterior
                </button>
                <button
                  onClick={() => load({ page: meta.page + 1 })}
                  disabled={!meta.hasMore || loading}
                  className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm"
                  style={{ background: C_SURFACE, border: `1px solid ${C_LINE}`, color: C_TEXT, opacity: !meta.hasMore ? 0.4 : 1 }}
                >
                  Siguiente <ChevronRight size={15} />
                </button>
              </div>
            )}

            <p className="mt-4 text-xs" style={{ color: C_MUTED }}>
              El número de celular no se muestra por tratarse de un dato personal sensible.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

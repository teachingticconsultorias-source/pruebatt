import React, { useState } from "react";
import { Loader2, Users, Lock } from "lucide-react";

const C_BG = "#FAFEFE";
const C_SURFACE = "#FFFFFF";
const C_LINE = "rgba(15,61,58,0.14)";
const C_TEXT = "#0F2E2C";
const C_MUTED = "#5B7876";
const C_TEAL = "#3EC6C0";

export default function AdminPanel() {
  const [secret, setSecret] = useState("");
  const [docentes, setDocentes] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleLoad(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/list-docentes?secret=${encodeURIComponent(secret)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      setDocentes(data.docentes);
    } catch (e) {
      setError("Clave incorrecta o error al cargar la lista.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ background: C_BG, color: C_TEXT, minHeight: "100vh", fontFamily: "'Inter', sans-serif" }} className="px-6 py-12">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-2 mb-6">
          <Users size={20} color={C_TEAL} />
          <h1 className="text-xl font-semibold">Docentes registrados en SciVerse</h1>
        </div>

        {!docentes && (
          <form onSubmit={handleLoad} className="flex gap-2 max-w-sm">
            <input
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="Clave de administrador"
              className="flex-1 rounded-lg px-3 py-2.5 text-sm outline-none"
              style={{ background: "rgba(15,61,58,0.05)", border: `1px solid ${C_LINE}`, color: C_TEXT }}
            />
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold"
              style={{ background: C_TEAL, color: "#0B2B29" }}
            >
              {loading ? <Loader2 size={15} className="animate-spin" /> : <Lock size={15} />}
              Entrar
            </button>
          </form>
        )}

        {error && <p className="text-sm mt-3" style={{ color: "#FB6542" }}>{error}</p>}

        {docentes && (
          <div className="mt-6 rounded-xl overflow-hidden" style={{ border: `1px solid ${C_LINE}` }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: C_SURFACE, borderBottom: `1px solid ${C_LINE}` }}>
                  <th className="text-left px-4 py-2.5">Nombres</th>
                  <th className="text-left px-4 py-2.5">Apellidos</th>
                  <th className="text-left px-4 py-2.5">IE</th>
                  <th className="text-left px-4 py-2.5">Correo</th>
                  <th className="text-left px-4 py-2.5">Celular</th>
                  <th className="text-left px-4 py-2.5">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {docentes.map((d) => (
                  <tr key={d.id} style={{ borderBottom: `1px solid ${C_LINE}` }}>
                    <td className="px-4 py-2.5">{d.nombres}</td>
                    <td className="px-4 py-2.5">{d.apellidos}</td>
                    <td className="px-4 py-2.5">{d.ie}</td>
                    <td className="px-4 py-2.5">{d.correo}</td>
                    <td className="px-4 py-2.5" style={{ color: C_MUTED }}>{d.celular || "—"}</td>
                    <td className="px-4 py-2.5" style={{ color: C_MUTED }}>{new Date(d.created_at).toLocaleDateString("es-PE")}</td>
                  </tr>
                ))}
                {docentes.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center" style={{ color: C_MUTED }}>
                      Todavía no hay docentes registrados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

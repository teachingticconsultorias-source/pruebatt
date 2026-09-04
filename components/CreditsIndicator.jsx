// components/CreditsIndicator.jsx

import React, { useCallback, useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { supabase } from "../supabaseClient.js";
import "../credit-widget.css";

function prettyDate(value) {
  if (!value) return "";
  const [y, m, d] = String(value).split("-").map(Number);
  if (!y || !m || !d) return value;

  return new Intl.DateTimeFormat("es-PE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(y, m - 1, d));
}

export default function CreditsIndicator({
  compact = false,
  onUpgrade = () => {},
}) {
  const [credits, setCredits] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadCredits = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      setCredits(null);
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/credits", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) throw new Error("No se pudieron cargar los créditos");

      const data = await response.json();
      setCredits(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCredits();

    // Se refresca automáticamente después de creaciones y al volver a la pestaña.
    const refresh = () => loadCredits();
    window.addEventListener("sciverse:material-created", refresh);
    window.addEventListener("sciverse:credit-used", refresh);
    window.addEventListener("focus", refresh);

    const interval = window.setInterval(loadCredits, 15000);

    return () => {
      window.removeEventListener("sciverse:material-created", refresh);
      window.removeEventListener("sciverse:credit-used", refresh);
      window.removeEventListener("focus", refresh);
      window.clearInterval(interval);
    };
  }, [loadCredits]);

  if (loading) {
    return (
      <div className={`credit-widget ${compact ? "credit-widget--compact" : ""}`}>
        Cargando créditos...
      </div>
    );
  }

  if (!credits) return null;

  const limit = Number(credits.limit || 5);
  const used = Number(credits.used || 0);
  const remaining = Math.max(Number(credits.remaining ?? limit - used), 0);
  const pct = Math.max(0, Math.min(100, (remaining / Math.max(limit, 1)) * 100));

  if (compact) {
    return (
      <div className="credit-widget credit-widget--compact">
        <Sparkles size={16} />
        <strong>{remaining} de {limit}</strong>
        <span>créditos</span>
      </div>
    );
  }

  return (
    <section className="credit-widget">
      <div className="credit-widget__head">
        <div>
          <span className="credit-widget__eyebrow">PLAN {String(credits.plan || "gratuito").toUpperCase()}</span>
          <h3>Tus creaciones con IA</h3>
        </div>
        <Sparkles size={22} />
      </div>

      <div className="credit-widget__number">
        <strong>{remaining}</strong>
        <span> / {limit} disponibles</span>
      </div>

      <div className="credit-widget__bar" aria-hidden="true">
        <div style={{ width: `${pct}%` }} />
      </div>

      <p>
        Se renuevan el {prettyDate(credits.next_reset)}.
      </p>

      {remaining > 0 && remaining <= 1 && (
        <p className="credit-widget__warn">Te queda {remaining} creación esta semana.</p>
      )}

      {remaining === 0 && (
        <button type="button" onClick={onUpgrade}>
          Conocer SciVerse Pro
        </button>
      )}
    </section>
  );
}

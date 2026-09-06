// components/admin/shared.jsx
//
// Piezas que comparten todas las secciones del panel. Estaban dentro de
// AdminApp.jsx; se extraen aquí al añadir Planes y Configuración para no
// tener dos formateadores de fecha ni dos maneras de pedir datos.
//
// Nada de esto decide permisos. La autorización vive en el backend: aquí
// sólo se traduce lo que responde a algo que una persona pueda leer.

import React, { useCallback, useEffect, useState } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

import Button from "../ui/Button.jsx";
import { Skeleton } from "../ui/Feedback.jsx";

export function fecha(valor, conHora = false) {
  if (!valor) return "—";
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-PE", {
    day: "2-digit", month: "short", year: "numeric",
    ...(conHora ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

export function desde(valor) {
  if (!valor) return "Nunca";
  const dias = Math.floor((Date.now() - new Date(valor).getTime()) / 86_400_000);
  if (Number.isNaN(dias)) return "—";
  if (dias === 0) return "Hoy";
  if (dias === 1) return "Ayer";
  if (dias < 30) return `Hace ${dias} días`;
  if (dias < 365) return `Hace ${Math.floor(dias / 30)} meses`;
  return `Hace ${Math.floor(dias / 365)} años`;
}

export function soles(centimos, moneda = "PEN") {
  const valor = (Number(centimos) || 0) / 100;
  return (moneda === "PEN" ? "S/ " : moneda + " ") + valor.toFixed(2);
}

/** Llamada autenticada de lectura. Nunca deja escapar el detalle técnico. */
export async function pedir(ruta, token) {
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

/** Escritura autenticada. Devuelve el JSON o lanza con mensaje legible. */
export async function enviar(ruta, cuerpo, token) {
  const res = await fetch(ruta, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(cuerpo),
  });

  const tipo = res.headers.get("content-type") || "";
  if (!tipo.includes("application/json")) {
    throw new Error("El servicio no está disponible en este momento.");
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || "No pudimos completar la acción.");
  return data;
}

export function useCarga(ruta, token, onDenegado) {
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

export function Dato({ etiqueta, valor }) {
  return (
    <div className="adm__dato">
      <span>{etiqueta}</span>
      <div>{valor ?? "—"}</div>
    </div>
  );
}

export function CargandoTarjetas() {
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

export function CargandoTabla() {
  return (
    <div className="adm__loadrows">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i}><Skeleton w="30%" h={15} /><Skeleton w="55%" h={12} /></div>
      ))}
    </div>
  );
}

export function ErrorEstado({ mensaje, onReintentar }) {
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

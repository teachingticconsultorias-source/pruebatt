import React, { useState } from "react";
import { Download, FlaskConical, Loader2, Pencil, Printer, Sparkles } from "lucide-react";

import { supabase } from "../supabaseClient.js";
import { cabecerasDeGeneracion, useClaveDeOperacion } from "../lib/idempotencia.js";
import { mensajeDeError, mensajeDeRespuesta, sinConexion } from "../lib/mensajes.js";
import { useAccionUnica } from "../lib/ui/useAccionUnica.js";
import { useConexion } from "../lib/ui/useConexion.js";
import { downloadResource } from "../lib/docx/exporters.js";
import { areasDeNivel } from "../config/curriculum.js";

/* ==========================================================================
   GENERAR LABORATORIO

   Mismo patrón que el resto de generadores: formulario por pasos → una
   llamada a `/api/generate-session-resource` → resultado exportable. Ni un
   endpoint nuevo ni una segunda forma de llamar a Gemini: el tipo `lab_guide`
   viaja por la misma puerta que la ficha de trabajo y hereda de ella auth,
   límite semanal, idempotencia y reintentos.

   LO QUE PIDE DE MÁS
   ------------------
   A diferencia de una sesión, una práctica de laboratorio depende de lo que
   haya EN el laboratorio. Por eso el paso 2 pregunta materiales, tipo de
   experimento, medidas de seguridad e integrantes por equipo: sin esos
   cuatro datos el modelo propone reactivos que no existen en un colegio
   público y procedimientos que no caben en la hora.
   ========================================================================== */

/** Tipos de práctica que el prompt sabe diferenciar. */
const TIPOS_DE_EXPERIMENTO = [
  "Observación guiada",
  "Experimento comparativo (con variables)",
  "Medición y registro de datos",
  "Construcción de un prototipo",
  "Disección o modelo anatómico",
  "Simulación o modelado",
  "Salida de campo con registro",
];

/** Normas frecuentes, para no obligar a escribirlas desde cero. */
const SEGURIDAD_SUGERIDA = [
  "Uso de mandil y lentes de protección",
  "Prohibido probar u oler sustancias",
  "Manipulación de vidrio con cuidado",
  "Fuente de calor con supervisión docente",
  "Lavado de manos y orden del mesón al terminar",
];

/**
 * @param {Function} [onGuardar]     guarda en la biblioteca; lo inyecta App.jsx
 * @param {React.ReactNode} [estadoGuardado]  el indicador de guardado
 */
export default function LabGuideGenerator({ initialGrade = "secundaria", profile = {},
  competencias = {}, capacidades = {}, onGuardar = null, estadoGuardado = null }) {
  const [unaVez] = useAccionUnica();
  const claveOp = useClaveDeOperacion("laboratorio");
  const enLinea = useConexion();

  const nivelInicial = initialGrade === "secundaria" ? "Secundaria" : "Primaria";
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    nivel: nivelInicial,
    grado: nivelInicial === "Primaria" ? "4.º" : "3.º",
    seccion: "",
    area: "Ciencia y Tecnología",
    tema: "",
    fecha: new Date().toISOString().slice(0, 10),
    duracion: "90",
    proposito: "",
    // Propios del laboratorio.
    materialesDisponibles: "",
    tipoExperimento: TIPOS_DE_EXPERIMENTO[1],
    medidasSeguridad: [],
    integrantes: "4",
    // Se preseleccionan desde el catálogo del área; la docente puede cambiarlos.
    competencia: competencias["Ciencia y Tecnología"]?.[0] || "",
    capacidades: [],
  });
  const [loading, setLoading] = useState(false);
  const [resource, setResource] = useState(null);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);

  const grados = form.nivel === "Primaria"
    ? ["1.º", "2.º", "3.º", "4.º", "5.º", "6.º"]
    : ["1.º", "2.º", "3.º", "4.º", "5.º"];
  const competenciasDelArea = competencias[form.area] || [];
  const capacidadesDeLaCompetencia = capacidades[form.competencia] || [];

  const update = (clave, valor) => setForm((prev) => ({ ...prev, [clave]: valor }));

  function cambiarArea(area) {
    // Al cambiar de área se recalcula la competencia, nunca al revés: si se
    // dejara la anterior, la guía saldría alineada a un área que ya no es.
    const competencia = (competencias[area] || [])[0] || "";
    setForm((prev) => ({ ...prev, area, competencia, capacidades: [] }));
  }
  function cambiarCompetencia(competencia) {
    setForm((prev) => ({ ...prev, competencia, capacidades: [] }));
  }
  function alternarCapacidad(cap) {
    setForm((prev) => ({ ...prev,
      capacidades: prev.capacidades.includes(cap)
        ? prev.capacidades.filter((c) => c !== cap)
        : [...prev.capacidades, cap] }));
  }
  function alternarSeguridad(norma) {
    setForm((prev) => ({ ...prev,
      medidasSeguridad: prev.medidasSeguridad.includes(norma)
        ? prev.medidasSeguridad.filter((n) => n !== norma)
        : [...prev.medidasSeguridad, norma] }));
  }

  function siguiente() {
    setError("");
    if (step === 1 && (!form.nivel || !form.grado || !form.area || !form.duracion)) {
      return setError("Completa nivel, grado, área y duración.");
    }
    if (step === 2 && (!form.tema.trim() || !form.proposito.trim())) {
      return setError("Escribe el tema de la práctica y su propósito de aprendizaje.");
    }
    setStep((s) => Math.min(3, s + 1));
  }

  async function generar() {
    if (!form.tema.trim()) return setError("Escribe el tema de la práctica.");
    if (!enLinea || sinConexion()) return setError(mensajeDeError("SIN_CONEXION"));
    setLoading(true); setError(""); setResource(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const cuerpo = {
        type: "lab_guide",
        form: {
          ...form,
          // El prompt lo lee como texto; una lista marcada se une aquí y no
          // en el servidor, que no tiene por qué saber de casillas.
          medidasSeguridad: form.medidasSeguridad.join("; "),
        },
      };
      const respuesta = await fetch("/api/generate-session-resource", {
        method: "POST",
        headers: cabecerasDeGeneracion(session?.access_token || "", claveOp.obtener()),
        body: JSON.stringify(cuerpo),
      });
      const datos = await respuesta.json().catch(() => ({}));
      if (!respuesta.ok) throw new Error(mensajeDeRespuesta(datos, "No se pudo generar la guía de laboratorio."));
      if (!datos.resource) throw new Error("AI_INCOMPLETE");
      // El intento terminó: la próxima generación será otra operación.
      claveOp.renovar();
      setResource(datos.resource);
      // El guardado lo inyecta App.jsx: si la migración 013 todavía no está
      // aplicada, el CHECK rechaza el tipo y `describeSaveError` lo cuenta sin
      // perder la guía, que sigue en pantalla y se puede descargar.
      await onGuardar?.({ tipo: "lab_guide", titulo: datos.resource.titulo || form.tema,
        form, contenido: datos.resource });
    } catch (fallo) {
      setError(mensajeDeError(fallo, "No se pudo generar la guía de laboratorio."));
    } finally {
      setLoading(false);
    }
  }

  async function descargar() {
    if (!resource || downloading) return;
    setDownloading(true); setError("");
    // Si falla la descarga NO se regenera nada: el resultado sigue en memoria.
    try { await downloadResource("lab_guide", resource, form, profile); }
    catch (fallo) { console.error(fallo); setError(mensajeDeError(fallo, "DESCARGA")); }
    finally { setDownloading(false); }
  }

  const g = resource?.guiaDocente || {};

  return (
    <div className="session-wizard">
      <div className="wizard-progress">
        {[{ n: 1, t: "Datos de la clase" }, { n: 2, t: "La práctica" }, { n: 3, t: "Revisión" }].map((item) => (
          <React.Fragment key={item.n}>
            <button className={step >= item.n ? "is-active" : ""} onClick={() => item.n < step && setStep(item.n)}>
              <i>{item.n}</i><span>{item.t}</span>
            </button>
            {item.n < 3 && <b className={step > item.n ? "is-complete" : ""} />}
          </React.Fragment>
        ))}
      </div>
      <div className="wizard-caption">Paso {step} de 3</div>

      {step === 1 && (
        <div className="wizard-card">
          <div className="wizard-card__title">
            <span><FlaskConical size={18} /></span>
            <div><h4>Datos de la clase</h4><p>La guía se alineará al CNEB con estos datos.</p></div>
          </div>
          <div className="wizard-fields">
            <label>Nivel *
              <select value={form.nivel} onChange={(e) => setForm((p) => ({ ...p, nivel: e.target.value, grado: "1.º" }))}>
                <option>Primaria</option><option>Secundaria</option>
              </select>
            </label>
            <label>Grado *
              <select value={form.grado} onChange={(e) => update("grado", e.target.value)}>
                {grados.map((g2) => <option key={g2}>{g2}</option>)}
              </select>
            </label>
            <label className="wide">Área curricular *
              <select value={form.area} onChange={(e) => cambiarArea(e.target.value)}>
                {areasDeNivel(form.nivel).map((a) => <option key={a}>{a}</option>)}
              </select>
            </label>
            <label>Sección<input value={form.seccion} onChange={(e) => update("seccion", e.target.value)} placeholder="Ej.: A" /></label>
            <label>Fecha<input type="date" value={form.fecha} onChange={(e) => update("fecha", e.target.value)} /></label>
            <label>Duración *
              <select value={form.duracion} onChange={(e) => update("duracion", e.target.value)}>
                <option value="45">45 minutos</option><option value="90">90 minutos</option><option value="120">120 minutos</option>
              </select>
            </label>
            <label>Integrantes por equipo *
              <select value={form.integrantes} onChange={(e) => update("integrantes", e.target.value)}>
                {["2", "3", "4", "5", "6"].map((n) => <option key={n} value={n}>{n} integrantes</option>)}
              </select>
            </label>
            {competenciasDelArea.length > 0 && (
              <label className="wide">Competencia CNEB *
                <select value={form.competencia} onChange={(e) => cambiarCompetencia(e.target.value)}>
                  {competenciasDelArea.map((c) => <option key={c}>{c}</option>)}
                </select>
              </label>
            )}
            {capacidadesDeLaCompetencia.length > 0 && (
              <fieldset className="wide capacity-picker">
                <legend>Capacidades que se movilizarán</legend>
                {capacidadesDeLaCompetencia.map((cap) => (
                  <label key={cap}>
                    <input type="checkbox" checked={form.capacidades.includes(cap)} onChange={() => alternarCapacidad(cap)} />
                    <span>{cap}</span>
                  </label>
                ))}
              </fieldset>
            )}
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="wizard-card">
          <div className="wizard-card__title">
            <span><FlaskConical size={18} /></span>
            <div><h4>La práctica</h4><p>Lo que hay en tu laboratorio decide lo que Kantu puede proponer.</p></div>
          </div>
          <div className="wizard-fields">
            <label className="wide">Tema de la práctica *
              <input value={form.tema} onChange={(e) => update("tema", e.target.value)}
                placeholder="Ej.: La densidad de los líquidos" />
            </label>
            <label className="wide">Propósito de aprendizaje *
              <textarea value={form.proposito} onChange={(e) => update("proposito", e.target.value)}
                placeholder="Qué deben lograr explicar o demostrar al terminar la práctica." />
            </label>
            <label className="wide">Tipo de experimento o actividad *
              <select value={form.tipoExperimento} onChange={(e) => update("tipoExperimento", e.target.value)}>
                {TIPOS_DE_EXPERIMENTO.map((t) => <option key={t}>{t}</option>)}
              </select>
            </label>
            <label className="wide">Materiales disponibles en el laboratorio
              <textarea value={form.materialesDisponibles} onChange={(e) => update("materialesDisponibles", e.target.value)}
                placeholder="Ej.: probetas, balanza digital, vasos de precipitados, aceite, sal, colorante." />
              <small className="field-help">Si lo dejas vacío, Kantu propondrá materiales de bodega, baratos y seguros.</small>
            </label>
            <fieldset className="wide capacity-picker">
              <legend>Medidas de seguridad a considerar</legend>
              {SEGURIDAD_SUGERIDA.map((norma) => (
                <label key={norma}>
                  <input type="checkbox" checked={form.medidasSeguridad.includes(norma)} onChange={() => alternarSeguridad(norma)} />
                  <span>{norma}</span>
                </label>
              ))}
            </fieldset>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="wizard-card wizard-review">
          <div className="wizard-card__title">
            <span><FlaskConical size={18} /></span>
            <div><h4>Revisa antes de generar</h4><p>Kantu utilizará exactamente esta información.</p></div>
          </div>
          <div className="review-grid">
            <div><small>Nivel y grado</small><strong>{form.nivel} · {form.grado} {form.seccion && `· ${form.seccion}`}</strong></div>
            <div><small>Área</small><strong>{form.area}</strong></div>
            <div><small>Duración y equipos</small><strong>{form.duracion} min · {form.integrantes} por equipo</strong></div>
            <div><small>Tipo de actividad</small><strong>{form.tipoExperimento}</strong></div>
            <div className="wide"><small>Tema</small><strong>{form.tema}</strong></div>
            <div className="wide"><small>Propósito</small><p>{form.proposito}</p></div>
            <div className="wide"><small>Materiales</small><p>{form.materialesDisponibles || "Kantu los propondrá"}</p></div>
            <div className="wide"><small>Seguridad</small><p>{form.medidasSeguridad.join(" · ") || "Las habituales del laboratorio escolar"}</p></div>
          </div>
        </div>
      )}

      {error && <p className="wizard-error" role="alert">{error}</p>}

      {!resource && (
        <div className="wizard-actions">
          {step > 1 && <button className="wizard-back" onClick={() => { setError(""); setStep((s) => s - 1); }}>Anterior</button>}
          {step < 3
            ? <button className="wizard-next" onClick={siguiente}>Continuar</button>
            : <button className="wizard-next" onClick={() => unaVez(generar)} disabled={loading} aria-busy={loading || undefined}>
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                {loading ? "Kantu está preparando el laboratorio…" : "Generar guía de laboratorio"}
              </button>}
        </div>
      )}

      {resource && (
        <>
          <div className="flow-actionbar">
            <button onClick={() => setResource(null)}><Pencil size={15} /> Editar datos</button>
            <button onClick={() => unaVez(descargar)} disabled={downloading} aria-busy={downloading || undefined}>
              {downloading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
              {downloading ? "Preparando Word…" : "Descargar Word"}
            </button>
            <button onClick={() => window.print()}><Printer size={15} /> Descargar PDF</button>
          </div>

          <div className="modular-section">
            <h5>{resource.titulo}</h5>
            {estadoGuardado}
            <p><strong>Propósito:</strong> {resource.proposito}</p>
            <p><strong>Pregunta de indagación:</strong> {resource.preguntaIndagatoria}</p>

            <details open><summary>Ficha del estudiante</summary>
              <small>Compromisos de seguridad</small>
              <ul>{(resource.normasSeguridad || []).map((n, i) => <li key={i}>{n}</li>)}</ul>
              <small>Materiales</small>
              <p>{[...(resource.materialesKit || []), ...(resource.materialesCaseros || [])].join(" · ")}</p>
              <small>Procedimiento</small>
              <ul>{(resource.procedimiento || []).map((paso, i) => <li key={i}>{paso}</li>)}</ul>
            </details>

            <details><summary>Guía del docente</summary>
              <p><strong>Hipótesis modelo:</strong> {g.hipotesisModelo}</p>
              <small>Seguridad del docente</small>
              <p>{g.seguridadDocente}</p>
              <small>Criterios de evaluación</small>
              <ul>{(g.criterios || []).map((c, i) => <li key={i}>{c}</li>)}</ul>
              <small>Solucionario de referencia</small>
              <p>{g.solucionario?.conclusionModelo}</p>
            </details>
          </div>
        </>
      )}
    </div>
  );
}

import React from "react";
import { RefreshCw, Sparkles } from "lucide-react";

import Modal from "./Modal.jsx";
import Button from "./Button.jsx";

/* ==========================================================================
   LO QUE KANTU PROPONE, ANTES DE TOCAR EL FORMULARIO

   POR QUÉ UN MODAL Y NO UN TOAST
   ------------------------------
   La regla del producto es: toast para confirmar algo pequeño, modal cuando
   hay que leer y decidir. Una sugerencia es lo segundo — son cinco líneas o
   diez palabras que la docente tiene que aprobar— y además sustituye lo que
   ya había escrito. Escribir encima sin preguntar es la clase de cosa que se
   descubre cuando ya se perdió el texto.

   Antes esto era `alert("Kantu sugirió 9 palabras")`: un cuadro del sistema
   operativo, sin las palabras dentro, que ya había machacado el formulario
   antes de aparecer.

   CANCELAR NO TOCA NADA
   ---------------------
   El formulario sólo cambia al pulsar «Usar». Es la única forma de que
   probar una sugerencia no tenga coste.
   ========================================================================== */

/** Cabecera con Kantu. Pequeño: es un acento, no una ilustración. */
function CabeceraKantu({ titulo }) {
  return (
    <span className="sv-kantu-head">
      <img
        className="sv-kantu-head__avatar"
        src="/mascot/kantu-session.webp"
        alt=""
        width="44"
        height="44"
        loading="lazy"
      />
      <span className="sv-kantu-head__texto">
        <Sparkles size={15} aria-hidden="true" />
        {titulo}
      </span>
    </span>
  );
}

export default function SuggestionModal({
  open,
  titulo = "Kantu tiene una idea",
  introduccion,
  sugerencia,
  lista,
  reemplaza = false,
  cargando = false,
  /**
   * Sin campo donde pegarla.
   *
   * El enfoque del reto grupal es una orientación para decidir antes de
   * generar: su formulario no tiene un campo «dinámica» y no se va a inventar
   * uno para que el botón «Usar» tenga a dónde escribir. Se lee y se cierra,
   * y el botón lo dice.
   */
  soloLectura = false,
  onUsar,
  onReintentar,
  onCerrar,
  textoUsar = "Usar sugerencia",
}) {
  if (!open) return null;

  const hayLista = Array.isArray(lista) && lista.length > 0;
  const hayTexto = typeof sugerencia === "string" && sugerencia.trim().length > 0;
  const hayContenido = hayLista || hayTexto;

  return (
    <Modal
      open
      onClose={onCerrar}
      size="md"
      title={<CabeceraKantu titulo={titulo} />}
      description={introduccion}
      actions={
        <>
          {!soloLectura && <Button variant="ghost" onClick={onCerrar}>Cancelar</Button>}
          {onReintentar && (
            <Button
              variant="outline"
              icon={RefreshCw}
              onClick={onReintentar}
              loading={cargando}
              loadingText="Buscando otra idea…"
            >
              Volver a sugerir
            </Button>
          )}
          {soloLectura ? (
            <Button onClick={onCerrar}>Entendido</Button>
          ) : (
            <Button onClick={onUsar} disabled={!hayContenido || cargando}>
              {textoUsar}
            </Button>
          )}
        </>
      }
    >
      <div className="sv-sugerencia">
        {hayLista ? (
          <ul className={`sv-sugerencia__lista${lista.every((x) => !x.includes(" ")) ? " is-palabras" : ""}`}>
            {lista.map((elemento) => <li key={elemento}>{elemento}</li>)}
          </ul>
        ) : (
          <p className="sv-sugerencia__texto">{sugerencia}</p>
        )}

        {/* Sólo cuando de verdad hay algo escrito que se va a perder. */}
        {reemplaza && !soloLectura && (
          <p className="sv-sugerencia__aviso">
            Al usarla se reemplazará lo que ya habías escrito en este campo.
          </p>
        )}
      </div>
    </Modal>
  );
}

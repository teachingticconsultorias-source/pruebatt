import React from "react";
import { RotateCcw, TriangleAlert } from "lucide-react";

import Button from "../ui/Button.jsx";
import { T } from "../../lib/atlas/i18n.es.js";

/* ==========================================================================
   RED DE SEGURIDAD DEL ATLAS

   POR QUÉ NECESITA UNA PROPIA
   ---------------------------
   Un fallo dentro de WebGL no se parece a los demás fallos de SciVerse: no
   viene de una petición que se pueda reintentar, sino del dispositivo. Un
   controlador viejo, un móvil sin memoria o un contexto perdido al cambiar
   de pestaña tiran el árbol de React entero, y sin esta barrera la docente
   se queda mirando una pantalla blanca sin saber qué pasó.

   Lo que NO se enseña: el mensaje del error, la pila, `undefined` ni
   `[object Object]`. El detalle técnico va a la consola, que es donde sirve.
   ========================================================================== */
export default class AtlasErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { fallo: false };
    this.reintentar = this.reintentar.bind(this);
  }

  static getDerivedStateFromError() {
    return { fallo: true };
  }

  componentDidCatch(error, info) {
    // Sin datos de la docente y sin texto crudo en pantalla: sólo en consola.
    console.error("[sciverse:atlas]", error?.message || error, info?.componentStack);
  }

  reintentar() {
    this.setState({ fallo: false });
    this.props.onReintentar?.();
  }

  render() {
    if (!this.state.fallo) return this.props.children;

    return (
      <div className="atlas-error" role="alert">
        <TriangleAlert size={40} aria-hidden="true" />
        <h2>{T.errorTitulo}</h2>
        <p>{T.errorReintento}</p>
        <p className="atlas-error__nota">{T.errorDetalle}</p>
        <div className="atlas-error__acciones">
          <Button icon={RotateCcw} onClick={this.reintentar}>{T.errorAccion}</Button>
          {this.props.onVolver && (
            <Button variant="outline" onClick={this.props.onVolver}>{T.errorVolver}</Button>
          )}
        </div>
      </div>
    );
  }
}

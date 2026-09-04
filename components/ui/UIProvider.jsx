import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { CheckCircle2, AlertTriangle, Info, XCircle, X, Sparkles } from "lucide-react";
import Modal from "./Modal.jsx";
import Button from "./Button.jsx";

/* ==========================================================================
   Proveedor único de feedback de interfaz.

   Centraliza:
     • toasts (success · error · warning · info)
     • modal "Próximamente" para funciones sin backend
     • modal de confirmación accesible

   Sustituye a window.alert / window.confirm, que bloquean el hilo, no se
   pueden estilar, rompen la experiencia con lector de pantalla y en móvil
   muestran el dominio de la URL.
   ========================================================================== */

const UIContext = createContext(null);

const TOAST_ICON = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

export function UIProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [comingSoon, setComingSoon] = useState(null);
  const [confirmState, setConfirmState] = useState(null);
  const idRef = useRef(0);

  const dismissToast = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const toast = useCallback(
    ({ tone = "info", title, description, duration = 4500 }) => {
      const id = ++idRef.current;
      setToasts((current) => [...current, { id, tone, title, description }]);
      if (duration > 0) {
        window.setTimeout(() => dismissToast(id), duration);
      }
      return id;
    },
    [dismissToast]
  );

  /**
   * Modal para funciones que existen visualmente pero aún no tienen backend.
   * Punto único: evita `alert("próximamente")` disperso por el código.
   */
  const openComingSoon = useCallback((options = {}) => {
    setComingSoon({
      title: options.title || "Esta función llegará pronto",
      description:
        options.description ||
        "Estamos terminando esta herramienta para que puedas utilizarla con confianza en tu aula.",
      detail: options.detail || null,
    });
  }, []);

  /** Confirmación accesible. Reemplaza a window.confirm. */
  const confirm = useCallback((options = {}) => {
    return new Promise((resolve) => {
      setConfirmState({
        title: options.title || "¿Confirmas esta acción?",
        description: options.description || "",
        confirmText: options.confirmText || "Confirmar",
        cancelText: options.cancelText || "Cancelar",
        tone: options.tone || "default",
        resolve,
      });
    });
  }, []);

  const value = useMemo(
    () => ({ toast, openComingSoon, confirm, dismissToast }),
    [toast, openComingSoon, confirm, dismissToast]
  );

  return (
    <UIContext.Provider value={value}>
      {children}

      {/* ------------------------------------------------------------ TOASTS */}
      <div className="sv-toasts" role="region" aria-label="Notificaciones" aria-live="polite">
        {toasts.map((item) => {
          const Icon = TOAST_ICON[item.tone] || Info;
          return (
            <div key={item.id} className={`sv-toast sv-toast--${item.tone}`} role="status">
              <span className="sv-toast__icon" aria-hidden="true">
                <Icon size={18} />
              </span>
              <div className="sv-toast__content">
                {item.title && <strong>{item.title}</strong>}
                {item.description && <p>{item.description}</p>}
              </div>
              <button
                type="button"
                className="sv-toast__close"
                onClick={() => dismissToast(item.id)}
                aria-label="Descartar notificación"
              >
                <X size={15} />
              </button>
            </div>
          );
        })}
      </div>

      {/* ------------------------------------------------------- PRÓXIMAMENTE */}
      {comingSoon && (
        <Modal
          variant="comingSoon"
          size="sm"
          title={comingSoon.title}
          description={comingSoon.description}
          onClose={() => setComingSoon(null)}
          actions={
            <Button variant="primary" onClick={() => setComingSoon(null)}>
              Entendido
            </Button>
          }
        >
          {comingSoon.detail && <p className="sv-modal__detail">{comingSoon.detail}</p>}
        </Modal>
      )}

      {/* -------------------------------------------------------- CONFIRMAR */}
      {confirmState && (
        <Modal
          variant={confirmState.tone === "danger" ? "danger" : "default"}
          size="sm"
          title={confirmState.title}
          description={confirmState.description}
          onClose={() => {
            confirmState.resolve(false);
            setConfirmState(null);
          }}
          actions={
            <>
              <Button
                variant="ghost"
                onClick={() => {
                  confirmState.resolve(false);
                  setConfirmState(null);
                }}
              >
                {confirmState.cancelText}
              </Button>
              <Button
                variant={confirmState.tone === "danger" ? "danger" : "primary"}
                onClick={() => {
                  confirmState.resolve(true);
                  setConfirmState(null);
                }}
              >
                {confirmState.confirmText}
              </Button>
            </>
          }
        />
      )}
    </UIContext.Provider>
  );
}

/** Hook de acceso. Devuelve no-ops si se usa fuera del proveedor. */
export function useUI() {
  const context = useContext(UIContext);
  if (context) return context;
  return {
    toast: () => {},
    openComingSoon: () => {},
    confirm: async () => window.confirm("¿Confirmas esta acción?"),
    dismissToast: () => {},
  };
}

export { Sparkles };

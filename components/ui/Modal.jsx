import React, { useCallback, useEffect, useRef } from "react";
import { X, Sparkles, CheckCircle2, AlertTriangle, Info } from "lucide-react";

/**
 * Modal accesible reutilizable.
 *
 * Los 5 modales que existían en la aplicación no tenían NINGUNO de estos
 * comportamientos: no cerraban con Escape, el Tab se escapaba al fondo, el
 * foco no volvía al abridor y el scroll de fondo seguía activo.
 * (WCAG 2.1.2 sin trampa de teclado · 2.4.3 orden del foco)
 *
 * Variantes: default · success · warning · danger · info · comingSoon
 */

const VARIANT_ICON = {
  default: null,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: AlertTriangle,
  info: Info,
  comingSoon: Sparkles,
};

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

export default function Modal({
  open = true,
  onClose,
  title,
  description,
  variant = "default",
  size = "md",
  icon,
  children,
  actions,
  closeLabel = "Cerrar",
  dismissible = true,
}) {
  const panelRef = useRef(null);
  const openerRef = useRef(null);
  const titleId = useRef(`sv-modal-${Math.random().toString(36).slice(2, 9)}`);

  const handleClose = useCallback(() => {
    if (dismissible && onClose) onClose();
  }, [dismissible, onClose]);

  // Guarda quién abrió el modal para devolverle el foco al cerrar.
  useEffect(() => {
    if (!open) return undefined;
    openerRef.current = document.activeElement;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Foco inicial dentro del panel.
    const timer = window.setTimeout(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const first = panel.querySelector(FOCUSABLE);
      (first || panel).focus();
    }, 20);

    return () => {
      window.clearTimeout(timer);
      document.body.style.overflow = previousOverflow;
      // Devolución del foco al elemento que lo abrió.
      if (openerRef.current instanceof HTMLElement) openerRef.current.focus();
    };
  }, [open]);

  // Escape para cerrar + trampa de foco con Tab.
  useEffect(() => {
    if (!open) return undefined;

    function onKeyDown(event) {
      if (event.key === "Escape") {
        event.stopPropagation();
        handleClose();
        return;
      }
      if (event.key !== "Tab") return;

      const panel = panelRef.current;
      if (!panel) return;
      const nodes = Array.from(panel.querySelectorAll(FOCUSABLE)).filter(
        (node) => node.offsetParent !== null
      );
      if (nodes.length === 0) {
        event.preventDefault();
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [open, handleClose]);

  if (!open) return null;

  const Icon = icon || VARIANT_ICON[variant];

  return (
    <div
      className="sv-modal-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) handleClose();
      }}
    >
      <section
        ref={panelRef}
        className={`sv-modal sv-modal--${size} sv-modal--${variant}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId.current : undefined}
        tabIndex={-1}
      >
        {dismissible && (
          <button type="button" className="sv-modal__close" onClick={handleClose} aria-label={closeLabel}>
            <X size={18} />
          </button>
        )}

        {(Icon || title || description) && (
          <header className="sv-modal__head">
            {Icon && (
              <span className="sv-modal__icon" aria-hidden="true">
                <Icon size={22} />
              </span>
            )}
            {title && (
              <h2 id={titleId.current} className="sv-modal__title">
                {title}
              </h2>
            )}
            {description && <p className="sv-modal__desc">{description}</p>}
          </header>
        )}

        {children && <div className="sv-modal__body">{children}</div>}
        {actions && <footer className="sv-modal__actions">{actions}</footer>}
      </section>
    </div>
  );
}

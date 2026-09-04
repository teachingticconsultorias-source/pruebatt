import React from "react";
import { Loader2 } from "lucide-react";

/* ==========================================================================
   Estados de carga, vacío y error.
   Sustituyen a los spinners genéricos y a "No hay datos".
   ========================================================================== */

/** Bloque de esqueleto. Respeta prefers-reduced-motion vía tokens. */
export function Skeleton({ w = "100%", h = 16, radius = "var(--radius-sm)", className = "" }) {
  return (
    <span
      className={`sv-skeleton ${className}`.trim()}
      style={{ width: w, height: h, borderRadius: radius }}
      aria-hidden="true"
    />
  );
}

/** Tarjeta esqueleto con la forma real de una tarjeta de recurso. */
export function SkeletonCard() {
  return (
    <article className="sv-skeleton-card" aria-hidden="true">
      <Skeleton w={40} h={40} radius="var(--radius-md)" />
      <Skeleton w="70%" h={18} />
      <Skeleton w="45%" h={13} />
      <Skeleton w="30%" h={13} />
    </article>
  );
}

/** Rejilla de esqueletos para listados. */
export function SkeletonGrid({ count = 6 }) {
  return (
    <div className="sv-skeleton-grid" role="status" aria-label="Cargando contenido">
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

/** Indicador de carga en línea. */
export function Spinner({ size = 20, label = "Cargando…" }) {
  return (
    <span className="sv-spinner" role="status">
      <Loader2 size={size} className="sv-spin" aria-hidden="true" />
      <span className="sv-sr-only">{label}</span>
    </span>
  );
}

/**
 * Estado vacío.
 * Nunca "No hay datos": siempre explica qué pasará y ofrece una salida.
 */
export function EmptyState({
  illustration,
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  tone = "default",
}) {
  return (
    <div className={`sv-empty sv-empty--${tone}`}>
      {illustration ? (
        <img src={illustration} alt="" className="sv-empty__art" loading="lazy" />
      ) : (
        Icon && (
          <span className="sv-empty__icon" aria-hidden="true">
            <Icon size={26} />
          </span>
        )
      )}
      <h3 className="sv-empty__title">{title}</h3>
      {description && <p className="sv-empty__desc">{description}</p>}
      {(action || secondaryAction) && (
        <div className="sv-empty__actions">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}

/** Badge de estado o categoría. */
export function Badge({ tone = "neutral", icon: Icon, children, className = "" }) {
  return (
    <span className={`sv-badge sv-badge--${tone} ${className}`.trim()}>
      {Icon && <Icon size={12} aria-hidden="true" />}
      {children}
    </span>
  );
}

/** Aviso contextual en línea. */
export function Alert({ tone = "info", icon: Icon, title, children, action }) {
  return (
    <div className={`sv-alert sv-alert--${tone}`} role={tone === "danger" ? "alert" : "status"}>
      {Icon && (
        <span className="sv-alert__icon" aria-hidden="true">
          <Icon size={18} />
        </span>
      )}
      <div className="sv-alert__content">
        {title && <strong>{title}</strong>}
        {children && <p>{children}</p>}
      </div>
      {action && <div className="sv-alert__action">{action}</div>}
    </div>
  );
}

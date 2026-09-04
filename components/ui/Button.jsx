import React from "react";
import { Loader2 } from "lucide-react";

/**
 * Botón único del sistema.
 *
 * Antes convivían al menos 15 estilos de botón distintos: `.primary-btn`
 * definido 4 veces, `.secondary-btn` 3 veces, más docenas de estilos en línea.
 *
 * Variantes: primary · secondary · outline · ghost · danger · accent
 * Tamaños:   sm (32) · md (40) · lg (48)
 */
const Button = React.forwardRef(function Button(
  {
    as: Tag = "button",
    variant = "primary",
    size = "md",
    icon: Icon,
    iconRight: IconRight,
    loading = false,
    loadingText,
    fullWidth = false,
    className = "",
    children,
    disabled,
    ...rest
  },
  ref
) {
  const isDisabled = disabled || loading;

  return (
    <Tag
      ref={ref}
      className={`sv-btn sv-btn--${variant} sv-btn--${size}${fullWidth ? " sv-btn--block" : ""}${loading ? " is-loading" : ""} ${className}`.trim()}
      disabled={Tag === "button" ? isDisabled : undefined}
      aria-busy={loading || undefined}
      aria-disabled={Tag !== "button" && isDisabled ? true : undefined}
      {...rest}
    >
      {loading ? (
        <Loader2 size={size === "sm" ? 14 : 16} className="sv-spin" aria-hidden="true" />
      ) : (
        Icon && <Icon size={size === "sm" ? 14 : 17} aria-hidden="true" />
      )}
      <span>{loading && loadingText ? loadingText : children}</span>
      {!loading && IconRight && <IconRight size={size === "sm" ? 14 : 16} aria-hidden="true" />}
    </Tag>
  );
});

export default Button;

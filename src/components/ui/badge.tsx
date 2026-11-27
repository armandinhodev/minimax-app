"use client";

/**
 * Badge — a small label.
 *
 * A label is not a pill: it is a hairline rectangle in the label face. The
 * variants map to the app's three state colors and to its single accent, so
 * a badge never introduces a hue the rest of the app does not use.
 */

function Badge({ variant = "subtle", children, className, onClick, style }: {
  variant?: "solid" | "subtle" | "outline" | "secondary" | "destructive" | "default" | "success" | "info" | "warning" | "purple";
  children?: React.ReactNode;
  className?: string;
  onClick?: () => void;
  style?: React.CSSProperties;
}) {
  const effectiveVariant = variant === "default" ? "subtle" : variant;

  const variantStyles: Record<string, React.CSSProperties> = {
    solid: {
      background: "var(--chakra-colors-interaction-accent)",
      color: "var(--chakra-colors-content-inverse)",
    },
    subtle: {
      background: "var(--chakra-colors-interaction-soft)",
      color: "var(--chakra-colors-content-ink)",
    },
    outline: {
      border: "1px solid var(--chakra-colors-surface-rule)",
      color: "var(--chakra-colors-content-readout)",
    },
    secondary: {
      background: "var(--chakra-colors-surface-field)",
      color: "var(--chakra-colors-content-readout)",
    },
    destructive: {
      background: "var(--chakra-colors-state-err-soft)",
      color: "var(--chakra-colors-state-err)",
    },
    success: {
      background: "var(--chakra-colors-state-ok-soft)",
      color: "var(--chakra-colors-state-ok)",
    },
    info: {
      background: "var(--chakra-colors-interaction-soft)",
      color: "var(--chakra-colors-content-ink)",
    },
    warning: {
      background: "var(--chakra-colors-state-run-soft)",
      color: "var(--chakra-colors-state-run)",
    },
    purple: {
      background: "var(--chakra-colors-interaction-soft)",
      color: "var(--chakra-colors-content-ink)",
    },
  };

  return (
    <span
      className={className}
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        height: "1.25rem",
        paddingLeft: "0.375rem",
        paddingRight: "0.375rem",
        fontFamily: "var(--chakra-fonts-mono)",
        fontSize: "0.6875rem",
        letterSpacing: "0.04em",
        borderRadius: "var(--chakra-radii-md)",
        cursor: onClick ? "pointer" : "default",
        ...(variantStyles[effectiveVariant] || variantStyles.subtle),
        ...style,
      }}
    >
      {children}
    </span>
  );
}

export { Badge };

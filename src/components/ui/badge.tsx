"use client";

/**
 * Badge — a small label.
 *
 * A label is a rectangle in the label face, never a pill. The variants map to
 * the app's three state colors and its single accent, so a badge never
 * introduces a hue the rest of the app does not use.
 */

function Badge({ variant = "subtle", children, className, onClick, style }: {
  variant?: "solid" | "subtle" | "outline" | "secondary" | "destructive" | "default" | "success" | "info" | "warning";
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
      color: "var(--chakra-colors-interaction-accent)",
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
      color: "var(--chakra-colors-interaction-accent)",
    },
    warning: {
      background: "var(--chakra-colors-state-run-soft)",
      color: "var(--chakra-colors-state-run)",
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
        height: "1.3rem",
        paddingLeft: "0.4rem",
        paddingRight: "0.4rem",
        fontFamily: "var(--chakra-fonts-body)",
        fontSize: "0.75rem",
        fontWeight: 500,
        borderRadius: "var(--chakra-radii-sm)",
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

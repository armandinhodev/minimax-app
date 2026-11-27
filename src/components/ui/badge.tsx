"use client";

/**
 * Badge — a small state or type label.
 *
 * A hairline rectangle with a 3px radius, never a pill. State variants use the
 * status color for the border and the text, so the word and the color agree.
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
      border: "1px solid var(--chakra-colors-interaction-accent)",
    },
    subtle: {
      background: "var(--chakra-colors-surface-plate)",
      color: "var(--chakra-colors-content-readout)",
      border: "1px solid var(--chakra-colors-surface-separator)",
    },
    outline: {
      background: "var(--chakra-colors-surface-plate)",
      color: "var(--chakra-colors-content-ink)",
      border: "1px solid var(--chakra-colors-surface-rule)",
    },
    secondary: {
      background: "var(--chakra-colors-surface-inset)",
      color: "var(--chakra-colors-content-readout)",
      border: "1px solid var(--chakra-colors-surface-inset)",
    },
    destructive: {
      background: "var(--chakra-colors-surface-plate)",
      color: "var(--chakra-colors-state-err)",
      border: "1px solid var(--chakra-colors-state-err)",
    },
    success: {
      background: "var(--chakra-colors-surface-plate)",
      color: "var(--chakra-colors-state-ok)",
      border: "1px solid var(--chakra-colors-state-ok)",
    },
    info: {
      background: "var(--chakra-colors-surface-plate)",
      color: "var(--chakra-colors-content-ink)",
      border: "1px solid var(--chakra-colors-surface-rule)",
    },
    warning: {
      background: "var(--chakra-colors-surface-plate)",
      color: "var(--chakra-colors-state-run)",
      border: "1px solid var(--chakra-colors-state-run)",
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
        gap: "4px",
        height: "24px",
        paddingLeft: "8px",
        paddingRight: "8px",
        fontFamily: "var(--chakra-fonts-body)",
        fontSize: "0.8125rem",
        fontWeight: 500,
        lineHeight: 1,
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

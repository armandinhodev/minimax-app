"use client";

function Label({ children, htmlFor, className, style }: {
  children?: React.ReactNode;
  htmlFor?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={className}
      style={{
        fontSize: "var(--chakra-font-sizes-label)",
        fontWeight: 700,
        lineHeight: "var(--chakra-line-heights-label)",
        color: "var(--chakra-colors-content-ink)",
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
        cursor: "pointer",
        ...style,
      }}
    >
      {children}
    </label>
  );
}

export { Label };

"use client";

/**
 * Chip — an exclusive or toggle choice.
 *
 * A 36px control with a check mark on the selected option. It is used for
 * model, ratio, area, format, filters and transport selection, so a selected
 * option never relies on color alone.
 */

import { Icon } from "@/components/ui/icons";

interface ChipProps {
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  /** Optional id for the htmlFor of a persistent label. */
  id?: string;
}

export function Chip({ selected = false, disabled = false, onClick, children, className, style, id }: ChipProps) {
  return (
    <button
      type="button"
      id={id}
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "6px",
        minHeight: "40px",
        padding: "6px 12px",
        border: `1px solid ${selected ? "var(--chakra-colors-interaction-accent)" : "var(--chakra-colors-surface-rule)"}`,
        background: selected ? "var(--chakra-colors-interaction-soft)" : "var(--chakra-colors-surface-plate)",
        color: selected
          ? "var(--chakra-colors-interaction-accent)"
          : disabled
            ? "var(--chakra-colors-content-readout)"
            : "var(--chakra-colors-content-ink)",
        borderRadius: "var(--chakra-radii-md)",
        fontSize: "var(--chakra-font-sizes-label)",
        lineHeight: "var(--chakra-line-heights-label)",
        fontWeight: selected ? 700 : 600,
        fontFamily: "inherit",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.65 : 1,
        textAlign: "center",
        transition: "background-color 120ms ease, border-color 120ms ease",
        ...style,
      }}
    >
      {selected && <Icon name="check" size={14} />}
      {children}
    </button>
  );
}

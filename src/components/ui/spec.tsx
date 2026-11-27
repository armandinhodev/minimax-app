"use client";

/**
 * Spec — a label/value row.
 *
 * Read-only production facts read as a definition table: label on the left,
 * value on the right in mono. Rows share a hairline separator.
 *
 * See docs/minimax-studio-ui/Minimax-directrices.md.
 */

import { Box, type BoxProps } from "@chakra-ui/react";

interface SpecProps extends BoxProps {
  /** What the field is, in the user's words. */
  label: string;
  /** The current value. Rendered in mono unless `plain` is set. */
  value: React.ReactNode;
  /** Renders the value in the UI face instead of mono. */
  plain?: boolean;
}

export function Spec({ label, value, plain = false, ...props }: SpecProps) {
  return (
    <Box
      display="grid"
      gridTemplateColumns="minmax(0, 1fr) auto"
      gap={4}
      alignItems="baseline"
      py="9px"
      borderBottom="1px solid"
      borderColor="surface.separator"
      {...props}
    >
      <Box fontSize="label" lineHeight="label" color="content.readout" minW={0}>
        {label}
      </Box>
      <Box
        fontFamily={plain ? "body" : "mono"}
        fontSize={plain ? "body" : "mono"}
        lineHeight={plain ? "body" : "mono"}
        fontVariantNumeric="tabular-nums"
        color="content.ink"
        textAlign="right"
        overflowWrap="anywhere"
      >
        {value}
      </Box>
    </Box>
  );
}

interface SpecListProps extends BoxProps {
  children: React.ReactNode;
}

/** A stack of Spec rows sharing one hairline. */
export function SpecList({ children, ...props }: SpecListProps) {
  return (
    <Box borderTop="1px solid" borderColor="surface.separator" {...props}>
      {children}
    </Box>
  );
}

interface FieldProps extends BoxProps {
  /** What the field is, in the user's words. */
  label: string;
  /** Id of the control, so the label is programmatically associated with it. */
  htmlFor?: string;
  /**
   * Marks the field as required, visibly.
   *
   * The label stays clean: it names the field and nothing else. A field the
   * user must fill carries an asterisk, and the control carries `required`
   * and `aria-required` for the assistive layer.
   */
  required?: boolean;
  children: React.ReactNode;
}

/**
 * A labelled control.
 *
 * Label above the control, never beside it: the length of the name must not
 * move the field column. Two short fields can share a row when they are
 * comparable.
 */
export function Field({ label, htmlFor, required = false, children, ...props }: FieldProps) {
  return (
    <Box display="grid" gap="6px" minW={0} {...props}>
      <label
        htmlFor={htmlFor}
        style={{
          fontSize: "var(--chakra-font-sizes-label)",
          lineHeight: "var(--chakra-line-heights-label)",
          fontWeight: 700,
          color: "var(--chakra-colors-content-ink)",
        }}
      >
        {label}
        {required && (
          <span aria-hidden="true" style={{ color: "var(--chakra-colors-content-readout)" }}>
            {" *"}
          </span>
        )}
      </label>
      <Box minW={0}>{children}</Box>
    </Box>
  );
}

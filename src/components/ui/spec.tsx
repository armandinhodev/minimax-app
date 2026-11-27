"use client";

/**
 * Spec — a label/value row.
 *
 * Parameters are the densest thing on every screen, so they read as a
 * definition table: label on the left, value on the right in mono. A column
 * of values lines up, so two parameter sets can be compared at a glance.
 *
 * See docs/design.md.
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
      gridTemplateColumns={{ base: "1fr", md: "10rem minmax(0, 20rem)" }}
      gap={{ base: 1, md: 4 }}
      alignItems="baseline"
      py="0.5rem"
      borderBottom="1px solid"
      borderColor="surface.rule"
      {...props}
    >
      <Box fontSize="label" lineHeight="label" fontWeight="500" color="content.readout">
        {label}
      </Box>
      <Box
        fontFamily={plain ? "body" : "mono"}
        fontSize={plain ? "body" : "mono"}
        lineHeight={plain ? "body" : "mono"}
        fontVariantNumeric="tabular-nums"
        color="content.ink"
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

/** A stack of Spec rows sharing one seam. */
export function SpecList({ children, ...props }: SpecListProps) {
  return (
    <Box borderTop="1px solid" borderColor="surface.rule" {...props}>
      {children}
    </Box>
  );
}

const rowLayout = {
  display: "grid",
  // La columna de etiqueta es fija: con una fraccion, el ancho dependia del
  // contenido del control y dos filas distintas no alineaban sus columnas.
  // La de control se topa: un valor de "2K" no debe ocupar 600px.
  gridTemplateColumns: { base: "1fr", md: "10rem minmax(0, 20rem)" },
  gap: { base: 1, md: 4 },
  alignItems: "center",
  py: "0.375rem",
  borderBottom: "1px solid",
  borderColor: "surface.rule",
} as const;

interface FieldProps extends BoxProps {
  /** What the field is, in the user's words. */
  label: string;
  /** Id of the control, so the label is programmatically associated with it. */
  htmlFor?: string;
  children: React.ReactNode;
}

/**
 * A labelled control.
 *
 * Same geometry as a Spec row: the label sits on the left and the control on
 * the right, so a form reads as a parameter sheet instead of a stack of
 * rounded inputs.
 */
export function Field({ label, htmlFor, children, ...props }: FieldProps) {
  return (
    <Box {...rowLayout} {...props}>
      {/* Un <label> real: la asociacion con el control no depende del primitivo. */}
      <label
        htmlFor={htmlFor}
        style={{
          fontSize: 'var(--chakra-font-sizes-label)',
          lineHeight: 'var(--chakra-line-heights-label)',
          fontWeight: 500,
          color: 'var(--chakra-colors-content-readout)',
        }}
      >
        {label}
      </label>
      <Box minW={0}>{children}</Box>
    </Box>
  );
}

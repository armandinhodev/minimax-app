"use client";

/**
 * AreaHeader — the header of a screen.
 *
 * A light header instead of a dark band: the title, one line of what the area
 * does, at most one constraint worth reading, and the live state. The artifact
 * gets the bright surface, not the header.
 *
 * See docs/design.md.
 */

import { Box, type BoxProps } from "@chakra-ui/react";

import { StatusLamp, type LampState } from "@/components/ui/status-lamp";

export interface Readout {
  label: string;
  value: string;
}

interface ReadoutStripProps {
  readouts: Readout[];
  /** What the readouts are, so they are not read as a copy of the form. */
  label?: string;
}

/** A row of values in mono. It can sit in a plate caption or on its own. */
export function ReadoutStrip({ readouts, label }: ReadoutStripProps) {
  return (
    <Box display="grid" gap={1}>
      {label && (
        <Box color="content.readout" fontSize="label" lineHeight="label" fontWeight={500}>
          {label}
        </Box>
      )}
      <Box display="flex" flexWrap="wrap" gap={{ base: 4, md: 6 }}>
        {readouts.map((readout) => (
          <Box key={readout.label} display="grid" gap="0.1rem">
            <Box color="content.readout" fontSize="label" lineHeight="label" fontWeight={500}>
              {readout.label}
            </Box>
            <Box
              fontFamily="mono"
              fontSize="mono"
              lineHeight="mono"
              color="content.ink"
              fontVariantNumeric="tabular-nums"
            >
              {readout.value}
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

interface AreaHeaderProps extends BoxProps {
  title: string;
  /** One line describing what the area does. */
  description?: string;
  /** A constraint worth reading, shown under the description. */
  note?: string;
  /** Live state of the current job, when the page tracks one. */
  state?: LampState;
  stateDetail?: string;
  /** Key facts of the current job, in mono. */
  readouts?: Readout[];
  /** What the readouts are, so they are not read as a copy of the form. */
  readoutsLabel?: string;
  /** Controls that belong to the header, shown on the right. */
  actions?: React.ReactNode;
}

export function AreaHeader({
  title,
  description,
  note,
  state,
  stateDetail,
  readouts,
  readoutsLabel,
  actions,
  ...props
}: AreaHeaderProps) {
  return (
    <Box
      pb={4}
      mb={0}
      borderBottom="1px solid"
      borderColor="surface.rule"
      {...props}
    >
      <Box display="flex" alignItems="flex-start" justifyContent="space-between" gap={4} flexWrap="wrap">
        <Box minW={0} maxW="52rem">
          <Box as="h1" fontSize="display" lineHeight="display" fontWeight="600" letterSpacing="-0.02em" color="content.ink">
            {title}
          </Box>
          {description && (
            <Box color="content.readout" fontSize="body" lineHeight="body" mt={2} maxW="46rem">
              {description}
            </Box>
          )}
          {note && (
            <Box color="content.subtle" fontSize="label" lineHeight="label" mt={2} maxW="46rem">
              {note}
            </Box>
          )}
        </Box>

        <Box display="flex" alignItems="center" gap={3} flexWrap="wrap" flex="0 0 auto">
          {state && <StatusLamp state={state} detail={stateDetail} />}
          {actions}
        </Box>
      </Box>

      {readouts && readouts.length > 0 && (
        <Box mt={4}>
          <ReadoutStrip readouts={readouts} label={readoutsLabel} />
        </Box>
      )}
    </Box>
  );
}

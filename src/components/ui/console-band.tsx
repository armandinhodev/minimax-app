"use client";

/**
 * ConsoleBand — the instrument header.
 *
 * This is the one bold element on every screen. It opens each page with
 * the identity of the instrument and, when there is one, the live state of
 * the job: the same thing a mixing desk shows above its channels.
 */

import { Box, type BoxProps } from "@chakra-ui/react";

import { StatusLamp, type LampState } from "@/components/ui/status-lamp";

export interface ConsoleReadout {
  label: string;
  value: string;
}

interface ReadoutStripProps {
  readouts: ConsoleReadout[];
  /** What the readouts are, so they are not read as a copy of the form. */
  label?: string;
}

/**
 * The instrument readout.
 *
 * A row of values in mono under a hairline, the way a desk shows what the
 * channel is doing. It can sit under the band header or on its own.
 */
export function ReadoutStrip({ readouts, label }: ReadoutStripProps) {
  return (
    <Box display="grid" gap={2}>
      {label && (
        <Box
          color="console.faint"
          fontFamily="mono"
          fontSize="0.6875rem"
          letterSpacing="0.08em"
          textTransform="uppercase"
        >
          {label}
        </Box>
      )}
      <Box
        display="grid"
        gridTemplateColumns={{ base: "1fr 1fr", md: "repeat(4, auto)" }}
        gap={{ base: 3, md: 6 }}
        justifyContent="start"
      >
        {readouts.map((readout) => (
          <Box key={readout.label} display="grid" gap="0.125rem">
            <Box
              color="console.faint"
              fontSize="label"
              lineHeight="label"
              fontWeight={500}
            >
              {readout.label}
            </Box>
            <Box
              fontFamily="mono"
              fontSize="mono"
              lineHeight="mono"
              color="console.text"
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

interface ConsoleBandProps extends BoxProps {
  /** Two-letter monogram of the area, e.g. "VI" for video. */
  monogram?: string;
  title: string;
  /** One line describing what the instrument does. */
  description?: string;
  /** A constraint worth reading, shown under the description. */
  note?: string;
  /** Live state of the current job, when the page tracks one. */
  state?: LampState;
  stateDetail?: string;
  /** Key facts of the current job, in mono. */
  readouts?: ConsoleReadout[];
  /** What the readouts are, so they are not read as a copy of the form. */
  readoutsLabel?: string;
  /** Controls that belong to the instrument, shown on the right. */
  actions?: React.ReactNode;
}

export function ConsoleBand({
  monogram,
  title,
  description,
  note,
  state,
  stateDetail,
  readouts,
  readoutsLabel,
  actions,
  ...props
}: ConsoleBandProps) {
  return (
    <Box
      bg="console.bg"
      color="console.text"
      borderRadius="lg"
      px={{ base: 4, md: 5 }}
      py={{ base: 4, md: 5 }}
      display="grid"
      gap={4}
      {...props}
    >
      <Box display="flex" alignItems="flex-start" justifyContent="space-between" gap={4} flexWrap="wrap">
        <Box display="flex" alignItems="flex-start" gap={3} minW={0}>
          {monogram && (
            <Box
              aria-hidden="true"
              display="inline-flex"
              alignItems="center"
              justifyContent="center"
              w="2.25rem"
              h="2.25rem"
              flex="0 0 auto"
              border="1px solid"
              borderColor="console.seam"
              borderRadius="md"
              fontFamily="mono"
              fontSize="0.8125rem"
              letterSpacing="0.08em"
              color="console.muted"
            >
              {monogram}
            </Box>
          )}
          <Box minW={0}>
            <Box fontSize="display" lineHeight="display" fontWeight="600" letterSpacing="-0.02em">
              {title}
            </Box>
            {description && (
              <Box color="console.muted" fontSize="body" lineHeight="body" mt={1} maxW="46rem">
                {description}
              </Box>
            )}
            {note && (
              <Box color="console.faint" fontSize="label" lineHeight="label" mt={2} maxW="46rem">
                {note}
              </Box>
            )}
          </Box>
        </Box>

        <Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
          {state && <StatusLamp state={state} detail={stateDetail} />}
          {actions}
        </Box>
      </Box>

      {readouts && readouts.length > 0 && (
        <Box borderTop="1px solid" borderColor="console.seam" pt={3}>
          <ReadoutStrip readouts={readouts} label={readoutsLabel} />
        </Box>
      )}
    </Box>
  );
}

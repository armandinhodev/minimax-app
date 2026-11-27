"use client";

/**
 * StatusLamp — the state readout.
 *
 * State is the loudest thing on the page: a lit dot and a mono label, on the
 * soft ground of the state it names. It is the only circle in the system.
 *
 * See docs/design.md.
 */

import { Box, type BoxProps } from "@chakra-ui/react";

export type LampState =
  | "queued"
  | "running"
  | "processing"
  | "preparing"
  | "succeeded"
  | "failed"
  | "cancelled";

const LAMP_TONE: Record<LampState, { token: string; soft: string; label: string }> = {
  queued: { token: "state.run", soft: "state.runSoft", label: "Queued" },
  running: { token: "state.run", soft: "state.runSoft", label: "Running" },
  processing: { token: "state.run", soft: "state.runSoft", label: "Processing" },
  preparing: { token: "state.run", soft: "state.runSoft", label: "Preparing" },
  succeeded: { token: "state.ok", soft: "state.okSoft", label: "Succeeded" },
  failed: { token: "state.err", soft: "state.errSoft", label: "Failed" },
  cancelled: { token: "state.run", soft: "state.runSoft", label: "Cancelled" },
};

interface StatusLampProps extends BoxProps {
  state: LampState;
  /** Optional detail shown to the right of the state. */
  detail?: string;
}

export function StatusLamp({ state, detail, ...props }: StatusLampProps) {
  const tone = LAMP_TONE[state] ?? LAMP_TONE.queued;

  return (
    <Box
      display="inline-flex"
      alignItems="center"
      gap={2}
      minH="1.875rem"
      px="0.6rem"
      py="0.25rem"
      bg={tone.soft}
      borderRadius="sm"
      {...props}
    >
      <Box aria-hidden="true" w="0.5rem" h="0.5rem" flex="0 0 auto" bg={tone.token} borderRadius="full" />
      <Box fontFamily="mono" fontSize="mono" lineHeight="mono" fontWeight="500" color="content.ink">
        {tone.label}
      </Box>
      {detail && (
        <Box fontFamily="mono" fontSize="label" lineHeight="label" color="content.readout" ml={1}>
          {detail}
        </Box>
      )}
    </Box>
  );
}

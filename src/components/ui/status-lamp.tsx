"use client";

/**
 * StatusLamp — the state readout.
 *
 * This is where the app spends its boldness: the state of a job is the one
 * thing an operator scans for. A lit bar plus a mono label reads like an
 * indicator on a panel, not like a badge.
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
      display="flex"
      alignItems="center"
      gap={3}
      minH="2rem"
      px={3}
      py="0.375rem"
      bg={tone.soft}
      border="1px solid"
      borderColor={tone.token}
      borderRadius="lg"
      {...props}
    >
      <Box
        aria-hidden="true"
        w="3px"
        alignSelf="stretch"
        bg={tone.token}
        borderRadius="sm"
      />
      <Box fontFamily="mono" fontSize="mono" lineHeight="mono" fontWeight="500" color="content.ink">
        {tone.label}
      </Box>
      {detail && (
        <Box fontFamily="mono" fontSize="mono" lineHeight="mono" color="content.readout" ml="auto">
          {detail}
        </Box>
      )}
    </Box>
  );
}

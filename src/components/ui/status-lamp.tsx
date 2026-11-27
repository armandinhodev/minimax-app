"use client";

/**
 * StatusLamp — the state of a job.
 *
 * A bordered badge with a symbol and a word: check for success, clock for
 * work in progress, cross for failure. The color is never the only signal.
 */

import { Box, type BoxProps } from "@chakra-ui/react";

import { Icon } from "@/components/ui/icons";

export type LampState =
  | "queued"
  | "running"
  | "processing"
  | "preparing"
  | "succeeded"
  | "failed"
  | "cancelled";

const LAMP_TONE: Record<LampState, { token: string; label: string; icon: "clock" | "check" | "close" | "pause" }> = {
  queued: { token: "state.run", label: "Queued", icon: "clock" },
  running: { token: "state.run", label: "Running", icon: "clock" },
  processing: { token: "state.run", label: "Processing", icon: "clock" },
  preparing: { token: "state.run", label: "Preparing", icon: "clock" },
  succeeded: { token: "state.ok", label: "Succeeded", icon: "check" },
  failed: { token: "state.err", label: "Failed", icon: "close" },
  cancelled: { token: "content.readout", label: "Cancelled", icon: "pause" },
};

interface StatusLampProps extends BoxProps {
  state: LampState;
  /** Optional detail shown next to the state. */
  detail?: string;
}

export function StatusLamp({ state, detail, ...props }: StatusLampProps) {
  const tone = LAMP_TONE[state] ?? LAMP_TONE.queued;

  return (
    <Box
      display="inline-flex"
      alignItems="center"
      gap="5px"
      minH="24px"
      px="8px"
      py="2px"
      bg={state === "cancelled" ? "surface.inset" : "surface.plate"}
      border="1px solid"
      borderColor={tone.token}
      borderRadius="sm"
      color={tone.token}
      {...props}
    >
      <Icon name={tone.icon} size={13} />
      <Box fontFamily="body" fontSize="0.8125rem" lineHeight={1} fontWeight={500}>
        {tone.label}
      </Box>
      {detail && (
        <Box fontFamily="mono" fontSize="0.75rem" lineHeight={1} color="content.readout" ml={1}>
          {detail}
        </Box>
      )}
    </Box>
  );
}

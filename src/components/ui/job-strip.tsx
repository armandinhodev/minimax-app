"use client";

/**
 * JobStrip — the four stages of a generation.
 *
 * Compose, Dispatch, Render and Retrieve are a sequence, so they are laid out
 * as one. Completed steps carry a check, the current step a thick copper rule,
 * and the backend decides which stage the task is in.
 *
 * See docs/minimax-studio-ui/Minimax-directrices.md.
 */

import { Box } from "@chakra-ui/react";

import { Icon } from "@/components/ui/icons";
import type { LampState } from "@/components/ui/status-lamp";

const STAGES = ["Compose", "Dispatch", "Render", "Retrieve"] as const;

/** Which stage a lamp state belongs to. */
function stageOf(state: LampState): number {
  switch (state) {
    case "queued":
    case "preparing":
      return 1;
    case "running":
    case "processing":
    case "failed":
    case "cancelled":
      return 2;
    case "succeeded":
      return 3;
    default:
      return 0;
  }
}

interface JobStripProps {
  state?: LampState;
}

export function JobStrip({ state }: JobStripProps) {
  if (!state) return null;

  const current = stageOf(state);

  return (
    <Box role="group" aria-label="Job stages" display="grid" gridTemplateColumns="repeat(4, minmax(0, 1fr))" gap="10px">
      {STAGES.map((stage, index) => {
        const done = index < current;
        const active = index === current;

        return (
          <Box
            key={stage}
            display="flex"
            alignItems="center"
            gap="6px"
            pb="6px"
            borderBottom={active ? "3px solid" : "1px solid"}
            borderColor={active ? "interaction.accent" : done ? "surface.rule" : "surface.separator"}
            color={active ? "interaction.accent" : done ? "content.ink" : "content.readout"}
            aria-current={active ? "step" : undefined}
            minW={0}
          >
            {done && <Icon name="check" size={13} />}
            <Box
              fontSize="help"
              lineHeight="help"
              fontWeight={active ? 700 : 500}
              overflow="hidden"
              textOverflow="ellipsis"
              whiteSpace="nowrap"
            >
              {stage}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

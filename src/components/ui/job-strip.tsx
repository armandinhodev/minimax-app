"use client";

/**
 * JobStrip — the four stages of a generation, as they actually happen.
 *
 * Compose, Dispatch, Render, Retrieve is a sequence, so it is shown as one.
 * The strip appears only when a job exists; the stage it marks is the stage
 * the job is in.
 *
 * See docs/design.md.
 */

import { Box } from "@chakra-ui/react";

import { StatusLamp, type LampState } from "@/components/ui/status-lamp";

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

function toneOf(state: LampState): string {
  if (state === "succeeded") return "state.ok";
  if (state === "failed") return "state.err";
  return "state.run";
}

interface JobStripProps {
  state?: LampState;
  /** A detail the operator needs next to the stage, e.g. the task id. */
  detail?: string;
}

export function JobStrip({ state, detail }: JobStripProps) {
  if (!state) return null;

  const current = stageOf(state);

  return (
    <Box
      display="flex"
      alignItems="center"
      gap={{ base: 3, md: 5 }}
      flexWrap="wrap"
      pb={3}
      mb={5}
      borderBottom="1px solid"
      borderColor="surface.rule"
      role="group"
      aria-label="Job stages"
    >
      <Box as="ol" display="flex" alignItems="center" gap={{ base: 3, md: 5 }} listStyleType="none" m={0} p={0}>
        {STAGES.map((stage, index) => {
          const done = index < current;
          const active = index === current;
          const tone = active ? toneOf(state) : "interaction.accent";

          return (
            <Box
              as="li"
              key={stage}
              display="flex"
              alignItems="center"
              gap={2}
              aria-current={active ? "step" : undefined}
            >
              <Box
                aria-hidden="true"
                w="0.5rem"
                h="0.5rem"
                flex="0 0 auto"
                bg={active ? tone : done ? "interaction.accent" : "surface.rule"}
                border="1px solid"
                borderColor={active ? tone : done ? "interaction.accent" : "surface.rule"}
              />
              <Box
                fontSize="label"
                lineHeight="label"
                fontWeight={active ? 600 : 500}
                color={active ? "content.ink" : done ? "content.readout" : "content.subtle"}
              >
                {stage}
              </Box>
            </Box>
          );
        })}
      </Box>

      <Box ml={{ base: 0, md: "auto" }}>
        <StatusLamp state={state} detail={detail} />
      </Box>
    </Box>
  );
}

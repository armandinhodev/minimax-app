"use client";

/**
 * AreaHeader — the title block of a screen.
 *
 * One 46px title, one line of what the area does, at most one constraint, and
 * the live state or actions on the right. No band, no rule: the panels below
 * carry the structure.
 *
 * See docs/minimax-studio-ui/Minimax-directrices.md.
 */

import { Box, type BoxProps } from "@chakra-ui/react";

import { StatusLamp, type LampState } from "@/components/ui/status-lamp";

export interface Readout {
  label: string;
  value: string;
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
  /** Controls that belong to the header, shown on the right. */
  actions?: React.ReactNode;
}

export function AreaHeader({
  title,
  description,
  note,
  state,
  stateDetail,
  actions,
  ...props
}: AreaHeaderProps) {
  return (
    <Box
      display="flex"
      alignItems="flex-start"
      justifyContent="space-between"
      gap={4}
      flexWrap="wrap"
      {...props}
    >
      <Box minW={0} maxW="52rem">
        <Box as="h1" fontSize={{ base: "2.125rem", md: "display" }} lineHeight="display" fontWeight={700} letterSpacing={{ base: "-0.02em", md: "-0.039em" }} color="content.ink">
          {title}
        </Box>
        {description && (
          <Box color="content.readout" fontSize="body" lineHeight="body" mt={2} maxW="48rem">
            {description}
          </Box>
        )}
        {note && (
          <Box color="content.readout" fontSize="help" lineHeight="help" mt={2} maxW="48rem">
            {note}
          </Box>
        )}
      </Box>

      <Box display="flex" alignItems="center" gap={3} flexWrap="wrap" flex="0 0 auto">
        {state && <StatusLamp state={state} detail={stateDetail} />}
        {actions}
      </Box>
    </Box>
  );
}

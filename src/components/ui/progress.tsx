"use client";

import { Box } from "@chakra-ui/react";
import type { BoxProps } from "@chakra-ui/react";

interface ProgressProps extends BoxProps {
  value?: number;
}

function Progress({ value, ...props }: ProgressProps) {
  return (
    <Box
      position="relative"
      height="0.1875rem"
      borderRadius="sm"
      bg="surface.rule"
      overflow="hidden"
      {...props}
    >
      <Box
        position="absolute"
        top="0"
        left="0"
        height="100%"
        width={value ? `${value}%` : "0%"}
        bg="interaction.accent"
        transition="width 0.3s ease"
      />
    </Box>
  );
}

export { Progress };

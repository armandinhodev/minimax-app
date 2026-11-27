"use client";

import { Box } from "@chakra-ui/react";
import type { BoxProps } from "@chakra-ui/react";

function Skeleton({ ...props }: BoxProps) {
  return <Box borderRadius="md" bg="surface.rule" {...props} />;
}

export { Skeleton };

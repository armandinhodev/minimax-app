"use client";

/**
 * Alert — a message panel.
 *
 * A message is a readout, not a card: it is separated by a colored rule and
 * a tinted ground, never by a rounded box with a shadow.
 */

import { Box } from "@chakra-ui/react";
import type { BoxProps } from "@chakra-ui/react";

interface AlertProps extends BoxProps {
  variant?: "default" | "destructive";
}

function Alert({ variant = "default", ...props }: AlertProps) {
  const destructive = variant === "destructive";

  return (
    <Box
      position="relative"
      display="grid"
      gap="0.25rem"
      pl={3}
      pr={3}
      py="0.625rem"
      borderLeft="2px solid"
      borderLeftColor={destructive ? "state.err" : "interaction.accent"}
      bg={destructive ? "state.errSoft" : "interaction.soft"}
      fontSize="body"
      lineHeight="body"
      textAlign="left"
      {...props}
    />
  );
}

function AlertTitle({ ...props }: BoxProps) {
  return <Box fontWeight="600" {...props} />;
}

function AlertDescription({ ...props }: BoxProps) {
  return <Box fontSize="body" lineHeight="body" color="content.readout" {...props} />;
}

export { Alert, AlertTitle, AlertDescription };

"use client";

/**
 * Alert — a message panel.
 *
 * A soft tint of the state over white, with the text in ink. No left bar, no
 * shadow. The title says what happened and the description says what to do.
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
      display="grid"
      gap="2px"
      px="14px"
      py="12px"
      borderRadius="md"
      bg={destructive ? "state.errSoft" : "surface.inset"}
      color="content.ink"
      fontSize="label"
      lineHeight="1.4"
      textAlign="left"
      {...props}
    />
  );
}

function AlertTitle({ ...props }: BoxProps) {
  return <Box fontWeight={700} {...props} />;
}

function AlertDescription({ ...props }: BoxProps) {
  return <Box fontSize="0.9375rem" lineHeight="1.4" color="content.readout" {...props} />;
}

export { Alert, AlertTitle, AlertDescription };

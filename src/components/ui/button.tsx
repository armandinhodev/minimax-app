"use client";

/**
 * Button.
 *
 * The primary action uses the app's single accent. Outlines are separated by
 * a hairline, not by a shadow, and nothing lifts on hover: a control that
 * moves is decoration, and the app has one accent to spend, not many.
 */

import { Button as ChakraButton, type ButtonProps as ChakraButtonProps } from "@chakra-ui/react";

type AppButtonVariant = "solid" | "outline" | "ghost" | "link" | "default" | "destructive";

interface ButtonProps extends Omit<ChakraButtonProps, "variant"> {
  variant?: AppButtonVariant;
}

function Button({ variant = "solid", colorPalette, _hover, type = "button", ...props }: ButtonProps) {
  const destructive = variant === "destructive" || colorPalette === "red";
  const solid = variant === "solid" || variant === "default" || destructive;
  const plain = variant === "link" || variant === "ghost";
  const effectiveVariant = solid ? "solid" : plain ? "plain" : variant;

  const tone = solid
    ? destructive
      ? { bg: "state.err", color: "content.inverse", _hover: { bg: "state.err" } }
      : { bg: "interaction.accent", color: "content.inverse", _hover: { bg: "interaction.accent" } }
    : {
      bg: "transparent",
      color: "content.ink",
      borderColor: "surface.rule",
      _hover: { bg: "surface.inset" },
    };

  return (
    <ChakraButton
      type={type}
      variant={effectiveVariant}
      borderRadius="md"
      fontSize="body"
      fontWeight="500"
      transition="background-color 140ms ease, border-color 140ms ease"
      {...tone}
      {...props}
    />
  );
}

export { Button };

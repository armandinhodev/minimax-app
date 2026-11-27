"use client";

/**
 * Button.
 *
 * Copper is the next action; white with a rule is everything else. Labels are
 * 14px bold, controls are 36px high, and nothing moves on hover.
 */

import { Button as ChakraButton, type ButtonProps as ChakraButtonProps } from "@chakra-ui/react";

import { Icon } from "@/components/ui/icons";

type AppButtonVariant =
  | "solid"
  | "outline"
  | "ghost"
  | "link"
  | "default"
  | "destructive"
  | "transport";

interface ButtonProps extends Omit<ChakraButtonProps, "variant"> {
  variant?: AppButtonVariant;
}

const FOCUS = { boxShadow: "0 0 0 3px var(--chakra-colors-interaction-focus-ring)" };

function Button({ variant = "solid", colorPalette, _hover, type = "button", children, ...props }: ButtonProps) {
  const destructiveSolid = colorPalette === "red";
  const destructiveOutline = variant === "destructive";
  const solid = variant === "solid" || variant === "default" || destructiveSolid;
  const plain = variant === "link" || variant === "ghost";
  const onTransport = variant === "transport";
  const effectiveVariant = solid ? "solid" : plain ? "plain" : "outline";
  const pressed = props["aria-pressed"] === true || props["aria-pressed"] === "true";

  const tone = solid
    ? destructiveSolid
      ? { bg: "state.err", color: "content.inverse", _hover: { bg: "state.err" } }
      : { bg: "interaction.accent", color: "content.inverse", _hover: { bg: "interaction.accentStrong" } }
    : onTransport
      ? {
          bg: "transparent",
          color: "transport.text",
          borderColor: "transport.seam",
          _hover: { bg: "transport.active" },
        }
      : destructiveOutline
        ? {
            bg: "surface.plate",
            color: "state.err",
            borderColor: "state.err",
            _hover: { bg: "state.errSoft" },
          }
        : variant === "ghost"
          ? {
              bg: "transparent",
              color: "content.ink",
              borderColor: "transparent",
              _hover: { bg: "surface.inset" },
            }
          : variant === "link"
            ? {
                bg: "transparent",
                color: "interaction.accent",
                borderColor: "transparent",
                textDecoration: "underline",
                textUnderlineOffset: "2px",
                _hover: { color: "interaction.accentStrong" },
              }
            : pressed
              ? {
                  bg: "interaction.soft",
                  color: "interaction.accent",
                  borderColor: "interaction.accent",
                  _hover: { bg: "interaction.soft" },
                }
              : {
                  bg: "surface.plate",
                  color: "content.ink",
                  borderColor: "surface.rule",
                  _hover: { bg: "surface.inset" },
                };

  return (
    <ChakraButton
      type={type}
      variant={effectiveVariant}
      borderRadius="md"
      fontSize="label"
      lineHeight="label"
      fontWeight={700}
      height={{ base: "44px", md: "36px" }}
      px="14px"
      gap="6px"
      justifySelf="start"
      transition="background-color 120ms ease, border-color 120ms ease"
      _focusVisible={FOCUS}
      _disabled={{
        bg: "surface.field",
        color: "content.readout",
        borderColor: "surface.separator",
        cursor: "not-allowed",
        opacity: 1,
      }}
      {...tone}
      {...props}
    >
      {pressed && <Icon name="check" size={14} />}
      {children}
    </ChakraButton>
  );
}

export { Button };

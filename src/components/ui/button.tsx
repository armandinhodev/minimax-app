"use client";

/**
 * Button.
 *
 * The primary action uses the app's single accent. Outlines are separated by
 * a hairline, not by a shadow, and nothing lifts on hover: a control that
 * moves is decoration, and the app has one accent to spend, not many.
 *
 * The "console" variant is for controls that live on the dark band, where a
 * light outline would be the only legible thing.
 */

import { Button as ChakraButton, type ButtonProps as ChakraButtonProps } from "@chakra-ui/react";

type AppButtonVariant =
  | "solid"
  | "outline"
  | "ghost"
  | "link"
  | "default"
  | "destructive"
  | "console";

interface ButtonProps extends Omit<ChakraButtonProps, "variant"> {
  variant?: AppButtonVariant;
}

function Button({ variant = "solid", colorPalette, _hover, type = "button", ...props }: ButtonProps) {
  const destructive = variant === "destructive" || colorPalette === "red";
  const solid = variant === "solid" || variant === "default" || variant === "destructive";
  const plain = variant === "link" || variant === "ghost";
  const onConsole = variant === "console";
  const effectiveVariant = solid ? "solid" : plain ? "plain" : "outline";

  // El rojo relleno se reserva para confirmar. En una lista de tarjetas, un
  // boton rojo por cada fila grita mas que la propia accion.
  const tone = solid
    ? variant === "destructive"
      ? { bg: "state.err", color: "content.inverse", _hover: { bg: "state.err" } }
      : { bg: "interaction.accent", color: "content.inverse", _hover: { bg: "interaction.accent" } }
    : onConsole
      ? destructive
        ? {
            bg: "transparent",
            color: "state.errBright",
            borderColor: "state.errBright",
            _hover: { bg: "console.active" },
          }
        : {
            bg: "transparent",
            color: "console.text",
            borderColor: "console.seam",
            _hover: { bg: "console.active" },
          }
      : destructive
        ? {
            bg: "transparent",
            color: "state.err",
            borderColor: "state.err",
            _hover: { bg: "state.errSoft" },
          }
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
      // Un boton ocupa lo que su texto ocupa. Sin esto, dentro de un grid el
      // boton se estiraba a todo el ancho de la hoja y competia con la banda.
      justifySelf="start"
      transition="background-color 140ms ease, border-color 140ms ease"
      {...tone}
      {...props}
    />
  );
}

export { Button };

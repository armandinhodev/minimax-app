"use client";

/**
 * Button.
 *
 * The primary action uses the app's single accent. Outlines are separated by
 * a hairline, and nothing lifts on hover: a control that moves is decoration.
 *
 * The "transport" variant is for controls that live on the transport bar.
 */

import { Button as ChakraButton, type ButtonProps as ChakraButtonProps } from "@chakra-ui/react";

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

function Button({ variant = "solid", colorPalette, _hover, type = "button", ...props }: ButtonProps) {
  const destructive = variant === "destructive" || colorPalette === "red";
  const solid = variant === "solid" || variant === "default" || variant === "destructive";
  const plain = variant === "link" || variant === "ghost";
  const onTransport = variant === "transport";
  const effectiveVariant = solid ? "solid" : plain ? "plain" : "outline";
  // Un control de seleccion (aria-pressed) se marca con el acento, no con un
  // bloque relleno: una grilla de opciones en azul pleno compite con la accion
  // principal de la pagina.
  const pressed = props["aria-pressed"] === true || props["aria-pressed"] === "true";

  // El rojo relleno se reserva para confirmar. En una lista, un boton rojo por
  // cada fila grita mas que la propia accion.
  const tone = solid
    ? variant === "destructive"
      ? { bg: "state.err", color: "content.inverse", _hover: { bg: "state.err" } }
      : { bg: "interaction.accent", color: "content.inverse", _hover: { bg: "interaction.accentStrong" } }
    : onTransport
      ? destructive
        ? {
            bg: "transparent",
            color: "state.errBright",
            borderColor: "state.errBright",
            _hover: { bg: "transport.active" },
          }
        : {
            bg: "transparent",
            color: "transport.text",
            borderColor: "transport.seam",
            _hover: { bg: "transport.active" },
          }
      : destructive
        ? {
            bg: "transparent",
            color: "state.err",
            borderColor: "state.err",
            _hover: { bg: "state.errSoft" },
          }
        : pressed
          ? {
              bg: "interaction.soft",
              color: "content.ink",
              borderColor: "interaction.accent",
              _hover: { bg: "interaction.soft" },
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
      px="0.9rem"
      // Un boton ocupa lo que su texto ocupa. Sin esto, dentro de un grid el
      // boton se estiraba a todo el ancho del panel y competia con el titulo.
      justifySelf="start"
      transition="background-color 140ms ease, border-color 140ms ease"
      _focusVisible={FOCUS}
      {...tone}
      {...props}
    />
  );
}

export { Button };

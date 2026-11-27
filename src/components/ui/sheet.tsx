"use client";

/**
 * Sheet — a panel of the workbench.
 *
 * Panels meet at a seam instead of floating apart: a tinted rail header, a
 * hairline frame and a 2px accent edge on the left. The result is not a sheet:
 * it is a plate.
 *
 * See docs/design.md.
 */

import { Box, type BoxProps } from "@chakra-ui/react";

interface SheetProps extends BoxProps {
  size?: "default" | "sm";
}

const sheetPadding = "1.125rem";

function Sheet({ size = "default", bg, borderColor, ...props }: SheetProps) {
  const padding = size === "sm" ? "0.875rem" : "0";

  return (
    <Box
      bg={bg ?? "surface.sheet"}
      borderRadius="sm"
      p={padding}
      border="1px solid"
      borderColor={borderColor ?? "surface.rule"}
      borderLeft="3px solid"
      borderLeftColor="interaction.accent"
      overflow="hidden"
      {...props}
    />
  );
}

function SheetHeader({ ...props }: BoxProps) {
  return (
    <Box
      bg="surface.rail"
      borderBottom="1px solid"
      borderColor="surface.rule"
      px={sheetPadding}
      pt="0.7rem"
      pb="0.6rem"
      {...props}
    />
  );
}

function SheetTitle({ ...props }: BoxProps) {
  return <Box fontSize="1rem" lineHeight="1.25" fontWeight="600" color="content.ink" {...props} />;
}

function SheetDescription({ ...props }: BoxProps) {
  return <Box fontSize="label" lineHeight="label" color="content.readout" mt="0.2rem" {...props} />;
}

function SheetContent({ ...props }: BoxProps) {
  return <Box px={sheetPadding} py="0.875rem" {...props} />;
}

function SheetFooter({ ...props }: BoxProps) {
  return (
    <Box
      display="flex"
      alignItems="center"
      gap={2}
      borderTop="1px solid"
      borderColor="surface.rule"
      bg="surface.rail"
      px={sheetPadding}
      py="0.625rem"
      {...props}
    />
  );
}

export {
  Sheet,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
  SheetContent,
};

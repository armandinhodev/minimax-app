"use client";

/**
 * Sheet — a panel of the work surface.
 *
 * It replaces the old card kit: no drop shadow, no accent border, radius
 * at most 4px. A panel is separated from its neighbours by a hairline seam,
 * the way machined panels are.
 *
 * See docs/design.md.
 */

import { Box, type BoxProps } from "@chakra-ui/react";

interface SheetProps extends BoxProps {
  size?: "default" | "sm";
}

const sheetPadding = "1.25rem";

function Sheet({ size = "default", bg, borderColor, ...props }: SheetProps) {
  const padding = size === "sm" ? "0.875rem" : sheetPadding;

  return (
    <Box
      bg={bg ?? "surface.sheet"}
      borderRadius="lg"
      p={padding}
      border="1px solid"
      borderColor={borderColor ?? "surface.rule"}
      {...props}
    />
  );
}

function SheetHeader({ ...props }: BoxProps) {
  return <Box px={sheetPadding} pt={sheetPadding} pb="0" {...props} />;
}

function SheetTitle({ ...props }: BoxProps) {
  return <Box fontSize="title" lineHeight="title" fontWeight="600" {...props} />;
}

function SheetDescription({ ...props }: BoxProps) {
  return <Box fontSize="body" lineHeight="body" color="content.readout" mt="0.35rem" {...props} />;
}

function SheetContent({ ...props }: BoxProps) {
  return <Box px={sheetPadding} py="0.75rem" {...props} />;
}

function SheetFooter({ ...props }: BoxProps) {
  return (
    <Box
      display="flex"
      alignItems="center"
      gap={2}
      borderTop="1px solid"
      borderColor="surface.rule"
      bg="surface.field"
      px={sheetPadding}
      py="0.625rem"
      borderBottomRadius="lg"
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

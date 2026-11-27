"use client";

/**
 * Sheet — a white panel of the bench.
 *
 * 10px outside, 5px inside, one hairline separation derived from the rule.
 * The header is a rail: an icon tile, the panel title and one line of purpose.
 * No shadows, no accent edge.
 *
 * See docs/minimax-studio-ui/Minimax-directrices.md.
 */

import { Box, type BoxProps } from "@chakra-ui/react";

import { Icon, type IconName } from "@/components/ui/icons";

interface SheetProps extends BoxProps {
  size?: "default" | "sm";
}

const sheetPadding = "20px";

function Sheet({ size = "default", bg, borderColor, ...props }: SheetProps) {
  const padding = size === "sm" ? "16px" : "0";

  return (
    <Box
      bg={bg ?? "surface.sheet"}
      borderRadius="lg"
      p={padding}
      border="1px solid"
      borderColor={borderColor ?? "surface.separator"}
      overflow="hidden"
      {...props}
    />
  );
}

interface SheetHeaderProps extends BoxProps {
  /** The pictogram of the panel: wave, image, folder, file… */
  icon?: IconName;
}

function SheetHeader({ icon, children, ...props }: SheetHeaderProps) {
  return (
    <Box
      display="flex"
      alignItems="flex-start"
      gap="12px"
      px={sheetPadding}
      py="16px"
      borderBottom="1px solid"
      borderColor="surface.separator"
      {...props}
    >
      {icon && (
        <Box
          aria-hidden="true"
          display="inline-flex"
          alignItems="center"
          justifyContent="center"
          w="40px"
          h="40px"
          flex="0 0 auto"
          bg="surface.inset"
          border="1px solid"
          borderColor="surface.separator"
          borderRadius="md"
          color="content.readout"
        >
          <Icon name={icon} size={20} />
        </Box>
      )}
      <Box minW={0} flex="1 1 auto">{children}</Box>
    </Box>
  );
}

function SheetTitle({ ...props }: BoxProps) {
  return (
    <Box fontSize="title" lineHeight="title" fontWeight={700} letterSpacing="-0.024em" color="content.ink" {...props} />
  );
}

function SheetDescription({ ...props }: BoxProps) {
  return <Box fontSize="0.9375rem" lineHeight="1.4" color="content.readout" mt="2px" {...props} />;
}

function SheetContent({ ...props }: BoxProps) {
  return <Box px={sheetPadding} py="16px" {...props} />;
}

function SheetFooter({ ...props }: BoxProps) {
  return (
    <Box
      display="flex"
      alignItems="center"
      gap={2}
      borderTop="1px solid"
      borderColor="surface.separator"
      px={sheetPadding}
      py="12px"
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

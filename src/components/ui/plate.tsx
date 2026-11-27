"use client";

/**
 * Plate — the white panel where a result is inspected.
 *
 * It shares the panel language (10px outside, rail header, hairline) and adds
 * the production facts as spec rows. The artifact itself lives inside.
 *
 * See docs/minimax-studio-ui/Minimax-directrices.md.
 */

import { Box, type BoxProps } from "@chakra-ui/react";

import { Icon, type IconName } from "@/components/ui/icons";

export interface PlateCaption {
  label: string;
  value: string;
}

interface PlateProps extends BoxProps {
  icon?: IconName;
  title?: string;
  description?: string;
  /** Labelled facts shown as spec rows under the result. */
  caption?: PlateCaption[];
  /** What to show before there is a result. */
  empty?: string;
  /** Actions that belong to the plate, shown under the caption. */
  actions?: React.ReactNode;
  children?: React.ReactNode;
}

export function Plate({
  icon = "folder",
  title,
  description,
  caption,
  empty,
  actions,
  children,
  ...props
}: PlateProps) {
  return (
    <Box
      bg="surface.sheet"
      border="1px solid"
      borderColor="surface.separator"
      borderRadius="lg"
      overflow="hidden"
      display="flex"
      flexDirection="column"
      minW={0}
      {...props}
    >
      {(title || description) && (
        <Box
          display="flex"
          alignItems="flex-start"
          gap="12px"
          px="20px"
          py="16px"
          borderBottom="1px solid"
          borderColor="surface.separator"
        >
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
          <Box minW={0} flex="1 1 auto">
            {title && (
              <Box fontSize="title" lineHeight="title" fontWeight={700} letterSpacing="-0.024em" color="content.ink">
                {title}
              </Box>
            )}
            {description && (
              <Box fontSize="0.9375rem" lineHeight="1.4" color="content.readout" mt="2px">
                {description}
              </Box>
            )}
          </Box>
        </Box>
      )}

      <Box px="20px" py="16px" minW={0} flex="1 1 auto" display="flex" flexDirection="column" gap="16px">
        {children ?? (empty && (
          <Box
            flex="1"
            display="grid"
            alignItems="center"
            justifyItems="center"
            textAlign="center"
            minH="10rem"
            p="20px"
            bg="surface.inset"
            border="1px solid"
            borderColor="surface.separator"
            borderRadius="md"
            color="content.readout"
            fontSize="body"
          >
            <Box maxW="26rem">{empty}</Box>
          </Box>
        ))}
      </Box>

      {caption && caption.length > 0 && (
        <Box px="20px">
          {caption.map((slot) => (
            <Box
              key={slot.label}
              display="grid"
              gridTemplateColumns="minmax(0, 1fr) auto"
              gap={4}
              alignItems="baseline"
              py="9px"
              borderTop="1px solid"
              borderColor="surface.separator"
            >
              <Box color="content.readout" fontSize="label" lineHeight="label">
                {slot.label}
              </Box>
              <Box
                fontFamily="mono"
                fontSize="mono"
                lineHeight="mono"
                color="content.ink"
                fontVariantNumeric="tabular-nums"
                textAlign="right"
                overflow="hidden"
                textOverflow="ellipsis"
              >
                {slot.value}
              </Box>
            </Box>
          ))}
        </Box>
      )}

      {actions && (
        <Box px="20px" py="16px" mt="auto">
          {actions}
        </Box>
      )}
    </Box>
  );
}

"use client";

/**
 * Plate — the surface a result appears on.
 *
 * The artifact is the reason the screen exists, so it gets the brightest
 * surface in the app, framed by one rule and a caption bar of labelled slots.
 * A plate is not a card: its caption is data, not decoration.
 *
 * See docs/design.md.
 */

import { Box, type BoxProps } from "@chakra-ui/react";

export interface PlateCaption {
  label: string;
  value: string;
}

interface PlateProps extends BoxProps {
  title?: string;
  description?: string;
  /** Labelled facts shown in the caption bar, in mono. */
  caption?: PlateCaption[];
  /** What to show before there is a result. */
  empty?: string;
  children?: React.ReactNode;
}

export function Plate({ title, description, caption, empty, children, ...props }: PlateProps) {
  const hasCaption = caption !== undefined && caption.length > 0;

  return (
    <Box
      bg="surface.plate"
      border="1px solid"
      borderColor="surface.rule"
      borderLeft="3px solid"
      borderLeftColor="interaction.accent"
      borderRadius="sm"
      overflow="hidden"
      display="flex"
      flexDirection="column"
      minW={0}
      {...props}
    >
      {(title || description) && (
        <Box px="1.125rem" py="0.7rem" display="grid" gap="0.15rem" bg="surface.rail" borderBottom="1px solid" borderColor="surface.rule">
          {title && (
            <Box fontSize="1rem" lineHeight="1.25" fontWeight="600" color="content.ink">
              {title}
            </Box>
          )}
          {description && (
            <Box fontSize="label" lineHeight="label" color="content.readout">
              {description}
            </Box>
          )}
        </Box>
      )}

      <Box px="1.125rem" py={title || description ? "0.5rem" : "1.125rem"} minW={0} flex="1 1 auto" display="flex" flexDirection="column">
        {children ?? (empty && (
          <Box flex="1" display="grid" alignItems="center" justifyItems="center" textAlign="center" minH="12rem" p="2rem" border="1px dashed" borderColor="surface.rule" color="content.readout">
            <Box maxW="24rem">{empty}</Box>
          </Box>
        ))}
      </Box>

      {hasCaption && (
        <Box
          display="flex"
          flexWrap="wrap"
          gap={{ base: 4, md: 6 }}
          borderTop="1px solid"
          borderColor="surface.rule"
          bg="surface.sheet"
          px="1.125rem"
          py="0.625rem"
        >
          {caption!.map((slot) => (
            <Box key={slot.label} display="grid" gap="0.1rem" minW={0}>
              <Box color="content.readout" fontSize="label" lineHeight="label" fontWeight={500}>
                {slot.label}
              </Box>
              <Box
                fontFamily="mono"
                fontSize="mono"
                lineHeight="mono"
                color="content.ink"
                fontVariantNumeric="tabular-nums"
                overflow="hidden"
                textOverflow="ellipsis"
              >
                {slot.value}
              </Box>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}

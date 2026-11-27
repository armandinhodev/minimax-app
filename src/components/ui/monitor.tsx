"use client";

/**
 * Monitor — the surface a result appears in.
 *
 * A result is not another white panel: it is a screen. The dark inset
 * frames it against the light control sheet and reads as equipment rather
 * than as a second card.
 */

import { Box, type BoxProps } from "@chakra-ui/react";

interface MonitorProps extends BoxProps {
  title?: string;
  description?: string;
  children?: React.ReactNode;
}

export function Monitor({ title, description, children, ...props }: MonitorProps) {
  return (
    <Box
      bg="console.bg"
      color="console.text"
      borderRadius="lg"
      overflow="hidden"
      display="grid"
      gridTemplateRows={title ? "auto 1fr" : "1fr"}
      {...props}
    >
      {title && (
        <Box
          px={{ base: 4, md: 5 }}
          py={3}
          borderBottom="1px solid"
          borderColor="console.seam"
          display="grid"
          gap="0.125rem"
        >
          <Box fontSize="title" lineHeight="title" fontWeight="600">
            {title}
          </Box>
          {description && (
            <Box color="console.muted" fontSize="label" lineHeight="label">
              {description}
            </Box>
          )}
        </Box>
      )}
      <Box px={{ base: 4, md: 5 }} py={4} minW={0}>
        {children}
      </Box>
    </Box>
  );
}

"use client";

/**
 * MetricBand — the totals strip of the dashboard and the library.
 *
 * One white band divided by hairlines: a 13px label over a 26px mono value.
 * On mobile it folds to two columns.
 */

import { Box } from "@chakra-ui/react";

export interface Metric {
  label: string;
  value: string;
}

export function MetricBand({ metrics }: { metrics: Metric[] }) {
  return (
    <Box
      border="1px solid"
      borderColor="surface.separator"
      borderRadius="lg"
      bg="surface.separator"
      overflow="hidden"
      display="grid"
      gridTemplateColumns={{ base: "repeat(2, minmax(0, 1fr))", md: `repeat(${Math.min(metrics.length, 4)}, minmax(0, 1fr))` }}
      gap="1px"
    >
      {metrics.map((metric) => (
        <Box key={metric.label} bg="surface.sheet" px="20px" py="12px" display="grid" gap="2px" minW={0}>
          <Box color="content.readout" fontSize="help" lineHeight="help">
            {metric.label}
          </Box>
          <Box
            fontFamily="mono"
            fontSize="metric"
            lineHeight="metric"
            fontWeight={700}
            color="content.ink"
            fontVariantNumeric="tabular-nums"
            overflow="hidden"
            textOverflow="ellipsis"
          >
            {metric.value}
          </Box>
        </Box>
      ))}
    </Box>
  );
}

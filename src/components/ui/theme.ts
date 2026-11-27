import { createSystem, defaultConfig, defineConfig } from '@chakra-ui/react';

/**
 * MiniMax Studio design tokens.
 *
 * The brief behind these values is in docs/design.md: the app is a bench for
 * dispatching generative media jobs, so it is built to look like equipment —
 * engraved labels, fixed type sizes, seams, and one state readout.
 *
 * Rules this file enforces:
 * - one interactive color (`accent`); product identity comes from monograms
 * - structure is seams and rules, not shadows
 * - radius stays at most 4px: equipment is machined, not pillowy
 */
const config = defineConfig({
  theme: {
    tokens: {
      colors: {
        bench: {
          console: { value: '#14181D' },
          seam: { value: '#2B323B' },
          sheet: { value: 'var(--chakra-colors-surface-sheet)' },
          field: { value: '#EEF0F2' },
          rule: { value: '#D7DCE1' },
          ink: { value: '#0F1216' },
          readout: { value: '#5C6673' },
          accent: { value: '#1F5E6B' },
          ok: { value: '#2F6B4F' },
          run: { value: '#A8591F' },
          err: { value: '#9B2C2C' },
        },
      },

      fonts: {
        body: { value: 'var(--font-archivo), system-ui, -apple-system, sans-serif' },
        heading: { value: 'var(--font-archivo), system-ui, -apple-system, sans-serif' },
        mono: { value: 'var(--font-plex-mono), ui-monospace, SFMono-Regular, monospace' },
      },

      fontSizes: {
        display: { value: '1.875rem' },
        title: { value: '1.125rem' },
        body: { value: '0.9375rem' },
        label: { value: '0.75rem' },
        mono: { value: '0.8125rem' },
      },

      lineHeights: {
        display: { value: '1.2' },
        title: { value: '1.35' },
        body: { value: '1.6' },
        label: { value: '1.4' },
        mono: { value: '1.5' },
      },

      radii: {
        sm: { value: '2px' },
        md: { value: '3px' },
        lg: { value: '4px' },
        xl: { value: '4px' },
        '2xl': { value: '4px' },
      },

      shadows: {
        // Panels are separated by seams, not by depth. These only exist for
        // the surfaces that genuinely float above the workspace.
        xs: { value: '0 1px 0 rgba(15, 18, 22, 0.04)' },
        sm: { value: '0 1px 2px rgba(15, 18, 22, 0.05)' },
        md: { value: '0 2px 6px rgba(15, 18, 22, 0.08)' },
        lg: { value: '0 8px 24px rgba(15, 18, 22, 0.12)' },
        overlay: { value: '0 18px 48px rgba(15, 18, 22, 0.28)' },
      },
    },

    semanticTokens: {
      colors: {
        // The console rail: dark graphite with a blue cast.
        console: {
          bg: { value: '{colors.bench.console}' },
          seam: { value: '{colors.bench.seam}' },
          text: { value: '#E7EAED' },
          muted: { value: '#98A2AE' },
          faint: { value: '#6C7683' },
          active: { value: '#1B2027' },
        },

        // The work surface: sheets on a recessed field.
        surface: {
          sheet: { value: '{colors.bench.sheet}' },
          field: { value: '{colors.bench.field}' },
          rule: { value: '{colors.bench.rule}' },
          border: { value: '{colors.bench.rule}' },
          inset: { value: 'rgba(15, 18, 22, 0.04)' },
        },

        // Type colors.
        content: {
          ink: { value: '{colors.bench.ink}' },
          readout: { value: '{colors.bench.readout}' },
          muted: { value: '{colors.bench.readout}' },
          subtle: { value: '#8A939E' },
          inverse: { value: '#F4F6F8' },
        },

        // The only interactive color.
        interaction: {
          accent: { value: '{colors.bench.accent}' },
          soft: { value: 'rgba(31, 94, 107, 0.12)' },
          faint: { value: 'rgba(31, 94, 107, 0.06)' },
          focusRing: { value: 'rgba(31, 94, 107, 0.32)' },
        },

        // Task state. Functional, not decorative.
        state: {
          ok: { value: '{colors.bench.ok}' },
          okSoft: { value: 'rgba(47, 107, 79, 0.12)' },
          run: { value: '{colors.bench.run}' },
          runSoft: { value: 'rgba(168, 89, 31, 0.12)' },
          err: { value: '{colors.bench.err}' },
          errSoft: { value: 'rgba(155, 44, 44, 0.12)' },
        },

        scrollbar: {
          thumb: { value: '#C9CFD6' },
          thumbHover: { value: '#A9B2BC' },
        },
      },
    },
  },
});

export const system = createSystem(defaultConfig, config);

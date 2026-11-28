import { createSystem, defaultConfig, defineConfig } from '@chakra-ui/react';

/**
 * MiniMax Studio design tokens — "Mesa de montaje".
 *
 * Source of truth: docs/minimax-studio-ui/ (palette + directives + plates).
 * Slate sidebar, cool workspace, white panels, copper for the next action.
 *
 * Rules this file enforces:
 * - one interactive color (`accent`, copper); state colors are functional
 * - the opaque rule is for functional controls; separators derive from it
 * - no fuchsia or magenta anywhere
 */
const config = defineConfig({
  theme: {
    // The studio breakpoints: sidebar at 900, stacked workbench at 1100.
    breakpoints: {
      sm: '480px',
      md: '768px',
      lg: '900px',
      xl: '1100px',
      '2xl': '1440px',
    },

    tokens: {
      colors: {
        bench: {
          ink: { value: '#202B38' },
          transport: { value: '#293341' },
          seam: { value: '#3A4552' },
          workspace: { value: '#E8EBEF' },
          panel: { value: '#FAFBFC' },
          plate: { value: '#FFFFFF' },
          rule: { value: '#77828E' },
          separator: { value: '#CCD1D5' },
          muted: { value: '#506070' },
          accent: { value: '#A33E12' },
          accentSoft: { value: '#F8E8DE' },
          ok: { value: '#296546' },
          run: { value: '#805700' },
          err: { value: '#A12C32' },
        },
      },

      fonts: {
        body: { value: '"Nimbus Sans", "Helvetica Neue", Helvetica, Arial, sans-serif' },
        heading: { value: '"Nimbus Sans", "Helvetica Neue", Helvetica, Arial, sans-serif' },
        mono: { value: '"Liberation Mono", "Courier New", monospace' },
      },

      fontSizes: {
        display: { value: '2.875rem' },
        title: { value: '1.4375rem' },
        subtitle: { value: '1.0625rem' },
        metric: { value: '1.625rem' },
        body: { value: '1rem' },
        label: { value: '0.875rem' },
        help: { value: '0.8125rem' },
        mono: { value: '0.8125rem' },
      },

      lineHeights: {
        display: { value: '1.04' },
        title: { value: '1.26' },
        subtitle: { value: '1.41' },
        metric: { value: '1.19' },
        body: { value: '1.44' },
        label: { value: '1.43' },
        help: { value: '1.46' },
        mono: { value: '1.54' },
      },

      // Panels are 10px outside and 5px inside; controls use 5px.
      radii: {
        sm: { value: '3px' },
        md: { value: '5px' },
        lg: { value: '10px' },
        xl: { value: '10px' },
        '2xl': { value: '12px' },
      },

      shadows: {
        // Panels have no shadow. Only overlays float above the table.
        xs: { value: '0 1px 0 rgba(32, 43, 56, 0.04)' },
        sm: { value: '0 1px 2px rgba(32, 43, 56, 0.06)' },
        md: { value: '0 2px 8px rgba(32, 43, 56, 0.08)' },
        lg: { value: '0 12px 32px rgba(32, 43, 56, 0.16)' },
        overlay: { value: '0 24px 64px rgba(18, 25, 34, 0.38)' },
      },
    },

    semanticTokens: {
      colors: {
        // The slate sidebar.
        transport: {
          bg: { value: '{colors.bench.transport}' },
          seam: { value: '{colors.bench.seam}' },
          text: { value: '#F7F8F9' },
          muted: { value: '#AEB7C2' },
          faint: { value: '#8C97A4' },
          active: { value: '#384555' },
        },

        // The bench: cool workspace, white panels, pure-white plates.
        surface: {
          sheet: { value: '{colors.bench.panel}' },
          plate: { value: '{colors.bench.plate}' },
          field: { value: '{colors.bench.workspace}' },
          rule: { value: '{colors.bench.rule}' },
          border: { value: '{colors.bench.separator}' },
          separator: { value: '{colors.bench.separator}' },
          // Fondo suave de iconos, chips y notas neutras.
          inset: { value: '#F1F3F5' },
          // El velo que baja el fondo cuando un dialogo se abre.
          veil: { value: 'rgba(32, 43, 56, 0.50)' },
        },

        // Type colors.
        content: {
          ink: { value: '{colors.bench.ink}' },
          readout: { value: '{colors.bench.muted}' },
          muted: { value: '{colors.bench.muted}' },
          subtle: { value: '#5F6C7B' },
          // Placeholder: lighter than readout so it is not read as a value.
          placeholder: { value: '#7F8B98' },
          inverse: { value: '#FFFFFF' },
        },

        // The only interactive color.
        interaction: {
          accent: { value: '{colors.bench.accent}' },
          accentStrong: { value: '#7E2F0D' },
          soft: { value: '{colors.bench.accentSoft}' },
          faint: { value: '#FBF1EA' },
          focusRing: { value: 'rgba(163, 62, 18, 0.35)' },
        },

        // Task state. Functional, not decorative.
        state: {
          ok: { value: '{colors.bench.ok}' },
          okSoft: { value: '#EAF1EC' },
          run: { value: '{colors.bench.run}' },
          runSoft: { value: '#F5EDDE' },
          err: { value: '{colors.bench.err}' },
          errSoft: { value: '#F8EAEB' },
          errBright: { value: '#E9A2A6' },
        },

        scrollbar: {
          thumb: { value: '#C7CED5' },
          thumbHover: { value: '#A9B3BD' },
        },
      },
    },
  },
});

export const system = createSystem(defaultConfig, config);

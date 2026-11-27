import { createSystem, defaultConfig, defineConfig } from '@chakra-ui/react';

/**
 * MiniMax Studio design tokens.
 *
 * The brief behind these values is in docs/design.md: the app is a cutting
 * room for generative media. The workspace is warm paper, the chrome is a
 * deep forest transport bar, and a single forest accent marks everything the
 * operator can act on.
 *
 * Rules this file enforces:
 * - one interactive color (`accent`); identity comes from structure, not hue
 * - state colors are functional: ok, running, failed
 * - no fuchsia or magenta anywhere in the palette
 */
const config = defineConfig({
  theme: {
    tokens: {
      colors: {
        bench: {
          ink: { value: '#171A16' },
          graphite: { value: '#232B25' },
          seam: { value: '#33403A' },
          workspace: { value: '#E9E4D8' },
          sheet: { value: '#FCFAF4' },
          rail: { value: '#EFE7D7' },
          plate: { value: '#FFFDF8' },
          rule: { value: '#CFC7B8' },
          readout: { value: '#6A645A' },
          accent: { value: '#1F5B45' },
          ok: { value: '#2C6E4A' },
          run: { value: '#A25F16' },
          err: { value: '#A8332B' },
        },
      },

      fonts: {
        body: { value: 'var(--font-bricolage), system-ui, -apple-system, sans-serif' },
        heading: { value: 'var(--font-bricolage), system-ui, -apple-system, sans-serif' },
        mono: { value: 'var(--font-dm-mono), ui-monospace, SFMono-Regular, monospace' },
      },

      fontSizes: {
        display: { value: '2.125rem' },
        title: { value: '1.25rem' },
        body: { value: '0.9375rem' },
        label: { value: '0.75rem' },
        mono: { value: '0.8125rem' },
      },

      lineHeights: {
        display: { value: '1.1' },
        title: { value: '1.3' },
        body: { value: '1.6' },
        label: { value: '1.35' },
        mono: { value: '1.5' },
      },

      // Panels are cut, not moulded: 2px, 4px on controls, 8px on overlays.
      radii: {
        sm: { value: '2px' },
        md: { value: '4px' },
        lg: { value: '6px' },
        xl: { value: '8px' },
        '2xl': { value: '10px' },
      },

      shadows: {
        // Structure is rules, not depth. Overlays are the only things that
        // float above the table.
        xs: { value: '0 1px 0 rgba(23, 26, 22, 0.04)' },
        sm: { value: '0 1px 2px rgba(23, 26, 22, 0.06)' },
        md: { value: '0 2px 8px rgba(23, 26, 22, 0.08)' },
        lg: { value: '0 12px 32px rgba(23, 26, 22, 0.14)' },
        overlay: { value: '0 24px 64px rgba(23, 26, 22, 0.35)' },
      },
    },

    semanticTokens: {
      colors: {
        // The transport bar: deep forest ink, one step up for `active`.
        transport: {
          bg: { value: '#18201B' },
          seam: { value: '{colors.bench.seam}' },
          text: { value: '#F1EFE8' },
          muted: { value: '#AAB0A5' },
          faint: { value: '#828A7F' },
          active: { value: '{colors.bench.graphite}' },
        },

        // The workbench: warm paper ground, panels on top, plates brightest.
        surface: {
          sheet: { value: '{colors.bench.sheet}' },
          rail: { value: '{colors.bench.rail}' },
          plate: { value: '{colors.bench.plate}' },
          field: { value: '{colors.bench.workspace}' },
          rule: { value: '{colors.bench.rule}' },
          border: { value: '{colors.bench.rule}' },
          inset: { value: 'rgba(23, 26, 22, 0.05)' },
          // La retícula apenas visible del tablero.
          grid: { value: 'rgba(23, 26, 22, 0.07)' },
          // El velo que baja el fondo cuando un dialogo se abre.
          veil: { value: 'rgba(23, 26, 22, 0.56)' },
        },

        // Type colors.
        content: {
          ink: { value: '{colors.bench.ink}' },
          readout: { value: '{colors.bench.readout}' },
          muted: { value: '{colors.bench.readout}' },
          subtle: { value: '#777064' },
          inverse: { value: '#F5F1E6' },
        },

        // The only interactive color.
        interaction: {
          accent: { value: '{colors.bench.accent}' },
          // El mismo acento, aclarado para leerse sobre el transporte.
          accentBright: { value: '#86C5A4' },
          // El acento presionado: el unico paso mas oscuro del mismo verde.
          accentStrong: { value: '#17452F' },
          soft: { value: 'rgba(31, 91, 69, 0.10)' },
          faint: { value: 'rgba(31, 91, 69, 0.05)' },
          focusRing: { value: 'rgba(31, 91, 69, 0.32)' },
        },

        // Task state. Functional, not decorative.
        state: {
          ok: { value: '{colors.bench.ok}' },
          okSoft: { value: 'rgba(44, 110, 74, 0.10)' },
          run: { value: '{colors.bench.run}' },
          runSoft: { value: 'rgba(162, 95, 22, 0.10)' },
          err: { value: '{colors.bench.err}' },
          errSoft: { value: 'rgba(168, 51, 43, 0.10)' },
          // El error sobre el transporte oscuro: el rojo de estado no se lee
          // contra el ink, asi que la banda usa una version mas clara.
          errBright: { value: '#E8837A' },
        },

        scrollbar: {
          thumb: { value: '#C3BCAD' },
          thumbHover: { value: '#ACA596' },
        },
      },
    },
  },
});

export const system = createSystem(defaultConfig, config);

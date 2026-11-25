import { createSystem, defaultConfig, defineConfig } from '@chakra-ui/react';

// Keep application colors here; components and CSS Modules consume semantic tokens.
const config = defineConfig({
  theme: {
    tokens: {
      colors: {
        app: {
          white: { value: '#ffffff' },
          slate: {
            50: { value: '#f8fafc' },
            100: { value: '#f1f5f9' },
            400: { value: '#94a3b8' },
            500: { value: '#64748b' },
            700: { value: '#334155' },
            900: { value: '#0f172a' },
          },
          heading: { value: '#111827' },
          brand: { value: '#6366f1' },
          speech: { value: '#38bdf8' },
          image: { value: '#a78bfa' },
          music: { value: '#f472b6' },
          library: { value: '#34d399' },
          video: { value: '#fb923c' },
          scrollbar: { value: '#d1d5db' },
          scrollbarHover: { value: '#9ca3af' },
        },
      },
    },
    semanticTokens: {
      colors: {
        navigation: {
          text: { value: '{colors.app.slate.900}' },
          muted: { value: '{colors.app.slate.500}' },
          subtle: { value: '{colors.app.slate.400}' },
          heading: { value: '{colors.app.heading}' },
          account: { value: '{colors.app.slate.700}' },
          surface: { value: '{colors.app.white}' },
          bgStart: { value: '{colors.app.slate.50}' },
          bgEnd: { value: '{colors.app.slate.100}' },
          border: { value: 'rgba(226, 232, 240, 0.92)' },
          divider: { value: 'rgba(226, 232, 240, 0.9)' },
          panel: { value: 'rgba(255, 255, 255, 0.9)' },
          panelStrong: { value: 'rgba(255, 255, 255, 0.96)' },
          hover: { value: 'rgba(15, 23, 42, 0.04)' },
          focusRing: { value: 'rgba(99, 102, 241, 0.24)' },
          shadow: { value: 'rgba(15, 23, 42, 0.06)' },
          shadowActive: { value: 'rgba(15, 23, 42, 0.1)' },
          highlight: { value: 'rgba(255, 255, 255, 0.72)' },
          headerBg: { value: 'rgba(248, 250, 252, 0.92)' },
          headerBorder: { value: 'rgba(226, 232, 240, 0.94)' },
          overlay: { value: 'rgba(15, 23, 42, 0.46)' },
          drawerShadow: { value: 'rgba(15, 23, 42, 0.22)' },
          speechGlow: { value: 'rgba(56, 189, 248, 0.14)' },
        },
        product: {
          brand: {
            accent: { value: '{colors.app.brand}' },
            soft: { value: 'rgba(99, 102, 241, 0.16)' },
            faint: { value: 'rgba(99, 102, 241, 0.1)' },
          },
          speech: {
            accent: { value: '{colors.app.speech}' },
            soft: { value: 'rgba(56, 189, 248, 0.18)' },
            faint: { value: 'rgba(56, 189, 248, 0.1)' },
          },
          image: {
            accent: { value: '{colors.app.image}' },
            soft: { value: 'rgba(167, 139, 250, 0.18)' },
            faint: { value: 'rgba(167, 139, 250, 0.1)' },
          },
          music: {
            accent: { value: '{colors.app.music}' },
            soft: { value: 'rgba(244, 114, 182, 0.18)' },
            faint: { value: 'rgba(244, 114, 182, 0.1)' },
          },
          library: {
            accent: { value: '{colors.app.library}' },
            soft: { value: 'rgba(52, 211, 153, 0.18)' },
            faint: { value: 'rgba(52, 211, 153, 0.1)' },
          },
          video: {
            accent: { value: '{colors.app.video}' },
            soft: { value: 'rgba(251, 146, 60, 0.18)' },
            faint: { value: 'rgba(251, 146, 60, 0.1)' },
          },
        },
        scrollbar: {
          thumb: { value: '{colors.app.scrollbar}' },
          thumbHover: { value: '{colors.app.scrollbarHover}' },
        },
      },
    },
  },
});

export const system = createSystem(defaultConfig, config);

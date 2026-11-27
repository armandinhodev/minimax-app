# MiniMax Studio

Web app para operar la API de MiniMax desde un solo lugar: voz, transcripción,
chat, imagen, video, video agent, música y una biblioteca de lo generado. La app
mantiene la API key en el servidor y expone una superficie propia por dominio
upstream.

## Stack

- **Next.js 16** (App Router) + React 18 + TypeScript
- **Chakra UI 3** con un tema propio (`src/components/ui/theme.ts`)
- **Zod** para los contratos de la API
- **better-sqlite3** para la biblioteca local y el historial
- **Vitest** para pruebas

## Requisitos

- Node.js `>=20.19`
- pnpm `11`

## Puesta en marcha

```bash
pnpm install
```

Creá un `.env` en la raíz con estas claves:

```dotenv
APP_ACCESS_KEY=...      # clave con la que se entra a la app
MINIMAX_API_KEY=...     # API key de MiniMax, solo del lado servidor
```

Después:

```bash
pnpm dev
```

La app queda en `http://localhost:3000`. El primer acceso pide `APP_ACCESS_KEY`;
la clave se guarda en `sessionStorage` y viaja como `Bearer` en cada llamada al
servidor. La `MINIMAX_API_KEY` nunca llega al navegador: la usan los Route
Handlers del servidor.

La base SQLite (`data/minimax.sqlite`) y los assets locales (`data/assets/`) se
crean solos al usar la app.

## Scripts

| Comando | Qué hace |
| --- | --- |
| `pnpm dev` | Servidor de desarrollo. |
| `pnpm build` | Build de producción. |
| `pnpm start` | Sirve el build. |
| `pnpm lint` | ESLint. |
| `pnpm typecheck` | `tsc --noEmit`. |
| `pnpm check` / `pnpm test` | Vitest, una corrida. |
| `pnpm test:watch` | Vitest en modo watch. |

## Estructura

```
src/
  domain/          entidades, value objects y puertos
  application/     DTOs con Zod y casos de uso
  infrastructure/  clientes MiniMax (server-only) y SQLite
  app/             rutas de Next: UI en (app) y (auth), API en app/api/minimax
  components/      UI, navegación y primitivas del design system
  lib/             utilidades de cliente (auth, historial, formato)
docs/              design system, arquitectura y documentación de la API
openspec/          especificaciones de los cambios
```

Cada dominio (speech, asr, image, video, video-agent, music, files, text)
atraviesa las mismas cuatro capas y conserva el mismo nombre. La convención
completa está en [`docs/architecture/api-organization.md`](docs/architecture/api-organization.md).

## Áreas de la app

| Área | Rutas |
| --- | --- |
| Speech | `/tts`, `/voices`, `/voices/clone`, `/voices/design` |
| Transcripción | `/asr` |
| Chat | `/text` |
| Imagen | `/image`, `/image/image-to-image` |
| Música | `/music`, `/music/lyrics`, `/music/cover-preprocess` |
| Video | `/video/generation`, `/video/context-ir`, `/video/regeneration`, `/video/tasks` |
| Video Agent | `/video-agent` |
| Biblioteca | `/library` |

## Diseño

El sistema visual está documentado en [`docs/design.md`](docs/design.md): papel
cálido, verde bosque como único acento, Bricolage Grotesque + DM Mono, transporte
superior y paneles con riel y costuras.

Dos suites lo mantienen:

- `src/components/ui/theme.test.tsx` — paleta, contraste WCAG, ausencia de
  fucsia, tipografías y radios.
- `src/components/ui/copy.test.tsx` — sentence case, jerga, valores en oración,
  obligatoriedad y variables de color.

Para pedir una dirección visual nueva (paleta + sistema + pantallas) a un
especialista o a otra IA, el insumo listo es
[`docs/design-brief.md`](docs/design-brief.md).

## Documentación de la API

- [Alineación con la API de MiniMax](docs/minimax-api-alignment.md)
- [Speech WebSocket](docs/minimax-speech-websocket.md)
- [ASR](docs/minimax-asr-api.md)
- [Imagen](docs/minimax-image-api.md)
- [Video](docs/minimax-video-api.md)
- [Video Agent](docs/minimax-video-agent-api.md)
- [Texto](docs/minimax-text-api.md)
- [Observabilidad](docs/minimax-observability.md)

## Pruebas

```bash
pnpm check
pnpm lint
pnpm typecheck
```

El flujo de trabajo del repo (metodología, cobertura y revisión) está en
[`AGENTS.md`](AGENTS.md).

## Límites conocidos

- La galería de voces no está virtualizada: con cientos de voces es una página
  muy larga.
- Las URLs de resultado de MiniMax son temporales; descargá lo que quieras
  conservar.
- Las pruebas no llaman a MiniMax: los clientes se testean con dobles. Una
  corrida real contra el proveedor requiere `MINIMAX_API_KEY` y autorización.

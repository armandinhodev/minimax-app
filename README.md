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
| Speech (TTS/STT) | `/tts`, `/asr`, `/voices`, `/voices/clone`, `/voices/design` |
| Chat | `/text` |
| Imagen | `/image`, `/image/image-to-image` |
| Música | `/music`, `/music/lyrics`, `/music/cover-preprocess` |
| Video | `/video/generation`, `/video/context-ir`, `/video/regeneration`, `/video/tasks` |
| Video Agent | `/video-agent` |
| Biblioteca | `/library` |

## Diseño

El sistema visual está documentado en [`docs/design.md`](docs/design.md). La
propuesta de referencia es [`docs/minimax-studio-ui/`](docs/minimax-studio-ui/):
pizarra y cobre, Nimbus Sans + Liberation Mono, sidebar, paneles con cabecera de
riel y placas de reproducción.

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
- [Video Agent: conteos exactos por plantilla](docs/minimax-video-agent-templates.md)
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

- El estado de cada pantalla (formularios, resultados y el hilo de chat) se
  conserva mientras dure la pestaña; recargar la página o cerrar sesión lo
  descarta. Cada pantalla ofrece un reset para empezar de cero.
- Las imágenes de referencia se suben a MiniMax con un tope de 20 MB, por debajo
  de los 30 MB que acepta el proveedor para una imagen.
- En Image-to-Image y Video podés elegir **Paste image** en un
  campo de imagen y pegar una captura o imagen copiada con **Ctrl+V** o **⌘V**.
  Se sube una imagen por vez a MiniMax y el campo usa su referencia interna.
  Para pegar un enlace, elegí **URL**. Todas las imágenes pegadas o subidas
  muestran una miniatura del original guardado temporalmente en la pestaña.
  No hay selector de la biblioteca de MiniMax: una imagen ya subida no se puede
  previsualizar, así que la app no ofrece elegirla.
- En Video Agent, elegí **URL** para un enlace público o **Paste image** /
  **Upload** para usar el original. El archivo se previsualiza en la pestaña y
  se envía únicamente al elegir **Create video**. Cada plantilla pide una
  cantidad exacta de imágenes: **3D character product presentation** necesita
  tres, el resto de las plantillas con imagen pide una. Los conteos confirmados
  están en
  [`docs/minimax-video-agent-templates.md`](docs/minimax-video-agent-templates.md).
- La galería de voces no está virtualizada: con cientos de voces es una página
  muy larga.
- En Library, una tarea de video en proceso o sin video disponible ofrece
  **Check status** para reconsultar a MiniMax por su `task_id` y actualizar el
  registro, sin regenerar. Video Agent no tiene listado: solo se puede consultar
  por ID.
- Las URLs de resultado de MiniMax son temporales; descargá lo que quieras
  conservar.
- Las pruebas no llaman a MiniMax: los clientes se testean con dobles. Una
  corrida real contra el proveedor requiere `MINIMAX_API_KEY` y autorización.

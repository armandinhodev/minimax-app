# Organización de la API de MiniMax

La app se organiza sobre un solo eje: **el producto upstream de MiniMax**.
Cada dominio atraviesa las cuatro capas con el mismo nombre, y la UI se deriva
de él. No conviven ejes mezclados (concepto de UI, momento del flujo, recurso
upstream) como antes de esta estandarización.

## El eje: dominios upstream

| Dominio | Slug | Endpoints upstream |
| --- | --- | --- |
| Speech (T2A, async, voces) | `speech` | `/v1/t2a_v2`, `/v1/t2a_async_v2`, `/v1/query/t2a_async_query_v2`, `/v1/get_voice`, `/v1/delete_voice`, `/v1/voice_clone`, `/v1/voice_design` |
| Speech-to-Text | `asr` | `/v1/speech_to_text` |
| Image | `image` | `/v1/images/generations`, `/v1/images/edits`, `/v1/h3_image_context_ir` |
| Video | `video` | `/v2/video_generation`, `/v2/h3_context_ir`, `/v2/video_regeneration`, `/v2/query/video_generation[/{id}]`, `DELETE /v2/video_generation/{id}` |
| Video Agent | `video-agent` | `/v1/video_template_generation`, `/v1/query/video_template_generation` || Music | `music` | `/v1/music_generation`, `/v1/lyrics_generation`, `/v1/music_cover_preprocess` |
| Files | `files` | `/v1/files/upload`, `/list`, `/retrieve`, `/retrieve_content`, `/delete` |
| Text / LLM | `text` | `/v1/text/chatcompletion_v2`, `/anthropic/v1/messages`, `/v1/chat/completions`, `/v1/responses`, `/v1/responses/input_tokens`, `/v1/models[/{id}]` |

## Convención de cuatro capas

```
src/domain/interfaces/minimax/<dominio>/I<Domain>Client.ts   puerto
src/application/dto/minimax/<Dominio>DTO.ts                      contratos + schemas Zod
src/application/use-cases/minimax/<dominio>/<UseCase>.ts        lógica
src/infrastructure/minimax/<dominio>/<Domain>Client.ts           server-only, HTTP
src/app/api/minimax/<dominio>/<accion>/route.ts                 adaptador HTTP
```

Reglas que sostienen la convención:

- **El prefijo `MiniMax` no se repite.** El path ya lo dice: `infrastructure/minimax/speech/SpeechClient.ts`, no `MiniMaxSpeechClient`. Igual para los puertos (`ISpeechClient`, no `IMiniMaxSpeechClient`).
- **El DTO es dueño de su schema.** No existe una capa de validadores paralela: los Route Handlers importan el schema Zod directamente del DTO del dominio. Antes había dos fuentes de verdad (`@/lib/validators` y los DTO), y esa duplicación había provocado remediaciones sucesivas.
- **Lo que no es de MiniMax se separa.** `IGenerationRepository` y los DTO/use cases de library viven fuera del prefijo `minimax/`, porque son de la app, no del proveedor.
- **`import 'server-only'`** en toda la capa de infraestructura: la API key nunca llega al browser.

## Mapa de rutas

| Ruta de la app | Upstream |
| --- | --- |
| `POST /api/minimax/speech/t2a` | `POST /v1/t2a_v2` |
| `GET /api/minimax/speech/t2a/stream` | `POST /v1/t2a_v2` con `stream: true` (SSE) |
| `POST /api/minimax/speech/t2a/websocket` | `wss://api.minimax.io/ws/v1/t2a_v2` (relay server-side → SSE) |
| `POST /api/minimax/speech/t2a/async` | `POST /v1/t2a_async_v2` |
| `GET /api/minimax/speech/t2a/async/[taskId]` | `GET /v1/query/t2a_async_query_v2` |
| `GET /api/minimax/speech/t2a/async/file/[fileId]` | `GET /v1/files/retrieve` |
| `GET /api/minimax/speech/voices` | `POST /v1/get_voice` |
| `POST /api/minimax/speech/voices` | `POST /v1/delete_voice` |
| `POST /api/minimax/speech/voices/clone` | `POST /v1/voice_clone` |
| `POST /api/minimax/speech/voices/design` | `POST /v1/voice_design` |
| `POST /api/minimax/asr/transcriptions` | `POST /v1/speech_to_text` |
| `POST /api/minimax/asr/transcriptions/stream` | `POST /v1/speech_to_text` con `stream: true` (SSE) |
| `POST /api/minimax/image` | `POST /v1/images/generations` o `/v1/images/edits` |
| `POST /api/minimax/image/context-ir` | `POST /v1/h3_image_context_ir` |
| `POST /api/minimax/video/generation` | `POST /v2/video_generation` |
| `POST /api/minimax/video/context-ir` | `POST /v2/h3_context_ir` |
| `POST /api/minimax/video/regeneration` | `POST /v2/video_regeneration` |
| `GET /api/minimax/video/tasks` | `GET /v2/query/video_generation` |
| `GET /api/minimax/video/tasks/[taskId]` | `GET /v2/query/video_generation/{task_id}` |
| `DELETE /api/minimax/video/tasks/[taskId]` | `DELETE /v2/video_generation/{task_id}` |
| `POST /api/minimax/music/generations` | `POST /v1/music_generation` |
| `POST /api/minimax/music/lyrics` | `POST /v1/lyrics_generation` |
| `POST /api/minimax/music/cover-preprocess` | `POST /v1/music_cover_preprocess` |
| `POST /api/minimax/files` | `POST /v1/files/upload` |
| `GET /api/minimax/files` | `GET /v1/files/list` |
| `GET /api/minimax/files/[fileId]` | `GET /v1/files/retrieve` |
| `GET /api/minimax/files/[fileId]/content` | `GET /v1/files/retrieve_content` |
| `DELETE /api/minimax/files/[fileId]` | `POST /v1/files/delete` |
| `POST /api/minimax/text/chat/completions` | `POST /v1/text/chatcompletion_v2` |
| `POST /api/minimax/text/chat/completions/stream` | `POST /v1/text/chatcompletion_v2` con `stream: true` (SSE) |
| `POST /api/minimax/text/messages` | `POST /anthropic/v1/messages` |
| `POST /api/minimax/text/responses` | `POST /v1/responses` |
| `POST /api/minimax/text/responses/input-tokens` | `POST /v1/responses/input_tokens` |
| `GET /api/minimax/text/models` | `GET /v1/models` |
| `GET /api/minimax/text/models/[model]` | `GET /v1/models/{model}` |
| `POST /api/minimax/video-agent/generations` | `POST /v1/video_template_generation` |
| `GET /api/minimax/video-agent/generations/[taskId]` | `GET /v1/query/video_template_generation` |
| `GET /api/minimax/video-agent/templates` | ninguno — el catálogo está en la FAQ de MiniMax |

`POST /api/minimax/image` mantiene una sola ruta: el upstream decide entre
generación y edición según cuántas imágenes de referencia acompañan el request,
y la app replica esa decisión. El split en dos rutas queda como refinamiento
opcional.

## Compatibilidad

Las rutas anteriores a la estandarización responden **308** hacia su
equivalente canónico, mediante `src/middleware.ts`. El período de gracia
mantiene funcionando clientes externos y enlaces guardados. Cuando se decida
cortar la compatibilidad, basta con borrar el middleware y sus tests.

| Ruta vieja | Ruta canónica |
| --- | --- |
| `/api/minimax/tts` | `/api/minimax/speech/t2a` |
| `/api/minimax/tts/stream` | `/api/minimax/speech/t2a/stream` |
| `/api/minimax/async/submit` | `/api/minimax/speech/t2a/async` |
| `/api/minimax/async/status/[taskId]` | `/api/minimax/speech/t2a/async/[taskId]` |
| `/api/minimax/async/result/[fileId]` | `/api/minimax/speech/t2a/async/file/[fileId]` |
| `/api/minimax/voices` | `/api/minimax/speech/voices` |
| `/api/minimax/voices/clone` | `/api/minimax/speech/voices/clone` |
| `/api/minimax/voices/design` | `/api/minimax/speech/voices/design` |
| `/api/minimax/music` | `/api/minimax/music/generations` |
| `/api/minimax/files/upload` | `/api/minimax/files` |
| `/api/minimax/files/list` | `/api/minimax/files` |

## Qué queda fuera

Los endpoints **legacy** de MiniMax no se implementan, y esa es una decisión
consciente, no un hueco:

- Video V1: text-to-video, image-to-video, first/last-frame, subject-reference,
  query y download.
- Image `image-01`: text-to-image e image-to-image.
- Music free: `Music-3.0-free`, `Music-2.6-free`, `music-cover-free`
  (discontinuados por MiniMax).

La cobertura vigente está en `docs/minimax-api-alignment.md`.

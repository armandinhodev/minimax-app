# MiniMax API alignment — speech, voice, files, music

The existing MiniMax integrations were checked against the current official API reference and
brought back in line. Every endpoint below was read on 2026-11-11; only the differences that the
app actually hits were changed. Endpoints that already matched were left untouched.

Source of truth: <https://platform.minimax.io/docs/llms.txt> and the linked API reference pages.

## Summary

| Area | Change | Why |
| --- | --- | --- |
| Music request | `instrumental` now maps to the documented `is_instrumental` field | The field was accepted and then dropped, so MiniMax always received a vocal request |
| Music models | Free models (`music-3.0-free`, `music-cover-free`) removed; availability notice added | MiniMax discontinued the free music models |
| Music output | `output_format` stays `hex` only | The app stores bytes locally, so a `url` payload must never reach the hex decoder |
| Music response | `data.status === 1` reported as "still in progress" | The documented status enum distinguishes running from completed |
| Files | Per-endpoint purpose sets added; upload/list accept the documented media purposes | MiniMax documents a different purpose subset per endpoint |
| Files | Response mapped from the documented `filename` / `bytes` fields | The list and retrieve payloads were read with non-existent field names |
| Files / speech | int64 identifiers stay exact end to end | `file_id` / `task_id` can exceed the IEEE-754 safe range |
| Speech async | `task_id`, `status` and `file_id` read from the documented top-level response fields | The current payload is nested under `data` |
| Speech sync | Duration read from `extra_info.audio_length` | `data.duration` is not part of the documented response |
| Speech async limit | Inline text capped at 100,000 characters | The documented 1,000,000 ceiling only applies to zip file tasks |
| Voice design | `trial_audio` treated as the documented hex payload | The reference documents hex, not base64 |
| Voice list | `system_voice` array and `voice_name` display names supported | The documented response shape differs from the legacy payload |

## Endpoints checked

### Music

| Endpoint | Reference | Status |
| --- | --- | --- |
| `POST /v1/music_generation` | [music-generation](https://platform.minimax.io/docs/api-reference/music-generation) | Aligned — `is_instrumental` mapped, free models removed, hex-only output kept |
| `POST /v1/lyrics_generation` | [lyrics-generation](https://platform.minimax.io/docs/api-reference/lyrics-generation) | Unchanged — `mode`, `prompt`, `lyrics`, `title` and the response already matched |
| `POST /v1/music_cover_preprocess` | [music-cover-preprocess](https://platform.minimax.io/docs/api-reference/music-cover-preprocess) | Unchanged — `model: music-cover` plus exactly one of `audio_url` / `audio_base64` already matched |

### Speech

| Endpoint | Reference | Status |
| --- | --- | --- |
| `POST /v1/t2a_v2` | [speech-t2a-http](https://platform.minimax.io/docs/api-reference/speech-t2a-http) | Aligned — `output_format: hex` is now explicit, duration comes from `extra_info.audio_length` |
| `POST /v1/t2a_v2` (stream) | [speech-t2a-http](https://platform.minimax.io/docs/api-reference/speech-t2a-http) | Unchanged — SSE chunks are forwarded as before |
| `POST /v1/t2a_async_v2` | [speech-t2a-async-create](https://platform.minimax.io/docs/api-reference/speech-t2a-async-create) | Aligned — top-level `task_id`, inline text capped at 100,000 characters |
| `GET /v1/query/t2a_async_query_v2` | [speech-t2a-async-query](https://platform.minimax.io/docs/api-reference/speech-t2a-async-query) | Aligned — top-level `status` / `file_id`, status case normalized |

### Voice

| Endpoint | Reference | Status |
| --- | --- | --- |
| `POST /v1/voice_clone` | [voice-cloning-clone](https://platform.minimax.io/docs/api-reference/voice-cloning-clone) | Aligned — `file_id` and `clone_prompt.prompt_audio` are sent as exact int64 literals |
| `POST /v1/voice_design` | [voice-design-design](https://platform.minimax.io/docs/api-reference/voice-design-design) | Aligned — `trial_audio` is read as the documented hex payload |
| `POST /v1/get_voice` | [voice-management-get](https://platform.minimax.io/docs/api-reference/voice-management-get) | Aligned — documented `system_voice` array and `voice_name` supported |
| `POST /v1/delete_voice` | [voice-management-delete](https://platform.minimax.io/docs/api-reference/voice-management-delete) | Unchanged — `voice_type` + `voice_id` already matched |

### Files

| Endpoint | Reference | Status |
| --- | --- | --- |
| `POST /v1/files/upload` | [file-management-upload](https://platform.minimax.io/docs/api-reference/file-management-upload) | Aligned — documented upload purposes accepted |
| `GET /v1/files/list` | [file-management-list](https://platform.minimax.io/docs/api-reference/file-management-list) | Aligned — documented list purposes and `filename` / `bytes` fields |
| `GET /v1/files/retrieve` | [file-management-retrieve](https://platform.minimax.io/docs/api-reference/file-management-retrieve) | Aligned — `filename` / `bytes` fields |
| `GET /v1/files/retrieve_content` | [file-management-retrieve-content](https://platform.minimax.io/docs/api-reference/file-management-retrieve-content) | Unchanged — raw bytes are already returned |
| `POST /v1/files/delete` | [file-management-delete](https://platform.minimax.io/docs/api-reference/file-management-delete) | Aligned — `file_id` is sent as an exact int64 literal |

## Music availability

MiniMax retired the free music models and closed the paid music APIs to new accounts:

> Starting August 20, 2026, the paid APIs (Music Generation and Lyrics Generation) will no longer be
> available to new users; existing paying users can continue to use the current API services. The free
> music generation APIs (Music-3.0-free, Music-2.6-free, music-cover-free) will be discontinued.

The app therefore offers only `music-3.0` and `music-cover`, and both the Music Generation and the
Lyrics Generation pages show an availability notice. Cover generation is kept because the API
reference still documents `/v1/music_cover_preprocess` and the `music-cover` model, even though the
FAQ treats cover as retired.

## Cobertura de endpoints

Cada endpoint upstream implementado tiene una ruta de la app, sobre el eje de
dominios. El mapa completo está en
[architecture/api-organization.md](architecture/api-organization.md).

| Dominio | Endpoints upstream cubiertos | Ruta de la app |
| --- | --- | --- |
| Speech | `/v1/t2a_v2`, `/v1/t2a_async_v2`, `/v1/query/t2a_async_query_v2` | `/api/minimax/speech/t2a/**` |
| Voice | `/v1/voice_clone`, `/v1/voice_design`, `/v1/get_voice`, `/v1/delete_voice` | `/api/minimax/speech/voices/**` |
| ASR | `/v1/speech_to_text` | `/api/minimax/asr/transcriptions/**` |
| Text | `/v1/text/chatcompletion_v2`, `/v1/chat/completions`, `/anthropic/v1/messages`, `/v1/responses`, `/v1/responses/input_tokens`, `/v1/models`, `/v1/models/{model}` | `/api/minimax/text/**` |
| Files | `/v1/files/upload`, `/list`, `/retrieve`, `/retrieve_content`, `/delete` | `/api/minimax/files/**` |
| Image | `/v1/images/generations`, `/v1/images/edits`, `/v1/h3_image_context_ir` | `/api/minimax/image/**` |
| Video | `/v2/video_generation`, `/v2/h3_context_ir`, `/v2/video_regeneration`, `/v2/query/video_generation[/{id}]`, `DELETE /v2/video_generation/{id}` | `/api/minimax/video/**` |
| Music | `/v1/music_generation`, `/v1/lyrics_generation`, `/v1/music_cover_preprocess` | `/api/minimax/music/**` |

**Endpoints vigentes aún sin implementar** (pendientes de las unidades W4 y W5 en
adelante): `POST /v1/video_template_generation` y
`GET /v1/query/video_template_generation` (Video Agent), y el TTS por WebSocket
(`wss://api.minimax.io/ws/v1/t2a_v2`).

## Deliberate deviations

| Deviation | Reason |
| --- | --- |
| `output_format` accepts `hex` only | The Library stores the raw bytes locally; a `url` payload would have to be downloaded and re-encoded, and must never be decoded as hex |
| Voice clone preview text capped at 500 characters | MiniMax allows 1000, but every preview synthesis is billed per character |
| Sync TTS accepts exactly 10,000 characters | The reference says "less than 10,000" while the guide says "up to 10,000"; the looser documented value is kept |
| Uploads stay capped at 20 MB | The app-wide request limit is stricter than the documented per-purpose media limits |

## Notes for the parent

- The schema unit tests that used to live in `src/lib/validators.test.ts` were
  redistributed to the DTO that owns each schema (`SpeechDTO.test.ts`,
  `VoiceDTO.test.ts`, `FileDTO.test.ts`, `ImageDTO.test.ts`, `MusicDTO.test.ts`).
  The shared `src/lib/validators.ts` barrel was removed: the DTO is now the
  single source of truth for request schemas.
- `src/lib/upload-policy.ts` still carries a `t2a_async` upload entry. MiniMax does not document
  `t2a_async` as an upload purpose (it is a delete purpose), so the upload endpoint now rejects it.
  Widening `FilePurposeSchema` to the full documented set also requires new entries in
  `UPLOAD_POLICY_BY_PURPOSE`.
- `POST /api/minimax/files/[fileId]` still accepts the legacy delete purposes only, because
  `DeleteFileSchema` is built on `FilePurposeSchema`. The file client already supports every
  documented delete purpose.

## Verification

- [x] Mocked upstream request/response contract tests for every changed operation
- [x] Existing safe behavior pinned (hex output, retries, telemetry, free of billable retries)
- [x] Focused Vitest run for the touched clients, routes, pages and use cases
- [x] ESLint on the changed files

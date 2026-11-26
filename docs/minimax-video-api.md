# MiniMax H3 video API integration

The Video Studio targets the MiniMax video V2 endpoints: `POST /v2/video_generation` for video generation, `POST /v2/h3_context_ir` for prompt enrichment only, and `POST /v2/video_regeneration` for 2K regeneration. Task status is read through the shared query, list and cancel/delete endpoints. Every create is billable, asynchronous and **never retried** — the returned task id is polled separately.

## Quick path

| User intent | App surface | Upstream endpoint |
| --- | --- | --- |
| Overview of the studio | `/video` | — |
| Generate a video | `/video/generation`, `POST /api/minimax/video/generation` | `POST /v2/video_generation` |
| Enrich a prompt | `/video/context-ir`, `POST /api/minimax/video/context-ir` | `POST /v2/h3_context_ir` |
| Regenerate in 2K | `/video/regeneration`, `POST /api/minimax/video/regeneration` | `POST /v2/video_regeneration` |
| Browse tasks | `/video/tasks`, `GET /api/minimax/video/tasks` | `GET /v2/query/video_generation` |
| Follow a task | `GET /api/minimax/video/tasks/[taskId]` | `GET /v2/query/video_generation/{task_id}` |
| Cancel or delete | `DELETE /api/minimax/video/tasks/[taskId]` | `DELETE /v2/video_generation/{task_id}` |

Each mode lives on its own route, mirroring the MiniMax creation endpoints
one to one, so every one of them is an independent page and an independent
sidebar item.

## Supported models

| Model | Generation | Context IR | Regeneration | Resolutions | Duration | `adaptive` ratio |
| --- | --- | --- | --- | --- | --- | --- |
| `MiniMax-H3` | yes | yes | yes | `480P`, `768P`, `2K` | 4–15 s | yes |
| `MiniMax-H3-Highspeed` | yes | no | no | `480P`, `768P` | 4–15 s | yes |
| `MiniMax-H3-Lite` | yes | no | no | `480P`, `768P` | 4–15 s | no |
| `MiniMax-H3-Max` | yes | no | no | `480P`, `768P` | 5–15 s | yes |
| `MiniMax-H3-Max-Turbo` | yes | no | no | `480P`, `768P` | 5–15 s | yes |
| `MiniMax-H3-MG` | yes | no | no | `768P`, `2K` | 4–15 s | yes |
| `MiniMax-H3-NC` | yes | no | no | `480P`, `768P` | 4–15 s | no |

`MiniMax-H3` is the default in the app. It reaches 2K and also serves `480P`
through RunningHub: keep `model` as `MiniMax-H3` and set `resolution` to `480P`.
`MiniMax-H3-MG` reaches 2K but no `480P`.

`MiniMax-H3-Max` and `MiniMax-H3-Max-Turbo` accept `extra.prompt_expansion_mode`
(`disabled`, `balanced`, `quality`); the field is rejected for every other model
instead of being ignored.

`MiniMax-H3-Lite` and `MiniMax-H3-NC` do not support the `adaptive` ratio, so
reference-to-video requests with them need a concrete ratio.

## Scenario rules

The content array decides the scenario, and the aspect ratio follows from it.

| Scenario | Content | Aspect ratio |
| --- | --- | --- |
| Text-to-video | one `text` item only | Required, concrete ratio only. `adaptive` is rejected. |
| Image-to-video | `text` + `first_frame` and/or `last_frame` images | Always `adaptive`. Any concrete ratio is rejected. |
| Reference-to-video | `text` + `reference_image`, `reference_video` and/or `reference_audio` | Optional. `MiniMax-H3-Lite` rejects `adaptive` and requires a concrete ratio. |

Additional constraints:

- Image-to-video and reference-to-video inputs cannot be mixed in one request.
- A `last_frame` image requires a `first_frame` image.
- Exactly one `text` item is required for generation and context-ir.
- A single image without a role defaults to `first_frame`; with other media present the role is mandatory.
- At most 1 first frame, 1 last frame, 9 reference images, 3 reference videos and 3 reference audio items.

## Request mapping

The app request uses camelCase names; the client maps them to the documented snake_case fields.

| App field | Upstream field | Rules |
| --- | --- | --- |
| `model` | `model` | One of the supported models above. |
| `content[].type` | `content[].type` | `text`, `image_url`, `video_url` or `audio_url`. |
| `content[].text` | `content[].text` | Prompt. Up to 7,000 characters for generation and context-ir, up to 40,000 for regeneration. |
| `content[].url` | `content[].image_url.url` / `video_url.url` / `audio_url.url` | Public `http(s)` URL, `mm_file://{file_id}`, or a supported Base64 data URL. |
| `content[].role` | `content[].role` | `first_frame`, `last_frame`, `reference_image`, `reference_video`, `reference_audio`, and `base_video` for regeneration only. |
| `resolution` | `resolution` | `480P`, `768P` or `2K`, restricted per model. |
| `duration` | `duration` | Whole seconds, restricted per model. |
| `ratio` | `ratio` | `adaptive`, `21:9`, `16:9`, `4:3`, `1:1`, `3:4` or `9:16`, restricted per scenario. |
| `promptExpansionMode` | `extra.prompt_expansion_mode` | `MiniMax-H3-Max` only. |
| `sourceTaskId` | `source_task_id` | Regeneration by source task id. Mutually exclusive with `content`. |
| `aigcWatermark` | `aigc_watermark` | Regeneration only. |

Regeneration requires **exactly one** source: either `sourceTaskId`, or a `content` array carrying exactly one `video_url` item with `role: "base_video"`. The base video must be a MiniMax H3 768P output with an audio track, 24 fps, dimensions divisible by 32, an area between 768×768 and 768×1344, and 107–362 frames in increments of 17.

## Media references

Media references are validated **syntactically only**. The server never downloads a user supplied URL.

| Kind | Accepted syntax | Size limit |
| --- | --- | --- |
| Image | `http(s)` URL, `mm_file://{file_id}`, `data:image/(jpeg\|jpg\|png\|webp\|heic\|heif);base64,...` | ≤ 30 MB |
| Video | `http(s)` URL, `mm_file://{file_id}`, `data:video/mp4;base64,...` | ≤ 50 MB |
| Audio | `http(s)` URL, `mm_file://{file_id}`, `data:audio/(wav\|mp3);base64,...` | ≤ 15 MB |

Inline media must stay under 64 MB in total. URLs with embedded credentials, non-HTTP schemes and malformed data URLs are rejected.

## Response shape

`VideoTaskDTO` is the normalized task shape used by every route:

```json
{
  "id": "424010985738629",
  "model": "MiniMax-H3",
  "status": "succeeded",
  "taskType": "generation",
  "modality": "video",
  "content": { "url": "https://cdn.example.com/h3-output.mp4" },
  "resolution": "2K",
  "duration": 5,
  "ratio": "16:9",
  "createdAt": 1785125529000,
  "updatedAt": 1785125946000,
  "usage": { "totalSeconds": 5, "outputSeconds": 5 }
}
```

- `status` is one of `queued`, `running`, `succeeded`, `failed`, `cancelled`. An unknown status is rejected instead of being coerced, so a failed query can never look like a completed task.
- `taskType` is `generation`, `h3_context_ir` or `regeneration`.
- `modality` is `video` for generation and regeneration, `text` for context-ir.
- `createdAt` and `updatedAt` are epoch **milliseconds**; MiniMax reports Unix seconds.
- `content.url` is only present when the provider link is a valid `http(s)` URL, so it can be embedded directly. `content.prompt` carries the enriched prompt of a context-ir task.
- `usage` is an extra field added by the app: it keeps the provider seconds or token counters that MiniMax reports once a task succeeds.

Route envelopes:

| Route | Body |
| --- | --- |
| `POST /api/minimax/video/generation` | `{ taskId }` |
| `POST /api/minimax/video/context-ir` | `{ taskId }` |
| `POST /api/minimax/video/regeneration` | `{ taskId }` |
| `GET /api/minimax/video/tasks/[taskId]` | `{ task }` |
| `GET /api/minimax/video/tasks` | `{ items, total }` |
| `DELETE /api/minimax/video/tasks/[taskId]` | `{ taskId, action, status }` |

`action` and `status` are `cancelled` (the task was queued) or `deleted` (the task had already finished). MiniMax decides the action from the current task status; the app never chooses it.

## Task lifecycle

1. The browser posts a create request. The route answers with the task id and records a queued task in the Library.
2. The browser polls `GET /api/minimax/video/tasks/[taskId]` every 3 seconds, at most 40 times, one request at a time.
3. The poll stops on a terminal status, on a request failure, or when the page unmounts. The in-flight request is aborted and the timer is cleared.
4. A successful query records the fresh status and the provider URL in the Library.

Only one task is tracked at a time, and a new create is refused while another one is still in flight.

## Library integration

`recordVideoTaskBestEffort` (from `src/app/api/minimax/_shared/video-library-recording.ts`) stores every video task as a `video` generation, keyed by the provider task id.

| Moment | What is recorded |
| --- | --- |
| After a create | The queued task and the original prompt. |
| After a successful query | The fresh status, the provider URL and the metadata. |
| After a list | The status of every returned task. The Library keeps the newer status when the provider reports an older one. |
| After a cancellation | The cancelled status, using the task type sent with the request. |
| After a deletion | Nothing. The local history of a finished result is preserved. |

Provider URLs are stored as `provider_url` assets with an explicit `expirationUnknown` flag: MiniMax publishes no expiry for the output links, so the app never invents one.

## Error handling

- `401` — the request carries no valid app access key. The route never calls MiniMax.
- `400` — the request breaks a documented rule. The route never calls MiniMax and the message names the rule.
- `4xx` from MiniMax — surfaced with the upstream status and message, for example `422 video description contains sensitive content (1026)`.
- `5xx` from MiniMax — reported as a temporary upstream failure with the upstream status attached.

Task ids are validated before they reach an upstream URL, and they are URL encoded when they are placed in the path.

## Checklist

- [ ] The chosen model supports the requested resolution and duration.
- [ ] The aspect ratio matches the scenario (concrete for text-to-video, adaptive for image-to-video).
- [ ] Image-to-video and reference-to-video inputs are not mixed.
- [ ] Regeneration carries exactly one source, and the base video is a 768P MiniMax H3 output.
- [ ] Media references use a supported syntax and stay inside the documented size limits.
- [ ] The finished video is downloaded while the provider link is still valid.

## Upstream references

- [Create Video Generation Task](https://platform.minimax.io/docs/api-reference/video-generation-v2-create)
- [Create H3-Context-IR Task](https://platform.minimax.io/docs/api-reference/video-generation-v2-h3-context-ir)
- [Create Video Regeneration Task](https://platform.minimax.io/docs/api-reference/video-generation-v2-regeneration)
- [Query Task](https://platform.minimax.io/docs/api-reference/video-generation-v2-query)
- [List Tasks](https://platform.minimax.io/docs/api-reference/video-generation-v2-list)
- [Cancel or Delete Task](https://platform.minimax.io/docs/api-reference/video-generation-v2-delete)

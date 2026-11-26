# MiniMax Video Agent integration

The Video Agent studio targets the template generation endpoints:

| User intent | App surface | Upstream endpoint |
| --- | --- | --- |
| Render a video from a template | `/video-agent`, `POST /api/minimax/video-agent/generations` | `POST /v1/video_template_generation` |
| Follow the task | `GET /api/minimax/video-agent/generations/[taskId]` | `GET /v1/query/video_template_generation` |
| Browse templates | `GET /api/minimax/video-agent/templates` | none — MiniMax publishes the list in its FAQ |

## The template catalogue is not an endpoint

MiniMax has no endpoint that lists templates: the catalogue is published in
[Video Agent Template List](https://platform.minimax.io/docs/faq/video-agent-templates).
The app therefore ships a curated copy in
`src/application/dto/minimax/video-agent/VideoAgentDTO.ts` — the 16 official
templates with their IDs and whether each one needs a media input, a text
input, or both. When MiniMax adds a template, that list has to be updated.

## Request mapping

| App field | Upstream field | Rules |
| --- | --- | --- |
| `templateId` | `template_id` | Required. Must be one of the official IDs. |
| `mediaInputs[]` | `media_inputs[]` | `{ value }` entries. Image URL, `mm_file://{file_id}` or a JPEG/PNG/WebP data URL. |
| `textInputs[]` | `text_inputs[]` | `{ value }` entries. |
| `callbackUrl` | `callback_url` | Optional. Absolute URL. |

Media requirements: JPEG, PNG or WebP; under 20MB; shorter side over 300px;
aspect ratio between 2:5 and 5:2.

### Callback verification

`callback_url` needs a receiver that answers MiniMax's `challenge` request
with the same value within 3 seconds, before any status push arrives. The app
does not host that endpoint: point the field at a receiver you control.

## Response

`POST` returns `{ "task_id": "…" }`. The query endpoint returns:

```json
{
  "task_id": "401047179385389059",
  "status": "Success",
  "video_url": "https://cdn.hailuoai.com/prod/video.mp4"
}
```

The upstream status vocabulary is `Preparing`, `Processing`, `Success` and
`Fail`. The app normalizes it to `preparing`, `processing`, `succeeded` and
`failed`.

**The download link is valid for 9 hours.** The app shows that reminder next
to the player.

## Billing

Template tasks are billable and asynchronous, like video generation. The
client never retries a create: a retry could charge twice for the same task.

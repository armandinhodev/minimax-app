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
| `mediaInputs[]` | `media_inputs[]` | `{ value }` entries. Public image URL or a JPEG/PNG/WebP data URL. The count must match the template (see below). |
| `textInputs[]` | `text_inputs[]` | `{ value }` entries. Only the templates that accept text take exactly one; the rest reject text with `2013`. |
| `callbackUrl` | `callback_url` | Optional. Absolute URL. |

Media requirements: JPEG, PNG or WebP; under 20MB; shorter side over 300px;
aspect ratio between 2:5 and 5:2.

### Exact input counts

MiniMax validates exact counts and answers `2013` with messages such as
`image input count not match, expected: 3, actual: 1`. The published template
table omits these counts. The app ships the confirmed counts, validates them
before calling MiniMax, and shows the provider detail if a count is rejected
anyway. The full matrix, the discrepancies with the published table and the
non-billable probe method live in
[Video Agent templates: exact input counts](minimax-video-agent-templates.md).

The studio previews pasted and selected files locally, and encodes them as
Base64 only when the user selects **Create video**. It does not upload them to
the MiniMax file library first. For a previously saved `mm_file://` ID, attach
the original or use a public URL instead. The app endpoint retains its
existing request schema for API callers, but MiniMax does not document file ID
references as supported for Video Agent.

The studio reports an upstream `2013` as invalid inputs rather than an outage.

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

## Library

Creating a task records it in the local Library as a pending video, and every
status query refreshes that same record. When MiniMax reports success, the
clip is attached as a temporary provider URL under the source **Video Agent**.
Library also offers **Check status** on unfinished tasks, which queries the
same provider task ID without creating a new one. MiniMax documents the
download link as valid for 9 hours; the app records the expiration as unknown
instead of inventing a deadline. Recording is best effort: a storage failure
is logged and never turns a submitted task into an API error.

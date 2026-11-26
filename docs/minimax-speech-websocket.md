# MiniMax WebSocket TTS

MiniMax exposes a WebSocket transport for text-to-speech:
`wss://api.minimax.io/ws/v1/t2a_v2`.

## Why the app relays instead of connecting from the browser

MiniMax authenticates the socket with the API key:

```
wss://api.minimax.io/ws/v1/t2a_v2
Authorization: Bearer <MINIMAX_API_KEY>
```

A browser cannot hold that connection without the key reaching it, and a
Next.js Route Handler cannot upgrade an HTTP request to a WebSocket. So the app
uses a **relay**:

```
browser ──HTTP POST──▶ app route ──WebSocket──▶ MiniMax
   ◀──SSE chunks────    ◀──WS events────────
```

The server holds the socket and re-encodes the audio as Server-Sent Events.
The key never leaves the server.

Node's global `WebSocket` (undici) accepts a `headers` option, which is how
the Authorization header gets attached — no extra dependency.

## Protocol

| Direction | Event | Payload |
| --- | --- | --- |
| server → client | `connected_success` | `session_id`, `trace_id` |
| client → server | `task_start` | `model`, `voice_setting`, `audio_setting` |
| server → client | `task_started` | `session_id` |
| client → server | `task_continue` | `text` (max 10,000 characters) |
| server → client | `task_continued` | `data.audio` (hex), `is_final`, `extra_info` |
| server → client | `task_finished` | `session_id` |
| server → client | `task_failed` | `base_resp.status_code`, `base_resp.status_msg` |

MiniMax closes the socket after 120 seconds without traffic.

### Settings

| Field | Values | Default |
| --- | --- | --- |
| `model` | `speech-2.8-hd`, `speech-2.8-turbo`, `speech-2.6-hd`, `speech-2.6-turbo`, `speech-02-hd`, `speech-02-turbo`, `speech-01-hd`, `speech-01-turbo` | `speech-2.8-hd` |
| `voice_id` | any system, cloned or designed voice | required |
| `speed` | 0.5 – 2 | 1 |
| `vol` | (0, 10] | 1 |
| `pitch` | -12 – 12 | 0 |
| `format` | `mp3`, `pcm`, `flac`, `wav`, `pcmu_raw`, `pcmu_wav`, `opus` | `mp3` |
| `sample_rate` | 8000, 16000, 22050, 24000, 32000, 44100 | 32000 |
| `channel` | 1 or 2 | 1 |

## App surface

| User intent | App route | Upstream |
| --- | --- | --- |
| Stream over WebSocket | `POST /api/minimax/speech/t2a/websocket` | `wss://api.minimax.io/ws/v1/t2a_v2` |
| Stream over HTTP | `POST /api/minimax/speech/t2a/stream` | `POST /v1/t2a_v2` with `stream: true` |

The `/tts` page has a transport toggle. Both transports reach the same
player, because the relay re-encodes the audio in the upstream shape
(`data.audio`, hex): one player, two transports.

## The audio encoding is hex

MiniMax streams the audio as **hex** inside `data.audio`:

```json
{ "data": { "audio": "deadbeef", "status": 2 }, "extra_info": { "usage_characters": 163 } }
```

Hex is also a subset of the base64 alphabet, so the two cannot be told apart
by the alphabet alone. The player treats a lowercase, even-length payload as
hex and anything else as base64, which keeps other producers working.

## Scope

- The bidi variant (the browser streaming text in chunks while audio comes
  back) is **not** implemented: it needs a duplex channel the HTTP transport
  cannot provide. The app sends the whole text in one `task_continue`.

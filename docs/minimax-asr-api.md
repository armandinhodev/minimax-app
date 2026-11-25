# MiniMax ASR (Speech-to-Text) integration

The Transcription studio targets `POST /v1/speech_to_text`. It is the only
MiniMax endpoint that takes `multipart/form-data` with the audio binary.

## Quick path

| User intent | App surface | Upstream endpoint |
| --- | --- | --- |
| Transcribe an audio file | `/asr`, `POST /api/minimax/asr/transcriptions` | `POST /v1/speech_to_text` |
| Transcribe with incremental text | `/asr` → "Stream transcript", `POST /api/minimax/asr/transcriptions/stream` | `POST /v1/speech_to_text` with `stream: true` |

## Request mapping

The browser posts `multipart/form-data` to the app's own route; the server
rebuilds the upstream form from it. The app never decodes the audio.

| Form field | Upstream field | Rules |
| --- | --- | --- |
| `file` | `file` | The audio binary. Required. |
| `model` | `model` | `asr-1.0` (the only documented model). |
| `response_format` | `response_format` | `json`, `verbose_json`, `srt` or `vtt`. Default `json`. |
| `timestamp_level` | `timestamp_level` | Empty (default), `sentence` or `word`. Only takes effect with `verbose_json`, `srt` or `vtt`. |
| `language` | `language` (header) | BCP-47 tag. Omitted or empty enables mixed-language recognition. |

Supported languages: `zh`, `yue`, `en`, `ja`, `ko`, `th`, `vi`, `id`, `ms`,
`fil`, `ar`, `tr`, `fr`, `de`, `es`, `it`, `pt`, `pl`, `ru`, `uk`.

## Limits

| Item | Limit | Upstream status |
| --- | --- | --- |
| Duration | 500 seconds | `400` — the audio is never silently truncated |
| Size | 50 MB | `413` |
| Containers | `wav`, `aiff`, `flac`, `alac`/`m4a`, `mp3`, `aac`, `opus`, `ogg` | `400` |

Raw PCM without a container is not supported. Recognition does not benefit from
high sample rates or stereo: mono 16 kHz or a compressed format gives the same
transcription with a much smaller upload.

## Response formats

| Format | Returns | App response |
| --- | --- | --- |
| `json` | `text` + `duration` | JSON body |
| `verbose_json` | `text` + `duration` + `segments[]` + `n_speakers` | JSON body |
| `srt` | SRT subtitles | `text/plain` |
| `vtt` | WebVTT subtitles | `text/vtt` |

`verbose_json`, `srt` and `vtt` enable speaker diarization and forced
alignment, and therefore **cannot be combined with `stream: true`** — the
upstream answers `400`. The app rejects that combination before the call.

Segments carry `id`, `start`, `end`, `speaker` and `text`. With
`timestamp_level: word` the granularity is character-level for Chinese and
word-level for English.

## Streaming

With `stream: true` the upstream answers `text/event-stream` and pushes one
event per line:

```
data: {"index":0,"delta":"Hello","finish":false}

data: {"index":1,"delta":" everyone","finish":false}

data: {"index":2,"delta":"","finish":true,"duration":26.325}
```

The client concatenates the `delta` values in `index` order and stops after
`finish: true`, which also carries the audio duration. The app forwards the
events verbatim from `/api/minimax/asr/transcriptions/stream`.

## Billing

MiniMax bills transcriptions by the **audio duration**. The client therefore
never retries: a retry after an ambiguous failure could charge the same audio
twice. Upstream failures surface as a `500` with a generic message.

## Errors

The ASR endpoint uses an OpenAI-style envelope instead of the usual MiniMax
shape:

```json
{
  "type": "error",
  "error": { "type": "bad_request_error", "message": "…(2013)", "http_code": "400" },
  "request_id": "…"
}
```

The app normalizes it to `MiniMaxAsrError` (code, status, message) and maps it
to the usual route error response, so the browser never sees upstream internals.

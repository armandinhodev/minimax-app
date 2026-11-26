# MiniMax Text (LLM) integration

The Chat Studio talks to MiniMax through **four upstream surfaces**. The app
keeps one canonical conversation shape and the client translates it to whichever
surface the request selects.

| Surface | Upstream endpoint | App route |
| --- | --- | --- |
| Native | `POST /v1/text/chatcompletion_v2` | `POST /api/minimax/text/chat/completions` |
| OpenAI | `POST /v1/chat/completions` | `POST /api/minimax/text/chat/completions` |
| Anthropic | `POST /anthropic/v1/messages` | `POST /api/minimax/text/messages` |
| Responses | `POST /v1/responses` | `POST /api/minimax/text/responses` |
| Streaming (native) | `POST /v1/text/chatcompletion_v2` con `stream: true` | `POST /api/minimax/text/chat/completions/stream` |
| Token estimate | `POST /v1/responses/input_tokens` | `POST /api/minimax/text/responses/input-tokens` |
| Model list | `GET /v1/models` | `GET /api/minimax/text/models` |
| Model retrieve | `GET /v1/models/{model}` | `GET /api/minimax/text/models/{model}` |

> The Anthropic-compatible endpoint is `/anthropic/v1/messages`, **not**
> `/v1/messages`. The prefix is part of the path.

## Models

| Model | Notes |
| --- | --- |
| `MiniMax-M3.1-Flash` | Default. 1M context, multimodal (text, image, video), always thinks. Thinking depth is tuned with `output_config.effort`. |
| `MiniMax-M3` | Multimodal, thinking is off unless `thinking: { type: 'adaptive' }` is sent. |

Both are reasoning models: streaming is recommended.

## Canonical request

The app body is the same for every surface:

```json
{
  "model": "MiniMax-M3.1-Flash",
  "system": "You are concise.",
  "messages": [
    { "role": "user", "content": "hola" },
    { "role": "user", "content": [
      { "type": "text", "text": "que ves?" },
      { "type": "image_url", "imageUrl": "https://example.com/a.png" }
    ] }
  ],
  "maxCompletionTokens": 4096,
  "temperature": 1,
  "topP": 0.95,
  "tools": [{ "name": "get_weather", "description": "…", "parameters": {} }],
  "toolChoice": "auto",
  "maskSensitiveInfo": false
}
```

Roles are `system`, `user`, `assistant` and `tool`. A `tool` message must carry
`toolCallId`, the id of the call it answers.

### How each surface receives it

| Canonical field | Native / OpenAI | Anthropic | Responses |
| --- | --- | --- | --- |
| `system` | leading `system` message | top-level `system` | top-level `instructions` |
| `messages[].content` (text) | `content` string | `content` string | `content` string |
| `messages[].content` (parts) | `[{type:'text'\|'image_url'}]` | `[{type:'text'\|'image'}]` | `[{type:'input_text'\|'input_image'}]` |
| `messages[].role` | same | `system` is lifted out; `tool` becomes a `tool_result` block | `system` becomes `developer` |
| `maxCompletionTokens` | `max_completion_tokens` | `max_tokens` (required) | `max_output_tokens` |
| `tools[]` | `[{type:'function', function:{…}}]` | `[{name, description, input_schema}]` | `[{type:'function', name, …}]` |
| `toolChoice` | `tool_choice: 'auto'` | `tool_choice: { type: 'auto' }` | `tool_choice: 'auto'` |

`max_tokens` is mandatory on the Anthropic surface; the app defaults it to
4096 (the reference recommends 131072 and caps it at 524288).

## Canonical response

Every surface is normalized to the same shape, so the browser never has to
branch on the surface:

```json
{
  "id": "…",
  "model": "MiniMax-M3.1-Flash",
  "content": "…",
  "reasoningContent": "…",
  "toolCalls": [{ "id": "…", "name": "get_weather", "arguments": "{…}" }],
  "finishReason": "tool_calls",
  "usage": { "inputTokens": 10, "outputTokens": 20, "totalTokens": 30, "reasoningTokens": 5 },
  "inputSensitive": false,
  "outputSensitive": false
}
```

`finishReason` keeps each surface's own vocabulary: `stop`, `length`,
`content_filter`, `tool_calls` (native / OpenAI) and `end_turn`, `max_tokens`,
`tool_use`, `pause_turn` (Anthropic).

## Errors

The text endpoints use two different envelopes, and the client normalizes
both:

- native / OpenAI: `{ code, message }` plus a `base_resp`. An application
  error inside `base_resp` is reported **even on HTTP 200**, so the client
  checks the payload before trusting it.
- Anthropic / Responses: `{ type: 'error', request_id, error: { type, message } }`.

Both become a `MiniMaxTextError` with a code, a status and a message, and the
route turns them into the usual safe response.

## Streaming

`POST /api/minimax/text/chat/completions/stream` forwards the upstream SSE
bytes verbatim. The browser accumulates `choices[].delta.content` and
`choices[].delta.reasoning_content` until the stream ends.

# MiniMax H3 image API integration

The image workflow now targets the current MiniMax-H3-Image endpoints: `POST /v1/images/generations` for text-to-image, `POST /v1/images/edits` for image edits, and `POST /v1/h3_image_context_ir` for prompt enhancement only. The legacy `image-01` endpoints (`/v1/image_generation`) are no longer used.

## Quick path

| User intent | App surface | Upstream endpoint |
| --- | --- | --- |
| Generate from a prompt | `/image` page, `POST /api/minimax/image` | `POST /v1/images/generations` |
| Edit with reference images | `/image/image-to-image` page, `POST /api/minimax/image` | `POST /v1/images/edits` |
| Preview the enhanced prompt | `POST /api/minimax/image/context-ir` | `POST /v1/h3_image_context_ir` |

The route picks the endpoint automatically: a request with 1 to 16 reference images is an edit, a request without them is text-to-image.

## Supported models

| Model | Generation | Edit | Context IR |
| --- | --- | --- | --- |
| `MiniMax-H3-Image` | yes | yes | yes |
| `MiniMax-H3-Image-Highspeed` | yes | yes | no (returns 400) |

`MiniMax-H3-Image` is the default in the app.

## Request mapping

The app request uses camelCase names; the client maps them to the documented snake_case fields.

| App field | Upstream field | Rules |
| --- | --- | --- |
| `model` | `model` | One of the supported models above. |
| `prompt` | `prompt` | 1 to 32,000 characters, trimmed. |
| `n` | `n` | 1 to 10, default 1. |
| `size` | `size` | `WIDTHxHEIGHT` or `auto`. Area between 655,360 and 20,000,000 px, ratio between 1:3 and 3:1. Cannot be combined with `aspectRatio` or `area`. |
| `aspectRatio` | `aspect_ratio` | `auto` or `X:Y` with X and Y between 1 and 300 and a ratio between 1:3 and 3:1. |
| `area` | `area` | `1K`, `2K` or `4K`. Target areas are 1024, 2048 and 4096 squared pixels. |
| `outputFormat` | `output_format` | `png`, `jpeg`, `jpg` or `webp`. The response always reports `png`, `jpeg` or `webp`. |
| `responseFormat` | `response_format` | `url` only. The Library stores provider URLs. |
| `outputCompression` | `output_compression` | 0 to 100, default 95. Applies to `jpeg` and `webp` only. |
| `disablePromptEnhanced` | `disable_prompt_enhanced` | The documented disable flag. Enhancement is on by default. Text-to-image with the flag set requires a fixed ratio or an explicit size. Not sent for edits: the edit endpoint always enhances the prompt. |
| `stream` | `stream` | Enables Server-Sent Events. Only `url` output is supported. |
| `images[].imageUrl` | `images[].image_url` | 1 to 16 references. Public URL, `mm_file://{file_id}`, or a `data:image/<format>;base64,...` URI with JPG, PNG, WEBP, HEIC or HEIF content. |

When `size` is omitted the client sends `size: "auto"` together with `aspect_ratio` (default `auto`) and `area` (default `4K`). When `size` is an explicit `WIDTHxHEIGHT`, both fields are omitted because the provider rejects that combination.

## Response shape

```json
{
  "id": "021792308678142a2c883cf675b9804d",
  "imageUrls": ["https://example.com/h3-image/output-0.jpg"],
  "images": [
    {
      "index": 0,
      "url": "https://example.com/h3-image/output-0.jpg",
      "size": "2720x1536",
      "revisedPrompt": "An orange cat curled up asleep on a sunlit windowsill.",
      "error": null
    }
  ],
  "metadata": {
    "successCount": 1,
    "failedCount": 0,
    "totalCount": 1,
    "outputFormat": "jpeg",
    "requestId": "021792308678142a2c883cf675b9804d",
    "created": 1792308678,
    "usage": { "generatedImages": 1, "totalTokens": 7254, "inputTokens": 3174, "outputTokens": 4080 }
  },
  "expiresAt": null
}
```

- `id` is the provider `request_id` when present, otherwise a generated UUID.
- `images` keeps every requested item, including the ones that failed.
- `expiresAt` is `null`: the current endpoints document no retention window for the returned URLs, so the app does not claim one.

## Per-item failures

A request succeeds with HTTP 200 as soon as one image is generated. `data[]` then holds one entry per requested image, and the failed entries carry only `error`:

```json
{ "error": { "code": "1027", "message": "output image failed content safety check" } }
```

The app surfaces these per item: the UI lists each failure with its code and message, and the Library records only the successful images. When every image fails, the provider answers with HTTP 402, 422 or 500 and the app reports that error instead.

## Errors

| Provider condition | HTTP | App response |
| --- | --- | --- |
| Invalid parameters, unsupported content | 400 / 422 | Upstream message with the provider status. |
| Insufficient balance or plan quota | 402 | Upstream message with the provider status. |
| Rate limited (images per minute) | 429 | Shared retryable message. |
| Provider failure | 500 | Shared retryable message. |
| Client timeout | 504 | `Request timed out`. |

Upstream errors use the envelope `{ "type": "error", "error": { "type", "message", "http_code" } }`. The client also still understands the legacy `base_resp` envelope reported inside a 200 response.

## Streaming

With `stream: true` the provider pushes Server-Sent Events. The client parses them and returns the same response shape, so the app API stays JSON.

| Event | Meaning |
| --- | --- |
| `image_generation.partial_succeeded` / `image_edit.partial_succeeded` | One image is ready. |
| `image_generation.partial_failed` / `image_edit.partial_failed` | One image failed; other images continue. |
| `image_generation.completed` / `image_edit.completed` | All images are done; carries `usage` and `request_id`. |
| `error` | Nothing was generated. The stream ends and the request is not billed. |

Keepalive comments (`: keepalive`) are ignored. Errors raised before the response headers arrive are returned as regular HTTP errors.

## Context IR

`POST /api/minimax/image/context-ir` runs the prompt enhancement on its own and returns the enhanced prompt, the aspect ratio chosen by the enhancement, and the token usage. It generates no images.

To reuse the enhanced prompt without paying for enhancement twice, send it as the `prompt` of a text-to-image request with `disablePromptEnhanced: true` and the returned `aspectRatio`. Image edits always enhance the prompt, so the result cannot be reused there.

## Operational rules

- The client timeout is 600 seconds, matching the documented server window.
- Automatic retries are disabled. These endpoints are not idempotent: a retry generates and bills a second set of images.
- Reference image URLs are forwarded to MiniMax as provided. This server never fetches a user-supplied URL.
- Library assets keep the provider URL, the reported output format, and the matching MIME type. No expiry is stored because none is documented.

## Migration from image-01

| Legacy option | Current behaviour |
| --- | --- |
| `seed` | Removed. The current endpoints have no seed, so the field is rejected instead of silently ignored. |
| `promptOptimizer` | Replaced by `disablePromptEnhanced`, the documented disable flag. |
| `subjectReference` | Replaced by `images[]`, which accepts 1 to 16 references. |
| `width` / `height` | Replaced by `size: "WIDTHxHEIGHT"`. |
| `aspectRatio` default `1:1` | Default is now `auto`; the server decides the frame when the ratio is not pinned. |
| `n` up to 9 | Up to 10. |
| `prompt` up to 1,500 characters | Up to 32,000 characters. |

The request object is strict, so any other legacy field is reported as an unrecognized key instead of being dropped.

## Checklist

- [ ] Every request field maps to a documented upstream field.
- [ ] Legacy options are rejected, not ignored.
- [ ] Per-item failures reach the UI and the Library.
- [ ] The client timeout is at least 600 seconds and no retry is performed.
- [ ] Asset format and MIME type match the reported output format.

## Sources

- [API Overview](https://platform.minimax.io/docs/api-reference/api-overview.md)
- [Text-to-Image](https://platform.minimax.io/docs/api-reference/image-generation-h3-generations.md)
- [Image Edit](https://platform.minimax.io/docs/api-reference/image-generation-h3-edits.md)
- [H3-Image-Context-IR](https://platform.minimax.io/docs/api-reference/image-generation-h3-context-ir.md)
- [Streaming Events](https://platform.minimax.io/docs/api-reference/image-generation-h3-streaming.md)
- [Image Generation Guide](https://platform.minimax.io/docs/guides/image-generation.md)

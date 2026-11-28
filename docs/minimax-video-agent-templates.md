# Video Agent templates: exact input counts

MiniMax publishes the template catalogue in
[Video Agent Template List](https://platform.minimax.io/docs/faq/video-agent-templates),
but that table omits how many inputs each template validates. The API rejects a
wrong count with `HTTP 200` and `base_resp.status_code: 2013`, for example:

```json
{ "base_resp": { "status_code": 2013, "status_msg": "invalid params, image input count not match, expected: 3, actual: 1" } }
```

The app ships the confirmed counts in
`src/application/dto/minimax/video-agent/VideoAgentDTO.ts` and validates the
request before calling MiniMax, so the form cannot submit an impossible count.

## Matrix (confirmed against the API on 2026-11-28)

| Template | ID | Images | Text |
| --- | --- | --- | --- |
| Diving | `392747428568649728` | 1 | 0 |
| Run for Life | `393769180141805569` | 1 | 1 |
| Transformers | `397087679467597833` | 1 | 0 |
| Still rings routine | `393881433990066176` | 1 | 0 |
| Weightlifting | `393498001241890824` | 1 | 0 |
| Climbing | `393488336655310850` | 1 | 0 |
| Anime Life Sim | `394514820878671878` | 0 | 1 |
| McDonald's Delivery Pet | `393879757702918151` | 1 | 0 |
| Pet Pilot | `397017167949312007` | 1 | 0 |
| Miniature Set Ad | `394176968202485769` | 1 | 0 |
| Male Model Try-On Ad | `393876118804459526` | 1 | 0 |
| Female Model Try-On Ad | `393866076583718914` | 1 | 0 |
| Art Fonts | `394875727173492739` | 0 | 1 |
| Drinkfall | `394220989629177861` | 1 | 0 |
| E-commerce Display Ad | `393853165953970178` | 1 | 0 |
| 3D character product presentation | `401431836934868999` | 3 | 1 |

## Discrepancies with the published table

- **E-commerce Display Ad**: the FAQ lists no media and required text. The API
  expects **one image and zero text inputs**. Sending text returns
  `text input count not match, expected: 0`.
- Most image templates reject text. Only **Run for Life** and the **3D
  character** template accept exactly one text input.

## How the counts were confirmed

Probes sent a deliberately impossible number of images (7) with the media
payload shape the API documents. A count mismatch is rejected before a task is
created, so those probes are free; the error reports the expected number:

```text
invalid params, image input count not match, expected: 3, actual: 7
```

The probe for a template that ignores text first reported
`text input count not match, expected: 0`, and the follow-up probe without text
reported its image count. One real request with the 3D template, three images
and one text input returned `status_code: 0` and a `task_id`, confirming the
row.

## Form behaviour

- The image field shows one slot per required image (three for the 3D
  template) and keeps **Create video** disabled until the exact count is
  attached.
- Only templates with a text input show the text box.
- When MiniMax rejects the count anyway (for example after a template change),
  the app shows the provider detail, including `expected` and `actual`.

## Maintenance

Re-run the probe whenever MiniMax adds or changes a template, then update the
catalogue and this matrix in the same change. Keep the counts as exact numbers:
the app sends exactly what the template validates, not "at most".

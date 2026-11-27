# Design system — MiniMax Studio

The source of truth is `docs/minimax-studio-ui/` (palette, directives and
plates). This file is the implementation contract: what the app does with that
proposal. Read both before touching a screen.

## The brief

**Subject.** A cutting room for generative media. An operator composes a job,
dispatches it, reads its state and retrieves the artifact.

**Audience.** Someone who runs generations all day behind one key.

**Job.** Compose → dispatch → read state → retrieve.

**The signature.** The playback plate: in audio, a waveform and a time ruler on
slate; in video, the ruler attached to the frame; in image, the full surface
with dimensions, format and download in the footprint. Copper is reserved for
the next action and the current selection.

## Color

Slate chrome, cool workspace, white panels, one copper accent.

| Token | Hex | Role |
| --- | --- | --- |
| `transport` | `#293341` | Sidebar, mobile bar and the body of the players. |
| `workspace` | `#E8EBEF` | The bench ground. |
| `panel` | `#FAFBFC` | Composition panels. |
| `plate` | `#FFFFFF` | Results, fields and inverse text. |
| `rule` | `#77828E` | Functional borders: controls that depend on their outline. |
| `separator` | `#CCD1D5` | Decorative separators (35 % of `rule` over `panel`). |
| `ink` | `#202B38` | Titles, body and values. |
| `muted` | `#506070` | Help, metadata and placeholders. |
| `accent` | `#A33E12` | Copper: primary action, selection and focus. |
| `accent-soft` | `#F8E8DE` | Selected nav route, selected chips, soft marks. |
| `ok` | `#296546` | Confirmation and completed work. |
| `run` | `#805700` | Queued, preparing, running, processing. |
| `error` | `#A12C32` | Failure and destructive action. |

**Application rules**

- One copper primary per form. Its label stays opaque white on hover; focus
  adds the outer ring.
- The same state color is used for the symbol, the word and the border.
- A wide alert mixes the state at 6 % over white and keeps the text in ink.
- Copper and red are distinguished by verb and context; every removal goes
  through confirmation.
- No fuchsia or magenta. A token in the 285–345° hue band fails the build.
- Text pairs are checked at 4.5:1; the functional rule at 3:1.

## Type

**Nimbus Sans** for the interface, **Liberation Mono** for technical data. Both
are declared as stacks with a local fallback; no webfont is downloaded.

| Role | Size / line-height | Weight | Tracking | Use |
| --- | --- | --- | --- | --- |
| Area title | 46 / 1.04, mobile 34 / 1.09 | 700 | −0.039em | Once per route. |
| Panel title | 23 / 1.26 | 700 | −0.024em | Form or result. |
| Subtitle | 17 / 1.41 | 700 | 0 | Voice group, asset name. |
| Body | 16 / 1.44 | 400 | 0 | Inputs and prose. |
| Label / button | 14 / 1.43 | 700 | 0 | Field label, action. |
| Help | 13 / 1.46 | 400 | 0 | Constraint next to a control. |
| Technical data | 13 / 1.54 | 400 | 0 | ID, time, count, size, state. |
| Main readout | 26 / 1.19 | 700 mono | 0 | Dashboard and Library totals. |

Tabular numerals everywhere. The full ID may break on narrow screens and is
copied whole. Preserve brands, acronyms, extensions and real model names.
Sentence case for the UI. Prompt and result line length stays at 76–80
characters.

## Shell

- **Sidebar, 220px** (190px between 900 and 1199px): the brand and Overview,
  then the seven areas in a stable order. Speech groups text to speech (TTS),
  transcription (STT) and the voice tools. The active area expands its routes;
  the current route carries the copper-soft ground, a 3px left mark and
  `aria-current`. A single-route area uses the same block on the area itself.
  Sign out sits at the foot.
- **Mobile:** a 52px slate bar with Menu and the brand. The drawer is 300px
  wide, traps focus, closes with Escape and restores focus to the trigger.
- **Content:** 1152px for standard routes; the full remaining width for Image,
  Music and Video. 32px padding on desktop, 18px on mobile.
- **Login:** a centered sheet with no navigation.

## Workbench

- 7/5 columns with a 16px gutter for composition and result. Speech uses two
  halves because both panels produce audio.
- Below 1100px the result stacks under the parameters.
- At 390px: one column, chips wrap, buttons are at least 44px high, metrics sit
  two per row. After dispatching from a long sheet, announce the state and
  offer the way to the result. Do not move focus during streaming.
- **Panels:** 10px outside, 5px inside, a `separator` frame and a rail header:
  40px icon tile, title and one line of purpose. Padding 20–22px desktop, 16px
  mobile. No shadows. Labels sit above their controls so a long name never
  shifts a column. Two short fields share a row only when comparable.
- **Plate:** white, no shadow. It sticks below the navigation only while its
  full height fits; otherwise it scrolls with the page. Playback and download
  stay in the same plate.
- **Job strip:** Compose, Dispatch, Render, Retrieve. Completed steps carry a
  check, the current step a 3px copper top rule and `aria-current="step"`. The
  backend decides the stage; Failed and Cancelled keep the last reached stage.

## Components

| Element | Treatment |
| --- | --- |
| Primary | Copper solid, white label, specific verb. While sending, block duplicates and keep width and focus. |
| Secondary / ghost | Rule outline for copy, open or download; ghost for contextual navigation. |
| Destructive | Red border and explicit verb. The dialog names the item, explains what is removed, focuses Cancel first and confirms with solid red. |
| Disabled | Workspace surface, secondary text, and an explanation where the reason matters (cover instrumental). |
| Field | Persistent label above, functional border, error below, counter aligned to the field. An asterisk plus one "Fields marked * are required." legend per sheet; `required` and `aria-required` on the control. |
| Select / dropdown | Arrow keys, Enter and Escape. Voices search by name or ID and announce language and count. Focus returns to the trigger. |
| Tabs / choice | Active route with line and weight. Exclusive choices carry a check and expose `aria-pressed` or `aria-selected`. |
| Switch / slider | Switch state by position plus accessible text; slider shows value and unit and supports arrows. |
| Dropzone | "Choose file" reachable by keyboard plus drag; file name, real progress and waveform or thumbnail. Error next to the file and a way to replace it. |
| Badge / notice | State with symbol and word. Selectable text for IDs and API details. |
| Audio / video | Play/pause, tabular position and duration, keyboard seek, download after success, and the native equivalent for volume and accessibility. |
| Long result | Selectable, preformatted for JSON or SRT, wrapped, with a Copy action and discreet confirmation. |
| Loading | Static skeleton that reserves the final size; numeric progress only when the service returns it. The previous result stays identified during a new run. |
| Dialog / drawer | Trap focus, Escape closes, inert background, focus restored. On a form error, focus the first invalid field and link the message with `aria-describedby`. |

### Job states

| API | Label and signal | Action or content |
| --- | --- | --- |
| `queued` | Queued, clock, run | Show the ID and the wait. |
| `preparing` | Preparing, run | Keep sources and parameters visible. |
| `running` | Running, run | Show the stage; cancel when available. |
| `processing` | Processing, run | Show the real processing detail. |
| `succeeded` | Succeeded, check, ok | Enable playback, copy or download. |
| `failed` | Failed, cross, error | Keep inputs; explain how to correct or retry. |
| `cancelled` | Cancelled, square, muted | Keep the task reference; allow a new composition. |

An empty result says where the output will appear. Zero matches offer a way to
clear filters. An expired TTL keeps the metadata and explains how to recreate
the resource. A missing session key uses the existing `/login`.

## Motion and accessibility

- Move only what confirms an operator action. The switch and the drawer may
  transition 120–160ms; `prefers-reduced-motion` disables them.
- The playback cursor follows real time; the loading indicator stays static.
- Send state changes to an `aria-live="polite"` region when the stage changes;
  group streaming chunks; reserve assertive alerts for errors that need
  intervention. The TTL counter announces expiry, not every second.
- Focus on a light background is a 3px copper ring separated by 2px. On the
  transport it is white. Links inside prose are underlined.
- Test the full keyboard, zoom, screen reader, focus after confirmation and
  reduced motion.

## Writing

- One verb per action, in the user's words: "Generate video", "Refresh tasks".
- An action keeps its name across the flow: "Generate" produces "Generated".
- Sentence case, no all caps, no filler.
- **A label names the field, nothing else.** No "(optional)" / "(required)".
- **Obligation is marked, not named:** asterisk after the label, one legend per
  sheet, `required` and `aria-required` on the control.
- **A value is a value, not a sentence.** Pairs are `Spec` rows, never
  "Format: MP3" or a middle dot.
- **The copy speaks about the user's world.** No backend, SQLite or HTTP in
  visible text; "the server" is allowed where the key lives.
- **A proper noun is not title case.** Acronyms, camelCase and hyphenated names
  are tolerated.
- **The rail lists feature names**, so "Video Agent" keeps its title case in
  the navigation while the page title is "Video Agent" and a button is a verb.

## How the rules are kept

`src/components/ui/theme.test.tsx` guards the palette (every base value, one
accent, no fuchsia, every text pair at 4.5:1, the functional rule at 3:1, the
two type stacks and the 10/5 geometry).

`src/components/ui/copy.test.tsx` reads the source tree: no optionality marker
in a field label, sentence case for labels/titles/buttons/tabs, no middle dots,
no implementation jargon, no all-caps labels, every color token resolves, every
CSS variable exists and no raw Chakra palette color.

The scan resolves the repository root from the test file and asserts that it
found the source tree, so an empty scan fails loudly. A line may opt out with
`// copy-test:allow`, which survives review.

## Known limits

- The voice gallery renders every voice in one list; with hundreds of voices it
  is a very long page and it is not virtualized yet.
- MiniMax output URLs are time limited. Download what should be kept.

## What this replaces

The first system was a console of instruments: graphite rail, a dark band on
every screen, white sheets in one column, teal as the accent. The second moved
to a warm paper table with a top transport, ultramarine and forest accents.
Both were coherent but the artifact was still a panel among panels.

This system follows the montage proposal: a slate sidebar, a cool bench, white
panels with rail headers, and a playback plate that treats the artifact as the
reason for the screen. Nimbus Sans and Liberation Mono replace the previous
type pairs.

## Anti-patterns

- A card with a drop shadow as a grouping device.
- A second accent color, or a per-area hue.
- Fuchsia or magenta in any token.
- All-caps labels or tracked-out eyebrows.
- Meta strings joined with middle dots.
- An arrow appended to a link or button label.
- A fade-and-slide-up entrance on every section.
- A label that says "(optional)" or "(required)".
- A raw Chakra palette color instead of a named token.
- A result below the form instead of beside it.
- A player without a visible clock or a keyboard way to seek.

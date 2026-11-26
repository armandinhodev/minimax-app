# Design system — MiniMax Studio

The design brief, the tokens and the rules. Read this before touching a
screen.

## The brief

**Subject.** A production console for generative media. MiniMax Studio is
the bench where an operator composes parameters, dispatches a job to
MiniMax, watches its state and retrieves the asset.

**Audience.** Someone who runs generations repeatedly, all day, with eight
different engines behind one key. They are not browsing; they are operating.

**Job.** Compose parameters → dispatch → read state → retrieve.

**What follows from that.** Every screen is a dense parameter set plus a
result that arrives asynchronously. A grid of identical cards cannot express
"parameter + state". A panel can. So the app is built to look like
equipment, not like a website: engraved labels, fixed type sizes, seams, and
one state readout.

## Color

Six base values plus three functional state colors. Nothing else.

| Token | Hex | Role |
| --- | --- | --- |
| `console` | `#14181D` | The console rail. Graphite with a blue cast — not black. |
| `seam` | `#2B323B` | Rail edges, hairline separators on the rail. |
| `sheet` | `#FFFFFF` | The work surface: panels and the workspace. |
| `field` | `#EEF0F2` | The recessed ground the sheets sit on. |
| `rule` | `#D7DCE1` | Hairlines, table rules, panel borders. |
| `ink` | `#0F1216` | Primary text. |
| `readout` | `#5C6673` | Field labels and secondary text. |
| `accent` | `#1F5E6B` | **The only** interactive color. Deep teal-blue. |

State colors are functional, not decorative:

| Token | Hex | Meaning |
| --- | --- | --- |
| `signal-ok` | `#2F6B4F` | Task succeeded. |
| `signal-run` | `#A8591F` | Task queued or running. |
| `signal-err` | `#9B2C2C` | Task failed, or a validation error. |

**Product identity does not come from color.** Each area carries a two-letter
monogram (`SP`, `IM`, `MU`, `VI`, `TR`, `CH`, `VA`, `LB`) in the rail. There
is no rainbow of per-product accents.

## Type

Two families, clearly distinct.

- **Archivo** (400/500/600) — UI. A grotesque with signage roots: industrial,
  slightly condensed, high x-height.
- **IBM Plex Mono** (400/500) — values, ids, durations, statuses, monograms.
  Tabular numerals, so a parameter set can be compared down the column.

| Role | Size / line-height | Weight | Notes |
| --- | --- | --- | --- |
| `display` | 30 / 1.2 | 600 | Page title. Tracking `-0.02em`. |
| `title` | 18 / 1.35 | 600 | Panel title. |
| `body` | 15 / 1.6 | 400 | Prose and input text. |
| `label` | 12 / 1.4 | 500 | Field labels. Sentence case, never all caps. Color `readout`. |
| `mono` | 13 / 1.5 | 400 | Values and identifiers. Tabular numerals. |

Line length stays under 80 characters. Body text is left aligned; nothing is
centered except media previews.

## Layout

- **Rail** — 264px, `console`, collapsible groups. The active item is marked
  with a 2px `accent` bar and a lighter surface, never with a filled pill.
- **Sheet** — the workspace is one column, max width 1180px, on the `field`
  ground. Panels are `sheet` with a hairline `rule` border.
- **Parameters** — rows with the label on the left and the value on the
  right, the value in mono. Dense and scannable.
- **Result** — a monitor block below the form, separated by a hairline rule.
  Never a floating card.
- **Below 768px** — the rail collapses to the drawer, panels stack, and
  parameter rows put the label above the value.

## Principles

1. **One accent color.** Everything interactive uses `accent`. Product
   identity comes from monograms.
2. **Structure is seams and rules, not shadows.** Radius is at most 4px:
   equipment is machined, not pillowy. Shadows appear only on overlays
   (drawer, dialog, popover).
3. **Numbers are mono and tabular**, so a parameter set can be scanned.
4. **State is the loudest thing on the page.** It is the one place the
   boldness is spent.
5. **Labels say what the field is**, in the user's words. No eyebrow labels,
   no middle-dot meta strings, no arrows on buttons.
6. **Nothing animates on load.** Motion only answers a user action.
7. **Errors and empty states point at the next action.** They never apologize
   and never state a mood.

## Writing

- One verb per action, in the user's words: "Transcribe", "Generate video",
  "Refresh tasks".
- An action keeps its name across the flow. The button that says "Publish"
  produces a notice that says "Published".
- Sentence case everywhere. No all caps. No filler.
- Empty states are invitations: "Choose an audio file to start."

## What this replaces

The previous interface was the generic card kit: every panel was the same
rounded rectangle with the same soft shadow and a 4px colored left border,
headings were the same size as body text, and the palette carried eight
accent hues that encoded nothing. That decoration was replaced by structure
that carries information.

## Anti-patterns

If a change starts to look like the following, it is wrong for this app:

- A new rounded card with a drop shadow used as a grouping device.
- A second accent color.
- All-caps labels, or a tracked-out eyebrow above a heading.
- Meta strings joined with middle dots.
- An arrow appended to a link or button label.
- A fade-and-slide-up entrance on every section.

# Design system — MiniMax Studio

The brief, the tokens and the rules. Read this before touching a screen.

## The brief

**Subject.** A cutting room for generative media. MiniMax Studio is where an
operator composes parameters, dispatches a job to one of eight engines, reads
its state and takes the artifact.

**Audience.** Someone who runs generations repeatedly, all day, behind one
key. They are not browsing; they are operating.

**Job.** Compose → dispatch → read state → retrieve.

**What follows from that.** The artifact is the reason the screen exists, so it
sits next to the parameters, on the brightest surface of the app, not below
them in a stack. The shell is a dark transport bar, not a website header: it
holds the areas and the session and gets out of the way. Everything else is a
warm paper table.

## The thesis

A bench is not a card grid. The identity of this app comes from two structural
decisions:

1. **The workbench.** Parameters on the left, the result on a plate to the
   right, both visible at once.
2. **The job strip.** A four-stage line — Compose, Dispatch, Render, Retrieve —
   that reads the real state of the job instead of decorating the page.

Color and type support those decisions. Neither is asked to carry identity on
its own.

## Color

Warm paper, deep forest. One accent and three functional states.

| Token | Hex | Role |
| --- | --- | --- |
| `ink` | `#171A16` | Primary text. |
| `graphite` | `#232B25` | The active surface inside the transport. |
| `seam` | `#33403A` | Hairlines on the transport. |
| `workspace` | `#E9E4D8` | The table: the ground every screen sits on. Warm sand paper, with a 22px dot grid at 7% opacity. |
| `sheet` | `#FCFAF4` | Panels. |
| `rail` | `#EFE7D7` | The band at the top of every panel and plate. |
| `plate` | `#FFFDF8` | The result surface. The brightest thing in the app. |
| `rule` | `#CFC7B8` | Hairlines, panel borders, table rules. |
| `readout` | `#6A645A` | Secondary text. |
| `accent` | `#1F5B45` | **The only** interactive color. Deep forest. |

State colors are functional, not decorative:

| Token | Hex | Meaning |
| --- | --- | --- |
| `signal-ok` | `#146B4A` | Task succeeded. |
| `signal-run` | `#A35A0A` | Task queued, running or processing. |
| `signal-err` | `#AE2A20` | Task failed, or a validation error. |

**No fuchsia and no magenta anywhere.** The palette is checked: a token in the
285–345° hue band with real saturation fails the build.

**Product identity does not come from color.** There are no per-area accents.
The area names the area.

## Type

Two families, clearly distinct.

- **Bricolage Grotesque** (400/500/600) — UI, prose and headings. An editorial
  grotesque with high x-height and a little warmth: it carries the display
  without needing a second display face.
- **DM Mono** (400/500) — values, ids, durations, timecode, states. Tabular
  numerals, so a parameter set can be compared down the column.

| Role | Size / line-height | Weight | Notes |
| --- | --- | --- | --- |
| `display` | 34 / 1.1 | 600 | Page title. Tracking `-0.02em`. |
| `title` | 20 / 1.3 | 600 | Panel and plate title. |
| `body` | 15 / 1.6 | 400 | Prose and input text. |
| `label` | 12 / 1.35 | 500 | Field labels. Sentence case, never all caps. Color `readout`. |
| `mono` | 13 / 1.5 | 400 | Values and identifiers. Tabular numerals. |

Line length stays under 80 characters. Body text is left aligned; nothing is
centered except media previews. No uppercase labels and no tracked-out
eyebrows: hierarchy comes from size, weight and position.

## Layout

- **Transport** — a 52px ink bar across the top: the studio name, the eight
  areas, and the session. It replaces the old left rail and gives the width
  back to the workbench.
- **Area subnav** — a second, light row with the routes of the active area.
  One line of what the area does. The current route is marked with a 2px
  accent underline, never a filled pill.
- **Workbench** — a 12-column grid on the table, max width 1152px (`72rem`).
  Parameters take 7 columns; the plate takes 5. Panels meet at a seam instead
  of floating apart: no gutter, a hairline frame, and a 3px accent edge on the
  left. Data screens (Tasks, Library) use the full width.
- **Panel rail** — every panel and plate opens with a `rail` band: the title,
  one line of what it holds, and a hairline under it. It is the handle of the
  panel, not an eyebrow: no uppercase, no tracking, no numbering.
- **Plate** — `plate`, a 2px radius, and a caption bar of labelled slots in
  mono: model, duration, size. Never a middle dot joining them. On a tall
  workbench the plate sticks below the transport.
- **Job strip** — the four stages under the header on the screens that track a
  task (the video modes). It appears only when there is one, and names the
  stage the job is actually in.
- **Below 900px** — the transport collapses to a menu button and a drawer, so
  the eight areas stay reachable.
- **Below 768px** — the subnav wraps instead of scrolling, and the workbench
  stacks parameters above the plate. Nothing scrolls sideways.

### Primitives

| Primitive | What it is |
| --- | --- |
| `AreaHeader` | The light header of a screen: title, one line of description, at most one constraint, and the live state. |
| `Plate` | The result surface. Bright, bordered, with a caption bar. |
| `Sheet` | A panel that holds controls. |
| `ReadoutStrip` | A row of labelled values in mono, under a header or in a plate. |
| `JobStrip` | The four-stage readout of a job. |
| `Spec` | A label/value row. The value is mono and tabular. |
| `Field` | A labelled control. Label left, control right, same geometry as `Spec`. |
| `StatusLamp` | The state readout. The loudest thing on a page. |
| `Badge` | A hairline rectangle in the label face. Never a pill. |

### Rules the structure imposes

- **The plate is the brightest surface**, and only when it holds a
  result or a preview. A panel that holds controls is a sheet.
- **The transport is the only dark block on the page.** State lives inside
  the light workbench; it does not need a dark band to be loud.
- **A button is sized to its label.** A primary action is never stretched to
  the width of the panel.
- **Controls align down the column.** The label column of a parameter row is
  a fixed 10rem, so every control starts at the same x.
- **No grid track is sized by its content.** A column is `minmax(0, 1fr)`, so
  a long id or a prompt clips instead of pushing the page sideways.
- **Radius is at most 2px on a panel and 4px on a control.** Only an overlay
  (dialog, drawer) goes to 8px. The round dot of a live state is the only
  circle.

## Principles

1. **One accent color.** Everything interactive uses `accent`.
2. **Structure is rules and surfaces, not shadows.** Shadows appear only on
   overlays: drawer, dialog, popover.
3. **The artifact gets the brightest surface** and the most space it can.
4. **State is the loudest thing on the page.** It is the one place the
   boldness is spent.
5. **Labels say what the field is**, in the user's words. No eyebrow labels,
   no middle-dot meta strings, no arrows on buttons.
6. **Nothing animates on load.** Motion only answers a user action.
7. **Errors and empty states point at the next action.** They never apologize
   and never state a mood.
8. **Destructive is a hairline until it confirms.** A filled red button
   appears once, on the confirmation.

## Writing

- One verb per action, in the user's words: "Transcribe", "Generate video",
  "Refresh tasks".
- An action keeps its name across the flow. The button that says "Publish"
  produces a notice that says "Published".
- Sentence case everywhere. No all caps. No filler.
- Empty states are invitations: "Choose an audio file to start."
- **A label names the field, nothing else.** No "(optional)", no "(required)".
- **Obligation is marked, not named.** A field the user must fill carries an
  asterisk after its label, the sheet says once what the asterisk means, and
  the control carries `required` and `aria-required` for the assistive layer.
  The label itself stays clean.
- **A value is a value, not a sentence.** Pairs are `Spec` rows — label left,
  value right. Never "Format: MP3  Duration: 165s" and never a middle dot
  joining them.
- **The copy speaks about the user's world.** "Saved to Library", not "saved to
  backend Library". The rule names the storage layer and the wire protocol
  (backend, SQLite, HTTP) and nothing else: saying "the server" is allowed,
  because the user needs to know where their key stays.
- **A proper noun is not title case.** "Generate with Whisper" is one
  capitalised word, not two: the rule catches a capitalised word that is not
  the first one, and tolerates acronyms (`URL`, `MP3`), camelCase (`MiniMax`)
  and hyphenated names (`H3-Image`).
- **The rail lists feature names.** "Clone Voice" keeps its title case in the
  navigation, while the button that clones a voice says "Clone voice": a menu
  names things, a button names an action.

## How the rules are kept

`src/components/ui/theme.test.tsx` guards the palette: every base value, a
single accent, no fuchsia hue, every text pair at 4.5:1 or better, the two
typefaces and the radii. `src/components/ui/copy.test.tsx` reads the source
tree and fails when a writing rule breaks.

The copy scan checks that no field label carries an optionality marker, that
labels, panel titles, button and tab labels are sentence case, that no visible
string joins values with a middle dot, that the copy the user reads never names
the implementation, that every color token resolves in the theme's color
space, that every CSS variable it references exists, and that no raw Chakra
palette color sneaks back in.

The scan resolves the repository root from the test file, not from the
working directory, and the first case asserts that it found the source tree:
a scan that finds nothing protects nothing, and that must fail loudly.

A line may opt out with `// copy-test:allow` when a rule is wrong for it.
The opt out is a comment, so a review sees it.

The rules cover what the user reads: panel titles, descriptions, buttons and
tabs, labels, alerts, badges, paragraphs, field labels, placeholders,
`aria-label` and toasts.

## Known limits

- The voice gallery renders every voice in one list. With hundreds of voices
  it is a very long page; it is not virtualized yet.

## What this replaces

The previous interface was a console of instruments: a graphite side rail, a
dark band repeated on every screen, white sheets stacked in one column, and
teal as the accent. It was coherent, but the result was still a vertical form
with the artifact at the bottom, and every screen opened with the same dark
block.

This system moves the artifact to the front — a plate next to the controls —
and replaces the rail with a transport bar, so the width goes to the work.
The palette moves from grey-graphite and teal to warm paper and forest green;
the type moves from Archivo and IBM Plex Mono to Bricolage Grotesque and DM
Mono. The job strip is new: it is the one place where the async lifecycle is
shown as a sequence, because it is one.

## Anti-patterns

If a change starts to look like the following, it is wrong for this app:

- A new rounded card with a drop shadow used as a grouping device.
- A second accent color, or a per-area hue.
- Fuchsia or magenta in any token.
- All-caps labels, or a tracked-out eyebrow above a heading.
- Meta strings joined with middle dots.
- An arrow appended to a link or button label.
- A fade-and-slide-up entrance on every section.
- A label that says "(optional)" or "(required)".
- A raw Chakra palette color (`red.400`) instead of a named token.
- A result that appears below the form instead of on the plate.

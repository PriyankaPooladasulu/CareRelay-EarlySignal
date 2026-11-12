# CareRelay EarlySignal: design system

## The one idea: the Relay Thread

CareRelay is a relay: a signal passed from hand to hand that can get dropped. A single thread runs down
the left of the patient page.

- Amina's three records (Oct 3, Oct 13, Oct 24) are solid chart-blue **nodes** on the thread.
- Where completion can't be confirmed, the thread **frays into a gap** with a slow amber pulse (2.4 s, low amplitude).
- Later steps (understand, plan, approve, reminder) are nodes further down. Each one turns solid when it's done.
- The gap **joins and turns green only when the patient confirms completion** (`/complete`). Approval or a
  reminder never closes it. The completion-integrity rule is the visual climax.
- The sticky journey track in the header is the same thread seen from above:
  `●─●─●─◌ Unconfirmed · Plan · Approved · Reminder · Completed`.
- When sharing changes on the watch, a faint pulse travels down the thread from the watch to the clinician summary.

Implementation: `components/thread.tsx`. Every Record-world section is a `ThreadRow` (a slice of thread in an
80 px gutter, 30 px on phones), so the line is continuous without measuring the page.

## Two worlds: fact vs. education

| | Record world | The Chamber |
|---|---|---|
| Holds | Amina's facts, evidence, actions, status | General education: 3D eye, voice, captions |
| Surface | `mist` background, paper sheets, faint grain | `choroid`, circular aperture, violet glow |
| Accent | `chart-blue` = patient-record fact | `lens-violet` = general education |
| Type | Atkinson for CareRelay's voice; **Newsreader serif only for verbatim record text** | Atkinson |

Entering the Chamber darkens the page chrome too (`data-world="chamber"`), so it feels like a different room.
The 3D eye sits in a circle, like looking through a fundus camera. The safety banner sits directly under it,
verbatim from the backend, always visible. Patient facts never appear in the Chamber; if someone asks "what do
my records say?" by voice, the answer appears in a separate paper-style chart-blue box.

## Tokens (`app/globals.css`)

| Token | Value | Use | Contrast checked |
|---|---|---|---|
| `mist` | `#F2F5F7` | Record world background | ink 15.6:1 |
| `paper` | `#FDFDFC` | Record sheets | |
| `ink` | `#13222C` | Primary text | |
| `ink-2` / `ink-3` | `#44545F` / `#56656F` | Secondary text | 7.4:1 / 5.6:1 on mist |
| `chart-blue` | `#1F5FA0` | Patient-record facts, links, solid thread | 6.4:1 on white |
| `lens-violet` | `#6A55C9` (fill) / `#B9ADF5` (text on dark) | Education | text 9:1 on choroid |
| `signal-amber` | `#E9A23B` fill, `#7A4E00` text | Unconfirmed / needs attention / the gap | text 6.6:1 on amber tint |
| `confirmed` | `#2C8A66` fill, `#1F6E50` text | **Only** after verified completion | text 5.9:1 on tint |
| `choroid` | `#0A1A21` | Chamber background (deep blue-teal, not black) | |

- **No red anywhere.** Nothing here is an emergency. Warm fundus orange exists only inside the 3D retina shader.
- **Status is never colour alone:** colour + icon + word (`StatusTag`): amber ◌ "Unconfirmed", amber ⧗ "Awaiting
  confirmation", blue ✓ "Approved by you", green ✓ "Completed".
- High-contrast mode (`Aa` menu) darkens secondary text and lines.

## Type

- **Atkinson Hyperlegible Next** (Braille Institute; via `next/font/google`) for all UI. Headings 800 weight, −0.015em.
  Hindi and Tamil fall back to Noto Sans Devanagari / Noto Sans Tamil (loaded, not preloaded).
- **Newsreader** only for verbatim record text (quotes, original-record viewer), with ~10% more line-height.
  Serif means "the document's own words".
- 1.25 scale on an **18 px base** (older users). `Aa` adds +20%. Body ≤ 70ch. Tabular numerals for dates.
- Avoided on purpose: tracked all-caps eyebrows, one coloured word in a headline, monospace labels, "→" in
  buttons, emoji icons (lucide-react only).

## Shape and surface

Radius encodes hierarchy: record sheets 4 px (paper), action/approval surfaces 16 px, the Chamber aperture is a
circle. Records are **stacked, slightly offset paper sheets** on the thread, not a card grid. Evidence opens as a
right **drawer** (bottom sheet on phones) with the quote highlighted inside the full original record using the
backend's code-point offsets (`splitEvidenceText`). Frosted blur only de-emphasises what's behind a drawer.

## The agent made visible (Action Center)

Three zones that never mix: **Plan** (shown before running), **Checks** (each step a row: queued ◌, running ◐,
passed ✓, failed ✕, waiting for you ⏸) and **Evidence** (the verified registry entry each result came from, with
its verified-on date, sources and limitations). The rows are the backend's real `plan.steps`, revealed one at a
time with 420–680 ms delays so judges can follow. A rejected option "steps back" (desaturates, title struck
through); the alternative rises with "Better matches your constraint". Nothing is invented.

## Motion rules

- One orchestrated load moment: the intro thread drawing itself (~1.6 s).
- Everything else answers the user: drawer slide (300 ms), step states, Option A stepping back, the 900 ms thread join.
- No fade-up-on-scroll, no hover lift on cards. UI durations 180–320 ms, ease-out.
- `prefers-reduced-motion`: the gap stops pulsing, the intro shows its final frame, the eye stops idling,
  the watch doesn't buzz, the join is instant.

## The CareRelay Watch

An original smartwatch drawn in CSS + SVG: round brushed-metal case with a pointer-tracking specular highlight,
knurled crown, flat side button, fabric strap fading off top and bottom. No brand shapes, logos, fonts, activity
rings or known face layouts. Screens: face, heart rate, blood pressure, steps, sleep, glucose, sharing. It shows
readings, never judgments. It receives the approved reminder (buzz) and can answer the completion question, which
runs the same `/complete` call as the app. All state lives in the one store (`lib/store.ts`).

## Sanity check against the "default health dashboard"

The default would be dark slate + cyan, bento KPI tiles that glow, a 3D model floating on grey. We rejected all of
it: the Record world is a light, paper-like surface; KPIs are a plain fact row of things we can prove (no tiles,
no glow); the only dark space is the Chamber, and it's dark for a reason (it's a different room for general
education); and the 3D eye is an original procedural model in a circular aperture rather than a borrowed embed.

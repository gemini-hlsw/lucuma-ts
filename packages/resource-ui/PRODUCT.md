# Product

Durable product truth for `@gemini-hlsw/resource-ui`, the web UI for the GPP **Resource**
service. This file and [DESIGN.md](DESIGN.md) are the two authorities for this package:
product truth here, every visual and interface decision there. [CLAUDE.md](CLAUDE.md) carries
engineering mechanics and points at both.

Everything below is a confirmed fact or an explicitly open question. Nothing here is a guess
dressed as a decision.

## Platform

web

Desktop-first, phone-supported. The primary scene is a workstation beside the other GPP
tools, on a wide screen. The phone is a real secondary scene - checking tonight's schedule
or a piece's location from anywhere, and acting on it once write arrives - so every
destination must stay reachable, legible and operable at phone widths. Optimised for the
workstation, never broken on the phone.

## Users

**Astronomers, night operations, and observatory staff.** Today they arrive with one question
about hardware and time: what instruments and components are - or were, or will be - on each
telescope, for a given night, week, or semester. They already know the observatory's
vocabulary: ports, instruments, observing nights, semesters, Gemini North and Gemini South.
Today they are checking a record; composing one is coming (see Capabilities), and the same
audiences will do the composing.

There is no authenticated user yet - every visitor is a guest, and the app says so - but
**authentication is coming soon**, arriving with the write capabilities. Treat a signed-in
user as a near-term state to design room for, not a hypothetical.

## Product Purpose

Resource reproduces the telescope schedules that already exist, accurately and readably, so
that the answer to "what is on Port 3 tonight" takes one glance instead of a spreadsheet.

The destinations all draw the one published record. Today there are five; the set is
expected to grow - more paths, more endpoints, more ways of seeing the same record - and
adding one must never mean restructuring the others:

| Destination    | The question it answers                                           |
| -------------- | ----------------------------------------------------------------- |
| `/night`       | What is mounted, and what the telescope is doing, for one night   |
| `/week`        | Seven nights on one continuous axis, and what changed across them |
| `/semester`    | How long each run lasts, as a chart or as a calendar              |
| `/instruments` | Where a named instrument is tonight, and its run history          |
| `/components`  | Where a named piece of hardware is, and its history               |

Success is that a reader trusts what they see: no view claims a fact the record does not carry,
and no gap is decorated to look like an answer.

## Positioning

Resource is the only reading of the operations schedule that is derived from the published
record rather than transcribed from it. The schedule elsewhere lives in an operations workbook
and in web overview sheets that disagree with each other; Resource reads one source and shows
the same record every way it is asked for, so two views cannot tell a reader different things
about the same night.

## Operating Context

- **The observing night, not the calendar day, is the unit.** A row of the schedule is an
  _evening_: the night it names begins on that evening and ends the following morning. Semesters
  follow the evenings - February to July is the A semester, August to January is B.
- **Two sites, always both.** Gemini North (`GN`) and Gemini South (`GS`) are the observatory's
  own two. The site control must work even when the server answers nothing.
- **Site time and UTC are both real working zones.** A GS night spans two UTC dates, so the zone
  a clock time is read in is a deliberate choice the reader makes, never the browser's guess.
  An observing night's label and an evening date are the site's own calendar and do not move
  when the reader changes the clock.
- **Ports are the row set.** `TELESCOPE_PORTS` is 1-5 at both sites, and a record on an
  unexpected port still has to draw.
- **Time is a half-open interval.** A record's end is exclusive, and every record can be clipped
  to a window; a partial night is a first-class answer, not an error.

## Capabilities and Constraints

**Read-only today, write soon.** v1 reproduces schedules; nothing in it edits them, and every
view reads the one published record. But mutations and a **telescope scheduler builder** -
users constructing and modifying calendar schedules - are coming, for the same astronomers,
night-operations personnel and staff. Nothing may be designed as if read-only were permanent:
the information architecture and component model must leave room for selection, editing,
validation, and contextual detail, and a view that would have to be replaced when editing
arrives is the wrong view. The schedule lifecycle, change log and restrictions that the
backend domain documents describe remain out of scope for v1.

**The surface will grow.** New destinations, endpoints and readings of the record are
expected as a matter of course, not as exceptions. The one-record invariant and the shared
projection path are what absorb them: adding a view must never mean copying another view's
path from records to pixels, and never mean restructuring the ones that exist.

**One backend, over HTTP.** The app reads the live Resource service at `/resource/graphql`.
That service does not serve the v1 API yet, so every view is empty behind a banner naming the
situation. That is the expected state, in development and deployed alike. There is no control
to choose a backend and there never will be one in the app.

**Nothing is gated on data.** No destination is hidden or disabled because a schedule is
missing; gating on whether a schedule exists strands the reader on one view.

**Synthetic data must never pass for real.** A semester whose schedule was never published is
marked as demo wherever it is chosen and wherever its pages are read, and a demo semester never
merges with a real one.

**A gap means "not recorded", never "unavailable"** (invariant **I4**). This is the product's
central honesty commitment: the absence of a record is the absence of a record, and no view may
claim a failure it cannot evidence.

**Terminology.** The published spelling of an instrument is what a reader sees - `'Alopeke`,
Zorro, Maroon-X - never the enum. A run whose name the instrument list does not hold is served
as `UNKNOWN` with its text carried alongside: a lookup question, not an error.

### Deferred capabilities

Each is open; none is scheduled. Anything built here needs a reason recorded beside it.

- **A visible "List" as a third view toggle.** A screen-reader block table already backs the
  semester chart, so exposing a list there is nearly free - but it adds a mode, and the
  night and week views would first need their tables built.
- **A retry affordance on the load-failure banner**, which is message-only today.
- **A components table on the night view.** If it returns it should answer a question
  `/components` cannot.
- **"Jump to current month"** in the calendar, when the viewed semester holds today.

### Open with operations

Questions the product wears an assumption for rather than silently inventing an answer. Each
assumption is recorded so it can be corrected, not defended.

| Question                                         | The assumption in force                                                                                                                                                                                                                                                                                             |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| What "A&G" on GS Port 4 means                    | Free text on a port-scoped closure, stored unparsed, and never read as a failure. What a port closure means for availability is still open.                                                                                                                                                                         |
| Mapping the schedule vocabulary onto lucuma-core | Every name the operations workbook mounts is a Resource `Instrument`, including the AO subsystems (Altair, Canopus) and Engineering.                                                                                                                                                                                |
| Unidentified runs                                | A name the instrument list does not hold is served as `UNKNOWN`, with its text carried in the record's note.                                                                                                                                                                                                        |
| Where a reader works                             | Readers live at one site and rarely switch, so the app opens on the site it was last left at rather than a fixed one, and the site sits beside the wordmark as identity. A link naming a site still overrides it.                                                                                                   |
| What the LGS column means                        | Constant per site in the current export (GN "Yes" on all 915 nights, GS "No" on all 730), so it may record capability rather than a nightly state. Recorded as spans either way, read as the laser being available or not. If operations confirm capability, the row belongs beside the site rather than the night. |

## Brand Commitments

- **Resource is chrome-continuous with Explore** (https://explore-dev.lucuma.xyz/, browsable as
  guest). It is one of the GPP applications, and a reader moving between them should feel one
  continuous product: the same dark visual language and the same colour scheme, above all the
  same green accent. The chrome was measured from the running Explore application rather than
  approximated; DESIGN.md records the measured values as the design authority (the CSS tokens
  it names are the code's source of truth).
- **Explore is the floor, not the ceiling.** Where Resource can achieve clearer hierarchy,
  stronger accessibility, better interaction design, or more efficient use of space than
  Explore does, it should. Continuity binds the palette, density and family resemblance, never
  Explore's weaknesses.
- **lucuma-ui is the component base.** The shared library's components, tokens and established
  patterns are used wherever they meet the need; a component the shared library already
  provides is not recreated here.
- **Icons are FontAwesome Pro**, through the project's established integration. An icon
  clarifies an action or a state; it never replaces an essential label.
- **This is an information-dense engineering dashboard.** There is a lot to fit, and the
  readers are experts scanning, comparing and monitoring repeatedly - condensed is correct
  here, airy is not.
- **The name is "Resource"**, and the app describes itself as the telescope calendar and
  operational-resource manager.
- **A build that is not production says so, loudly.** Every current build is a development build
  and carries a marker no screenshot can lose.

## Evidence on Hand

- **The published record is the product's only claim.** Nine semesters of schedule data
  (GS 2024B-2026A, GN 2024B-2026B) exist as fixtures parsed from an operations workbook export,
  which supersedes the published web overview sheets where they disagreed. They back the tests
  and the local mock; they are not a product claim and must not be presented as live data.
- **The instrument component catalog is synthetic.** So is the list of instruments GPP knows but
  the schedule never mounts. Both are quarantined behind one file each, both are deterministic,
  and neither may ever decide whether data is available.
- **There are no users to quote, no adoption numbers, and no benchmarks.** The backend does not
  serve the v1 API yet, so there is no production usage of any kind. Do not fabricate any.

## Product Principles

1. **Show the record, never a better-looking version of it.** A gap stays a gap. An unknown stays
   unknown. Nothing is smoothed, filled, or decorated to make a view look complete.
2. **One record, many readings.** Every destination projects from the same published record,
   so two views can never disagree about the same night - however many views there come to
   be.
3. **The reader's question is about hardware and time.** Identity - which instrument, which piece,
   which port - is what the interface must never make ambiguous.
4. **Say the assumption out loud.** Where operations have not answered, the app wears a recorded
   assumption and marks it, rather than inventing an answer or refusing to draw.
5. **A control that does nothing is worse than no control.** Every control changes what is
   displayed, and a selection that would be a silent no-op moves the thing it governs instead.

## Accessibility & Inclusion

**The target is WCAG 2.2 Level AA**: contrast, keyboard operation, visible focus, semantic
structure, accessible data tables, non-colour state indicators, and adequate control targets.

These are in force now and future work must preserve them:

- **Identity never rides on colour alone.** Every block, row and swatch that carries an identity
  also carries its published name in words.
- **Every control is labelled**, and the visible caption is the control's only accessible name -
  no call site repeats it as a second label.
- **Tests drive the interface the way assistive technology reads it**, through accessible queries
  (`getByRole`, `getByLabelText`), so a control that cannot be found by its role or its name
  fails the suite.
- **Charts must not be the only reading.** Every chart owes a block-table reading; the
  semester chart has its screen-reader table today, and the night and week charts do not -
  a known gap queued to close. The charts' own accessibility module is off on the strength
  of that commitment, which only the semester view has kept so far.

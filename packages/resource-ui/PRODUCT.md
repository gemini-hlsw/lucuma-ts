# Product

Product truth for `@gemini-hlsw/resource-ui`, the web UI for the GPP **Resource** service. This
file and [DESIGN.md](DESIGN.md) are the two authorities for this package: product truth here,
every visual and interface decision there. [CLAUDE.md](CLAUDE.md) carries engineering rules and
[README.md](README.md) the stack, commands and local sign-in.

## Platform

web

Desktop-first, phone-supported. The primary scene is a workstation beside the other GPP tools, on
a wide screen. The phone is a real secondary scene - checking tonight's schedule or a piece's
location from anywhere - so every destination must stay reachable, legible and operable at phone
widths. Optimised for the workstation, never broken on the phone.

## Users

**Astronomers, night operations, and observatory staff.** They arrive with one question about
hardware and time: what instruments and components are - or were, or will be - on each telescope,
for a given night, week, or semester. They already know the observatory's vocabulary: ports,
instruments, observing nights, semesters, Gemini North and Gemini South. The same audiences will
compose schedules once writing arrives.

Every view sits behind the session check. Opening any URL shows the loading mark until the check
settles, at most the refresh timeout, then the page at that URL for a reader with a session and the
sign-in screen for one without. A reader signs in on the sign-in screen, with ORCID or as a guest;
the masthead names whoever is here (the person's display name, or "Guest User"), and a guest can
still sign in with ORCID from the app menu. Guest is SSO's own guest session, so another tab or
another GPP app on the domain picks it up, and a guest reads what a PI reads. There is no login
route: the URL never changes on the way in, so a deep link survives either path. A session that
ends under a reader - expiry, a refused refresh, a sign-out in another tab - returns them to the
sign-in screen with a one-line notice. Writes will need an ORCID account.

## Product Purpose

Resource reproduces the telescope schedules that already exist, accurately and readably, so that
the answer to "what is on Port 3 tonight" takes one glance instead of a spreadsheet.

The destinations all draw the one published record:

| Destination    | The question it answers                                         |
| -------------- | --------------------------------------------------------------- |
| `/night`       | What is mounted, and what the telescope is doing, for one night |
| `/week`        | Seven nights on one continuous axis                             |
| `/semester`    | How long each run lasts, month by month                         |
| `/instruments` | Where a named instrument is tonight, and its run history        |
| `/components`  | Where a named piece of hardware is, and its history             |

Success is that a reader trusts what they see: no view claims a fact the record does not carry,
and no gap is decorated to look like an answer.

## Positioning

Resource is the only reading of the operations schedule that is derived from the published record
rather than transcribed from it. The schedule elsewhere lives in an operations workbook and in web
overview sheets that disagree with each other; Resource reads one source and shows the same record
every way it is asked for, so two views cannot tell a reader different things about the same
night.

## Operating Context

- **The observing night, not the calendar day, is the unit.** A row of the schedule is an
  _evening_: the night it names begins on that evening and ends the following morning. Semesters
  follow the evenings - February to July is the A semester, August to January is B.
- **Two sites, always both.** Gemini North (`GN`) and Gemini South (`GS`) are the observatory's
  own two. The site control must work even when the server answers nothing.
- **Readers live at one site and rarely switch**, so the app opens on the site it was last left
  at, and the site sits beside the wordmark as identity. A link naming a site still overrides it.
- **Site time and UTC are both real working zones.** A GS night spans two UTC dates, so the zone a
  clock time is read in is a deliberate choice the reader makes, never the browser's guess. An
  observing night's label and an evening date are the site's own calendar and do not move when
  the reader changes the clock.
- **Ports are the row set.** `TELESCOPE_PORTS` is 1-5 at both sites, and a record on an
  unexpected port still has to draw.
- **Time is a half-open interval.** A record's end is exclusive, and every record can be clipped
  to a window; a partial night is a first-class answer, not an error.
- **Every name the operations schedule puts on a port is an instrument**, including the AO
  subsystems (Altair, Canopus) and Engineering.
- **A port closure is free text, stored unparsed, and never read as a failure.** What a closure
  means for availability is operations' call, not the app's.

## Capabilities and Constraints

**v1 is read-only.** Resource reproduces schedules; nothing in it edits them, and every view
reads the one published record. Mutations and a **telescope scheduler builder** - users
constructing and modifying calendar schedules - are coming, for the same audiences. Nothing may be
designed as if read-only were permanent: the information architecture and component model must
leave room for selection, editing, validation, and contextual detail, and a view that would have
to be replaced when editing arrives is the wrong view. The schedule lifecycle, change log and
restrictions are out of scope for v1.

**The surface will grow.** New destinations, endpoints and readings of the record are expected as
a matter of course. The one-record invariant and the shared projection path absorb them: adding a
view must never mean copying another view's path from records to pixels, and never mean
restructuring the ones that exist.

**One backend.** The app reads the live Resource service and nothing else. There is no control
to choose a backend and there never will be one in the app.

**Nothing is gated on data.** No destination is hidden or disabled because a schedule is missing;
gating on whether a schedule exists strands the reader on one view.

**Every semester is real.** Every semester the app lists is a published one and no page marks one
as demo. Only the Semester page reads the list of semesters; every other view asks about its own
window alone, and a night with nothing recorded says so whether or not a semester covers it.

**A gap means "not recorded", never "unavailable"** (invariant **I4**). This is the product's
central honesty commitment: the absence of a record is the absence of a record, and no view may
claim a failure it cannot evidence.

**Terminology.** The published spelling of an instrument is what a reader sees - `'Alopeke`,
Zorro, Maroon-X - never the enum. A run whose name the instrument list does not hold is served as
`UNKNOWN` with its text carried alongside: a lookup question, not an error.

## Brand Commitments

- **Resource is chrome-continuous with Explore** (https://explore-dev.gemini.edu/, browsable as
  guest). It is one of the GPP applications, and a reader moving between them should feel one
  continuous product: the same dark visual language and the same colour scheme, above all the
  same green accent. DESIGN.md holds the values.
- **Explore is the floor, not the ceiling.** Where Resource can achieve clearer hierarchy,
  stronger accessibility, better interaction design, or more efficient use of space than Explore
  does, it should. Continuity binds the palette, density and family resemblance, never Explore's
  weaknesses.
- **lucuma-ui is the component base.** The shared library's components, tokens and established
  patterns are used wherever they meet the need; a component the shared library already provides
  is not recreated here.
- **Icons are FontAwesome Pro**, through the project's established integration. An icon clarifies
  an action or a state; it never replaces an essential label.
- **This is an information-dense engineering dashboard.** There is a lot to fit, and the readers
  are experts scanning, comparing and monitoring repeatedly - condensed is correct here, airy is
  not.
- **The name is "Resource"**, and the app describes itself as the telescope calendar and
  operational-resource manager.
- **A build that is not production says so, loudly**, with a marker no screenshot can lose.

## Product Principles

1. **Show the record, never a better-looking version of it.** A gap stays a gap. An unknown stays
   unknown. Nothing is smoothed, filled, or decorated to make a view look complete.
2. **One record, many readings.** Every destination projects from the same published record, so
   two views can never disagree about the same night - however many views there come to be.
3. **The reader's question is about hardware and time.** Identity - which instrument, which piece,
   which port - is what the interface must never make ambiguous.
4. **Say the assumption out loud.** Where operations have not answered, the app wears a recorded
   assumption and marks it, rather than inventing an answer or refusing to draw.
5. **A control that does nothing is worse than no control.** Every control changes what is
   displayed, and a selection that would be a silent no-op moves the thing it governs instead.

## Accessibility & Inclusion

**The target is WCAG 2.2 Level AA**: contrast, keyboard operation, visible focus, semantic
structure, accessible data tables, non-colour state indicators, and adequate control targets.

- **Identity never rides on colour alone.** Every block, row and swatch that carries an identity
  also carries its published name in words.
- **Every control is labelled**, and the visible caption is the control's only accessible name -
  no call site repeats it as a second label.
- **Tests drive the interface the way assistive technology reads it**, through accessible queries
  (`getByRole`, `getByLabelText`), so a control that cannot be found by its role or its name fails
  the suite.
- **Charts must not be the only reading.** Every chart owes a block-table reading, and the charts'
  own accessibility module is off on the strength of that commitment. The semester chart has its
  screen-reader table; the night and week charts still owe theirs.

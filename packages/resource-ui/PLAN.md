# Resource UI - rebuild plan

Written 2026-08-07, after the Dan / Bryan / Andrew meeting. This is the single
authoritative plan for the package. If it disagrees with
`lucuma-odb/resource/docs/`, see §3 - that doc set is being trimmed to match.

> **Source pivot, 2026-08-11 (Dan):** the operations workbook export
> (`mock-server/fixtures/telescope_schedules.xlsx`) is now the **only** schedule
> source. Everything below that describes importing the published web overview
> sheets, or the synthetic GS 2099B demo semester, is superseded: the sheet
> importer and the demo are gone, both sites are organised by ports, and the
> workbook's Mode/Program and ToOs columns are served as their own block kinds.
> CLAUDE.md's "Importing the workbook" section is current.

---

## 1. What Resource v1 is

Resource is **the queryable record of what the observatory can do, at each site, over
any interval of time**. It is not a scheduler, and it is not a tool for building a
schedule.

From the meeting, in the participants' own framing:

- Science operations (Joanna, Atsuko) build the semester schedule today in Google
  Sheets, colour-coded by instrument. That process is not being replaced yet.
- Resource replaces the **published artefact** - the bar chart on the web page - with
  something accurate, readable and interactive.
- Resource is also the central repository for instrument and component location and
  status (the ICTD replacement).
- **We are not building a calendar-building wizard.** Bryan was explicit: start by
  replacing the existing bar chart with a basic telescope calendar showing instrument
  availability on given nights.

The headline acceptance test: **GS 2026B, served from our API and rendered in our UI,
matches the published sheet cell for cell.**

---

## 2. What we are reproducing

Source: <https://www.gemini.edu/sciops/metrics/gs2026Boverview.html> (and the `gn`
equivalent). Both are **Excel-exported HTML**, fully machine-readable today. No PDF
parsing is needed.

### 2.1 Structure (verified 2026-08-07)

|              | Gemini South                               | Gemini North                                                |
| ------------ | ------------------------------------------ | ----------------------------------------------------------- |
| Rows         | 5 telescope **ports** (Port 1-up … Port 5) | **Instruments** (GMOS, GNIRS, IGRINS2, Altair, Visiting ×2) |
| Columns      | days of month, one block per month         | same                                                        |
| Band meaning | instrument mounted on that port            | instrument "potentially usable"                             |
| Months       | Aug 2026 - Jan 2027 (6 blocks)             | same                                                        |

- **The data is in the cell background colour, not the text.** GS instrument colours:
  F2 `#26FF00`, GMOS `#01C7FF`, GHOST `yellow`, Cal/ZORRO `#E3E3E3`.
- **Parsing gotcha:** `colspan` is genuine Excel cell merging and **must be expanded**
  to recover day positions - expanding it is what makes column N line up with day N.
  The date range is then the run of same-coloured cells across the expanded row, not
  the colspan of any single cell.
- **Sheet chrome is not data.** Excel paints each month block's label cells, and the
  edge cell where a truncated row runs out, in one colour (`#ccffff` on both sheets).
  It reaches the day columns on short rows, where it reads as a one-day mystery
  instrument. Detected per row by comparing against the row's own label background.
- Text appears once per run as a label, plus annotations: "Telescope Shutdown",
  "Maintenance", "A&G", "ZORRO Block". GN adds run names ("Maroon-X Run",
  "'Alopeke Run", "Cold head replacement").
- Left column carries month name and new/full moon dates. Day header uses colour for
  weekends and holidays.
- Footer carries a version date ("Version: Jun 15, 2026").

### 2.2 Scope check

Despite its legend, **GS 2026B contains no program IDs, no classical runs and no
priority-visitor detail.** The legend text is boilerplate carried between semesters.
The real content is: which instrument is on which port on which nights, plus a handful
of annotations. Anything richer is not in the source and must not be invented.

The two sites group the same facts differently. That is Andrew's "provide both calendar
and port-based views" - one dataset, several presentations.

---

## 3. The data model

One record kind carries both layouts:

```
Block { id, site, interval, subject, state, note }
```

GS's page is that grouped by port. GN's is that grouped by instrument. The calendar is
that grouped by date. The night view is one night, all rows.

### 3.1 Partial nights are the load-bearing constraint

The published sheet is whole-night granular. **That must not leak into the model.**

> The importer emits night-aligned **intervals**, never dates. Every cell run becomes a
> `TimestampInterval` resolved through `LocalObservingNight` (14:00 local on `d-1` →
> 14:00 local on `d`, labelled by `d`).

A partial night is then simply an interval that does not align to those boundaries, and
every view handles it because none of them ever assumed alignment. **The moment
`date: LocalDate` becomes a field on a block, partial nights become a retrofit.**

Corollary for the port and instrument views: a cell covers a whole night, so it needs a
rule for a non-uniform night. Show the single value when uniform, otherwise mark it
mixed and put the transitions in the night view. One function, not a subsystem.

### 3.2 Kept from `lucuma-odb/resource/docs/v1-domain-model.md`

| Concept                                                                            | Why                                                                                                 |
| ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `TimestampInterval`, start inclusive / end exclusive (I1)                          | the whole partial-night capability, for free                                                        |
| **I3 / V2** no two blocks for the same subject overlap                             | the one invariant that keeps the data honest. Enforced in the mock store now, DB later              |
| **I4** a gap means "not recorded", never "unavailable"                             | critical for the import: the sheet's empty cells must not render as "closed"                        |
| **I6** interval queries return everything intersecting; caller-controlled clipping | how one query feeds semester, week and night views                                                  |
| Observing night = `LocalObservingNight`, labelled by end date                      | turns sheet dates into intervals. Sources labelling by _evening_ date differ by one day             |
| **I5** store UTC, local time is presentation                                       | two sites, one model                                                                                |
| Uniform block shape                                                                | why one query feeds four presentations                                                              |
| `ResourceUsage` as **one** enum: `SCIENCE` / `ENGINEERING` / `UNAVAILABLE`         | confirmed in the meeting (IGRINS2 mounted but unusable). Do **not** split into availability + usage |
| `InstrumentLocationType` `PORT`/`FLOOR`/`LAB`/`BASE`/`UNKNOWN` + port number       | Bryan and Andrew's "location _and_ status"                                                          |
| `TelescopeAvailability` `OPEN`/`CLOSED` + free-text reason                         | carries "Shutdown", "Maintenance"                                                                   |

### 3.3 Dropped

| Dropped                                                                                                          | Why                                                                                                                                                                                                                                   |
| ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **The whole schedule lifecycle** (§7): `TelescopeSchedule`, DRAFT→publish-once, V6/V7/V8, `scheduleId` on blocks | biggest de-scope available. We reproduce a schedule that already exists; the meeting ruled out a build tool                                                                                                                           |
| Change log (§7.1), V11                                                                                           | no audit requirement surfaced. Add when editing is real                                                                                                                                                                               |
| Gid prefixes / shared `b-` id space (§3)                                                                         | Hugo's call when he writes the Scala. Plain string ids in the mock                                                                                                                                                                    |
| Soft deletion / `existence` (V10), retention (§10), auth posture (§11)                                           | not UI concerns                                                                                                                                                                                                                       |
| `BLOCK_SCHEDULING` mode, `Partner`, V4                                                                           | nothing in either published sheet uses it                                                                                                                                                                                             |
| Subsystem restrictions `ELEVATION`/`POINTING`/`OTHER` (§6.4)                                                     | the doc calls them informational; no view needs them                                                                                                                                                                                  |
| `PowerSource`                                                                                                    | in `[REQ]`, but no view needs it yet                                                                                                                                                                                                  |
| `ConflictBehavior` / CARVE                                                                                       | edit machinery for Phase 4. For now, overlapping writes are rejected                                                                                                                                                                  |
| **Current (live) availability** (§6.1)                                                                           | dropped 2026-08-09 (Dan): v1 is the published schedule plus synthetic data, never a claim about the telescope's actual present state. The need is real ("expected open tonight, currently closed: snow") and returns with a live feed |

### 3.4 Deferred, with field shapes reserved

Reserving a shape costs nothing now and avoids a migration later. Populating it is what
waits.

- **`InstrumentComponent` identity** with codes, barcodes, aliases (§5.2, V9). The
  actual ICTD replacement, but the sheet has zero component data and Bryan said the
  initial catalog is entered by hand. Synthesize components in the mock; don't model
  the catalog.
- **`TooSupport`** - see §4, the scheduler needs the fact.

**Size check: the SDL should land in the 150-200 line range** (the parked one is 1,367).
If it grows much past 200, something crept back in. Count declarations, not the file -
this SDL is a review deliverable, so roughly two thirds of it is documentation. It is at
125 declaration lines in a 319-line file.

### 3.5 Types the ODB already defines are reproduced, not reinvented

`v1-graphql-api.md` §2 imports `Timestamp`, `TimestampInterval`, `Date`, `Site`,
`Semester`, `NonEmptyString` and `PosInt` from `OdbSchema.graphql`. The mock cannot
import them, so it declares them - **field for field, with the ODB's own wording**, and
the same on the wire:

- `TimestampInterval` carries `duration: TimeSpan!`, which brings `TimeSpan` and the
  `Long` / `BigDecimal` scalars with it. Duration is derived from the interval in the
  resolver, never stored, so a night that crosses a DST boundary at Gemini South reports
  23 or 25 hours rather than an assumed 24.
- `Timestamp` serialises as `2026-08-07T18:00:00Z`. `toISOString()` and the imported
  fixtures both carry a `.000` fraction; a scalar serialiser trims it.
- Text that is absent rather than blank is `NonEmptyString`; a port number is `PosInt`.

The point is that the payload here is the payload the Scala service will send, so no
operation has to change when this file is swapped for the published schema. Where the
mock deliberately differs - the `Instrument` enum, plain string ids - the SDL says so.

---

## 4. The scheduler contract

`v1-graphql-api.md:17` - there is no separate scheduler projection. The scheduler
consumes `telescopeNights`, the same query the calendar views need.

```graphql
telescopeNights(site: Site!, nights: DateInterval!): [TelescopeNight!]!
```

Rules that must survive the de-scope (`v1-scheduler-integration.md`):

1. **Clipped to the night, partial nights preserved.** A mid-night change arrives as two
   blocks with a boundary, never flattened to one per-night value.
2. **`dataAvailable: false`** with empty lists for an un-entered night, so it never reads
   as "nothing available". Maps directly onto the sheet's empty cells.
3. **Absence over a sub-interval is "not recorded", not `UNAVAILABLE`.**
4. **400-night bound.**
5. **No subscriptions.** The scheduler re-queries after events from other services.

Dropping the lifecycle makes this _simpler_: the doc specifies "always reads published
schedules, no `scheduleId` argument", which with one layer is true by construction.

Two items stay in the response contract for the scheduler even though the UI does not
use them yet: `TooSupport` (authoring waits on Bryan's derivation rules) and component
identity for observation matching. Current availability was the third until 2026-08-09,
when it moved to §3.3's dropped list - v1 never reports the telescope's actual present
state, so the scheduler reads planned availability only until a live feed exists.

---

## 5. Phases

### Phase 0 - clean up (done)

Keep the tech stack, shell, layout, styling and proven date/moon math. Everything
built against the superseded authoring model was removed - first parked out of the
build, then dropped from this branch's history entirely when it was squashed for
public testing (2026-08-10). The branch now opens with one baseline commit holding
exactly what the rebuild kept.

Keep the mock **harness** (`mock-server/{schema.ts,server.ts,time.ts}`,
`src/test/mockClient.ts`) - ~140 lines whose dual-consumption pattern lets one
executable schema serve both the dev server on :4000 and the browser tests via Apollo
`SchemaLink`. Park the mock **content** (`schema.graphql`, `resolvers.ts`, `seed.ts`,
`store.ts`).

### Phase 1 - import real data (done)

Lives in `mock-server/import/` rather than `tools/`, because its only consumer is the
seed and that directory is already covered by both tsconfigs and the ESLint node block.

1. `sheet.ts` - HTML -> expanded cell grid. Pure, no DOM, no filesystem.
2. `overview.ts` - grid -> months, subject rows, colour runs, legend, moon notes.
3. `blocks.ts` - runs -> blocks with observing-night intervals, per-site reading.
4. `importPublishedSchedule.ts` - the only impure part: reads the fixture (or
   `--refetch`es it) and writes `mock-server/data/{gs,gn}2026B.json`.

**Eight semesters ship as the working set** - GN and GS for 2025A, 2025B, 2026A and
2026B - each with its sheet committed verbatim as a fixture and its parsed result in
`mock-server/data/`, plus an `index.json` so a site + semester picker needs no network
call. Adding a semester is a row in `publishedSets.ts`, a `--refetch`, and two committed
files. Tests run against all eight, so a differently-shaped sheet fails there first.

Findings worth carrying forward:

- **Port 4 at GS holds no science instrument all semester** - it carries A&G.
- **The GN colour key is incomplete.** Two shades the sheet uses, `#ed7d31` (Maroon-X
  in the multi-instrument queue) and `#fce5cd` ('Alopeke run), appear only in the
  page's prose, never in the Key row. The importer emits those blocks with no
  instrument and warns rather than dropping them. Their date ranges match the prose
  exactly, which is good evidence the parse is right.
- Contiguous runs are merged across the sheet's month boundaries, so GHOST on Port 1
  is one block from 2026-08-07 to 2027-01-31 rather than six.
- **GS 2025A prints 29 day columns for a February that had 28.** The workbook was
  edited from a leap year and the header row was never shortened. The importer trusts
  the calendar over the sheet and warns, so no block carries a date that never existed.
- **Separator rows are painted white, not left blank**, which is why "has a background"
  cannot be the test for whether a row holds data.
- Instruments resolve by colour first - the key, then the unkeyed body shades the
  workbook confirmed (`UNKEYED_BACKGROUNDS`) - then by the run's printed name, which
  mounts an instrument even on an uncoloured cell. GN writes the same instrument as
  "Maroon-X", "Maroon-X Run", "'Alopeke" and "`Alopeke", in shades the key does not
  always list. Across the eight sheets that resolves GN to
  Alopeke/Altair/Engineering/GMOS/GNIRS/IGRINS2/Maroon-X and GS to
  Cal-ZORRO/Canopus/F2/GHOST/GMOS/GSAOI/IQUEYE.
- **Seven blocks in GN 2025B stay unresolved** and are marked `UNKNOWN`
  rather than guessed at - see §7.

5. **Reconcile against the operations workbook. Done 2026-08-08, re-run 2026-08-09**
   - see [VALIDATION.md](VALIDATION.md). With the workbook confirmed as ground truth
     it yielded two parser fixes (the text-only F2 night, `#ed7d31` = Maroon-X), after
     which zero parse gaps remain. The workbook still carries facts the sheet does not
     (fibre-fed availability, instruments behind closed ports), and a few runs where
     the two sources contradict outright - catalogued there for operations.

### Phase 2 - the mock API (done)

4. Write the new `schema.graphql` small. **Circulate this file to Bryan and Andrew
   before writing resolvers** - it is the "share the API design" deliverable, and SDL is
   cheaper to review than code.
5. New `store.ts` + `resolvers.ts` over the imported fixture. **Done** - the mock
   serves `publishedSemesters`, `telescopeNight`, `telescopeNights` and
   `instrumentAvailability` from the eight real schedules. A night is a
   projection (clip every record to the night), never stored, which is what keeps
   partial nights working with no special case.
6. Synthetic layer for components, subsystems and modes, under three rules:
   - **deterministic** - seeded generator, no `Math.random`, no `Date.now()` at seed
     time (the parked seed was pinned to real wall-clock Aug 2026 and was set to decay);
   - **anchored to real data** - generate GMOS component records only across the ranges
     GMOS is actually mounted;
   - **quarantined to one module** - swap one file when Bryan supplies real data.

```
published HTML / Bryan's Excel
      ↓  mock-server/import/importPublishedSchedule.ts
mock-server/data/gs2026B.json        ← committed fixture, REAL
      ↓
mock-server/seed.ts                  ← fixtures + demo.ts + synthesized layer
      ↓
MockStore → resolvers → SDL
      ├── dev server (yoga :4000)
      └── browser tests (SchemaLink)
```

**The one hand-written schedule: GS 2099B** (`mock-server/demo.ts`, added
2026-08-09). The published sheets are whole-night granular, so the edge cases the
model exists for - a mid-night instrument swap, a half-night port closure, gaps,
an unkeyed colour, a closure band over still-mounted instruments - had no served
data. The demo semester exercises all of them, quarantined in one file, dated
where no published semester can collide, and flagged `demo: true` end to end: the
pickers say "(demo)", every page header wears an amber SYNTHETIC DATA tag, and
the API page documents it - synthetic records must never pass for a published
schedule.

### Phase 3 - the views (done)

7. **Semester view. Done** - one grid serving both layouts, since the difference
   between them is only which rows the schedule is filed under. GS shows ports,
   GN shows instruments, from the same `rowLabel` the API carries.

   The layout is the sheet's, because that is where its readability comes from.

   **Colour carries instrument identity, one hue each.** An earlier pass spent
   colour on availability instead, on the grounds that thirteen instruments cannot
   have thirteen distinguishable hues. That is true and it was still the wrong
   call: nearly every block in a published semester is a working instrument, so
   the chart came out one colour and you had to read every label to find GMOS.
   Dan, 2026-08-07: "all the instruments being the same color was bad design, it's
   hard to read."

   What makes it work is that **no chart shows thirteen instruments**. GN resolves
   to seven and GS to seven, sharing only GMOS, so the assignment is optimised over
   the pairs that can actually share a chart - both sites clear every separation
   check, where a naive thirteen-way choice fails. The numbers, the two reserved
   decisions (red held back for closures; lightness deliberately non-uniform) and
   the commands to re-check are in `src/styles/global.css`.

   This is still consistent with Andrew's "colour coding to distinguish between
   active and unavailable instruments": unavailable is the hollow block and the
   closure band, neither of which is an instrument hue.

7b. **Drawn as a chart, one Highcharts xrange per month. Done.** Blocks are drawn
as blocks, clipped per month, keeping their true intervals.

The first version decomposed intervals into one cell per night and then
reconstructed the runs to place a label - GS 2026B is sixteen facts drawn as nine
hundred cells. Every awkward thing about it followed: labels cut to "Eng…",
columns pinned at 1.5rem so nothing responded to the viewport, and partial nights
undrawable, which §3.1 says must never happen.

7c. **Three views of one semester, on a toggle. All three done.** Dan, 2026-08-08:
the cell grid is worth keeping because it looks like the published PDF, but it has
to be drawn by Highcharts so it is responsive - and a calendar wanted alongside
both, so a reader picks whichever suits them.

| View         | Answers                              | How                               |
| ------------ | ------------------------------------ | --------------------------------- |
| **Chart**    | how long does a run last?            | xrange per month, exact intervals |
| **Grid**     | what does the sheet say on the 17th? | Highcharts `heatmap` per month    |
| **Calendar** | what can I do on a given night?      | react-big-calendar month (§7e)    |

The grid is a **deliberate** per-night decomposition - the thing the paragraph
above argues against by default, done in one view for the one job it is better
at, and never as the only view. Its cells are projected from the placed timeline
blocks (`domain/semesterCells.ts`), not rebuilt from records, so a cell and a bar
cannot disagree. A night that is not uniform is marked `MIXED` and the night view
is where the change is legible, which is §3.1's own corollary.

**The DOM table it replaces was the package's worst defect.** It was frozen
three commits behind the chart, and had its own copy of the
domain model - so every fix §7 and §7b record was applied to the chart only. Held
against the same data it still spelled "Telescope"/"Shutdown"/"Maintenance" one
word per port row, painted A&G red as a six-month shutdown, and coloured by
availability. None of its fourteen tests covered closures, A&G or the band. The
parallel model is deleted; `semesterCells.test.ts` pins all three.

7d. **The accessible reading is not one of the views.** All three are pictures, so
a text reading rides alongside whichever is showing: `SemesterBlockTable`, one row
per block over the whole semester. Sixteen rows, not nine hundred cells - the old
grid called itself the accessible reading while announcing "Port 3: GMOS, night of
7 Aug", then the 8th, then the 9th, which is worse than no table.

7e. **The calendar. Rebuilt again 2026-08-09, on react-big-calendar.** Third
generation. The first handed each block to FullCalendar as an all-day event
drawn naively - the chart wrapped at Sunday. The second removed events entirely
and painted per-night facts into the squares; Dan's verdict was that it was not
good enough, and that the calendar should be built on react-big-calendar with
its event layout genuinely used.

So the runs are events again, but properly this time, and the night facts kept:

- **react-big-calendar lays a run out as one bar** spanning its weeks, cut and
  continued at week edges, stacked with the week's other bars. `showAllEvents`
  keeps every bar visible - a semester week holds half a dozen facts at most,
  and "+2 more" folding two of five ports away made the month unreadable. Bars
  keep the instrument palette and their published names; a telescope-wide
  closure is a red bar; a span naming no instrument draws hollow, exactly like
  the chart. The legend is the chart's (`TimelineLegendBar`), not the grid's.
- **The square's chrome is still the night**: lunar brightness as a wash, the
  moon disc and the printed new/full markers, hours of astronomical dark, and
  holidays, all from `domain/calendarNights.ts`.
- **Every square clicks through to its night view** - the date header, the
  empty cell and the bars all navigate to `/night` with the selection kept.
  The header button's accessible name ("Open night beginning 2026-08-14") is
  also what the tests drive.
- **The view and the month are URL state** (`?view=calendar&month=2026-11`,
  via `useUrlParam`), so any page of the calendar is a sendable link, and the
  toolbar title is a picker over the semester's months - any month is one
  jump, not a chain of prev-clicks. An unknown month parameter lands on the
  first month rather than an empty grid (I4). The month accompanies **only**
  the calendar: changing the view or the semester drops it in the same URL
  update, so a chart or grid link is just the semester (2026B) and never
  carries a month naming a calendar page nobody is on.

**The sheet contained holidays all along.** Its day-header row is painted: one
colour on every weekend, another on public holidays. Both were parsed into
`SheetCell.background` and discarded. Across the four GS sheets the weekend
colour lands on 47-50 weekends and **zero** weekdays, and the second colour lands
on exactly the Chilean national holidays - Good Friday, Día del Trabajo, Glorias
Navales, San Pedro y San Pablo, Virgen del Carmen, Fiestas Patrias, and the 2025
election days. Three things follow, all in `import/calendarDays.ts`:

- The colours **change between semesters** (`#ffdd00` vs `#ffc000`, `lime` vs
  `#26ff00`), so the weekend colour is found structurally - the one on every
  weekend and no weekday - exactly like the per-row chrome detection. Never
  hardcode it.
- `#26ff00` is **also F2's instrument colour** at GS. In the day header it means
  holiday; in a subject row it means F2. Do not merge the two maps.
- **Gemini North paints neither**, so it has no holidays. Same site asymmetry as
  the closure convention (NEED-CLARIFICATION question 2), not a parse failure.

**Weekends are deliberately not imported.** They are derivable from the date with
certainty, and GS 2025A leaves one unpainted. Holidays are the opposite: nothing
else knows that 18 September is Fiestas Patrias.

**The moon notes are imported too** ("12 new Moon"), and they have real typos.
The parser is anchored so a mangled note fails rather than yielding a plausible
wrong date - GN 2026A prints `101full` and `213new`, where a loose digit scan
returns day 10 and day 21. A structural check also catches GS 2026B printing
December's full moon as "new": two of one phase inside twenty days is a misprint,
detectable with no ephemeris at all.

**What is still approximate, and labelled as such:**

- **Dark hours are astronomical night** (sun below -18 degrees), _not_ moonless
  time, because we still have no moonrise or moonset. A full moon riding high
  counts as dark here.
- **Brightness is phase only**, from `moon.ts`'s mean-synodic approximation
  (±~half a day). A reading aid, not a scheduling input, which is why the
  published new and full dates are drawn alongside it rather than instead of it.

Closing both needs a decision recorded in NEED-CLARIFICATION: lucuma-core's
`ImprovedSkyCalc` has `lunarElevation`, `lunarIlluminatedFraction` and
`lunarSkyBrightness`, but `modules/npm` exports only formatters and ID parsers,
so it is Scala-only today. Either the Resource API computes it server-side or
someone adds the export.

**Library:** `react-big-calendar` 1.20.0 with `dateFnsLocalizer` over the
package's own `date-fns` - chosen by Dan 2026-08-09 for its month event layout.
The known cost, recorded when FullCalendar was picked the first time round,
still stands and is accepted: it hard-depends on moment, moment-timezone,
luxon, dayjs, globalize and lodash, none of which our localizer path ever
invokes. FullCalendar (and its preact-renders-the-callbacks trap) is gone.

**Three traps.** A square is the **evening** a night begins, not the night's
label, or the same run sits a day off the grid on the same page. All-day event
**ends are exclusive**: a run's event ends at local midnight after its last
evening, or the bar draws one day short. And the calendar's height is **inline
in the component, not in global.css** - the browser tests do not load the app
stylesheet, and the height decides the week-row geometry. Custom components are
ordinary React here (no preact), so they can be proper capitalised components
under the React Compiler.

Three findings worth keeping:

- **A telescope-wide closure is one band across every row.** The sheet spells
  "Telescope Shutdown A&G Maintenance" vertically down the port rows and the
  importer records a word each, so the grid read as though Port 2 were named
  "Telescope". The importer also emits the wide record with the whole phrase, so
  the band is drawn from that and each port closure has the band's span
  subtracted. The fragments vanish; A&G on Port 4, which outlasts the shutdown,
  stays. Verified against all four GS semesters.
- **A&G is no longer painted as a shutdown.** Six months of red on Port 4 asserted
  a failure we have no evidence of. It is drawn as a hollow block until question 1
  of NEED-CLARIFICATION is answered.
- **Red is reserved for closures**, so no instrument gets it. The first palette
  handed GHOST red-600, which put the loudest signal on a working instrument
  sitting right beside a shutdown band.

8. Semester calendar view (month grid) - **done**, the third toggle, per §7c
   and §7e. The cell-for-cell comparison against the sheet lives in **Grid**.

9. **Week view. Done.** Seven observing nights on one continuous axis - they abut
   exactly, 14:00 to 14:00, so there is no gap to draw. Seven nights from the one
   asked for rather than a calendar week: an observing night is labelled by the
   morning it ends on, so a Monday-to-Sunday week has to pick which of those two
   dates it means and is wrong for half its readers either way.

   Each night gets a seventh of the width, which is enough for the sun to shade
   it - so the week shows the usable hours across seven nights, which is the one
   thing the semester cannot show and the night view shows only once. A night the
   API reports no data for is hatched and labelled, from `telescopeNights`.

   **Upgraded to a briefing, 2026-08-09** (Dan: the week should be a dashboard
   with more about what to expect). The published schedule is whole-night
   granular and changes maybe twice a month, so seven nights of runs are usually
   seven identical columns - what makes a week different is the sky and the
   changes, both already in hand. Under the chart now sit:

   - **A facts card per night** (`domain/weekBriefing.ts`): hours of
     astronomical dark, moon disc and fraction, the sheet's printed new/full
     moon, holidays, and "not recorded". The header sums the week's dark and
     brackets the moon. Same honesty rules as the calendar: dark is
     astronomical night, brightness is phase-only.
   - **A changes table**: every boundary strictly inside the window - runs
     beginning and ending, closures by their printed reason, and component
     state changes with their site clock time ("R400 to Summit lab, Sun 22
     Nov 10:00"). A boundary exactly at the window's edge is not a change - a
     run that began last week merely continues - and a record that simply ends
     is not phrased, because "nothing recorded" is not a state to announce
     (I4). The week query fetches component records for this; it is the first
     view after the night to read them.

10. **Night view. Done.** One night, and the view the model exists for: a run
    changing partway through is drawn where it changes, with the instant named
    above the chart. The published sheets are whole-night granular so no such
    night exists yet in the data - the tests for it are synthetic, pinning the
    capability rather than the fixture.

    Two decisions worth keeping:

    - **The sun wash goes over the bars, not behind them.** An instrument mounted
      at noon is still mounted, so its bar covers the whole night and a band
      behind it is invisible - which is how the first version came out.
    - **"Nothing is recorded" comes from the API**, via `telescopeNight`'s
      `dataAvailable`, not from an empty row. That is I4 surviving all the way to
      the screen.

    `siteTime.ts` computes the night window the block query asks for while the API
    resolves the same night for `dataAvailable`; the two implementations mirror
    each other deliberately, and a test pins that they agree - including across a
    Gemini South DST change, where a night is 23 hours.

### Phase 4 - interaction: descoped from v1

**v1 is read-only** (Dan, 2026-08-09). Resource reads a published schedule and
reproduces it; nothing edits it. Range editing was built - one mutation, refused
overlaps, an in-place panel - and removed the same day; the experiment itself was
squashed out of this branch's history for public testing, so if editing returns
it is designed fresh against this section. One finding from that work survives
because it is not about editing:

- **Chart data labels must be `pointerEvents: 'none'`** or the label over a bar
  swallows anything aimed at the block beneath it.

(A second finding from that era - "Highcharts' point click event binds but never
fires" - was disproven when read-only click-through landed 2026-08-10: point and
chart click events fire reliably and drive the night navigation in §10; the old
workaround advice is retired.)

What replaces interaction in v1 scope: the **component browser** - Resource is
the ICTD replacement, so finding where an instrument piece is comes before
editing when it moves. See §8 (components). Read-only navigation - every
night-shaped thing opening its night view - landed with the v1 punch list; see
§10.

---

## 6. Working rules

Written down because the previous attempt failed on process, not on code.

- **One capability per commit**, with its tests. The parked branch added night, week,
  semester and editor in a single commit, which is what made scope loss invisible.
- **This file is the design truth.** Do not let decisions accumulate only in commit
  messages or code comments.
- **No new schema type without a requirement behind it** - a row in the published sheet,
  a line in the scheduler contract, or a request from Bryan or Andrew.

---

## 7. Open with Bryan and Andrew

- The 2026B Excel, to check the importer against.
- ~~**Night labelling.**~~ **Confirmed 2026-08-07:** a column headed "7" is the night
  beginning the evening of the 7th, so it maps to the lucuma-core observing night
  labelled the 8th. The importer defaults to that.
- **Three GN colours are used but never listed in the sheet's key**, leaving 7 blocks
  (all GN 2025B) marked `UNKNOWN`. Each keeps its colour and any printed note, so
  identifying them is a lookup, not a re-import. **Since 2026-08-09 they are served
  and drawn** - grey, labelled "Unknown", `Instrument.UNKNOWN` in the SDL - because a
  reader comparing the chart against the published page must not find painted bands
  missing (Dan's call: draw them now, identify later). ANNOTATION blocks (text over
  unpainted cells, e.g. GNIRS "Cold head replacement") stay unserved - text alone
  marks nothing as available:
  - ~~`#ed7d31` ("Visiting" row, no text)~~ **Resolved 2026-08-09**: the operations
    workbook marks MAROON-X available on every such night, matching the page's prose
    ("Maroon-X in Multi-Instrument Queue"). Carried in `UNKEYED_BACKGROUNDS`; the
    runs now mount MAROON_X.
  - `black` (4 blocks, all GN 2025-11-27, every row, no text) - the workbook shows a
    normal Science night (it is US Thanksgiving); a holiday marker?
  - `#cccccc` (1 block, "Engineering Shutdown") and `#efefef` (2 blocks, "Onsky checks")
    - engineering states rather than instruments. Where do these belong in the model?
      The workbook keeps the instruments at Science through both (VALIDATION.md §3.3).
- ToO derivation rules (Bryan investigating).
- Confirm the status vocabulary: `SCIENCE` / `ENGINEERING` / `UNAVAILABLE` plus location
  (telescope port vs lab), per the IGRINS2 discussion.
- Should GN's instrument rows and GS's port rows converge on one presentation, or stay
  two views over one dataset?
- Review the Phase 2 SDL before resolvers are written.

---

## 8. Components - the ICTD half

**Added 2026-08-09.** The meeting's second mandate beside the calendar: Resource
is "the central repository for instrument and component location and status".
The browser at `/components` answers "where is the R400 grating", which no
schedule view can.

### 8.1 The endpoint review

The doc design (`v1-graphql-api.md`) was reviewed before building; the identity
model (§5.2) is kept nearly verbatim - enum-tag codes, barcode-as-code for MOS
masks, aliases within the instrument. Five things changed:

| Doc design                                       | Here, and why                                                                                                                                                                 |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Component blocks carry `usage` only              | **`place` added.** The requirement is location; as designed the API could not answer "where".                                                                                 |
| `InstrumentLocation` reused? No - never designed | A piece is `INSTALLED \| SUMMIT_LAB \| BASE \| UNKNOWN`. INSTALLED resolves through the instrument's own records, so a filter can never claim a port its instrument is not on |
| Queries hang off `TelescopeSchedule`             | Top level. Components are **live**, never schedule-owned (the killed lifecycle)                                                                                               |
| `offset`/`limit` paging                          | Unpaged - "one response" is an answered question, and a site set is ~30 pieces                                                                                                |
| `code`/`barcode`/`alias` exact args              | One `search` across all identities. The exact-resolution args are the backend's concern (ODB observing-mode checks)                                                           |

`TelescopeNight.components` is kept: the scheduler contract wants component
identity in the night projection, clipped like everything else. The synthetic
layer never decides `dataAvailable` - fake data must not make an unrecorded
night look recorded.

### 8.2 The fake data

`mock-server/components.ts` is the quarantine boundary, under Phase 2's three
rules: **deterministic** (no PRNG, no wall clock; each piece declares a
`pattern`), **anchored** (a riding piece is INSTALLED exactly across its
instrument's published mountings), **swappable** (one file when Bryan's catalog
arrives). Patterns: rides-with-instrument, spare-in-lab, stored-at-base,
mask-campaign, fails-mid-semester - the last two give the history expansion and
"changes tonight" real data, with mid-run boundaries exercising §3.1.

### 8.3 The browser

One PrimeReact DataTable (per the standing simple-standard-UI preference): search
across name/code/barcode/alias, instrument and type filters, a Where column
joining INSTALLED to the instrument's port, and a row expansion listing the
piece's history in evening dates. "Where" is answered for the URL's observing
night - the same selection the night view reads - so tests anchor on fixture
dates, never the wall clock.

**Reworked 2026-08-10** (Dan: better display, real fake data): rows group by
instrument under a subheader carrying the instrument's chart colour and its
one-line answer (piece count, how many are on the telescope tonight); the
repeating Instrument column and column sorting go - sorting would tear the
groups, and search plus filters are how a finder narrows. **Status speaks
operations, not the enum**: Science / Engineering / a muted "Spare" for a stored
piece with nothing wrong / red "Unavailable" with the record's note under the
tag - red is reserved for actually out of service, because a lab full of
red-tagged spares read as a broken observatory. The filter dropdowns offer
sorted options carrying their piece counts. The catalog itself carries **real
identities** - lucuma-core enum tags with their G-numbers (GmosSouthGrating,
Flamingos2Filter, GnirsDisperser, …), honest hand-written codes where no enum
exists (GHOST's IFUs and cameras, the speckle EMCCDs, Altair's optics) - so
every instrument the sheets mount browses non-empty; codes stay unique per site
because the id derives from them.

### 8.4 The night view draws the projection

**Added 2026-08-09.** `TelescopeNight.components` is no longer scheduler-only: the
night view lists the pieces riding tonight below the chart - installed at some
point during the night, or changing state during it - through the same finder
rows the browser builds, so the two cannot disagree about where a piece is.
Stored spares are counted, with a link into the browser, never listed; a night
listing every lab spare would bury the pieces the night is about.

A mid-night change is the section's reason to exist: it is named with its site
clock time ("changes at 10:00") rather than flattened to one state. The
synthetic R400 failure - 60% through GMOS's first GS 2026B mounting, inside the
night of 2026-11-22 - is the first boundary inside a night the dev server
actually serves, so §3.1's capability is now visible in the UI, not only pinned
by synthetic tests.

---

On 2026-08-09 the `plan=draft` URL selection was removed from `useSelection` -
a vestige of the dropped lifecycle (§3.3) that nothing read. (The `tz` time
display parameter followed it on 2026-08-10: nothing rendered the toggle, every
view speaks the site clock, and dead URL machinery is not a feature.) The URL
carries site, semester and night only; there is no other schedule document to
select.

---

## 10. The v1 finish - shipped 2026-08-10

The 2026-08-10 walkthrough punch list and the rounds after it closed the gap
between "the views exist" and "this is a product someone can be handed". The
decisions, so they do not live only in commit messages:

- **Tonight is the front door.** The index route lands on `/night`; no `night`
  in the URL means the night in progress; the masthead wordmark links home to
  tonight carrying only the site; the night and week pages have a Tonight
  button that simply drops the night parameter. Opening the app answers "what
  is on the telescope right now", not "here is a semester sheet".
- **Site and semester are masthead chrome, not page controls.** Every page read
  the same site and two read the semester, so the selection moved beside the
  account control. Choosing a semester whose nights do not hold the current one
  also moves the night to that semester's first night - on the night and week
  views the control means "take me to that semester", never a silent no-op.
- **Every night-shaped thing opens its night view** - calendar squares, the
  week's facts cards, chart bars, grid cells - through one `useOpenNight` hook,
  so every way in lands on the same URL with the selection kept. Charts resolve
  the click to the instant under the cursor (`nightAt`); Highcharts point and
  chart click events fire fine, retiring the Phase 4 era's contrary finding.
- **Port closures draw per view.** Every no-instrument block derives from a
  closure record, but what a port closure means is still open (question 1), so
  the wide views keep the hollow absence while the night view opts into the
  closure red (`unscheduledAs` on the shared chart builder) with one "Shut
  down" legend key - red means shut down on every surface, and a mid-night
  closure is the exact thing the night view exists to show.
- **The week page speaks evening dates** - heading, date picker, axis and cards
  in the published columns' own vocabulary, with the convention stated in the
  subtitle; the URL keeps the observing-night label it shares with the night
  view.
- **A no-data night is not a dead end**: the message lists the published ranges
  (contiguous semesters merged, the demo separate and labelled synthetic) and
  offers the nearest covered night (`domain/coverage.ts`).
- **Availability blocks are contextual values, never cache entities.** Every
  query clips its blocks to the asked interval under stable ids, so Apollo
  id-normalization let one night's response overwrite another's intervals.
  `src/gql/cache.ts` sets `keyFields: false` on the block types - the clobbering
  that file predicted when Phase 2 landed. The companion fix: `TimelineChart`
  keys its chart by the axis window, because Highcharts 12 answers an update
  swapping axis extremes and xrange data together with an empty series.
- **The app carries its own data source.** The masthead's Data control picks
  the built-in demo - the mock schema executed in the browser, the same
  executable schema the dev server and the tests use, so a deployed build
  needs no backend - or the live endpoint, which does not serve the v1 API
  yet; a live failure raises a banner that names the situation and offers the
  way back. The choice persists in localStorage and switches by reload, so
  each source gets a clean client and cache.
- **The superseded model left the branch entirely.** Its code and the orphaned
  time-display toggle were deleted, and the history squashed so neither ever
  appears in it; this file is the record of the pivot, and reintroducing any of
  it requires a decision recorded here.

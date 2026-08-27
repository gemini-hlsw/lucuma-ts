# CLAUDE.md - resource-ui

Working guide and design record for `@gemini-hlsw/resource-ui`, the web UI for the GPP
**Resource** service. The package is unpublished and pre-v1: what is written here are live
constraints, not history. When something is removed, it leaves this file with it.

## State of the package

The v1 read surface is complete and waiting on its backend. Five destinations draw the one
record: `/night`, `/week` (seven nights on one continuous axis), `/semester`, `/instruments`
and `/components`. The sidebar names the endpoint on every page.

**The app reads one backend: the live Resource service** at `/resource/graphql`. It does not
serve the v1 API yet, so every view is empty behind an amber banner naming the situation
(`src/gql/liveStatus.ts`, `LiveFailureBanner`). That is the expected state, in development and
deployed alike.

**No data source runs in the client.** The app must never execute a GraphQL schema in the
browser - that puts graphql-yoga, an executable schema and the SDL into a frontend bundle. Any
data source it is given has to be reached over HTTP.

**What is switchable is the dev server's proxy, never the app.** `RESOURCE_API=mock` (or
`pnpm dev:mock`) points the vite proxy at the mock on :4000. The app makes one request to one
path and does not care which process answers, so this needs no change to `ApolloConfigs.ts`: no
control, no second link, no schema in the bundle.

`mock-server/` is what the browser tests execute against, what codegen reads, and what :4000
serves. The app is not a consumer of it.

## Navigation and selection

- **Tonight is the front door.** The index route lands on `/night`; no `night` in the URL means
  the night in progress. The wordmark links home to it, and the night and week pages carry a
  Tonight button.
- **Site and semester are masthead chrome, not page controls.** Choosing a semester whose nights
  do not hold the current one also moves the night to that semester's first night, so the control
  is never a silent no-op.
- **The Clock toggle** (Site | UTC, `clock=utc`, via `app/useSelection.ts`) picks the zone every
  clock time renders in. `displayTimeZone` in `domain/siteTime.ts` is the one resolver, threaded
  as a required parameter so no formatter can silently stay site-local. Observing-night labels and
  evening dates are the site's calendar and never move with it.
- **Every night-shaped thing opens its night view** - calendar squares, week cards, chart bars -
  through `app/useOpenNight.ts`.
- **Page-scoped parameters go through `app/useUrlParam.ts`.** Defaults are deleted from the URL,
  not written, and subordinate parameters drop in the same update: the calendar's month belongs to
  the calendar alone, so switching view or semester drops it.

## The views

`/semester` carries a **Chart | Calendar** toggle: an xrange per month for how long a run lasts,
and a react-big-calendar month grid for what a given night holds - the only one of the two that
shows the week, or the moon.

**Do not give a view its own path from records to pixels.** Both project from the placed rows
`domain/timeline.ts` produced, never from a `Mounting`. The one deliberate exception is
`domain/calendarNews.ts`, which reads raw records because its subject is the records' own
boundaries rather than placed spans.

Both charts are built on `domain/timeline.ts` and `features/timeline/`. A view supplies its own
axis and its own way of phrasing a span - dates and nights for the semester and week, clock times
for a night - and nothing else. Adding a fourth window should not mean copying any of it.

### Calendar

Night chrome plus critical-event chips; every square clicks through to its night view.

**No run bars, ever.** Single-evening chips for the critical events - an instrument changing on a
port ("IGRINS-2 → MAROON-X", one chip per boundary, phrased by the new usage), the telescope
closing (red, the reason) and reopening - projected by `domain/calendarNews.ts`, with window-edge
boundaries treated as furniture. More news kinds are expected (component failures next, once the
semester query carries them). A chip wears the incoming instrument's hue with its name in the text.

Square chrome (moon disc, published new/full, dark hours, holiday, closed wash, brightness wash)
comes from `domain/calendarNights.ts`. The legend keys only hues and the closure - chips say their
own words. The toolbar title is a month picker; view and month are URL state
(`?view=calendar&month=2026-11`).

Three traps:

- A square is the **evening** a night begins, not the night's label, or it sits a day off the grid.
- All-day event **ends are exclusive** (local midnight after the last evening) or bars draw a day
  short.
- The calendar's height is **inline in the component**, not in `global.css` - the browser tests do
  not load the app stylesheet, and the height decides the week-row geometry.

### Week

Seven nights of a whole-night-granular schedule are usually seven identical columns, so the chart
shows the runs and a briefing under it shows the sky and the changes. Both come from
`domain/weekBriefing.ts`; `features/week/WeekBriefing.tsx` draws them.

- **`WeekNightStrip`** - one card per night: weekday label, moon disc and percentage, hours of
  astronomical dark, tags for a published new/full moon, a holiday, and a night with nothing
  recorded. Every card **is** a button onto its night view. `summarizeWeek` folds the same facts
  into the page subtitle.
- **`WeekChangesTable`** - "Changes this week": When / What / Where, one row per block boundary
  falling **inside** the window. A boundary on the window's edge is not a change. The kinds are a
  run beginning or ending, a closure beginning or ending, and a component moving. When nothing
  changes it says so rather than drawing an empty table.

Like the calendar's news, the changes read **ports only** (`buildWeekChanges` skips a mounting with
a null port): a shelf change is inventory, not a night's headline.

### Night

**Where partial nights are visible.** The workbook is whole-night granular, so no served night
splits a row and the chart's tests are synthetic on purpose - they pin the partial-night capability
the non-negotiables protect, not the current data.

**The chart alone**, deliberately bare for now and expected to gain things back. `NightSchedule`
does not select the projection's `components`; the field stays in the schema, since it is the
scheduler's. If a night-scoped table returns, build its rows through `componentFinder`.

**The night view alone adds the subsystem rows**: PWFS1, PWFS2 and LGS beneath the state rows,
monochrome in the same usage words a mounted span uses, with **no legend section of their own** -
every subsystem span draws in the one quiet neutral and prints its state in words, so a colour key
would key no distinction. The wide views omit the rows entirely; three semester-constant rows per
month would bury the runs.

### Coverage

**A night no semester covers says what is covered** (`domain/coverage.ts`). `coverageRanges` merges
the site's published semesters into contiguous spans for the message, `nearestCoveredNight` offers
the way back, and a demo semester never merges with a real one. `app/useSemester.ts` reads the same
module's `resolveSemester`.

### `/instruments`

One row per instrument the site's records name: which port it is on tonight (or plainly none), the
run's extent, and a row expansion listing its runs, which is where the workbook's Not Available
windows become legible. An instrument with no record on the chosen night reads "Not recorded", never
carried forward. The **Location filter** groups by the same phrasing the Where cell prints
(`locationLabel`, so the two cannot drift), offering only the locations the rows hold, counted, from
the telescope outwards. The run column is headed **"Dates"**, echoing the expansion's first column.

`domain/instrumentFinder.ts` mirrors `componentFinder` - same night-not-instant reading, same
last-record-decides, same honest absence.

**Instruments GPP knows but the schedule never mounts** come from `mock-server/storedInstruments.ts`,
a **quarantine boundary** alongside `components.ts` under the same three rules: deterministic,
anchored to the site's own recorded span, never deciding `dataAvailable`. Resource's `Instrument`
names eighteen (plus `UNKNOWN`) and the workbook mounts eleven on ports, so the acquisition cameras,
GPI, NIRI and SCORPIO would otherwise be invisible. `ENGINEERING`, `GSAOI` and `IQUEYE` are served by
neither layer but are in the palette against the day a record names one.

**Site is fixed per instrument** (AcqCam appears at both sites under one tag exactly as GMOS does) and
**location is what moves**. These records carry **no port**, which is structurally what keeps them out
of every schedule view. Their hues sit outside the two measured site sets deliberately; if one is ever
scheduled, re-run that site's separation check.

### `/components`

The ICTD half: a finder DataTable over the component catalog, grouped by instrument under subheaders
(colour swatch, piece count, how many are on the telescope tonight), with filter dropdowns carrying
their counts. Status speaks operations, not the enum: Science / Engineering / a muted "Spare" for a
stored piece with nothing wrong / red "Unavailable", with the record's own words in the Note column -
derived once in `componentLabels.componentStatus` and worn by the browser row and its history alike.

The catalog carries **real identities** (lucuma-core enum tags and G-numbers; honest hand-written codes
where no enum exists) but its blocks are **synthetic** - `mock-server/components.ts` is the quarantine
boundary; swap that one file when real data arrives. A piece's place is `INSTALLED` or a storage
location, never a port; INSTALLED resolves through the instrument's own mounting records
(`domain/componentFinder.ts`).

### Both finders

**Site-scoped, never semester-scoped**, via `app/useSiteSpan.ts`. "Where is Zorro" is not a semester
question - Zorro sits out GS 2025B - and a piece's history does not restart in February. The masthead's
semester control still moves the **night** these pages report for; it does not decide what they can see.

**Both open a row into `components/ui/RecordHistoryTable.tsx`** - Dates, Nights, where, Status, Note,
one line per record. A plain `<table>`, not a nested DataTable: this is presentation, not a control, and
PrimeReact's header fill, stripes and hover would compete with the table it hangs inside. Five rules:

- **It reads as the row it hangs under, continued.** Full width and responsive, the note taking the
  slack; indented `pl-12` (the expander column's 2.5rem plus a cell's 0.5rem) so its first cell starts
  under the name; and wearing that row's own background, which needs a `shell.css` rule.
- **Status is words, not badges.** Ten badges stacked under one row is a column of shouting pills.
  Colour marks only the state worth noticing - red for out of service. `components/ui/StatusTag.tsx`
  holds both facets (`severity` for a row's badge, `tone` for the words) so one derivation drives both.
- **A note is a column, never a second line under the status** (`components/ui/NoteCell.tsx`), on the
  browsers and their expansions alike. Last column everywhere, and it **wraps** rather than truncating
  or scrolling - a clipped note reads as the whole note.
- **The columns never move**, even when nothing fills them. An empty cell is the honest answer.
- **It says what the record cannot say alone**, from what the one query already returns - never a second
  round trip. A component block says INSTALLED and never a port, so the history resolves it through the
  same mountings the row uses (`componentFinder.whereOf`); every span carries its length in nights
  (`siteTime.nightCount`, counted over evening dates because a night is not a fixed number of hours).

Each page maps its own records onto `HistoryRow` and keeps its own vocabulary. **The two browser pages
themselves are deliberately not shared**: the shapes diverge (grouped subheaders against a flat list, two
filters against one, different expansions) and a `FinderPage` taking a dozen props would hide nothing.

## Chart rows, colour and treatment

**Every schedule view heads itself with the Telescope, Mode and ToO rows** when records reach its window,
through `collectStateRows` in `domain/timeline.ts`. The Telescope row states the recorded availability: a
quiet "Open" block, or "Closed" in the reserved closure red alongside the band.

**The state rows are monochrome and draw as a header band.** Hue means instrument identity and nothing
else. The ordinary state (Open, Queue, Standard ToOs) is the quiet neutral; a state worth noticing
(`NOTABLE_MODE`/`NOTABLE_TOO`: any other mode, any departure from standard ToOs) the bright one. **Do not
give a state a hue** - a new state kind joins the two neutrals or the closure red.

State bars keep the instrument size, every row label draws at full strength, and the groups are named in
the gutter: a small-caps **"Telescope" heading row over the state rows and an "Instruments" heading row
over the subjects** (`groupedRowLayout`/`headingLabelHtml`), on every chart, doubling as the band's
breathing room. Not an axis break, which drops the adjacent gutter label out of line with its bar; heading
type is sized to fit the narrowest 92px gutter. All derived from the rows inside the shared builders - no
view passes categories or header counts alongside its data. The **calendar draws only the notable state
spans**; routine values every week would bury the runs.

**One colour per instrument, keyed by the enum.** The map lives in `features/timeline/timelineOptions.ts`
as `satisfies Record<Instrument, string>`, so a new instrument in the schema fails to compile until it has
a colour. Colour follows the instrument, never its position in a list.

**The palette was chosen by measurement, per site.** No chart shows all fourteen hues - the workbook mounts
six subjects at GS and seven at GN, sharing GCAL and GMOS - so the assignment is optimised over the pairs
that can actually share a chart. Both groups clear every separation check (GN 14.0 deutan / 16.5 normal, GS
10.2 protan / 23.7 normal). Two things follow, both recorded with their numbers in `src/styles/global.css`:

- The validator's **lightness-band check deliberately fails**. Uniform lightness drops normal-vision
  separation to 12.2, under the hard floor of 15.
- **Red is reserved for the closure band**, not an instrument. Holding rose back as well drops separation
  to 14.7, so rose stays available.

Re-run the two site sets, not all fourteen at once, before changing any of them. The commands are in the
stylesheet.

**Identity never rides on colour alone.** Every block carries its published name, and the legend keys only
the instruments the window actually contains.

**Absence is drawn hollow, not as a fourteenth colour.** A port closure draws as an absence in every view -
the hollow "nothing scheduled" ghost (`schedule-ghost` in `timelineOptions.ts`) - because what a port
closure means for availability is still open with operations and no view may claim a failure it cannot
evidence. Red is the telescope's alone.

**Unknown is a reserved neutral**, like the closure red: a run the schedule names that the instrument list
does not is served as `Instrument.UNKNOWN` and draws zinc grey, labelled "Unknown", outside the two
validated hue sets. Where one coincides with a named run - GN's two "Visiting" rows share a label - the
named run wins the shared span (`domain/timeline.ts`).

**Usability is a treatment over the identity hue, never a second palette.** Science is the plain filled bar;
Engineering-use is the same hue hatched with its measured ink (`engineeringPattern`, the pattern-fill
Highcharts module; a CSS stripe on calendar bars); Not-available is hollow with the hue on the outline and a
muted label - distinct from the grey dashed ghost, and never red. The tooltip states the usage in words; the
Instruments legend gains neutral "Engineering use" / "Not available" keys only when the window holds them.
`usage` rides `Mounting` and `TimelineBlock`.

**A telescope shutdown is said once**: the Telescope row's Closed block is the one solid red statement
(`--schedule-closed`), the closed span is the translucent `--schedule-band` wash over the subject rows
(never per-row red painting - the ports are not each closed, the telescope is), the reason prints once on
the wash band, and one legend key names the red everywhere. Subject rows under a shutdown keep their own
records.

**The legend has one section per state row** - Telescope, Mode, ToO, then Instruments - because the neutrals
repeat across rows and a repeated grey must be keyed under the row it belongs to. Two chrome sections follow
wherever a view supplies keys: **Sky** (daylight and twilight washes) and **Calendar** (weekends, the now
marker, un-entered nights). Six sections, in that order, in `TimelineLegendBar`
(`features/timeline/TimelineChart.tsx`, fed by the `*LegendExtras` helpers in `timelineOptions.ts`). A
section with no keys does not render.

## Shared pixels, page-owned words

A thing drawn in two places is drawn from one module, taking a presentation shape rather than either page's
domain row. This is the rule the whole of `components/ui/` follows; `componentCells.tsx` exists because a second copy
of `whereLabel` had already let two views disagree about closures.

| Module                                   | What it owns                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `WhereCell`                              | A `WhereReading`: coarse presence (on the telescope / off it / not recorded), the place in words, and the change tag. `componentLabels.componentWhere` and `InstrumentsPage.instrumentWhere` map onto it, one line each.                                                                                                                                                                                                                                      |
| `PageHeader`                             | Every destination's title, synthetic flag, subtitle and right-hand controls slot.                                                                                                                                                                                                                                                                                                                                                                             |
| `PageStatus`                             | The three states a page shows instead of content: `ErrorAlert` (reserved red, `role="alert"`, the error's own message verbatim), `Loading`, `EmptyPanel`. Never red and never a warning for an empty panel - a gap means "not recorded" (I4). Three components, not one that decides: the night view alone has three distinct empty states and one carries a button.                                                                                          |
| `NightStepper`                           | The Tonight / arrows / date toolbar, its chrome, aria labels and cleared-input guard. The page owns the date vocabulary.                                                                                                                                                                                                                                                                                                                                      |
| `LabelledControl`                        | Binds a caption to its control **by id**, as a render prop, so the caller decides which prop carries it (`id` on an input, `inputId` on a PrimeReact Dropdown). It must not wrap the control: implicit labelling only reaches a labelable element, and a label wrapping a Dropdown named nothing and swallowed the control's words into the name ("Instrument All All"). The caption is the control's only name - no call site repeats it as an `aria-label`. |
| `FilterField`                            | The finder bar's layout over `LabelledControl`. `filterOptions.countedOption` is the "(12)" suffix.                                                                                                                                                                                                                                                                                                                                                           |
| `InstrumentSwatch`                       | Colour square plus name (in `features/timeline/`, beside the palette it reads).                                                                                                                                                                                                                                                                                                                                                                               |
| `siteTime.eveningLabel` / `eveningRange` | The one evening formatter. Style is a parameter (`dayMonth`, `dayMonthYear`, `weekdayDayMonth`) because that choice is about what the page already says, never about what the date means.                                                                                                                                                                                                                                                                     |

## Gotchas that cost real debugging

Both fixed structurally - do not undo them.

- **Availability blocks are contextual values, never cache entities.** Every query clips its blocks to the
  asked interval, so a block is a projection onto a window. Blocks once carried a stable `id` on which
  Apollo normalized, letting one night's response overwrite another's intervals (empty chart, "no components
  tonight" on a scheduled night). `ScheduleBlock` has no `id`; `domain/adapters.ts` makes row keys from
  response position; `src/gql/cache.ts` sets `keyFields: false` on every implementor as the second lock, and
  `cache.test.ts` reads the SDL so a new implementor cannot quietly miss the list. `InstrumentComponent`
  keeps its id and stays normalized, being identity-only.
- **`TimelineChart` keys its Highcharts chart by the axis window.** Highcharts 12 answers an update that
  swaps axis extremes and xrange data together with an empty series, so a window change is a fresh chart
  while same-window updates (data arriving, the "now" marker) update in place.

## Still open with operations

Questions the code wears an assumption for rather than silently inventing an answer:

| Question                                         | The assumption in code                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| What "A&G" on GS Port 4 means                    | Free text on a port-scoped closure, stored unparsed; drawn as a hollow absence, never a failure.                                                                                                                                                                                                             |
| Mapping the schedule vocabulary onto lucuma-core | Every name the workbook mounts is a Resource `Instrument`, including the AO subsystems (Altair, Canopus) and Engineering.                                                                                                                                                                                    |
| Unidentified runs                                | A name the instrument list does not hold is served as `UNKNOWN` with its text in `note` - a lookup question, not an error.                                                                                                                                                                                   |
| What the LGS column means                        | Constant per site in this export (GN "Yes" on all 915 nights, GS "No" on all 730), so it may record capability rather than a nightly state. Recorded as spans either way, read as the laser being available or not. If operations confirm capability, the row belongs beside the site rather than the night. |

## Not doing yet

Each is open; none is scheduled. Anything built here needs a reason recorded beside it.

- **A visible "List" as a third view toggle.** The block table already exists as the accessible reading of
  every chart, so exposing it is nearly free - but it adds a mode.
- **A retry affordance on the load-error banner**, which is message-only.
- **A components table on the night view.** If it returns it should answer a question `/components` cannot.
- **"Jump to current month"** in the calendar, when the viewed semester holds today.

## Commands

Prefix each with `pnpm --filter @gemini-hlsw/resource-ui`.

| Script            | What it does                                                          |
| ----------------- | --------------------------------------------------------------------- |
| `dev`             | vite dev server, proxying `/resource/graphql` to the real dev service |
| `dev:mock`        | the same, proxied to the mock on :4000 (`RESOURCE_API=mock`)          |
| `dev:mock-server` | mock GraphQL server on :4000 (`predev:mock-server` runs codegen)      |
| `codegen`         | regenerate `src/gql/gen`: typed operations + the SDL the mock serves  |
| `test`            | vitest, in a real browser (Playwright chromium)                       |
| `build`           | `tsc -b && vite build` (`prebuild` runs codegen)                      |
| `lint:eslint`     | eslint                                                                |

There is **no** `test:browser` script - `test` already runs in the browser. First-time browser tests need
`pnpm --filter @gemini-hlsw/resource-ui exec playwright install chromium`.

`dev` reads the live service, so **until the backend serves v1 it shows the failure banner and no data**.
That is deliberate: standing something else in for the backend in development is how a frontend ends up
shipping a server. `dev:mock-server` hosts the mock over HTTP for GraphiQL and for external consumers trying
the API; the browser tests are where the views are exercised against it.

**Treat port 4000 as untrusted at session start.** A mock server from an old session can outlive it and serve
a schema that no longer exists - this has caused confusion three times. Check with
`lsof -nP -iTCP:4000 -sTCP:LISTEN` and restart via the pnpm script, which runs `codegen` first. Two routes get
past that hook and re-serve the previous schema: invoking `node ./mock-server/server.ts` directly, and editing
the SDL while `--watch` is already running (it restarts the process without re-running the hook). Run
`codegen` by hand in either case.

## Where the schedule data came from

`mock-server/data/*.json` **is** the schedule source: nine semesters (GS 2024B-2026A, GN 2024B-2026B), both
sites organised by ports, with telescope mode and ToO support riding along. It was parsed once out of the
operations workbook export (`mock-server/fixtures/telescope_schedules.xlsx`, kept as provenance), which is the
operations team's own record and supersedes the published web overview sheets where they disagreed.

**The reader is not in this package.** It lives on the `resource/workbook-importer` branch - `workbook.ts`
pure and unit-tested, `importWorkbook.ts` the only part touching disk (ExcelJS). Revive that branch if an
Excel import is ever needed; edit the JSON if the mock's data has to change. `mock-server/records.ts` holds
the record types either way, taking their vocabularies from the schema's own enums.

How the workbook was read:

- One sheet per site, one row per **evening** ("Local Date" is the evening a night begins; both sites start
  2024-08-01). Semester split follows the evenings: Feb-Jul is A, Aug-Jan is B; observing nights are
  evening + 1.
- **Both sites are organised by ports.** Port columns decide what is served; the usability column supplies
  `usage` (Science / Engineering / Not Available), and a usage change splits the block.
- `Telescope` becomes whole-telescope availability records, **Open and Closed alike** - the sheet states both,
  so an Open night is a fact, never a gap. "Shutdown" is a closure's reason when Mode/Program names it; a
  night closed under an operating mode ("Queue" - weather) gets none, and its **mode stays unrecorded**.
- `Mode/Program` becomes `TelescopeModeBlock`s ("Visitor: X" is PRIORITY_VISITOR with X as the note). The
  `ToOs` column is **blank on every night of the current export**; blank is served as the observatory's
  default, **Standard support, wearing the assumption** as the record's note. A written level supersedes it.
  (Defaulting blank to "None" read as a recorded prohibition; that was the bug.)
- **Off-port usability is recorded**: an instrument marked usable with no port - the `Alopeke and Zorro
  visitor runs between mounts - becomes a mounting with no port, location UNKNOWN. The null port keeps it off
  every chart.
- **PWFS1, PWFS2 and the LGS column become subsystem records.**
- **Deliberately not imported**, each warned about at the time: the OIWFS columns (an OIWFS is an instrument
  _component_, and importing these would cross the synthetic-component quarantine), and GN's single trailing
  2027A evening (an export artifact). An unrecognised port name becomes an UNKNOWN block, never a silent drop.
- The workbook carries no colours, holidays or moon dates: legends key the enum palette, the calendar computes
  its moon, and no holiday chrome appears.

## Mock server

One typed mock shared by the :4000 dev server and the browser tests, both exercising the same resolvers and
literally the same file of SDL. **Preserve that property** - it is why a browser test and a GraphiQL
click-through cannot disagree.

| File                                  | What it is                                                                                                                      |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `schema.graphql`                      | The SDL, and the source codegen reads. Keep it small.                                                                           |
| `src/gql/gen/schema.graphql`          | The same SDL with `#import`s resolved, written by codegen. Generated, gitignored, never hand-edited.                            |
| `seed.ts`                             | Imports the nine `data/*.json` files. Everything comes from the workbook, so the mock cannot decay with the wall clock.         |
| `store.ts` / `resolvers.ts`           | Read-only so far.                                                                                                               |
| `records.ts`                          | The record types `data/*.json` holds, vocabularies from the schema's own enums, so a renamed SDL value is a compile error here. |
| `schema.ts` / `server.ts` / `time.ts` | The harness. `buildMockSchema(sdl)` returns an executable schema over a fresh store; `server.ts` is the yoga dev server.        |

- **A night is a projection**: clip every record to the night's interval and report what is left. Nothing is
  stored per night, which is what makes partial nights work with no special case.
- **The `#import` line has to be `schema.graphql`'s first content.** The loader only looks for imports when
  the SDL _starts_ with one; a header comment above it silently turns every type below into an unknown type
  (`schemaArtifact.test.ts` catches this). ODB scalars come in that way rather than being restated, as
  `packages/configs`' schema files do.
- **One SDL file, no second copy.** `#import` is @graphql-tools' rather than GraphQL's - GraphQL reads it as
  a comment - so a raw read of the source builds a schema whose `Timestamp` is undefined. Codegen already
  resolves it, so it writes the expansion back out rather than the package resolving imports again at
  runtime. The artifact lives under `src/gql/gen/` because generated code lives under `src/*/gen/` in every
  package here.
- **The artifact is only as fresh as the last `codegen` run.** A missing one fails loudly (`ENOENT`); a stale
  one starts fine and answers from the old schema. Hence `predev:mock-server`, on the precedent `prebuild`
  set. The price - an invalid document anywhere in `src/gql/` now fails `pnpm dev:mock-server` - was accepted
  deliberately.
- **The dependency runs one way**: `mock-server/` reads from `src/gql/gen/`, and nothing in `src/` imports
  from `mock-server/` outside the tests. So **`mock-server/` neither typechecks nor starts until `codegen`
  has run.**
- `src/test/mockClient.ts` wires the same schema into Apollo via `SchemaLink`; `src/test/mockPipeline.test.ts`
  pins the loop. If that test breaks, the dev server and the tests have diverged. SchemaLink **executes
  without validating**, so validate explicitly against the schema where it matters.

## GraphQL & codegen workflow

- Operations live in `src/gql/resource.ts` as `graphql(...)` tagged documents. Hooks returning **domain
  models** (not raw fragments) belong in `src/gql/hooks.ts`. `src/gql/ApolloConfigs.ts` is the client setup.
- Codegen source is `mock-server/schema.graphql`, configured in `tasks/codegen.ts`. It writes the typed
  operations and the resolved SDL into `src/gql/gen/`. `tasks/printSchemaPlugin.ts` prints the second one -
  named by path, not as `schema-ast`, because the CLI resolves a named plugin from its own install directory
  and in this workspace that lands on the copy built against graphql 17, whose type predicates answer false
  for this package's graphql 16 objects (`Unknown type BigDecimal.`).
- **After changing any operation or the schema, run `codegen`.** `prebuild` does it on build.
- The client preset only emits types an operation selects. If a type is missing from `gen/`, the fix is an
  operation that selects it, not a hand-written duplicate.
- When the backend ships, point `tasks/codegen.ts` at `@gemini-hlsw/lucuma-schemas/resource`.
- `@graphql-eslint` operation linting runs in `eslint.config.js` against `mock-server/schema.graphql`. `require-selections` asks for
  an `id` wherever a type has one, which is why `InstrumentComponent` selections carry it and blocks - which
  have none - are unaffected. That config globs `./src/gql/**/*.graphql`, which also contains the generated
  SDL, and those rules read a `.graphql` file as **operations** (every type in a schema fails
  `executable-definitions`). The `src/*/gen` entry in
  `eslint.config.shared.js`'s `globalIgnores` is what keeps them apart, and it is load-bearing: narrowing it
  turns the generated schema into forty lint errors that say nothing about the code.

## Data flow

GraphQL response → **pure adapters** (`src/domain/adapters.ts`) → **UI domain models**
(`src/domain/types.ts`) → components. All null handling and timestamp parsing lives in the adapters;
components never touch generated fragment shapes.

`src/domain/` holds the pure modules - date, interval and semester math, the sky (`moon.ts`, `sun.ts`), the
timeline and calendar projections, the two finders, the week briefing - each with unit tests beside it. Keep
date math and chart builders pure; keep components focused on rendering and interaction.

## Non-negotiables

- **Never put a `date` on a block.** Intervals only. The moment a `LocalDate` becomes a field, partial nights
  turn into a retrofit. (Referred to across the code as **the partial-night non-negotiable**.)
- **Every interval this API serves is half-open**, `start` inclusive and `end` exclusive - including a
  semester's `nights: DateInterval!`, which is why it is not a `firstNight`/`lastNight` pair. A _last_ night
  reads inclusive while `DateIntervalInput.end` is exclusive, so the obvious `telescopeNights` call came back
  one night short and nothing said so. The domain model reads a semester inclusively, and
  `toPublishedSemesters` is the one line where the two meet.
- **A block has no `id`.** Row keys are the adapters'. `InstrumentComponent` keeps its id, being real hardware.
- **`InstrumentLocation` is one type**, `place: InstrumentPlace!` with an optional `port`. `place` includes
  `PORT` and is total, so one field answers "where is this" for a port and a shelf alike and a client needs no
  fragment. **The schema cannot enforce the pairing, so the server owes it**: `port` is non-null exactly when
  `place` is `PORT`, and explicitly null otherwise. `mock-server/resolvers.ts`'s `instrumentLocation` is the
  only place a location value is built, and `domain/adapters.ts`'s `toLocation` the only place the app
  re-checks it - a contradictory record reads as off-port/`UNKNOWN` with a dev-mode warning, never an error,
  because one bad record must not empty a night. Do not build a location literal at a call site, and do not
  push the `place`/`port` pair past the adapter: the domain model carries the exclusive pair (`Mounting.port`
  xor `Mounting.place`, whose type `OffPortPlace` excludes `PORT`).
- **A gap means "not recorded", never "unavailable"** (invariant **I4**). Empty port cells must not render as
  closed, and **empty calendar squares stay empty**. Do not decorate a gap to make a month look finished.
- **`ResourceUsage` is one enum** - `SCIENCE`/`ENGINEERING`/`UNAVAILABLE`. Do not split it into separate
  availability and usage fields.
- **Types the ODB already defines are imported, never restated** - the scalars, `TimestampInterval`,
  `TimeSpan`, `Site`, `Partner`. `Instrument` is the deliberate exception: the schedules mount things the ODB's
  enum does not name.
- **A record's port is its row; there is no row label.** `domain/ports.ts` renders the label from the port.
  Do not reintroduce a display string the model can derive. The row set is `TELESCOPE_PORTS` (five, a fact
  about the instrument support structure) unioned with any port the records name, so a quiet port keeps its
  blank row - blank says "nothing recorded" (I4), a missing row would say the port does not exist - and a
  record on an unexpected port still draws instead of vanishing.
- **No new schema type without a requirement behind it**: a column in the workbook, a line in the scheduler
  contract, or a request from Bryan or Andrew.
- **One capability per commit**, with its tests.

## Testing

Browser-mode Vitest (Playwright chromium). Pure functions get plain unit tests; pages get browser tests that
mount against the mock via `src/test/renderApp.tsx` and drive real interactions with accessible queries
(`getByRole`, `getByLabelText`).

- **Every control whose press, toggle or hover changes what is displayed gets a browser test driving the real
  interaction.** Test both directions where they exist: what must change with the control (the night chart's
  axis under the Site | UTC clock) _and_ what must not (the semester chart's geometry and fills across the same
  toggle). Guard "must change" assertions non-empty first, so a blanked chart cannot pass as merely "different".
- **Anchor on fixture dates, never the wall clock.** Where a test must involve "now", derive it with the same
  function the page uses.
- **PrimeReact overlays render into `document.body`**, outside the render container, so a Dropdown panel is
  unreachable from `renderApp` locators. Drive dropdowns through `src/test/helpers.ts` (`openDropdown` /
  `selectDropdownOption`), which reaches the panel via `page`, scoped through `getByRole('listbox')` so the
  hidden native `<select>` mirror does not also match.
- **The tests load no app stylesheet**: a test that needs styling to pass is testing the stylesheet. The one
  exception is `styles/chartOverlays.css`, which is behaviour rather than appearance - a Highcharts overlay that
  catches the pointer swallows the hover under it - and the single test asserting that imports it itself.
- **The URL hooks in `src/app/` are driven through the URL**, not through `renderHook`: `test/probe.tsx` renders
  a hook inside the real router, prints what a test asserts on and offers buttons standing in for the app's
  controls. One `Probe` per route, though - two routes rendering it at the same position let React reuse the
  fiber, and two `use` bodies with different hook counts is a hook-order violation.
- Prefer tests driven by configuration (e.g. `SIDEBAR_MENU_SECTIONS`) over hard-coded lists.
- Don't assert on internal React structure; don't over-mock.

## Tailwind & PrimeReact conventions

**The chrome is Explore's theme, measured from explore-dev.lucuma.xyz** and held as tokens in `global.css`
`@theme`: the black-to-raised surface ladder, the white-opacity text ladder, the GPP action green
(`--color-gpp`), the brand light green (`--color-gpp-accent` - the DEVELOPMENT badge and identity accents, never
an action), and Explore's info blue / secondary slate. Extend from these tokens, never from a hex in a component;
`shell.css` wires them into PrimeReact. Red stays closed/unavailable, amber unknown/warning. Use PrimeReact first
for controls, Tailwind for layout and small adjustments.

**When a Tailwind utility loses to a PrimeReact control, the winner is `lucuma-ui-css`, not PrimeReact.**
PrimeReact's own classes are wrapped in `@layer primereact` and set almost nothing (`.p-tag` gets three
flexbox properties), so they lose to anything. The theme is `lucuma-ui-css`, and `lucuma-ui.scss` loads it
**unlayered** inside `.dark { }` - so its rules are `.dark .p-tag` at 0-2-0, beating a Tailwind utility at
0-1-0 in `@layer utilities` twice over: unlayered outranks layered, and the specificity is higher anyway.
Declaring PrimeReact's documented layer order (`@layer tailwind-base, primereact, tailwind-utilities`) does
nothing here, because PrimeReact's layer is not the competitor - do not reach for it.

Override through the variables first: `shell.css` re-tints `lucuma-ui-css` by reassigning its own
`--surface-*`, `--text-color`, `--primary-color` and `--highlight-*`, which is why the app matches without
fighting any selector. Reach for `!` only where `lucuma-ui-css` hardcodes a value with no variable behind
it - today that is `.p-tag { font-size: 0.75rem }`, the reason every `!` in this package sits on a `<Tag>`.

Prefer Tailwind utilities over CSS files except where Tailwind can't express it (complex selectors,
keyframes, third-party overrides).

**Density is one number.** The root font size is 13px (`shell.css`), matched against Explore at both widths;
everything is sized in rem. Settled - re-measure against Explore before changing it.

**The masthead has a measured width budget**, its arithmetic in `shell.css` beside `.xp-masthead-right`. Check
there before adding an item to the bar:

| Width             | What happens                                                                                                                                        |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **831px**         | The bar stops fitting: 133.7 wordmark + 137.2 badge + 503.1 right group + 31.2 gaps + 26 padding. Nothing wraps; the items' contents break instead. |
| **848px (53rem)** | The three control captions are visually hidden, buying 112.3px back. A media query's rem is the initial 16px, not the 13px root.                    |
| **~693px**        | The floor, where the menu button starts clipping. The shell is `overflow-x: hidden`, so nothing past it is reachable.                               |

## Architecture docs

`lucuma-odb/resource/docs/` is authoritative for the v1 backend domain and API, with the v1 scope trims applied
here: the schedule lifecycle, change log and restrictions are out of scope - every view reads the one published
record, and editing was descoped from v1. When the two disagree, this file and the code win for this package.

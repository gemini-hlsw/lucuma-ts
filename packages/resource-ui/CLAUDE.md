# CLAUDE.md - resource-ui

Guidance for working in `@gemini-hlsw/resource-ui`, the web UI for the GPP **Resource**
service.

This file is the working guide **and** the design record for the package: what
Resource is, the decisions that shaped it, and how to work in the code. The earlier
planning documents (PLAN.md, NEED-CLARIFICATION.md, VALIDATION.md) were retired on
2026-08-11 as outdated; what still holds from them lives here and in the git history.

## State of the package

**The v1 surface is complete (2026-08-10) and heading to public testing.** The one
data source is the operations workbook export (`mock-server/fixtures/telescope_schedules.xlsx`,
pivot 2026-08-11): nine semesters (GS 2024B-2026A, GN 2024B-2026B), both sites
organised by ports, with telescope mode and ToO support riding along. Four
destinations draw the same data: `/night` as a single night, `/week` as seven
nights on one continuous axis, `/semester`, and `/components` (the ICTD half).
The sidebar names the source on every page. The raw API browser that once
lived at `/api` was removed at Dan's direction (2026-08-11) - GraphiQL against
the demo-data server on :4000 is the way to inspect the contract.

**The app carries its own data.** The masthead's Data control picks the backend:
the built-in demo - the mock schema executed in the browser over Apollo
`SchemaLink`, so a deployed build (and local dev) needs no server at all - or the
live `/resource/graphql` endpoint, which does not serve the v1 API yet. Switching
persists in localStorage and reloads for a clean client (`src/gql/dataSource.ts`);
a live failure raises a banner naming the situation with a switch-back button.

**Tonight is the front door.** The index route lands on `/night`, no `night` in the
URL means the night in progress, the masthead wordmark links home to it, and the
night and week pages carry a Tonight button. Site and semester are **masthead
chrome**, not page controls - choosing a semester whose nights do not hold the
current one also moves the night to that semester's first night, so the control is
never a silent no-op on the night and week views. The masthead's **Clock toggle**
(Site | UTC, the `clock=utc` URL parameter via `app/useSelection.ts`) picks the zone
every clock time renders in - `displayTimeZone` in `domain/siteTime.ts` is the one
resolver, threaded as a required parameter so no formatter can silently stay
site-local. Observing-night labels and evening dates are the site's calendar and
never move with it. **Every night-shaped thing opens its night view** - calendar
squares, week cards, chart bars and grid cells - through one `app/useOpenNight.ts`
hook, so every way in lands on the same URL.

`/semester` itself carries a **Chart | Grid | Calendar** toggle: an
xrange per month for how long a run lasts, a Highcharts `heatmap` per month for what
the sheet says on a given night, and a react-big-calendar month grid for what a given
night holds - the only one of the three that shows the week, or the moon.

All three project from the same placed blocks, which is the whole point: the DOM table
the grid replaces kept its own copy of the domain model, was frozen three commits
behind, and had silently drifted into disagreeing with the chart about closures, about
A&G and about colour. **Do not give a view its own path from records to pixels.**
`domain/semesterCells.ts` reads `TimelineRow`, never a `Mounting`. The one deliberate
exception is the calendar's news projection (`domain/calendarNews.ts`), which reads the
raw records because its subject is the records' own boundaries, not placed spans - it
is a domain module with its own tests, not a view-side copy of the model.

**The calendar is react-big-calendar: night chrome plus critical-event chips,
and every square clicks through to its night view** (rebuilt 2026-08-09;
chips-not-bars at Dan's direction 2026-08-11, after a news-span-bars
iteration he rejected). **No run bars, ever**: the calendar draws single-evening
chips for the critical events - an instrument changing on a port ("IGRINS-2 →
MAROON-X", one chip per boundary, a usability change phrased by the new usage),
the telescope closing (red, the reason) and reopening - projected by
`domain/calendarNews.ts` from the raw records, with window-edge boundaries
treated as furniture. More news kinds are expected to join it (component
failures next, once the semester query carries them). A chip wears the incoming
instrument's hue with its name in the text; the square's chrome (moon disc,
published new/full, dark hours, holiday, closed wash, brightness wash) still
comes from `domain/calendarNights.ts` and is now the view's main content - the
height dropped to 44rem with the bars gone. The legend keys only hues and the
closure: the treatment keys are suppressed, since chips say their words. The toolbar title
is a month picker, and the view and month are URL state
(`?view=calendar&month=2026-11`) - page-scoped parameters go through
`app/useUrlParam.ts`, which is also how the component finder's filters are
linkable. Default values are deleted from the URL, not written, and the month
belongs to the calendar alone: switching view or semester drops it, so chart
and grid links are just the semester.

Three traps. A square is the **evening** a night begins, not the night's label, or
it sits a day off the grid on the same page. All-day event **ends are exclusive**
(local midnight after the last evening) or bars draw a day short. And the calendar's
height is **inline in the component**, not in `global.css` - the browser tests do
not load the app stylesheet, and the height decides the week-row geometry.

All three are built on `domain/timeline.ts` and `features/timeline/`, which hold the
block-and-closure logic and the chart frame. A view supplies its own axis and its own way
of phrasing a span - dates and nights for the semester and week, clock times for a night -
and nothing else. Adding a fourth window should not mean copying any of it.

Two gotchas that cost real debugging, both fixed structurally - do not undo them:

- **Availability blocks are contextual values, never cache entities.** Every query
  clips its blocks to the asked interval under stable ids, so Apollo id-normalization
  let one night's response overwrite another's intervals (empty chart, "no components
  tonight" on a scheduled night). `src/gql/cache.ts` sets `keyFields: false` on the
  three block types; `Component` stays normalized, being identity-only.
- **`TimelineChart` keys its Highcharts chart by the axis window.** Highcharts 12
  answers an update that swaps axis extremes and xrange data together with an empty
  series; a window change is therefore a fresh chart, while same-window updates
  (data arriving, the "now" marker) update in place.

**Port closures draw per view.** Every no-instrument block derives from a closure
record, but what a port closure means for availability is still open with
operations - so the wide views keep the hollow absence, and the
night view alone opts into the closure red (`unscheduledAs: 'closure'` on the shared
chart builder), with one "Shut down" legend key for bands and port closures alike.

**The night view is where partial nights are visible.** The workbook is
whole-night granular, so no served night splits a row and the chart's tests are
synthetic on purpose - they pin the partial-night capability the non-negotiables
protect, not the current data. One served source still exercises it: the
**components table below the chart**, whose synthetic R400 failure lands mid-night inside the
GS night of 2025-11-20. The table builds its rows through the same `componentFinder`
the browser uses - do not give it its own path from blocks to rows.

**The night view alone adds the subsystem rows** (2026-08-12): PWFS1, PWFS2 and
LGS beneath the state rows, monochrome in the same usage words a mounted span
uses, with their own Subsystems legend section. The wide views stay without
them - three semester-constant rows per month would bury the runs, the same
reason the calendar draws no routine bars.

**Every schedule view heads itself with the Telescope, Mode and ToO rows**
when records reach its window (Dan, 2026-08-11) - the workbook's Telescope and
Mode/Program columns, and the assumed-Standard ToO default, drawn as
telescope-state blocks: the night and week charts, every semester
month chart and grid, all through `collectStateRows` in `domain/timeline.ts`.
The Telescope row states the recorded availability - a quiet "Open" block, or
"Closed" in the reserved closure red alongside the band. **The state rows are
monochrome and draw as a header band**: hue on a chart means instrument
identity and nothing else, so the earlier per-state hues are gone - the
ordinary state (Open, Queue, Standard ToOs) is the quiet neutral, a state
worth noticing (`NOTABLE_MODE`/`NOTABLE_TOO` in the domain: any other mode,
any departure from standard ToOs) the bright one. The state bars keep the
instrument size, every row label draws at full strength, and the groups are
named in the gutter: a small-caps **"Telescope" heading row over the state
rows and an "Instruments" heading row over the subjects**
(`groupedRowLayout`/`headingLabelHtml`), on the charts and the grid alike -
the heading row doubles as the band's breathing room. (Not an axis break,
which drops the adjacent gutter label out of line with its bar; heading type
is sized to fit the narrowest 92px gutter.) All derived from the rows inside
the shared builders - no view passes categories or header counts alongside
its data. The grid's state cells are
exempt from the closure band (a closure does not erase a state record; a
shutdown night's missing mode stays a gap, I4), except the Telescope row's own
Closed cells, which are the closure. The **calendar draws only the notable
state spans** as bars - routine values every week would bury the runs. **The
legend is sectioned** - Telescope (open/closed, modes, the shut-down key), ToO
and Instruments, each labelled, so three vocabularies never read as one line
of colours (Dan, 2026-08-11); a section with no keys does not render
(`TimelineLegendBar` + the `*LegendExtras` helpers in `timelineOptions.ts`).
Do not give a state a hue; if a new state kind arrives, it joins the two
neutrals or the closure red.

**Instrument usability is a treatment over the identity hue, never a second
palette** (Dan, 2026-08-11): a Science span is the plain filled bar; an
Engineering-use span is the same hue hatched with its measured ink
(`engineeringPattern` - the pattern-fill Highcharts module, a CSS stripe on
calendar bars); a Not-available span is hollow with the hue on the outline and
a muted label - distinct from the grey dashed "nothing scheduled" ghost, and
never red, which stays the telescope's. The tooltip states the usage in words;
the Instruments legend gains neutral "Engineering use" / "Not available"
treatment keys only when the window holds them. The workbook's usability
columns already split blocks on a usage change; `usage` rides `Mounting`,
`TimelineBlock` and `SemesterCell`.

**A telescope shutdown is said once, consistently** (Dan, 2026-08-11): the
Telescope row's Closed block/cell is the one solid red statement
(`--schedule-closed`, measured), the closed span is the translucent
`--schedule-band` wash over the subject rows in every chart view AND the grid
(never per-row red painting - the ports are not each closed, the telescope
is), the reason prints once on the wash band, and one legend key - "Closed" -
names the red everywhere. Subject rows under a shutdown keep their own
records, usually the sheet's own empty cells. A port-scoped closure block
draws as the hollow absence in every view - the night view's old red port
bars are gone with the whole `unscheduledAs` machinery. **The legend has one
section per state row** - Telescope, Mode, ToO, then Instruments - because the
neutrals repeat across rows and a repeated grey must be keyed under the row it
belongs to (Dan, 2026-08-11).

**One colour per instrument, keyed by the enum.** A single fill for every mounting made
the chart unreadable - you had to read every label to find GMOS. The map lives in
`features/timeline/timelineOptions.ts` as `satisfies Record<Instrument, string>`, so a new instrument
in the schema fails to compile until it has a colour rather than silently reading as
another one. Colour follows the instrument, never its position in a list.

**The palette was chosen by measurement, per site.** Fourteen hues cannot all separate,
but no chart shows fourteen - the workbook mounts six subjects at GS and seven at GN,
sharing GCAL and GMOS - so the assignment is optimised over the pairs that can actually
share a chart. Both groups clear every separation check (GN 14.0 deutan / 16.5 normal,
GS 10.2 protan / 23.7 normal). Two things follow, and both are recorded with their
numbers in `src/styles/global.css`:

- The validator's **lightness-band check deliberately fails**. Uniform lightness was
  tried and drops normal-vision separation to 12.2, under the hard floor of 15.
- **Red is reserved for the closure band**, not an instrument. Holding rose back as well
  drops separation to 14.7, so rose stays available.

Re-run the two site sets, not all fourteen at once, before changing any of them. The
commands are in the stylesheet.

**Identity never rides on colour alone.** Every block carries its published name, and the
legend above the charts keys only the instruments the semester actually contains. That is
what makes the palette safe for a reader who cannot separate two of the hues.

**Absence is drawn hollow, not as a fourteenth colour** - a fill would crowd the palette
and claim to be an instrument.

**Unknown is a reserved neutral, like the closure red.** A run the importer cannot
identify is served as `Instrument.UNKNOWN` and draws zinc grey, labelled "Unknown",
deliberately outside the two validated hue sets so an unidentified band never reads as
an instrument. Where one coincides with a named run - GN's two "Visiting" rows share a
label - the named run wins the shared span (`domain/timeline.ts`), the same rule wide
closures apply to port closures.

**Still open with operations** - the standing questions the code wears an
assumption for, rather than silently inventing an answer:

- **What "A&G" on GS Port 4 means.** It arrives as free text on a port-scoped
  closure and is stored unparsed; the views draw it as a hollow absence, never a
  failure, because the record gives no evidence for one.
- **Mapping the schedule vocabulary onto lucuma-core.** Every name the workbook
  mounts is modelled as a Resource `Instrument` for now (Dan, 2026-08-07),
  including the AO subsystems (Altair, Canopus) and Engineering; whether some
  belong elsewhere is deferred.
- **Unidentified runs.** An unrecognised workbook name is served as `UNKNOWN`
  with its text in `note` - a lookup question, not a parse failure.
- **What the LGS column means.** It is _constant per site_ in this export - GN
  prints "Yes" on all 915 nights, GS "No" on all 730 - so it may record the
  site's laser capability rather than a nightly state. Recorded as spans
  either way (that is what the column says), read as the laser being available
  or not, and not reinterpreted. If operations confirm it is capability, the
  LGS row belongs beside the site rather than on the night.

The superseded schedule-authoring model does not appear in this branch's history -
it was removed and the history squashed before public testing (2026-08-10);
reintroducing anything from it requires a fresh decision recorded here.

**`/instruments` is the finder's other half** (2026-08-12): one row per
instrument the site's records name, saying which port it is on tonight - or
plainly that it is on none - with the run's extent, and a row expansion listing
every run of the semester, which is where the workbook's Not Available windows
become legible. It exists because the schedule views draw ports only, so an
instrument recorded usable between mounts has no row there. It is deliberately
the component browser's twin in shape (one DataTable, the night from the URL,
client-side search) so the two read as one tool. `domain/instrumentFinder.ts`
mirrors `componentFinder` - same night-not-instant reading, same
last-record-decides, same honest absence.

**`/components` is the ICTD half**: a finder DataTable over the
component catalog, grouped by instrument under subheaders (colour swatch, piece
count, how many are on the telescope tonight), with filter dropdowns whose options
carry their counts. Status speaks operations, not the enum: Science / Engineering /
a muted "Spare" for a stored piece with nothing wrong / red "Unavailable" with the
record's note - shared with the night table through
`features/components/componentCells.tsx`. The catalog carries **real identities**
(lucuma-core enum tags and G-numbers; honest hand-written codes where no enum
exists) but its blocks are **synthetic** - `mock-server/components.ts` is the
quarantine boundary; swap that one file when real data arrives, and never let the
synthetic layer decide `dataAvailable`. A piece's place is `INSTALLED` or a storage
location, never a port - INSTALLED resolves through the instrument's own mounting
records (`domain/componentFinder.ts`).

## Commands

```bash
pnpm --filter @gemini-hlsw/resource-ui dev            # vite dev server (proxies /resource/graphql → the real dev service)
pnpm --filter @gemini-hlsw/resource-ui dev:mock-server# demo-data GraphQL server on :4000
pnpm --filter @gemini-hlsw/resource-ui codegen        # regenerate src/gql/gen from mock-server/schema.graphql
pnpm --filter @gemini-hlsw/resource-ui test           # vitest - runs in a real browser (Playwright chromium)
pnpm --filter @gemini-hlsw/resource-ui build          # tsc -b && vite build (prebuild runs codegen)
pnpm --filter @gemini-hlsw/resource-ui lint:eslint
```

There is **no** `test:browser` script - `test` already runs in the browser. First-time
browser tests need `pnpm --filter @gemini-hlsw/resource-ui exec playwright install chromium`.

`dev` alone is a working app: the default data source executes the mock in the browser.
`dev:mock-server` hosts the same demo data over HTTP at :4000, for GraphiQL and for
external consumers trying the API. It is **not** the "Live server" source: Live means
the actual Resource service, in development too (the vite proxy carries
`/resource/graphql` to the dev deployment purely to sidestep CORS), and fails with
the banner until the real backend serves v1.

**Treat port 4000 as untrusted at session start.** A mock server from an old session can
outlive it and serve a schema that no longer exists - this has caused confusion three
times now. Check with `lsof -nP -iTCP:4000 -sTCP:LISTEN` and restart via the pnpm script.

## Importing the workbook

`mock-server/import/` turns the operations workbook export into the JSON the mock
seeds from. **It is the only schedule source.** The published web overview sheets
this package used to fetch and parse are gone - the workbook is the operations
team's own record and supersedes them where they disagreed (the 2026-08-09
validation pass found several such runs, and the workbook flatly omits some
published visits).

```bash
pnpm --filter @gemini-hlsw/resource-ui import:schedule
```

A new export from operations means replacing
`mock-server/fixtures/telescope_schedules.xlsx` and re-running the import. Nothing
is fetched from the web.

- `workbook.ts` is pure and unit-tested; `importWorkbook.ts` is the only part
  touching disk (ExcelJS - default import only, its CJS bundle breaks named
  imports under plain node).
- One sheet per site, one row per **evening** ("Local Date" is the evening a
  night begins; both sites start 2024-08-01, 2024B's first evening - the other
  reading would start both on 2024A's final night). Semester split follows the
  evenings: Feb-Jul is A, Aug-Jan is B; observing nights are evening + 1.
- **Both sites are organised by ports.** Port columns decide what is served; the
  instrument's usability column supplies its `usage` (Science / Engineering /
  Not Available), and a usage change splits the block.
- `Telescope` becomes whole-telescope availability records, **Open and Closed
  alike** - the sheet states both, so an Open night is a fact, never a gap.
  "Shutdown" is a closure's reason when Mode/Program names it; a night closed
  under an operating mode ("Queue" - weather) gets none. A shutdown night's
  **mode stays unrecorded**.
- `Mode/Program` becomes `TelescopeModeBlock`s ("Visitor: X" is
  PRIORITY_VISITOR with X as the note). The `ToOs` column is **blank on every
  night of the current export**; the demo serves blank as the observatory's
  default, **Standard support, wearing the assumption** as the record's note
  (Dan, 2026-08-11) - a written level is a fact and supersedes it. (An earlier
  import silently defaulted the blank to "None", which read as a recorded
  prohibition; that was the bug.)
- **Off-port usability is imported** (2026-08-12): an instrument the workbook
  marks usable with no port recorded - the `Alopeke and Zorro visitor runs
between mounts - becomes a mounting with no port, location UNKNOWN, because
the workbook never says where an unmounted instrument physically is. It is
**not** a `rowLabels` entry: the schedule views are the ports' picture, and
  the instrument browser is where an off-port run is legible (Dan, 2026-08-12).
- **PWFS1, PWFS2 and the LGS column become subsystem records** (2026-08-12).
  The LGS Yes/No is the laser available for science or not - both recorded
  facts, and GS records "No" every night rather than a gap.
- **Deliberately not imported**, each with a warning: the OIWFS columns (an
  OIWFS is an instrument _component_, and the component layer stays synthetic
  until real ICTD data arrives - importing these would cross that quarantine),
  and GN's single trailing 2027A evening (an export artifact). An unrecognised
  port name becomes an UNKNOWN block, never a silent drop.
- The workbook carries no colours, holidays or moon dates: legends key the enum
  palette, the calendar computes its moon, and no holiday chrome appears.

## Mock server

`mock-server/` is one typed mock shared by the dev server, the browser tests **and the
app's own demo data source**, so all three exercise the same resolvers and the same SDL
that codegen reads. **Preserve that property** - it is why a browser test, a manual
click-through and a deployed demo cannot disagree.

- `schema.graphql` - the SDL. Codegen source and served schema. Keep it small; every
  type needs a requirement behind it.
- `seed.ts` - imports the nine generated `data/*.json` files. Everything is
  imported from the workbook - there is no hand-written schedule any more (the
  GS 2099B stress semester left with the source pivot, 2026-08-11), which is why
  the mock cannot drift from the operations record or decay with the wall clock
  the way the superseded seed did. The partial-night capability is pinned by
  synthetic unit fixtures and by the component layer's mid-run boundaries.
- `store.ts` / `resolvers.ts` - read-only so far. A night is a **projection**: clip every
  record to the night's interval and report what is left. Nothing is stored per night,
  which is what makes partial nights work with no special case.
- `schema.ts` / `server.ts` / `time.ts` - the harness. `buildMockSchema(sdl)` returns an
  executable schema over a fresh store; `server.ts` is the yoga dev server.

`src/test/mockClient.ts` wires the same schema into Apollo via `SchemaLink`, and
`src/test/mockPipeline.test.ts` pins the whole loop. If that test breaks, the dev server
and the tests have diverged.

Note that SchemaLink **executes without validating**, so an invalid selection would pass
a page test unnoticed. Validate explicitly against the schema where it matters.

## GraphQL & codegen workflow

- Operations live in `src/gql/resource.ts` as `graphql(...)` tagged documents. Hooks that
  return **domain models** (not raw fragments) belong in `src/gql/hooks.ts`.
- Codegen source is `mock-server/schema.graphql`, configured in `tasks/codegen.ts`.
  Output is `src/gql/gen/` (gitignored, never hand-edit).
- **After changing any operation or the schema, run `codegen`.** `prebuild` does it on build.
- The client preset only emits types an operation selects. If a type you need is missing
  from `gen/`, the fix is an operation that selects it, not a hand-written duplicate.
- When the backend ships, point `tasks/codegen.ts` at `@gemini-hlsw/lucuma-schemas/resource`.

`@graphql-eslint` operation linting runs in `eslint.config.js` against
`mock-server/schema.graphql` (navigate-ui's `graphqlConfigForSchema` helper), on top
of codegen's own validation - an invalid selection fails both.

## Data flow

GraphQL response → **pure adapters** (`src/domain/adapters.ts`) → **UI domain models**
(`src/domain/types.ts`) → components. All null handling and timestamp parsing lives in the
adapters; components never touch generated fragment shapes.

Pure domain modules currently in place: `interval.ts`, `localDate.ts`, `siteTime.ts`,
`semester.ts`, `moon.ts`, `sun.ts`. Keep date math and chart builders pure and
unit-tested; keep components focused on rendering and interaction.

## Non-negotiables

These are the standing invariants, from what went wrong last time.

- **Never put a `date` on a block.** Intervals only. The moment a `LocalDate` becomes a
  field, partial nights turn into a retrofit. (Referred to across the code as **the
  partial-night non-negotiable**.)
- **A gap means "not recorded", never "unavailable"** (invariant **I4**). The
  workbook's empty port cells must not render as closed.
- **`ResourceUsage` is one enum** - `SCIENCE`/`ENGINEERING`/`UNAVAILABLE`. Do not split it
  into separate availability and usage fields.
- **No new schema type without a requirement behind it**: a column in the workbook, a
  line in the scheduler contract, or a request from Bryan or Andrew.
- **One capability per commit**, with its tests.

## Testing

Browser-mode Vitest (Playwright chromium). Pure functions get plain unit tests; pages get
browser tests that mount against the mock via `src/test/renderApp.tsx` and drive real
interactions with accessible queries (`getByRole`, `getByLabelText`).

- **Every control whose press, toggle or hover changes what is displayed gets a
  browser test driving the real interaction** (Dan, 2026-08-11). Test both
  directions where they exist: what must change with the control (the night
  chart's axis under the Site | UTC clock) _and_ what must not (the semester
  grid's and chart's geometry and fills across the same toggle). Guard
  "must change" assertions non-empty first, so a blanked chart cannot pass as
  merely "different". The grid-corruption bug shipped precisely because the
  toggle-to-display path had no test.
- **Anchor on fixture dates, never the wall clock.** The superseded seed was pinned to
  real August 2026 and was set to decay into an all-past demo. Where a test must involve
  "now", derive it with the same function the page uses.
- **PrimeReact overlays render into `document.body`**, outside the render container, so a
  Dropdown panel is unreachable from `renderApp` locators. Drive dropdowns through
  `src/test/helpers.ts` (`openDropdown` / `selectDropdownOption`), which clicks with
  `userEvent` and reaches the panel via `page`, scoped through `getByRole('listbox')`
  so the hidden native `<select>` mirror does not also match.
- Prefer tests driven by configuration (e.g. `SIDEBAR_MENU_SECTIONS`) over hard-coded
  lists, so adding a destination does not break unrelated guards.
- Don't assert on internal React structure; don't over-mock.

## Tailwind & PrimeReact conventions

**The chrome is Explore's theme, measured from explore-dev.lucuma.xyz (2026-08-10)** and
held as tokens in `global.css` `@theme`: the black-to-raised surface ladder, the
white-opacity text ladder, the GPP action green (`--color-gpp`, identical to Explore's),
the brand light green (`--color-gpp-accent` - the DEVELOPMENT badge and identity accents,
never an action), and Explore's info blue / secondary slate. Extend the app from these
tokens, never from a hex in a component; `shell.css` wires them into PrimeReact. Red stays
closed/unavailable, amber unknown/warning. Use PrimeReact first for controls; Tailwind for
layout and small adjustments. PrimeReact component widths sometimes beat Tailwind
utilities on equal specificity - reach for `!` when overriding them.

Prefer Tailwind utilities over CSS files except where Tailwind can't express it (complex
selectors, keyframes, third-party overrides).

## Architecture docs

`lucuma-odb/resource/docs/` is authoritative for the v1 backend domain and API, with
the v1 scope trims applied for this package: the schedule lifecycle, change log and
restrictions are out of scope here - every view reads the one published record, and
editing was descoped from v1 outright. When the two disagree, this file and the code
win for this package.

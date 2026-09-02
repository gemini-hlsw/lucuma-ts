# CLAUDE.md - resource-ui

Working guide and design record for `@gemini-hlsw/resource-ui`, the web UI for the GPP
**Resource** service. The package is unpublished and pre-v1: what is written here are live
constraints, not history. When something is removed, it leaves this file with it.

## State of the package

The v1 read surface is complete and waiting on its backend. Five destinations draw the one
record: `/night`, `/week` (seven nights on one continuous axis), `/semester`, `/instruments`
and `/components`. The About dialog names the endpoint this serving reads.

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

Five destinations draw the one record. `/semester` carries a **Chart | Calendar** toggle.

**Do not give a view its own path from records to pixels.** Every view projects from the placed rows
`domain/timeline.ts` produced, never from a `Mounting`, and both charts build on `domain/timeline.ts`
plus `features/timeline/`. A view supplies its own axis and its own way of phrasing a span - dates and
nights for the semester and week, clock times for a night - and nothing else. Adding a fourth window
should not mean copying any of it. The one deliberate exception is `domain/calendarNews.ts`, which
reads raw records because its subject is the records' own boundaries rather than placed spans.

| View              | What it draws                                                                                             | Its module                                    |
| ----------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Night             | the chart alone, deliberately bare, plus PWFS1/PWFS2/LGS subsystem rows no other view shows               | `features/night/`                             |
| Week              | the run chart, plus `WeekNightStrip` (a card per night, each one a button onto it) and `WeekChangesTable` | `domain/weekBriefing.ts`                      |
| Semester chart    | an xrange per month: how long a run lasts                                                                 | `features/semester/`                          |
| Semester calendar | night chrome plus single-evening critical-event chips                                                     | `domain/calendarNews.ts`, `calendarNights.ts` |
| `/instruments`    | a row per instrument the site's records name, expanding into its runs                                     | `domain/instrumentFinder.ts`                  |
| `/components`     | the ICTD half: the piece catalog grouped by instrument, expanding into its history                        | `domain/componentFinder.ts`                   |

Rules the code does not state for itself:

- **The calendar draws no run bars, ever** - single-evening chips only, for the critical events (an
  instrument changing on a port, the telescope closing with its reason, reopening). A window-edge
  boundary is furniture, not news. More news kinds are expected as the semester query carries them.
- **A boundary on the window's edge is not a change**, in the week's changes table or the calendar's
  news. Both read **ports only**: a shelf change is inventory, not a night's headline.
- **Subsystem rows are the night view's alone.** They carry no legend section - every span draws in the
  one quiet neutral and prints its state in words, so a colour key would key no distinction. Three
  semester-constant rows per month would bury the runs on the wide views.
- **Both finders are site-scoped, never semester-scoped** (`app/useSiteSpan.ts`). "Where is Zorro" is not
  a semester question, and a piece's history does not restart in February. The masthead's semester
  control moves the **night** these pages report for; it does not decide what they can see.
- **The two browser pages are deliberately not shared.** The shapes diverge - grouped subheaders against
  a flat list, two filters against one, different expansions - and a `FinderPage` taking a dozen props
  would hide nothing. Both open a row into `components/ui/RecordHistoryTable.tsx`, which is a plain
  `<table>` rather than a nested DataTable, keeps its columns even when empty, and puts a note in a
  column that wraps rather than a second line that truncates.
- **A night no semester covers says what is covered** (`domain/coverage.ts`), and offers the nearest
  covered night. A demo semester never merges with a real one.
- **Both quarantine boundaries are one file each** - `mock-server/storedInstruments.ts` for instruments
  GPP knows but the schedule never mounts, `components.ts` for the synthetic piece catalog. Same three
  rules: deterministic, anchored to the site's own recorded span, never deciding `dataAvailable`. Swap
  the one file when real data arrives. Stored instruments carry **no port**, which is structurally what
  keeps them off every schedule view.

Three traps in the calendar, each of which has cost real time:

- A square is the **evening** a night begins, not the night's label, or it sits a day off the grid.
- All-day event **ends are exclusive** (local midnight after the last evening) or bars draw a day short.
- The calendar's height is **inline in the component**, not in `global.css` - the browser tests do not
  load the app stylesheet, and the height decides the week-row geometry.

## Chart rows, colour and treatment

**Every schedule view heads itself with the Telescope, Mode and ToO rows** when records reach its window,
through `collectStateRows` in `domain/timeline.ts`. All of the layout below is derived from the rows
inside the shared builders - no view passes categories or header counts alongside its data.

- **State rows are monochrome and draw as a header band.** The ordinary state (Open, Queue, Standard
  ToOs) is the quiet neutral; a state worth noticing (`NOTABLE_MODE`/`NOTABLE_TOO`) the bright one.
  **Do not give a state a hue** - a new state kind joins the two neutrals or the closure red. The
  calendar draws only the notable spans; routine values every week would bury the runs.
- **One colour per instrument, keyed by the enum**, in `features/timeline/timelineOptions.ts` as
  `satisfies Record<Instrument, string>`, so a new instrument fails to compile until it has a colour.
  Colour follows the instrument, never its position in a list, and **identity never rides on colour
  alone** - every block carries its published name.
- **Red is the telescope's alone.** A shutdown is said once: the Telescope row's solid red block
  (`--schedule-closed`), a translucent `--schedule-band` wash over the subject rows, the reason printed
  once on the band, one legend key. Never per-row red painting - the ports are not each closed.
- **Absence is drawn hollow, not as a fourteenth colour** (`schedule-ghost`). What a port closure means
  for availability is still open with operations, and no view may claim a failure it cannot evidence.
- **Unknown is a reserved neutral** - zinc grey, outside the validated hue sets. Where an unknown run
  coincides with a named one, the named run wins the shared span.
- **Usability is a treatment over the identity hue, never a second palette.** Science is the plain bar;
  Engineering-use the same hue hatched; Not-available hollow with the hue on the outline and a muted
  label, distinct from the ghost and never red.
- **The legend has one section per state row**, then Instruments, then Sky and Calendar where a view
  supplies them - six, in that order, in `TimelineLegendBar`. The neutrals repeat across rows, so a
  repeated grey must be keyed under the row it belongs to. A section with no keys does not render.
- **Group headings, not axis breaks.** Small-caps "Telescope" and "Instruments" heading rows name the
  groups in the gutter and double as the band's breathing room. An axis break drops the adjacent gutter
  label out of line with its bar; heading type is sized to fit the narrowest 92px gutter.

**The palette was measured per site, not chosen.** No chart shows all fourteen hues, so the assignment is
optimised over the pairs that can actually share a chart (six subjects at GS, seven at GN). Re-run **the
two site sets, not all fourteen at once**, before changing any of them. The tokens themselves are in
`src/styles/global.css`.

## Shared pixels, page-owned words

A thing drawn in two places is drawn from one module, taking a presentation shape rather than either page's
domain row. This is the rule the whole of `components/ui/` follows; `componentCells.tsx` holds the one copy of each
component cell, so no two views can disagree about a closure.

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

- **Availability blocks are contextual values, never cache entities.** The same block type comes back
  clipped from the night projection and unclipped from the range queries (`clip: false` on every one), so a
  block is a projection onto a window rather than a record. A stable `id` lets Apollo normalize one window's
  answer onto another's and empty a scheduled night (empty chart, "no components tonight"). `ScheduleBlock`
  has no `id`; `domain/adapters.ts` makes row keys from
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

**`README.md` is the command reference** - every script, the two-terminal mock setup, codegen, the
first-time `playwright install chromium`, and why `dev` shows the failure banner. It is not repeated here.

## Where the schedule data came from

`mock-server/data/*.json` **is** the schedule source: nine semesters (GS 2024B-2026A, GN 2024B-2026B),
parsed once out of the operations workbook export (`mock-server/fixtures/telescope_schedules.xlsx`, kept
as provenance), which supersedes the published web overview sheets where they disagreed. **The reader is
not in this package** - it lives on the `resource/workbook-importer` branch. Revive that branch if an
Excel import is ever needed; edit the JSON if the mock's data has to change.

Four reading decisions that the JSON cannot show you, each of which was a judgment call:

- **A row is an evening**, not an observing night ("Local Date" is the evening a night begins; the night
  is evening + 1). Semester split follows the evenings: Feb-Jul is A, Aug-Jan is B.
- **Open is a fact, not a gap.** The sheet states Open and Closed alike. "Shutdown" is a closure's reason
  only when Mode/Program names it; a night closed under an operating mode gets none and its **mode stays
  unrecorded**.
- **A blank `ToOs` column is served as Standard support**, wearing the assumption as the record's note.
  It is blank on every night of the current export. Defaulting it to "None" read as a recorded
  prohibition, and that was the bug.
- **The OIWFS columns were deliberately not imported** - an OIWFS is an instrument _component_, so
  importing them would cross the synthetic-component quarantine. GN's single trailing 2027A evening is an
  export artifact and is also dropped. An unrecognised port name becomes an UNKNOWN block, never a silent
  drop.

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
- **Treat port 4000 as untrusted at session start.** A mock server from an old session can outlive it and
  serve a schema that no longer exists - this has caused confusion three times. Check with
  `lsof -nP -iTCP:4000 -sTCP:LISTEN` and restart through the pnpm script, which runs `codegen` first. Two
  routes get past that hook and re-serve the previous schema: invoking `node ./mock-server/server.ts`
  directly, and editing the SDL while `--watch` is already running, which restarts the process without
  re-running the hook. Run `codegen` by hand in either case.

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
- When the backend ships, point `tasks/codegen.ts` at `@gemini-hlsw/lucuma-odb-schemas/resource`.
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

**The API contract half of these lives in `ENDPOINTS.md`** ("Contracts the resolvers must keep"): half-open
intervals, a block as a value rather than an entity, partial nights as first-class, I4 absence, clipping,
`ResourceUsage` as one enum, and `location` as one total `place` with an optional `port`. Read it before
changing the schema. What follows is the half that is this app's, plus the rules with no other home.

- **Never put a `date` on a block.** Intervals only. The moment a `LocalDate` becomes a field, partial
  nights turn into a retrofit. (Referred to across the code as **the partial-night non-negotiable**.)
- **A gap means "not recorded", never "unavailable"** (invariant **I4**). Empty port cells must not render
  as closed, and **empty calendar squares stay empty**. Do not decorate a gap to make a month look
  finished.
- **`toLocation` in `domain/adapters.ts` is the only place the app re-checks the `place`/`port` pairing**,
  and a contradictory record reads as off-port/`UNKNOWN` with a dev-mode warning, never an error, because
  one bad record must not empty a night. Do not build a location literal at a call site, and do not push
  the pair past the adapter: the domain model carries the exclusive form (`Mounting.port` xor
  `Mounting.place`, whose type `OffPortPlace` excludes `PORT`).
- **A record's port is its row; there is no row label.** `domain/ports.ts` renders the label from the port
  - do not reintroduce a display string the model can derive. The row set is `TELESCOPE_PORTS` unioned
    with any port the records name, so a quiet port keeps its blank row (blank says "nothing recorded"; a
    missing row would say the port does not exist) and a record on an unexpected port still draws.
- **A block has no `id`**; row keys are the adapters'. `InstrumentComponent` keeps its id, being real
  hardware. The cache lock that enforces this is under "Gotchas" below.
- **No new schema type without a requirement behind it**: a column in the workbook, a line in the
  scheduler contract, or a request from Bryan or Andrew.
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

**The masthead has a measured width budget.** Check it before adding an item to the bar:

| Width             | What happens                                                                                                                                        |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **831px**         | The bar stops fitting: 133.7 wordmark + 137.2 badge + 503.1 right group + 31.2 gaps + 26 padding. Nothing wraps; the items' contents break instead. |
| **848px (53rem)** | The three control captions are visually hidden, buying 112.3px back. A media query's rem is the initial 16px, not the 13px root.                    |
| **~693px**        | The floor, where the menu button starts clipping. The shell is `overflow-x: hidden`, so nothing past it is reachable.                               |

## Architecture docs

`lucuma-odb/resource/docs/` is authoritative for the v1 backend domain and API, with the v1 scope trims applied
here: the schedule lifecycle, change log and restrictions are out of scope - every view reads the one published
record, and editing was descoped from v1. When the two disagree, this file and the code win for this package.

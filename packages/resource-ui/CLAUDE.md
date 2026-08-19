# CLAUDE.md - resource-ui

Guidance for working in `@gemini-hlsw/resource-ui`, the web UI for the GPP **Resource**
service.

This file is the working guide **and** the design record for the package: what
Resource is, the decisions that shaped it, and how to work in the code. The earlier
planning documents (PLAN.md, NEED-CLARIFICATION.md, VALIDATION.md) were retired on
2026-08-11 as outdated; what still holds from them lives here and in the git history.

## State of the package

**The v1 surface is complete (2026-08-10) and waiting on its backend.** Five
destinations draw the one record: `/night` as a single night, `/week` as seven
nights on one continuous axis, `/semester`, `/instruments` and `/components` (the
two inventory browsers). The sidebar names the endpoint on every page. The raw API
browser that once lived at `/api` was removed at Dan's direction (2026-08-11) -
GraphiQL against the mock server on :4000 is the way to inspect the contract.

**The schedule the views were built against** is the operations workbook export
(`mock-server/fixtures/telescope_schedules.xlsx`, pivot 2026-08-11): nine semesters
(GS 2024B-2026A, GN 2024B-2026B), both sites organised by ports, with telescope
mode and ToO support riding along. It lives in `mock-server/data/*.json` and is
what the browser tests and the :4000 server serve - **not** something the app can
read (see below).

**The app reads one backend: the live Resource service** at `/resource/graphql`.
It does not serve the v1 API yet, so every view is empty behind an amber banner
naming the situation (`src/gql/liveStatus.ts`, `LiveFailureBanner`) until the
Scala service ships. That is the expected state of this branch, in development
and deployed alike.

**There is no demo data source, and no way to select one** (2026-08-14, Hugo's
review). The app used to carry the mock schema and execute it in the browser
over Apollo `SchemaLink`, chosen from a masthead Data control. That put
graphql-yoga, an executable schema and the SDL - 245 kB of server-side code -
into a frontend bundle. Two lighter-touch versions were tried and both rejected
in favour of removing it outright: gating on `import.meta.env.DEV`, and loading
it as a lazy chunk. **Do not reintroduce it.** If the app is ever given a data
source before the backend serves v1, it has to be something it reaches over
HTTP - the shape `pnpm dev:mock-server` already has on :4000 - and never a
schema executed in the client. Wiring that up would be a change to
`src/gql/ApolloConfigs.ts`, and nobody has asked for it.

`mock-server/` itself stays, and is untouched by this: it is what the browser
tests execute against, what codegen reads, and what :4000 serves.

**The dev server can be pointed at it, and that is the whole of the mechanism**
(2026-08-19): `RESOURCE_API=mock`, or `pnpm dev:mock`, switches the vite proxy's
target to :4000. It is the shape the rule above asks for - the app reaches a
server over HTTP - and it needed no change to `ApolloConfigs.ts` after all,
because the app already makes one request to one path and does not care which
process answers. There is still no control, no second link and no schema in the
bundle, and the live service is still the default. What is switchable is the dev
server's proxy, never the app.

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

**The week view carries a briefing under its chart**, because seven nights of a
whole-night-granular schedule that changes twice a month are usually seven identical
columns - the chart shows the runs, and what makes one week different from the next
is the sky and the changes. Both come from `domain/weekBriefing.ts`, pure and
unit-tested like every other projection, and `features/week/WeekBriefing.tsx` draws
them in two plain standard pieces (`app/pages/WeekPage.tsx` renders both):

- **`WeekNightStrip`** - one card per night: the evening's weekday label, the moon
  disc and its percentage, hours of astronomical dark, and tags for a published
  new/full moon, a holiday, and a night with nothing recorded. Every card **is** a
  button onto its night view, because every night-shaped thing opens its night view.
  `summarizeWeek` folds the same facts into the page subtitle (dark hours, moon at
  each end).
- **`WeekChangesTable`** - "Changes this week": When / What / Where, one row per
  block boundary falling **inside** the window. A boundary exactly on the window's
  edge is not a change, since a run that began last week merely continues. The kinds
  are a run beginning or ending, a closure beginning or ending, and a component
  moving. When nothing changes it says so ("every run carries straight through")
  rather than drawing an empty table.

Like the calendar's news, the changes read **ports only** (`buildWeekChanges` skips a
mounting with a null port): a shelf change is inventory, not a night's headline, and
the instrument browser is where an off-port run is legible.

**A night no semester covers says what is covered** (`domain/coverage.ts`). A dead end
that only says "no schedule covers this night" leaves the reader guessing and typing
dates until one lands, so `coverageRanges` merges the site's published semesters into
contiguous spans for the message and `nearestCoveredNight` offers the way back;
a demo semester never merges with a real one, so a synthetic range stays its own
entry and can be labelled as such. `app/useSemester.ts` reads the same module's
`resolveSemester`.

Two gotchas that cost real debugging, both fixed structurally - do not undo them:

- **Availability blocks are contextual values, never cache entities.** Every query
  clips its blocks to the asked interval, so a block is a projection onto a window
  rather than a thing - and blocks carried a stable `id` on which Apollo normalized,
  which let one night's response overwrite another's intervals (empty chart, "no
  components tonight" on a scheduled night). `ScheduleBlock` no longer has an `id`
  at all (2026-08-14, Hugo's review); `domain/adapters.ts` makes the row keys the
  views need, from response position. `src/gql/cache.ts` still sets
  `keyFields: false` on every implementor as the second lock, and `cache.test.ts`
  reads the SDL so a new implementor cannot quietly miss the list.
  `InstrumentComponent` keeps its id and stays normalized, being identity-only.
- **`TimelineChart` keys its Highcharts chart by the axis window.** Highcharts 12
  answers an update that swaps axis extremes and xrange data together with an empty
  series; a window change is therefore a fresh chart, while same-window updates
  (data arriving, the "now" marker) update in place.

**A port closure draws as an absence, in every view.** Every no-instrument block
derives from a closure record, but what a port closure means for availability is
still open with operations, so no view claims a failure it cannot evidence: the
hollow "nothing scheduled" ghost everywhere (`schedule-ghost` in
`features/timeline/timelineOptions.ts`). The night view had a per-view opt-in to
the closure red on top of this - `unscheduledAs: 'closure'` - and it went with
that machinery; red is the telescope's alone (see the shutdown rule below).

**The night view is where partial nights are visible.** The workbook is
whole-night granular, so no served night splits a row and the chart's tests are
synthetic on purpose - they pin the partial-night capability the non-negotiables
protect, not the current data.

**The night view is the chart alone** (Dan, 2026-08-12). It carried a components
table under the chart - every piece riding tonight, with the mid-night boundary
of the synthetic R400 failure named at its clock time. It was removed because it
did not help a reader of the night: the pieces are the component browser's
subject, and the one thing the table demonstrated - a boundary inside a night -
the chart's own synthetic tests already pin. The view is deliberately bare for
now and expected to gain things back. `NightSchedule` therefore stops
selecting the projection's `components`; the field stays in the schema, since it
is the scheduler's. If a night-scoped table returns, build its rows through
`componentFinder` as that one did - do not give a view its own path from blocks
to rows.

**The night view alone adds the subsystem rows** (2026-08-12): PWFS1, PWFS2 and
LGS beneath the state rows, monochrome in the same usage words a mounted span
uses. They get **no legend section of their own**, deliberately: every subsystem
span draws in the one quiet neutral and prints its state in words, so a colour
key there would key no distinction, and the gutter label already names the row
(the reason is recorded beside the extras in `timelineOptions.ts`). The wide
views stay without the rows entirely - three semester-constant rows per month
would bury the runs, the same reason the calendar draws no routine bars.

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
legend is sectioned**, each section labelled, so the vocabularies never read as
one line of colours (Dan, 2026-08-11), and a section a window has no keys for
does not render (`TimelineLegendBar` in `features/timeline/TimelineChart.tsx`,
fed by the `*LegendExtras` helpers in `timelineOptions.ts`). The sections
themselves are listed once, with the shutdown rule below.
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
belongs to (Dan, 2026-08-11). Two further sections follow those wherever a view
supplies keys for them, keying chrome rather than a row's vocabulary: **Sky**
(the daylight and twilight washes) and **Calendar** (weekends, the now marker,
un-entered nights). Six sections in all, in that order, in `TimelineLegendBar`.

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

**Unknown is a reserved neutral, like the closure red.** A run the schedule names
that the instrument list does not is served as `Instrument.UNKNOWN` and draws zinc grey, labelled "Unknown",
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
- **Unidentified runs.** A workbook name the instrument list does not hold is
  served as `UNKNOWN` with its text in `note` - a lookup question, not an error.
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
its runs, which is where the workbook's Not Available windows become legible.
An instrument with
no record on the chosen night reads "Not recorded" - never carried forward from
the last night that had one. The **Location filter** groups by the same phrasing
the Where cell prints (`locationLabel`, so the two cannot drift), offering only
the locations the rows actually hold, counted, from the telescope outwards.

**Instruments GPP knows but the schedule never mounts** are served from
`mock-server/storedInstruments.ts` (2026-08-12), a second **quarantine
boundary** alongside `components.ts` and under the same three rules -
deterministic, anchored to the site's own recorded span, never deciding
`dataAvailable`. Resource's `Instrument` names eighteen (plus `UNKNOWN`) and the
workbook mounts eleven of them on ports, so the acquisition cameras, GPI, NIRI and
SCORPIO would otherwise be invisible - which is what this layer answers for.
`ENGINEERING`, `GSAOI` and `IQUEYE` are named by the enum and served by neither
layer; they are in the palette against the day a record names one. **Site is fixed per instrument** (an instrument does not
move between telescopes; AcqCam appears at both under one tag exactly as GMOS
does) and **location is what moves** - summit lab to dome floor and back. These
records carry **no port**, which is structurally what keeps them out of every
schedule view, and the calendar's news and the week's changes read **ports
only** for the same reason: a shelf change is inventory, not a night's headline.
Their hues sit outside the two measured site sets deliberately, since they never
draw a bar; if one is ever scheduled, re-run that site's separation check. It exists because the schedule views draw ports only, so an
instrument recorded usable between mounts has no row there. It is deliberately
the component browser's twin in shape (one DataTable, the night from the URL,
client-side search) so the two read as one tool. `domain/instrumentFinder.ts`mirrors`componentFinder` - same night-not-instant reading, same
last-record-decides, same honest absence.

**`/components` is the ICTD half**: a finder DataTable over the
component catalog, grouped by instrument under subheaders (colour swatch, piece
count, how many are on the telescope tonight), with filter dropdowns whose options
carry their counts. Status speaks operations, not the enum: Science / Engineering /
a muted "Spare" for a stored piece with nothing wrong / red "Unavailable", with the
record's own words beside it in the Note column - derived once in
`componentLabels.componentStatus` and worn by the browser row and the row's own
history alike, so the two cannot answer one record differently.
The catalog carries **real identities**
(lucuma-core enum tags and G-numbers; honest hand-written codes where no enum
exists) but its blocks are **synthetic** - `mock-server/components.ts` is the
quarantine boundary; swap that one file when real data arrives, and never let the
synthetic layer decide `dataAvailable`. A piece's place is `INSTALLED` or a storage
location, never a port - INSTALLED resolves through the instrument's own mounting
records (`domain/componentFinder.ts`).

**Both finders are site-scoped, never semester-scoped** (Dan, 2026-08-12), via
`app/useSiteSpan.ts`: they query the site's whole recorded span. "Where is
Zorro" is not a semester question - Zorro sits out GS 2025B and `Alopeke sits
out two GN semesters, so a semester-scoped browser answers with silence - and a
piece's history does not restart in February either: the R400's failures ran
nine records across the site's record, of which a 2025B scope showed one, with
nothing on screen saying it had been cut. The instrument browser always worked
this way; the component browser was brought into line. The masthead's semester
control still moves the **night** these pages report for, which is why it stays
on them; it just no longer decides what they can see. The instruments table's
run column is headed **"Dates"**, echoing the expansion's own first column -
the row is one line of that list ("This run" read as a different kind of thing).

**Both finders open a row into the same table** (2026-08-12):
`components/ui/RecordHistoryTable.tsx` - Dates, Nights, where, Status, Note, one
line per record. It replaced a ragged list where a reader had to infer from
position that "Summit lab" was a place and "Science" a status. It is a plain
`<table>`, not a nested DataTable: this is presentation, not a control, and
PrimeReact's header fill, stripes and hover would compete with the table it
hangs inside instead of reading as one of its rows. Four rules, all from Dan:

- **It reads as the row it hangs under, continued.** Full width and responsive,
  with the note taking the slack so the fixed columns stay put; indented
  `pl-12` - the expander column's 2.5rem plus a cell's 0.5rem - so its first
  cell starts exactly under the name; and wearing that row's own background,
  which needed a `shell.css` rule because the theme fills every expansion with
  the plain row surface and it came out a lighter band under a striped row.
- **Status is words, not badges.** A badge earns its ink in a finder row, where
  there is one of it; ten stacked under one row is a column of shouting pills.
  Colour marks only the state worth noticing - red for out of service, the red
  the schedule reserves. `components/ui/StatusTag.tsx` holds both facets of a
  status (`severity` for the row's badge, `tone` for the words) so one
  derivation drives both and they cannot drift.
- **A note is a column, never a second line under the status** (Dan,
  2026-08-12) - on the browsers and their expansions alike
  (`components/ui/NoteCell.tsx`). Under the badge it began at a
  different x on every row and no heading said what it was. It is the last
  column everywhere, so it takes the table's slack, and it **wraps** rather
  than truncating or scrolling: a clipped note reads as the whole note, and a
  cell that scrolls sideways hides its tail the same way while being harder to
  work. A row two lines tall costs nothing.
- **The columns never move**, even when nothing fills them: a Note column that
  came and went made two expansions on one page disagree about what the third
  column meant. An empty cell is the honest answer.
- **It says what the record cannot say alone**, from what the one query already
  returns - never a second round trip. A component block says INSTALLED and
  never a port, so the history resolves it through the same mountings the row
  uses (`componentFinder.whereOf`, over the block's own span); and every span
  carries its length in nights (`siteTime.nightCount`, counted over evening
  dates because a night is not a fixed number of hours).

Each page maps its own records onto `HistoryRow` and keeps its own vocabulary -
the shape is shared, the words belong to the subject.

**Shared pixels, page-owned words** (2026-08-12). That is the rule the whole of
`components/ui/` follows, and it is worth stating because the alternative had
already happened twice: `componentCells.tsx` exists because a second copy of
`whereLabel` let the grid and the chart disagree about closures, and the
instrument browser then grew its own hand-rolled copy of the component Where
cell one directory over - the same three dots and the same warning tag, free to
drift apart. So a thing drawn in two places is drawn from one module, taking a
presentation shape rather than either page's domain row:

- **`WhereCell`** takes a `WhereReading` - a coarse presence (on the telescope /
  off it / not recorded), the place in words, and what the change tag says.
  `componentLabels.componentWhere` and `InstrumentsPage.instrumentWhere` are the
  two mappings onto it, one line each.
- **`PageHeader`** is every destination's title, synthetic flag, subtitle and
  right-hand controls slot. **`PageStatus`** holds the three states a page shows
  instead of content: `ErrorAlert` (the reserved red, `role="alert"`, the
  error's own message verbatim), `Loading`, and `EmptyPanel` - never red and
  never a warning, because a gap means "not recorded" (I4). Three components
  rather than one that decides between them: the night view alone has three
  distinct empty states and one carries a button.
- **`NightStepper`** is the Tonight / arrows / date toolbar the night and week
  views share. It owns the chrome, the aria labels and the cleared-input guard;
  the page owns the date vocabulary, since only it knows whether the input shows
  a night's label or the evening a week begins.
- **`LabelledControl`** binds a caption to its control by id - a render prop, so
  the caller decides which prop carries the id (`id` on an input, `inputId` on a
  PrimeReact Dropdown). It does **not** wrap the control: implicit labelling only
  reaches a labelable element, and a label wrapping a Dropdown both named nothing
  and swallowed the control's own words into the name ("Instrument All All").
  **`FilterField`** is the finder bar's layout over it; the masthead uses it
  directly. The caption is then the control's only name - no call site repeats it
  as an `aria-label`. `filterOptions.countedOption` is the "(12)" suffix every
  filter dropdown carries. **`InstrumentSwatch`** (in `features/timeline/`, beside the palette
  it reads) is the colour square plus name, so colour-follows-the-instrument
  holds outside the charts too.
- **`siteTime.eveningLabel`/`eveningRange`** are the one evening formatter.
  There were five, and five formatters is five chances for one view to print
  "19 Nov 2026" where its neighbour prints "19 Nov". The style is a parameter
  (`dayMonth`, `dayMonthYear`, `weekdayDayMonth`) because that choice is about
  what the page around it already says, never about what the date means.

What is deliberately **not** shared is the two browser pages themselves. They
read as twins, but the shapes diverge - grouped-by-instrument subheaders against
a flat list, two filters against one, different expansions - and a `FinderPage`
taking a dozen props would hide nothing.

## Not doing yet

Wanted-but-unbuilt, carried over from the 2026-08-10 walkthrough punch list, which
was retired with `TODO.md` on 2026-08-19 - it had not been touched since
2026-08-12 and held nothing this list does not. Each item is still open; none is
scheduled. Anything built here needs a reason recorded beside it, the same as any
other capability.

- **A visible "List" as a fourth view toggle.** The block table already exists as
  the accessible reading of every chart, so exposing it is nearly free - but it
  adds a mode, and the semester toggle is chart / grid / calendar today.
- **A retry affordance on the load-error banner**, which is message-only.
- **A components table on the night view.** It had one, removed on 2026-08-12 as
  not helping a reader of the night. If it returns it should answer a question
  `/components` cannot.
- **"Jump to current month"** in the calendar, when the viewed semester holds today.

## Commands

```bash
pnpm --filter @gemini-hlsw/resource-ui dev            # vite dev server (proxies /resource/graphql → the real dev service)
pnpm --filter @gemini-hlsw/resource-ui dev:mock       # the same, proxied to the mock on :4000 (RESOURCE_API=mock)
pnpm --filter @gemini-hlsw/resource-ui dev:mock-server# mock GraphQL server on :4000 (predev:mock-server runs codegen)
pnpm --filter @gemini-hlsw/resource-ui codegen        # regenerate src/gql/gen: typed operations + the SDL the mock serves
pnpm --filter @gemini-hlsw/resource-ui test           # vitest - runs in a real browser (Playwright chromium)
pnpm --filter @gemini-hlsw/resource-ui build          # tsc -b && vite build (prebuild runs codegen)
pnpm --filter @gemini-hlsw/resource-ui lint:eslint
```

There is **no** `test:browser` script - `test` already runs in the browser. First-time
browser tests need `pnpm --filter @gemini-hlsw/resource-ui exec playwright install chromium`.

`dev` reads the live Resource service - the vite proxy carries `/resource/graphql` to
the dev deployment purely to sidestep CORS - so **until the Scala backend serves v1 it
shows the failure banner and no data**. That is deliberate (2026-08-14): the app has one
backend, and standing something else in for it in development is how a frontend ends up
shipping a server. `dev:mock-server` hosts the mock over HTTP at :4000 for GraphiQL and
for external consumers trying the API; it is where to look at what the contract answers,
and the browser tests are where the views are exercised against it.

**Treat port 4000 as untrusted at session start.** A mock server from an old session can
outlive it and serve a schema that no longer exists - this has caused confusion three
times now. Check with `lsof -nP -iTCP:4000 -sTCP:LISTEN` and restart via the pnpm script.
It serves the generated `src/gql/gen/schema.graphql`, so **the artifact has to exist
and has to be current**. Starting through the pnpm script guarantees both:
`predev:mock-server` runs `codegen` first. Two routes get past that hook and re-serve the
previous schema - invoking `node ./mock-server/server.ts` directly, and editing the SDL
while `--watch` is already running, since `--watch` restarts the process without re-running
the hook. Run `codegen` by hand in either case.

## Where the schedule data came from

`mock-server/data/*.json` **is** the schedule source. It was parsed once out of the
operations workbook export (`mock-server/fixtures/telescope_schedules.xlsx`, kept
beside it as provenance). The published web overview sheets this package used to
fetch and parse are gone - the workbook is the operations team's own record and
supersedes them where they disagreed (the 2026-08-09 validation pass found several
such runs, and the workbook flatly omits some published visits).

**The reader is no longer in this package** (2026-08-14, Hugo's review): operations
will not send another export, so an unmaintained spreadsheet dependency bought
nothing. It lives on the `resource/workbook-importer` branch - `workbook.ts` pure and
unit-tested, `importWorkbook.ts` the only part touching disk (ExcelJS). Revive that
branch if an Excel import is ever needed again; edit the JSON if the mock's data has
to change. `mock-server/records.ts` holds the record types either way, and they take
their vocabularies from the schema's own enums.

What the JSON holds, and how the workbook was read into it:

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
- **Off-port usability is recorded** (2026-08-12): an instrument the workbook
  marks usable with no port recorded - the `Alopeke and Zorro visitor runs
  between mounts - becomes a mounting with no port, location UNKNOWN, because
  the workbook never says where an unmounted instrument physically is. The null
  port is what keeps it off every chart: the schedule views are the ports'
  picture, and the instrument browser is where an off-port run is legible (Dan,
  2026-08-12).
- **PWFS1, PWFS2 and the LGS column become subsystem records** (2026-08-12).
  The LGS Yes/No is the laser available for science or not - both recorded
  facts, and GS records "No" every night rather than a gap.
- **Deliberately not imported**, each warned about at the time: the OIWFS columns (an
  OIWFS is an instrument _component_, and the component layer stays synthetic
  until real ICTD data arrives - importing these would cross that quarantine),
  and GN's single trailing 2027A evening (an export artifact). An unrecognised
  port name becomes an UNKNOWN block, never a silent drop.
- The workbook carries no colours, holidays or moon dates: legends key the enum
  palette, the calendar computes its moon, and no holiday chrome appears.

## Mock server

`mock-server/` is one typed mock shared by the :4000 dev server and the browser tests,
both exercising the same resolvers and, since 2026-08-19, literally the same file of
SDL - codegen's expansion of the schema it also generates the client types from.
**Preserve that property** - it is why a browser test and a GraphiQL click-through
cannot disagree. The app itself is no longer a consumer (see "no demo data source"
above).

- `schema.graphql` - the SDL, and the source codegen reads. Keep it small; every
  type needs a requirement behind it. Its ODB scalars come in through
  `#import ... from "@gemini-hlsw/lucuma-odb-schemas/odb"` rather than being restated
  (2026-08-14, Hugo's review), the way `packages/configs`' schema files take theirs.
  **The `#import` line has to be the file's first content** - the loader only looks
  for imports when the SDL _starts_ with one, and a header comment above it silently
  turns every type below into an unknown type (`schemaArtifact.test.ts` catches that).
- `src/gql/gen/schema.graphql` - the same SDL with those imports resolved, written by
  codegen and read by every consumer: the :4000 server off disk, and the tests with
  `?raw`. **One file and no second copy** is the property worth protecting, which is
  why no count of readers is kept here - the count was load-bearing for nothing and
  went stale as soon as a test was added. Generated, gitignored, never
  hand-edited. It sits with the typed operations rather than under `mock-server/`
  because generated code lives under `src/*/gen/` in every package here, and a
  package-specific convention costs an ignore line in every tool's config
  (moved 2026-08-19). `#import` is @graphql-tools' rather than GraphQL's - GraphQL reads it
  as a comment - so a raw read of the source builds a schema whose `Timestamp` is
  undefined; codegen already resolves it to generate the client types, so it writes
  the expansion back out instead of the package resolving imports a second time at
  runtime (2026-08-19). That is what `packages/configs` does with
  `typeDefs.generated.ts`, and it is why this package declares no @graphql-tools
  dependency. The one thing to know about the artifact: **it is only as fresh as the
  last `codegen` run**, so a schema edit that has not been through codegen is a mock
  server serving the previous schema. Hence `predev:mock-server` in `package.json`,
  on the precedent `prebuild` already set for the same generated-artifact dependency:
  a missing artifact failed loudly on its own (`ENOENT` naming the path), but a stale
  one started successfully and answered from the old schema, silently, which is the
  failure port 4000 has already cost this package repeatedly. The hook couples
  starting the server to codegen, so an invalid document anywhere in `src/gql/` now
  fails `pnpm dev:mock-server`; that price was accepted deliberately, a failure naming
  the broken document being strictly better than a server answering from last week's
  schema.
- `seed.ts` - imports the nine generated `data/*.json` files. Everything is
  imported from the workbook - there is no hand-written schedule any more (the
  GS 2099B stress semester left with the source pivot, 2026-08-11), which is why
  the mock cannot drift from the operations record or decay with the wall clock
  the way the superseded seed did. The partial-night capability is pinned by
  synthetic unit fixtures and by the component layer's mid-run boundaries.
- `store.ts` / `resolvers.ts` - read-only so far. A night is a **projection**: clip every
  record to the night's interval and report what is left. Nothing is stored per night,
  which is what makes partial nights work with no special case.
- `records.ts` - the record types `data/*.json` holds, taking their vocabularies from
  the schema's own enums (`Instrument`, `ResourceUsage`, `Partner`, …) rather than
  restating them, so a value the SDL renames is a compile error here.
- `schema.ts` / `server.ts` / `time.ts` - the harness. `buildMockSchema(sdl)` returns an
  executable schema over a fresh store; `server.ts` is the yoga dev server.

**The dependency between the two directories runs one way: `mock-server/` reads from
`src/gql/gen/`, and nothing in `src/` imports from `mock-server/` outside the tests.**
It reaches for two generated things - the schema's enums, type-only, in `records.ts`;
and the SDL as a value, which `resolvers.test.ts` and `schemaArtifact.test.ts` import
and `server.ts` reads off disk by path. The cost is what it always was and is the part
worth keeping in mind: **`mock-server/` neither typechecks nor starts until `codegen`
has run.** This rule used to be phrased as "the one place `mock-server/` reaches into
`src/`, type-only"; that stopped being true on 2026-08-19, when the SDL artifact moved
from `mock-server/gen/` to `src/gql/gen/`. The direction and the codegen dependency are
what the old phrasing was actually protecting, and both still hold.

`src/test/mockClient.ts` wires the same schema into Apollo via `SchemaLink`, and
`src/test/mockPipeline.test.ts` pins the whole loop. If that test breaks, the dev server
and the tests have diverged.

Note that SchemaLink **executes without validating**, so an invalid selection would pass
a page test unnoticed. Validate explicitly against the schema where it matters.

## GraphQL & codegen workflow

- Operations live in `src/gql/resource.ts` as `graphql(...)` tagged documents. Hooks that
  return **domain models** (not raw fragments) belong in `src/gql/hooks.ts`.
  `src/gql/ApolloConfigs.ts` is the client setup.
- Codegen source is `mock-server/schema.graphql`, configured in `tasks/codegen.ts`.
  It writes two outputs into `src/gql/gen/`, both gitignored and never hand-edited:
  the typed operations, and `schema.graphql` (the SDL with its `#import`s resolved,
  which is what the mock serves). Nothing resolves imports at runtime.
  `tasks/printSchemaPlugin.ts` is the one-line plugin that prints the second one -
  named by path, not as `schema-ast`, because the codegen CLI resolves a named plugin
  from its own install directory and in this workspace that lands on the copy built
  against graphql 17, whose type predicates answer false for this package's graphql 16
  objects (`Unknown type BigDecimal.`, 2026-08-19).
- **After changing any operation or the schema, run `codegen`.** `prebuild` does it on build.
- The client preset only emits types an operation selects. If a type you need is missing
  from `gen/`, the fix is an operation that selects it, not a hand-written duplicate.
- When the backend ships, point `tasks/codegen.ts` at `@gemini-hlsw/lucuma-schemas/resource`.

`@graphql-eslint` operation linting runs in `eslint.config.js` against
`mock-server/schema.graphql`, on top of codegen's own validation - an invalid
selection fails both, and both resolve the SDL's `#import`s through their own
loaders. `require-selections` there asks for an `id` wherever a type has one,
which is why `InstrumentComponent` selections carry it and blocks - which have no
id - are unaffected.

That config globs `./src/gql/**/*.graphql`, which since 2026-08-19 also contains
the generated SDL, and those rules read a `.graphql` file as **operations**: run
them over a schema and every type in it fails `executable-definitions`. What keeps
the two apart is the `src/*/gen` entry in `eslint.config.shared.js`'s
`globalIgnores`, the same pre-existing glob that covers the artifact for git and
Prettier. It is load-bearing - narrowing it turns the generated schema into forty
lint errors that say nothing about the code.

## Data flow

GraphQL response → **pure adapters** (`src/domain/adapters.ts`) → **UI domain models**
(`src/domain/types.ts`) → components. All null handling and timestamp parsing lives in the
adapters; components never touch generated fragment shapes.

`src/domain/` is where the pure modules live - date, interval and semester math, the
sky (`moon.ts`, `sun.ts`), the timeline and calendar projections, the two finders, the
week briefing - each with its own unit tests beside it. Read the directory rather than
a list here: the list this replaced named six of twenty. Keep date math and chart
builders pure and unit-tested; keep components focused on rendering and interaction.

## Non-negotiables

These are the standing invariants, from what went wrong last time.

- **Never put a `date` on a block.** Intervals only. The moment a `LocalDate` becomes a
  field, partial nights turn into a retrofit. (Referred to across the code as **the
  partial-night non-negotiable**.)
- **Every interval this API serves is half-open**, `start` inclusive and `end`
  exclusive - including a semester's `nights: DateInterval!`, which is why it is not a
  `firstNight`/`lastNight` pair. A _last_ night reads inclusive while
  `DateIntervalInput.end` is exclusive, so the obvious `telescopeNights` call came back
  one night short and nothing said so (2026-08-14, Hugo's review). The domain model
  reads a semester inclusively, and `toPublishedSemesters` is the one line where the
  two meet.
- **A block has no `id`.** Every query clips its records to the window asked for, so a
  block is a projection rather than an entity, and an id on one invites exactly the
  cache bug this app shipped. Row keys are the adapters' (`domain/adapters.ts`).
  `InstrumentComponent` keeps its id, being real hardware.
- **`InstrumentLocation` is one type**, `place: InstrumentPlace!` with an optional
  `port` (Dan, 2026-08-17, reversing the union of 2026-08-14). `place` includes `PORT`
  and is total, so one field answers "where is this" for a port and a shelf alike and a
  client needs no fragment. **The schema cannot enforce the pairing, so the server owes
  it**: `port` is non-null exactly when `place` is `PORT`, and explicitly null
  otherwise. `mock-server/resolvers.ts`'s `instrumentLocation` is the only place a
  location value is built, and `domain/adapters.ts`'s `toLocation` is the only place the
  app re-checks it - a contradictory record reads as off-port/`UNKNOWN` with a dev-mode
  warning naming it, never as an error, because one bad record must not empty a night.
  Do not build a location literal at a call site, and do not push the `place`/`port`
  pair past the adapter: the domain model carries the exclusive pair (`Mounting.port`
  xor `Mounting.place`, whose type `OffPortPlace` excludes `PORT`) so nothing downstream
  can hold both.
- **A gap means "not recorded", never "unavailable"** (invariant **I4**). The
  workbook's empty port cells must not render as closed, and **empty calendar
  squares stay empty** - the not-recorded/closed distinction is load-bearing, so
  do not decorate a gap to make the month look finished.
- **`ResourceUsage` is one enum** - `SCIENCE`/`ENGINEERING`/`UNAVAILABLE`. Do not split it
  into separate availability and usage fields.
- **Types the ODB already defines are imported, never restated** - the scalars,
  `TimestampInterval`, `TimeSpan`, `Site`, `Partner`. `Instrument` is the deliberate
  exception: the schedules mount things the ODB's enum does not name, and reconciling
  the two is still open with operations.
- **A record's port is its row; there is no row label** (Dan, 2026-08-12). The schedule
  views draw the telescope's ports, so a location's `port` alone says which row
  a record belongs to and `domain/ports.ts` renders the label. The API carried a `rowLabel` on
  every block and a `rowLabels` list on every semester until both were removed as
  restatements of the port - the timeline was regex-parsing "Port 3" back into a
  number. Do not reintroduce a display string the model can derive. The row set is
  `TELESCOPE_PORTS` (five, a fact about the instrument support structure) unioned with
  any port the records name, so a quiet port keeps its blank row - blank says "nothing
  recorded" (I4), while a missing row would say the port does not exist - and a record
  on an unexpected port still draws instead of vanishing.
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
- **The tests load no app stylesheet** (2026-08-14, Hugo's review): a test that needs
  styling to pass is testing the stylesheet. The one exception is
  `styles/chartOverlays.css`, which is behaviour rather than appearance - a Highcharts
  overlay that catches the pointer swallows the hover under it - and the single test
  that asserts that imports it for itself.
- **The URL hooks in `src/app/` are driven through the URL**, not through
  `renderHook`: `test/probe.tsx` renders a hook inside the real router, prints what a
  test asserts on and offers buttons standing in for the app's controls, and the
  assertion is on the resulting URL. One `Probe` per route, though - two routes
  rendering it at the same position let React reuse the fiber, and two `use` bodies
  with different hook counts is a hook-order violation.
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

**Density is one number.** The root font size is 13px (`shell.css`), matched against
Explore at both widths; everything is sized in rem, so that one value trades density
for roominess without touching a layout. It is settled - re-measure against Explore
before changing it.

**The masthead has a measured width budget**, and its arithmetic is in `shell.css`
beside `.xp-masthead-right`. Check it there before adding an item to the bar:

- **831px** is where the bar stops fitting - 133.7 wordmark + 137.2 badge + 503.1
  right group + 31.2 gaps + 26 padding. Nothing wraps there; the items' contents
  break instead.
- **848px (53rem)** is where the three control captions are visually hidden, buying
  112.3px back. A media query's rem is the initial 16px, not the 13px root.
- **~693px** is the floor, where the menu button starts clipping. The shell is
  `overflow-x: hidden`, so there is no scrollbar to reach what goes past it.

## Architecture docs

`lucuma-odb/resource/docs/` is authoritative for the v1 backend domain and API, with
the v1 scope trims applied for this package: the schedule lifecycle, change log and
restrictions are out of scope here - every view reads the one published record, and
editing was descoped from v1 outright. When the two disagree, this file and the code
win for this package.

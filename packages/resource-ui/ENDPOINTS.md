# Resource v1 - required GraphQL API

For backend review: the queries the Resource UI needs the Scala service to serve, plus
the query the scheduler team consumes. The authoritative SDL is
[`mock-server/schema.graphql`](mock-server/schema.graphql) - it is both what the mock
serves and what the frontend's codegen reads, so the wire shapes below are the ones the
UI is already built against. The wider architecture (types, semantics, error behaviour)
is `lucuma-odb/resource/docs/v1-graphql-api.md`; the scheduler contract is
`lucuma-odb/resource/docs/v1-scheduler-integration.md`. Where this file and those
disagree, this file reflects the schema as served on 2026-08-12 (they were written
2026-08-10, before the ToO/Mode queries landed).

## The endpoint

One path everywhere a client sees: **`/resource/graphql`**. The deployed frontend
derives it from its hostname (`https://lucuma-resource-dev.lucuma.xyz/resource/graphql`,
`…-staging…`), and the dev proxy already carries the same path, so the real service must
serve it too. No authentication in v1 - the mock allows everything and the frontend
sends no credentials; aligning the PoC's per-field auth with that intent is backend
work. No subscriptions, no mutations: v1 is read-only, and consumers re-query.

## The queries

Nine, all read-only. Signatures as in the SDL; "clip" is the shared interval contract
described below.

| Query                                                                                | What it answers                                                                                                                                 | Consumers                                                                   |
| ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `publishedSemesters`                                                                 | every site + semester Resource holds: title, version, `demo` flag, first/last night, `rowLabels`, holidays, moon events                         | the masthead picker; every view's bounds                                    |
| `telescopeNight(site, observingNight)`                                               | one night as a projection: `dataAvailable`, the night's interval, and every record clipped to it (instruments, closures, ToO, mode, components) | night view                                                                  |
| `telescopeNights(site, nights)`                                                      | a range of nights, same shape per night; bounded at 400                                                                                         | **the scheduler's only query**; week view (per-night `dataAvailable`)       |
| `instrumentAvailability(site, interval, clip)`                                       | instrument mountings intersecting an interval, with `usage` and location                                                                        | semester, week and night charts; the component browser's "where is it" join |
| `telescopeAvailability(site, interval, clip)`                                        | whole-telescope Open/Closed records and port-scoped closures                                                                                    | the Telescope state row and closure bands, every schedule view              |
| `tooSupport(site, interval, clip)`                                                   | ToO support level records                                                                                                                       | the ToO state row, every schedule view                                      |
| `telescopeMode(site, interval, clip)`                                                | telescope mode records (Queue, Classical, Priority visitor, …) with `programReference`                                                          | the Mode state row, every schedule view                                     |
| `components(site, instruments, componentTypes, search)`                              | the component catalog - identity only: `code`, `name`, `barcode`, `aliases`                                                                     | component browser (the ICTD half)                                           |
| `instrumentComponentAvailability(site, interval, clip, instruments, componentTypes)` | where each piece is over a window, with `usage`, `place` and the reason on the record                                                           | component browser and piece history; the week's "changes this week" list    |

## The operations the UI actually runs

One request per page load; every view gets its whole window in one response. From
[`src/gql/resource.ts`](src/gql/resource.ts):

| Operation               | Queries combined                                                                                                                   | Notes                                                                                                                                                  |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GetPublishedSemesters` | `publishedSemesters`                                                                                                               | run once by the shell; every other operation's bounds come from it                                                                                     |
| `GetSemesterSchedule`   | `instrumentAvailability` + `telescopeAvailability` + `tooSupport` + `telescopeMode`, all `clip: false`                             | a full semester in one response                                                                                                                        |
| `GetNightSchedule`      | `telescopeNight` + the same four range queries over the night, `clip: false`                                                       | the projection carries `dataAvailable` and the night's components; the range queries come unclipped so the view can say a run continues beyond tonight |
| `GetWeekSchedule`       | `telescopeNights` (per-night `dataAvailable` only) + the four range queries + `instrumentComponentAvailability`, all `clip: false` | a run spanning the week draws as one bar, not seven abutting ones                                                                                      |
| `GetComponentBrowser`   | `components` + `instrumentComponentAvailability` + `instrumentAvailability`, `clip: false`                                         | the catalog, every piece's records, and the mountings INSTALLED resolves against                                                                       |

## Contracts the resolvers must keep

These are what the UI and the scheduler are built on; each is pinned by tests against
the mock.

- **A night is a projection, never a stored record.** Clip every record to the night's
  interval and report what is left. Nothing is stored per night - that is what makes
  partial nights work with no special case.
- **Partial nights are first-class.** Blocks carry `[start, end)` intervals, never
  dates. A mid-night change arrives as two blocks with a boundary between them, never
  flattened to one per-night value.
- **Absence means "not recorded", never "unavailable"** (invariant I4). `telescopeNight`
  is never null: an un-entered night answers `dataAvailable: false` with empty lists,
  and a consumer must never read an empty list as a closed telescope. The workbook's
  Telescope column records Open and Closed alike, so an open night is a fact, not a gap.
- **Clipping** (invariant I6): the interval queries return every record intersecting the
  asked interval. `clip: false` (the default) returns stored intervals, so a view can
  draw a mounting running past its window's edge; `clip: true` trims. The night
  projection always clips.
- **Stable record ids, contextual intervals.** A block's id names the stored record;
  its interval in a clipped response is a value scoped to that query, not an update to
  the entity. (Normalizing clipped blocks by id let one night's response overwrite
  another's in the frontend cache; the API's contract is that ids identify, intervals
  answer the question asked.)
- **Unpaged, deliberately.** A semester is one response (a few thousand blocks, roughly
  1-2 MB before gzip); a site's component working set is under a hundred pieces.
- **One designed error:** `telescopeNights` rejects more than 400 nights with a plain
  `GraphQLError` naming the bound - above a semester, below an accidental decade.
  Everything else is standard GraphQL validation behaviour.

## What the scheduler needs

From `v1-scheduler-integration.md`, unchanged by anything above:

- **One query, `telescopeNights`** - one night in real-time mode, up to a semester in
  simulation mode, the same shape over any range. It reads the live records directly:
  no draft state, no schedule id, no publish cycle between a staff correction and its
  visibility.
- **The response is the night projection**: every block intersecting each night,
  clipped, with its interval, so the scheduler can ask "which blocks cover this
  candidate execution interval, and what do they say". An observation is schedulable at
  time t only if a block with an acceptable `usage` covers t for each required
  resource.
- **Component identity for observation matching** rides in the night: `code` is the
  lucuma-core enum tag where one exists, MOS masks match by `barcode`, legacy names
  resolve through per-instrument `aliases`. No scheduler-side tables.
- **Gaps stay honest**: a night with no data is `dataAvailable: false`; a sub-interval
  with no block is not recorded, not `UNAVAILABLE`; Resource never extrapolates past
  the entered calendar.
- **Performance shape**: bounded SQL per request regardless of range (the projection
  wants a view, not per-night assembly - Grackle N+1 on nested joins is the named
  risk); real-time mode is one small indexed range scan, sub-100 ms target; no
  subscriptions - the scheduler re-queries after events from its other sources.
- **Still reserved, not yet in the schema**: LGS and telescope-subsystem blocks
  (PWFS1/2, …), and the planned-versus-current availability split. Their field shapes
  are reserved in the odb docs; this contract is unchanged when they land. Mode and ToO
  blocks, listed as reserved there on 2026-08-10, are served now.

## Shared types

The real service imports shared scalars and types from `OdbSchema.graphql` - `Timestamp`,
`TimestampInterval`, `Site`, `Date`, `Semester`, `NonEmptyString`, `PosInt` - which the
preview SDL reproduces field for field, so no frontend operation changes when the
schemas swap (`tasks/codegen.ts` moves to `@gemini-hlsw/lucuma-schemas/resource`).
`Instrument` is deliberately **not** imported: the schedules' vocabulary exceeds
lucuma-core's (site-agnostic `GMOS`, the AO subsystems, `CAL_ZORRO`, `ENGINEERING`,
`UNKNOWN`), and mapping onto the ODB enum is still open with operations. Resource-owned
inputs are `TimestampIntervalInput` and `DateIntervalInput`, both half-open with the
start inclusive.

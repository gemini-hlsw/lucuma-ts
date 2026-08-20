# Resource v1 - required GraphQL API

For backend review: the queries the Resource UI needs the Scala service to serve, plus
the query the scheduler team consumes. This file is self-contained - it is the whole
contract, not a summary of one held elsewhere.

The authoritative SDL is [`mock-server/schema.graphql`](mock-server/schema.graphql) - it
is what the frontend's codegen reads, and what the mock serves is codegen's own expansion
of it (`src/gql/gen/schema.graphql`), so the wire shapes below are the ones the UI is
already built against. Every query quoted here is executed
against that schema on **every test run** (`src/test/endpointsExamples.test.ts`), so a
documented query cannot drift into being unanswerable; the response values beside them
were taken from a run on 2026-08-14 and move with the data.

**Two layers behind one API.** Everything the schedules record comes from the
operations workbook and is what the Scala service must reproduce. Two things are
**synthetic stand-ins** until real data exists, each quarantined to one mock file
and flagged here where it appears: the **component catalog's blocks**
(`mock-server/components.ts`) and the **stored instruments** - instruments GPP
knows that the schedule never mounts (`mock-server/storedInstruments.ts`). Their
_shapes_ are the contract; their _values_ are invented, and neither is ever
allowed to decide `dataAvailable`.

## The endpoint

One path everywhere a client sees: **`/resource/graphql`**. The deployed frontend maps
its own hostname to a service host and appends that path
(`https://lucuma-resource-dev.lucuma.xyz/resource/graphql`, `…-staging…`), and the dev
proxy carries the same path, so the real service must serve it too. No authentication in
v1 - the mock allows everything and the frontend sends no credentials; aligning the
PoC's per-field auth with that intent is backend work. No subscriptions, no mutations:
v1 is read-only, and consumers re-query.

## The queries

Ten, all read-only. Signatures as in the SDL; "clip" is the shared interval contract
described below.

| Query                                                                                | What it answers                                                                                                                                             | Consumers                                                                                           |
| ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `publishedSemesters`                                                                 | every site + semester Resource holds: title, version, `demo` flag, `nights` (half-open), holidays, moon events                                              | the masthead picker; every view's bounds                                                            |
| `telescopeNight(site, observingNight)`                                               | one night as a projection: `dataAvailable`, the night's interval, and every record clipped to it (instruments, closures, ToO, mode, subsystems, components) | night view                                                                                          |
| `telescopeNights(site, nights)`                                                      | a range of nights, same shape per night; bounded at 400                                                                                                     | **the scheduler's only query**; week view (per-night `dataAvailable`)                               |
| `instrumentAvailability(site, interval, clip)`                                       | every instrument record intersecting an interval - mountings on a port, and instruments off the telescope with the place they sit                           | semester, week and night charts; the instrument browser; the component browser's "where is it" join |
| `telescopeAvailability(site, interval, clip)`                                        | whole-telescope Open/Closed records and port-scoped closures                                                                                                | the Telescope state row and closure bands, every schedule view                                      |
| `tooSupport(site, interval, clip)`                                                   | ToO support level records                                                                                                                                   | the ToO state row, every schedule view                                                              |
| `telescopeSubsystemAvailability(site, interval, clip, subsystems)`                   | subsystem records - the workbook's nightly PWFS1, PWFS2 and LGS; the rest of the enum awaits entered data                                                   | the night view's Subsystems rows; the scheduler's LGS-availability row                              |
| `telescopeMode(site, interval, clip)`                                                | telescope mode records (Queue, Classical, Priority visitor, …) with `programReferences` and the block-scheduling `partner`                                  | the Mode state row, every schedule view                                                             |
| `components(site, instruments, componentTypes, search, includeDeleted)`              | the component catalog - identity only: `code`, `name`, `barcode`, `aliases`, soft-delete `existence` (deleted pieces excluded unless `includeDeleted`)      | component browser (the ICTD half)                                                                   |
| `instrumentComponentAvailability(site, interval, clip, instruments, componentTypes)` | where each piece is over a window, with `usage`, `location` and the reason on the record                                                                    | component browser and piece history; the week's "changes this week" list                            |

## The operations the UI actually runs

One request per page load; every view gets its whole window in one response. From
[`src/gql/resource.ts`](src/gql/resource.ts):

| Operation            | Queries combined                                                                                                                   | Notes                                                                                                                                                   |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PublishedSemesters` | `publishedSemesters`                                                                                                               | run once by the shell; every other operation's bounds come from it                                                                                      |
| `SemesterSchedule`   | `instrumentAvailability` + `telescopeAvailability` + `tooSupport` + `telescopeMode`, all `clip: false`                             | a full semester in one response; the instrument browser runs the same operation over the site's whole recorded span                                     |
| `NightSchedule`      | `telescopeNight` + the five range queries over the night, `clip: false`                                                            | the projection is asked only for `dataAvailable`; the range queries come unclipped so the view can say a run continues beyond tonight                   |
| `WeekSchedule`       | `telescopeNights` (per-night `dataAvailable` only) + the four range queries + `instrumentComponentAvailability`, all `clip: false` | a run spanning the week draws as one bar, not seven abutting ones                                                                                       |
| `ComponentBrowser`   | `components` + `instrumentComponentAvailability` + `instrumentAvailability`, `clip: false`                                         | the catalog, every piece's records, and the mountings INSTALLED resolves against; run over the site's whole recorded span, as the instrument browser is |

## The record types

Every interval record implements `ScheduleBlock` - `site`, `interval`, `note` -
and adds a subject and a state. Six kinds, plus two identity types and the night
projection.

`ScheduleBlock` carries **no `id`**: every query clips its records to the
interval asked for, so a block is a projection onto a window rather than an
addressable thing, and an id on it would invite a client to cache it as one.
`InstrumentComponent` keeps its id, being a real piece of hardware.

| Type                                   | Subject                       | State it carries                                                   |
| -------------------------------------- | ----------------------------- | ------------------------------------------------------------------ |
| `InstrumentAvailabilityBlock`          | `instrument`, `publishedName` | `usage`, `location` (`place` + optional `port`)                    |
| `TelescopeAvailabilityBlock`           | the site, or one `port`       | `availability` (OPEN/CLOSED), `reason`                             |
| `TelescopeModeBlock`                   | the site                      | `mode`, `programReferences[]`, `partner`                           |
| `TooSupportBlock`                      | the site                      | `tooSupport`                                                       |
| `TelescopeSubsystemAvailabilityBlock`  | `subsystem`                   | `usage`, `powerSource`                                             |
| `InstrumentComponentAvailabilityBlock` | `component` (nested identity) | `usage`, `location`                                                |
| `InstrumentComponent`                  | identity only                 | `code`, `name`, `barcode`, `aliases`, `existence`                  |
| `PublishedSemester`                    | site + semester               | `title`, `version`, `demo`, `nights`, `holidays`, `moonEvents`     |
| `TelescopeNight`                       | one night                     | `dataAvailable`, `interval`, and all six block lists clipped to it |

### The enumerations

| Enum                      | Values                                                                                                   | Note                                                                                                                                                                       |
| ------------------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ResourceUsage`           | `SCIENCE`, `ENGINEERING`, `UNAVAILABLE`                                                                  | one operational-state value for instruments, components and subsystems alike - never split into separate availability and usage fields                                     |
| `TelescopeAvailability`   | `OPEN`, `CLOSED`                                                                                         | only the telescope is open or closed                                                                                                                                       |
| `TelescopeModeType`       | `QUEUE`, `CLASSICAL`, `PRIORITY_VISITOR`, `ENGINEERING`, `COMMISSIONING`, `SHUTDOWN`, `BLOCK_SCHEDULING` | this export emits only `QUEUE` and `PRIORITY_VISITOR`; in particular no `SHUTDOWN` - a shutdown night's mode stays unrecorded there - but entered data may                 |
| `Partner`                 | `AR`, `BR`, `CA`, `CL`, `KR`, `UH`, `US`                                                                 | lucuma-core's seven; non-null exactly on a `BLOCK_SCHEDULING` span, so null throughout this export                                                                         |
| `TooSupport`              | `NONE`, `STANDARD`, `INTERRUPT`, `RAPID`                                                                 | `NONE` is "no ToOs of any kind", a recorded fact - not an absence                                                                                                          |
| `TelescopeSubsystem`      | `PWFS1`, `PWFS2`, `ALTAIR`, `CANOPUS`, `LGS`, `GPOL`, `DOME_SHUTTER`, `DOME_VENT_GATES`                  | the workbook fills the first two and `LGS`; the rest await entered data                                                                                                    |
| `PowerSource`             | `COMMERCIAL`, `GENERATOR`                                                                                | reserved - the workbook records none                                                                                                                                       |
| `InstrumentPlace`         | `PORT`, `FLOOR`, `LAB`, `BASE`, `UNKNOWN`                                                                | `port` is non-null exactly when `place` is `PORT` - a server guarantee the schema cannot enforce; the other four are where an instrument sits when it is off the telescope |
| `ComponentLocation`       | `INSTALLED`, `FLOOR`, `LAB`, `BASE`, `UNKNOWN`                                                           | `INSTALLED` means "wherever its instrument is", resolved by joining the instrument's own records, so a piece can never claim a port its instrument is not on               |
| `InstrumentComponentType` | `FILTER`, `DISPERSER`, `FPU`, `WFS`, `OTHER`                                                             | an OIWFS is a component of type `WFS`                                                                                                                                      |
| `Existence`               | `PRESENT`, `DELETED`                                                                                     | soft delete: a retired piece stops being offered but its history stays valid                                                                                               |
| `Instrument`              | the schedules' vocabulary, **not** lucuma-core's                                                         | see below                                                                                                                                                                  |

**`Instrument` deliberately diverges from lucuma-core.** It is site-agnostic where the
schedules are (one `GMOS` covering GMOS-N and GMOS-S, one `ACQ_CAM` covering both
telescopes' acquisition cameras), and it carries values lucuma-core has no place for -
the AO subsystems `ALTAIR` and `CANOPUS`, the facility calibration unit `GCAL`,
`ENGINEERING` as an operational state, `CAL_ZORRO` for the sheets' joint "Cal/ZORRO"
spelling, and `UNKNOWN` for a run the schedule names that the list does not. Every lucuma-core
instrument has a value here; mapping the two enums onto each other is deferred and
still open with operations.

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
- **Where a record is says which row it draws on.** A schedule view's subject rows are
  the telescope's five instrument ports, and a `PORT` location's `port` is the whole of
  a mounting's place in that picture - the API carries no row label and no row list, and
  a consumer must never parse a port out of a string. Any other place (an
  instrument between mounts, or one in the summit lab) belongs to no row and reaches a
  reader through the instrument browser instead. `location` is **one type with a total
  `place` and an optional `port`**, and a consumer reads `place` as the discriminator.
  The pairing - `port` non-null exactly when `place` is `PORT`, and explicitly null
  otherwise - is a server guarantee rather than a schema constraint.
- **A block is a value, not an entity.** Its interval in a clipped response is scoped
  to the query that asked, so nothing about it is addressable and it carries no id.
  (Blocks did carry one, and normalizing on it let one night's response overwrite
  another's in the frontend cache. Removing it is what makes that unrepeatable rather
  than merely configured-around.)
- **Unpaged, deliberately** - and the interval queries are far smaller than the shape
  suggests, because a record is a span, not a row per night. Counted against this export:
  a whole GS 2025B schedule (`instrumentAvailability` + `telescopeAvailability` +
  `tooSupport` + `telescopeMode`) is **14 blocks**; a site's whole component history is
  **188 blocks**; a site's catalog is **60-75 pieces**. The one large response is the
  scheduler's simulation-mode range, where the projection repeats every block on every
  night it touches: GS 2025B is 184 nights and **16,384 blocks** over all six lists,
  which runs to megabytes and varies several-fold with what is selected. **Size the SQL
  by the block count** - that is a fact about the export, where a byte figure is only ever
  true of the selection and the compression it was measured with. That is the case worth
  designing around; nothing the UI asks for comes close.
- **Two designed errors**, both plain `GraphQLError`s naming what was wrong.
  `telescopeNights` rejects more than 400 nights, naming the bound - above a semester,
  below an accidental decade. And every interval query rejects an interval whose `end`
  precedes its `start`, naming the argument: filtering on overlap would otherwise
  answer such a query with `[]`, which is exactly what a well-formed query over an
  unrecorded span answers, so a caller's mistake would be indistinguishable from
  "nothing is recorded here". Everything else is standard GraphQL validation behaviour.

## Example operations and responses

Real requests against real data: every response below was captured from the mock
as served on 2026-08-14, and
[`src/test/endpointsExamples.test.ts`](src/test/endpointsExamples.test.ts) executes
every query in this file against the served schema, so a documented example cannot
silently go stale. Responses are trimmed where a `// …` comment says so; the values
move if the data does. For live exploration the same data is one command away:
`pnpm resource-ui dev:mock-server`, then GraphiQL at
`http://localhost:4000/graphql`.

### The picker

```graphql
query {
  publishedSemesters {
    site
    semester
    title
    version
    demo
    nights {
      start
      end
    }
  }
}
```

```jsonc
{
  "data": {
    "publishedSemesters": [
      {
        "site": "GS",
        "semester": "2024B",
        "title": "Gemini South Semester 2024B",
        "version": "telescope_schedules.xlsx",
        "demo": false,
        "nights": { "start": "2024-08-02", "end": "2025-02-02" },
      },
      // … eight more site + semester entries
    ],
  },
}
```

`nights` is **half-open**, like every other interval this API serves: `start` is
the semester's first observing night and `end` is the night _after_ its last. It
is the same shape `telescopeNights` takes, so a whole semester is
`telescopeNights(site: $site, nights: $nights)` with the value straight out of
this response - no arithmetic, and no last night quietly dropped.

The field replaced a `firstNight`/`lastNight` pair on 2026-08-14. A _last_ night
reads inclusive while `DateIntervalInput.end` is exclusive, so the obvious call
came back one night short and nothing in the response said so.

### One night, with a mid-night boundary

The projection the night view and the scheduler read: everything clipped to the
night's 14:00-to-14:00 site-local interval (17:00Z at GS in November). The R400
grating fails at 03:00Z inside this night - the boundary arrives as two blocks,
never flattened to one per-night value.

```graphql
query {
  telescopeNight(site: GS, observingNight: "2025-11-20") {
    observingNight
    dataAvailable
    interval {
      start
      end
    }
    instrumentAvailability {
      instrument
      publishedName
      location {
        place
        port
      }
      usage
      interval {
        start
        end
      }
    }
    telescopeAvailability {
      availability
      port
      reason
      interval {
        start
        end
      }
    }
    telescopeMode {
      mode
      programReferences
      partner
      note
      interval {
        start
        end
      }
    }
    tooSupport {
      tooSupport
      note
      interval {
        start
        end
      }
    }
    components {
      usage
      location
      note
      interval {
        start
        end
      }
      component {
        code
        name
        barcode
      }
    }
  }
}
```

```jsonc
{
  "data": {
    "telescopeNight": {
      "observingNight": "2025-11-20",
      "dataAvailable": true,
      "interval": { "start": "2025-11-19T17:00:00Z", "end": "2025-11-20T17:00:00Z" },
      "instrumentAvailability": [
        {
          "instrument": "GHOST",
          "publishedName": "GHOST",
          "location": { "place": "PORT", "port": 1 },
          "usage": "SCIENCE",
          "interval": { "start": "2025-11-19T17:00:00Z", "end": "2025-11-20T17:00:00Z" },
        },
        // … Ports 2-5: GCAL, GMOS-S, Canopus, Flamingos2, all SCIENCE all night,
        // then the three records with no port - AcqCam, GPI and SCORPIO, each
        // UNAVAILABLE in a storage location. A night answers every instrument
        // record, not only the mounted ones; see "Instruments off the telescope".
      ],
      "telescopeAvailability": [
        {
          "availability": "OPEN",
          "port": null,
          "reason": null,
          "interval": { "start": "2025-11-19T17:00:00Z", "end": "2025-11-20T17:00:00Z" },
        },
      ],
      "telescopeMode": [
        {
          "mode": "QUEUE",
          "programReferences": [],
          "partner": null,
          "note": null,
          "interval": { "start": "2025-11-19T17:00:00Z", "end": "2025-11-20T17:00:00Z" },
        },
      ],
      "tooSupport": [
        {
          "tooSupport": "STANDARD",
          "note": "Assumed: the workbook does not record ToO support",
          "interval": { "start": "2025-11-19T17:00:00Z", "end": "2025-11-20T17:00:00Z" },
        },
      ],
      "components": [
        {
          "usage": "SCIENCE",
          "location": "INSTALLED",
          "note": null,
          "interval": { "start": "2025-11-19T17:00:00Z", "end": "2025-11-20T17:00:00Z" },
          "component": { "code": "B1200_G5321", "name": "B1200", "barcode": null },
        },
        // … R831_G5322 and R600_G5324 next, both UNAVAILABLE in the lab, whole-night.
        // The two entries below are the fourth and fifth, pulled up out of order
        // because they are the export's one mid-night boundary - the point being
        // that a component change arrives as two blocks, never a per-night value:
        {
          "usage": "SCIENCE",
          "location": "INSTALLED",
          "note": null,
          "interval": { "start": "2025-11-19T17:00:00Z", "end": "2025-11-20T03:00:00Z" },
          "component": { "code": "R400_G5325", "name": "R400", "barcode": null },
        },
        {
          "usage": "UNAVAILABLE",
          "location": "LAB",
          "note": "Failed; removed for repair",
          "interval": { "start": "2025-11-20T03:00:00Z", "end": "2025-11-20T17:00:00Z" },
          "component": { "code": "R400_G5325", "name": "R400", "barcode": null },
        },
        // … 71 more component blocks, whole-night; 76 in all
      ],
    },
  },
}
```

### The scheduler's range

The same shape per night over any range - `nights` is half-open, `start`
inclusive.

```graphql
query {
  telescopeNights(site: GS, nights: { start: "2025-11-19", end: "2025-11-22" }) {
    observingNight
    dataAvailable
    instrumentAvailability {
      instrument
      usage
      interval {
        start
        end
      }
    }
  }
}
```

```jsonc
{
  "data": {
    "telescopeNights": [
      {
        "observingNight": "2025-11-19",
        "dataAvailable": true,
        "instrumentAvailability": [
          {
            "instrument": "GHOST",
            "usage": "SCIENCE",
            "interval": { "start": "2025-11-18T17:00:00Z", "end": "2025-11-19T17:00:00Z" },
          },
          // … seven more records, clipped to this night: Ports 2-5 (GCAL,
          // GMOS-S, Canopus, Flamingos2) and the three with no port (AcqCam,
          // GPI, SCORPIO). Eight per night at GS - a night answers every
          // instrument record, not only the mounted ones.
        ],
      },
      // … 2025-11-20 and 2025-11-21, same shape
    ],
  },
}
```

### Honest gaps past the calendar

GS's last entered night is 2026-08-01. The nights beyond it answer
`dataAvailable: false` - never an empty list that reads as "nothing available",
and never an extrapolation.

```graphql
query {
  telescopeNights(site: GS, nights: { start: "2026-07-31", end: "2026-08-04" }) {
    observingNight
    dataAvailable
  }
}
```

```json
{
  "data": {
    "telescopeNights": [
      { "observingNight": "2026-07-31", "dataAvailable": true },
      { "observingNight": "2026-08-01", "dataAvailable": true },
      { "observingNight": "2026-08-02", "dataAvailable": false },
      { "observingNight": "2026-08-03", "dataAvailable": false }
    ]
  }
}
```

### Interval records, unclipped by default

One night asked for; the stored intervals answer - GHOST's mounting runs the
whole semester, so a view can say the run continues past its window. The same
query with `clip: true` trims every interval to exactly the asked
`2025-11-19T17:00:00Z … 2025-11-20T17:00:00Z`.

```graphql
query {
  instrumentAvailability(site: GS, interval: { start: "2025-11-19T17:00:00Z", end: "2025-11-20T17:00:00Z" }) {
    instrument
    publishedName
    usage
    location {
      place
      port
    }
    interval {
      start
      end
    }
  }
}
```

```jsonc
{
  "data": {
    "instrumentAvailability": [
      {
        "instrument": "GHOST",
        "publishedName": "GHOST",
        "usage": "SCIENCE",
        "location": { "place": "PORT", "port": 1 },
        "interval": { "start": "2025-08-01T18:00:00Z", "end": "2026-02-01T17:00:00Z" },
      },
      // … the other four ports, also semester-long
    ],
  },
}
```

Two kinds of record answer this query, told apart by `location.place`, and the
next example shows the second.

### Instruments off the telescope

The same query, filtered here to the records whose `location.place` is not `PORT`.
Two things produce them. An **off-port run** is the workbook's own: an instrument
recorded usable with no port, which says nothing about where it physically sits,
so it answers `UNKNOWN` (the GN `'Alopeke` visitor runs). A **stored instrument**
is an instrument GPP knows that the schedule never mounts, and it does carry a
place - `LAB`, `FLOOR` or `BASE` - which changes over time as the instrument
moves.

The schedule views draw ports only, so neither kind appears on a chart; both
reach a reader through the instrument browser.

```graphql
query {
  instrumentAvailability(site: GS, interval: { start: "2025-11-19T17:00:00Z", end: "2025-11-20T17:00:00Z" }) {
    instrument
    publishedName
    usage
    location {
      place
      port
    }
    interval {
      start
      end
    }
  }
}
```

```jsonc
{
  "data": {
    "instrumentAvailability": [
      // … the five port mountings, as above
      {
        "instrument": "ACQ_CAM",
        "publishedName": "AcqCam",
        "usage": "UNAVAILABLE",
        "location": { "place": "LAB", "port": null },
        "interval": { "start": "2025-10-13T18:00:00Z", "end": "2026-08-01T18:00:00Z" },
      },
      {
        "instrument": "GPI",
        "publishedName": "GPI",
        "usage": "UNAVAILABLE",
        "location": { "place": "BASE", "port": null },
        "interval": { "start": "2024-08-01T18:00:00Z", "end": "2025-12-25T18:00:00Z" },
      },
      {
        "instrument": "SCORPIO",
        "publishedName": "SCORPIO",
        "usage": "UNAVAILABLE",
        "location": { "place": "LAB", "port": null },
        "interval": { "start": "2025-09-07T06:00:00Z", "end": "2026-08-01T18:00:00Z" },
      },
    ],
  },
}
```

`place` is total - `PORT` is one of its values - so a record on the telescope and
a record on a shelf answer the same field, which is what lets one query answer
"where is everything" without a fragment per case. Note that
**site is not on the instrument** - it is on the record, because site assignment
is time-bounded operational data. In practice an instrument does not move between
telescopes, and the mock never moves one.

### A closure with its reason

Four days asked for; the whole stored fifteen-night shutdown answers.
`port: null` means the telescope itself, not one port.

```graphql
query {
  telescopeAvailability(site: GS, interval: { start: "2024-08-02T00:00:00Z", end: "2024-08-06T00:00:00Z" }) {
    availability
    port
    reason
    interval {
      start
      end
    }
  }
}
```

```json
{
  "data": {
    "telescopeAvailability": [
      {
        "availability": "CLOSED",
        "port": null,
        "reason": "Shutdown",
        "interval": { "start": "2024-08-01T18:00:00Z", "end": "2024-08-16T18:00:00Z" }
      }
    ]
  }
}
```

### A subsystem's state - the laser, per site

The workbook records the wavefront sensors and the LGS nightly. Gemini South
has no laser: "No" every night is a recorded fact, never a gap.

```graphql
query {
  telescopeSubsystemAvailability(
    site: GS
    interval: { start: "2025-11-19T17:00:00Z", end: "2025-11-20T17:00:00Z" }
    subsystems: [LGS]
  ) {
    subsystem
    usage
    powerSource
    interval {
      start
      end
    }
  }
}
```

```json
{
  "data": {
    "telescopeSubsystemAvailability": [
      {
        "subsystem": "LGS",
        "usage": "UNAVAILABLE",
        "powerSource": null,
        "interval": { "start": "2025-08-01T18:00:00Z", "end": "2026-02-01T17:00:00Z" }
      }
    ]
  }
}
```

### Component identity, by search

`search` matches name, code, barcode and alias, case-insensitively. `code` is
the lucuma-core enum tag where one exists.

```graphql
query {
  components(site: GS, search: "R400") {
    id
    instrument
    componentType
    code
    name
    barcode
    aliases
    existence
  }
}
```

```json
{
  "data": {
    "components": [
      {
        "id": "k-gs-R400_G5325",
        "instrument": "GMOS",
        "componentType": "DISPERSER",
        "code": "R400_G5325",
        "name": "R400",
        "barcode": null,
        "aliases": ["R400"],
        "existence": "PRESENT"
      }
    ]
  }
}
```

### A piece's history

The state half of the browser: R400's mid-run boundary carries the reason on
the record itself.

```graphql
query {
  instrumentComponentAvailability(
    site: GS
    interval: { start: "2025-11-01T00:00:00Z", end: "2025-12-31T00:00:00Z" }
    componentTypes: [DISPERSER]
  ) {
    usage
    location
    note
    interval {
      start
      end
    }
    component {
      code
    }
  }
}
```

```jsonc
{
  "data": {
    "instrumentComponentAvailability": [
      {
        "usage": "SCIENCE",
        "location": "INSTALLED",
        "note": null,
        "interval": { "start": "2024-08-23T18:00:00Z", "end": "2026-08-01T18:00:00Z" },
        "component": { "code": "B1200_G5321" },
      },
      // … R831_G5322 and R600_G5324 next, both UNAVAILABLE in the lab across the
      // whole recorded span. The two below are the fourth and fifth, pulled up out
      // of order because they are the R400 failure this section is about - and note
      // both run past the asked window, which is what `clip: false` means:
      {
        "usage": "SCIENCE",
        "location": "INSTALLED",
        "note": null,
        "interval": { "start": "2025-08-01T18:00:00Z", "end": "2025-11-20T03:00:00Z" },
        "component": { "code": "R400_G5325" },
      },
      {
        "usage": "UNAVAILABLE",
        "location": "LAB",
        "note": "Failed; removed for repair",
        "interval": { "start": "2025-11-20T03:00:00Z", "end": "2026-02-01T17:00:00Z" },
        "component": { "code": "R400_G5325" },
      },
      // … six more disperser blocks in the window; 11 in all
    ],
  },
}
```

## What the scheduler needs

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
  subscriptions - the scheduler re-queries after events from its other sources. The
  size to design against is simulation mode, measured under "Unpaged, deliberately"
  above: the underlying rows are few, but the projection repeats each on every night
  it touches.
- **LGS availability is served**: the LGS subsystem's blocks, nightly from the
  workbook, beside PWFS1 and PWFS2. Both sites record it every night - GN as
  available, GS as `UNAVAILABLE` - so neither is an absence, and a consumer must
  not read GS's as "not entered". The rest of the subsystem enum awaits entered data. One caveat worth a
  conversation: that column is _constant per site_ across this export, so it may
  be recording the site's laser capability rather than a nightly state.
- **Instruments off the telescope answer too.** `instrumentAvailability` returns
  every instrument record, not only the mounted ones, so a consumer asking
  "where is everything" gets one answer. A scheduler filtering for what it can
  observe with should keep the records whose `place` is `PORT` (and read `usage`), exactly
  as the schedule views do.
- **Still reserved, not yet in the schema**: the planned-versus-current
  availability split (`CurrentTelescopeAvailability`). Nothing in this contract
  changes when it lands - it adds a query rather than altering one.

## Shared types

The real service is expected to import these from the shared ODB schema, and **so does
the preview SDL** - `mock-server/schema.graphql` opens with an `#import … from
"@gemini-hlsw/lucuma-odb-schemas/odb"` rather than restating them, so the two cannot
have drifted and no frontend operation changes when the schemas swap
(`tasks/codegen.ts` moves to `@gemini-hlsw/lucuma-schemas/resource`).

For orientation on what "swap" means: the published
`@gemini-hlsw/lucuma-odb-schemas/resource` is still the proof-of-concept schema - 60
lines, one query (`telescopeNightTimeline`). This document describes what replaces it,
and the preview SDL here is what codegen reads until it does.

- **Scalars**: `Date`, `Timestamp`, `Semester`, `NonEmptyString`, `PosInt`,
  `ProgramReferenceLabel`, and `Long` / `BigDecimal` (used only by `TimeSpan`'s fields).
- **Types**: `TimestampInterval` (`start` inclusive, `end` exclusive, plus a derived
  `duration: TimeSpan!`), `TimeSpan`, and the `Site` and `Partner` enums.
- **Resource-owned inputs**: `TimestampIntervalInput` and `DateIntervalInput`, both
  half-open with the start inclusive.

`Instrument` is deliberately **not** imported - see "The record types" above for what it
carries beyond lucuma-core's and why mapping the two is still open with operations. It is
the one enum here that is Resource's own.

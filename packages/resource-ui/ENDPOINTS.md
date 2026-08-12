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

Ten, all read-only. Signatures as in the SDL; "clip" is the shared interval contract
described below.

| Query                                                                                | What it answers                                                                                                                                             | Consumers                                                                   |
| ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `publishedSemesters`                                                                 | every site + semester Resource holds: title, version, `demo` flag, first/last night, `rowLabels`, holidays, moon events                                     | the masthead picker; every view's bounds                                    |
| `telescopeNight(site, observingNight)`                                               | one night as a projection: `dataAvailable`, the night's interval, and every record clipped to it (instruments, closures, ToO, mode, subsystems, components) | night view                                                                  |
| `telescopeNights(site, nights)`                                                      | a range of nights, same shape per night; bounded at 400                                                                                                     | **the scheduler's only query**; week view (per-night `dataAvailable`)       |
| `instrumentAvailability(site, interval, clip)`                                       | instrument mountings intersecting an interval, with `usage` and location                                                                                    | semester, week and night charts; the component browser's "where is it" join |
| `telescopeAvailability(site, interval, clip)`                                        | whole-telescope Open/Closed records and port-scoped closures                                                                                                | the Telescope state row and closure bands, every schedule view              |
| `tooSupport(site, interval, clip)`                                                   | ToO support level records                                                                                                                                   | the ToO state row, every schedule view                                      |
| `telescopeSubsystemAvailability(site, interval, clip, subsystems)`                   | subsystem records - the workbook's nightly PWFS1, PWFS2 and LGS; the rest of the enum awaits entered data                                                   | the night view's Subsystems rows; the scheduler's LGS-availability row      |
| `telescopeMode(site, interval, clip)`                                                | telescope mode records (Queue, Classical, Priority visitor, …) with `programReferences` and the block-scheduling `partner`                                  | the Mode state row, every schedule view                                     |
| `components(site, instruments, componentTypes, search, includeDeleted)`              | the component catalog - identity only: `code`, `name`, `barcode`, `aliases`, soft-delete `existence` (deleted pieces excluded unless `includeDeleted`)      | component browser (the ICTD half)                                           |
| `instrumentComponentAvailability(site, interval, clip, instruments, componentTypes)` | where each piece is over a window, with `usage`, `location` and the reason on the record                                                                    | component browser and piece history; the week's "changes this week" list    |

## The operations the UI actually runs

One request per page load; every view gets its whole window in one response. From
[`src/gql/resource.ts`](src/gql/resource.ts):

| Operation               | Queries combined                                                                                                                   | Notes                                                                                                                                                  |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GetPublishedSemesters` | `publishedSemesters`                                                                                                               | run once by the shell; every other operation's bounds come from it                                                                                     |
| `GetSemesterSchedule`   | `instrumentAvailability` + `telescopeAvailability` + `tooSupport` + `telescopeMode`, all `clip: false`                             | a full semester in one response                                                                                                                        |
| `GetNightSchedule`      | `telescopeNight` + the five range queries over the night, `clip: false`                                                            | the projection carries `dataAvailable` and the night's components; the range queries come unclipped so the view can say a run continues beyond tonight |
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

## Example operations and responses

Real requests against real data: every response below was captured from the mock
(the workbook import of 2026-08-11), and
[`src/test/endpointsExamples.test.ts`](src/test/endpointsExamples.test.ts) executes
every query in this file against the served schema, so a documented example cannot
silently go stale. Responses are trimmed where a `// …` comment says so; the values
move when a new workbook is imported. For live exploration the same data is one
command away: `pnpm resource-ui dev:mock-server`, then GraphiQL at
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
    firstNight
    lastNight
    rowLabels
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
        "firstNight": "2024-08-02",
        "lastNight": "2025-02-01",
        "rowLabels": ["Port 1", "Port 2", "Port 3", "Port 4", "Port 5"],
      },
      // … eight more site + semester entries
    ],
  },
}
```

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
      rowLabel
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
          "rowLabel": "Port 1",
          "usage": "SCIENCE",
          "interval": { "start": "2025-11-19T17:00:00Z", "end": "2025-11-20T17:00:00Z" },
        },
        // … Ports 2-5: GCAL, GMOS-S, Canopus, Flamingos2, all SCIENCE all night
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
        // … ~70 more component blocks, whole-night
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
          // … the other four ports, clipped to this night
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
`2025-11-19T17:00:00Z … 2025-11-20T17:00:00Z`. Ids are positional per schedule
in the mock; Gid prefixes are the backend's call.

```graphql
query {
  instrumentAvailability(site: GS, interval: { start: "2025-11-19T17:00:00Z", end: "2025-11-20T17:00:00Z" }) {
    id
    instrument
    publishedName
    rowLabel
    usage
    location {
      type
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
        "id": "GS-2025B-b-0",
        "instrument": "GHOST",
        "publishedName": "GHOST",
        "rowLabel": "Port 1",
        "usage": "SCIENCE",
        "location": { "type": "PORT", "port": 1 },
        "interval": { "start": "2025-08-01T18:00:00Z", "end": "2026-02-01T17:00:00Z" },
      },
      // … the other four ports, also semester-long
    ],
  },
}
```

An off-port run answers the same shape with no port: the late-September 2026
'Alopeke visitor run at GN is usable with no port recorded, so it serves
`"location": { "type": "UNKNOWN", "port": null }`. The schedule views draw only
the ports, so these reach a reader through the instrument browser instead.
`FLOOR`, `LAB` and `BASE` await entered data - the workbook never states where
an unmounted instrument physically is.

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
      // … nine more disperser blocks in the window
    ],
  },
}
```

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
- **LGS availability is served**: the LGS subsystem's blocks, nightly from the
  workbook (GN records the laser available, GS records none), beside PWFS1 and
  PWFS2. The rest of the subsystem enum awaits entered data.
- **Still reserved, not yet in the schema**: the planned-versus-current
  availability split (`CurrentTelescopeAvailability`). Its field shape is
  reserved in the odb docs; this contract is unchanged when it lands. Mode, ToO
  and subsystem blocks, listed as reserved there on 2026-08-10, are served now.

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

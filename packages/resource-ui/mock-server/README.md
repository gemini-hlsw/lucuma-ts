# Resource mock GraphQL server

A stand-in for the Scala Resource backend, used to develop the UI before it exists. It serves the
v1 API preview from the **operations workbook export** (`fixtures/telescope_schedules.xlsx`) -
nine semesters across both sites, the operations team's own record rather than invented demo data.

`schema.graphql` is the API design deliverable circulated to operations for review.
`lucuma-odb/resource/docs/v1-graphql-api.md` is the wider architecture;
[../CLAUDE.md](../CLAUDE.md) records what this schema deliberately leaves out.

## Running

```bash
pnpm --filter @gemini-hlsw/resource-ui dev:mock-server   # http://localhost:4000/graphql
```

Yoga serves GraphiQL at that URL. **The app is not a consumer**: the UI's Vite dev server proxies
`/resource/graphql` to the real dev deployment, so :4000 is for GraphiQL and for an external
consumer trying the API, never for the running app (see [../CLAUDE.md](../CLAUDE.md)).

**Treat port 4000 as untrusted at session start.** A server from an earlier session can outlive it
and serve a schema that no longer exists. Check with `lsof -nP -iTCP:4000 -sTCP:LISTEN`.

The server reads `../src/gql/gen/schema.graphql`, which codegen writes, so the script above runs
codegen first (`predev:mock-server`). That covers a start from cold; it does not cover an SDL edit made
while the server is already running, because `--watch` restarts the node process without
re-running the hook and does not reload on `schema.graphql` either. Run
`pnpm --filter @gemini-hlsw/resource-ui codegen` and restart the script after any SDL change.

## The API

Ten queries, all read-only. Resource reproduces schedules that already exist, so there is
nothing to mutate - editing was descoped from v1 outright.

| Query                                                              | For                                                      |
| ------------------------------------------------------------------ | -------------------------------------------------------- |
| `publishedSemesters`                                               | the site + semester picker                               |
| `telescopeNight(site, observingNight)`                             | one night, every record clipped to it                    |
| `telescopeNights(site, nights)`                                    | the scheduler's only query; bounded at 400 nights        |
| `instrumentAvailability(site, interval, clip)`                     | the semester and week views                              |
| `telescopeAvailability(site, interval, clip)`                      | closures, the other half of a semester view              |
| `tooSupport(site, interval, clip)`                                 | the ToO state row, every schedule view                   |
| `telescopeMode(site, interval, clip)`                              | the Mode state row, every schedule view                  |
| `telescopeSubsystemAvailability(site, interval, clip, subsystems)` | the night view's subsystem rows; the scheduler's LGS row |
| `components(site, instruments, componentTypes, search)`            | the component browser's catalog                          |
| `instrumentComponentAvailability(site, interval, clip)`            | where each piece is, over a window                       |

Three contracts the resolvers exist to keep:

- **A night is a projection**, never a stored record: clip everything to the night's interval and
  report what is left. That is what makes partial nights work with no special case.
- **`dataAvailable: false`** with empty lists means "not entered". A consumer must never read an
  empty list as a closed telescope.
- **`clip: false`** (the default) returns stored intervals, so a view can draw a mounting running
  past the edge of the window it asked for. `clip: true` trims. The night projection always clips.

Types the ODB already defines - `TimestampInterval` with its `duration`, `TimeSpan`,
`NonEmptyString`, `PosInt`, and the `Timestamp` wire format - are **imported, never restated**
(2026-08-14, Hugo's review): `schema.graphql` opens with an `#import … from
"@gemini-hlsw/lucuma-odb-schemas/odb"`. A reproduction can drift from the ODB; an import cannot,
so the payload here is the payload the Scala service will send.

## Layout

- `schema.graphql` - the SDL, and codegen's only source (`tasks/codegen.ts`), so the UI's generated
  types cannot drift from what the mock answers with. Its ODB types arrive by `#import`, which is
  @graphql-tools' convention and a comment to GraphQL, so the file on its own does not build.
- `../src/gql/gen/schema.graphql` - that file with the imports resolved, written by codegen and
  served. It is generated code, so it lives under `src/*/gen/` with the typed operations rather
  than in this directory, the way every package in this workspace keeps its generated output.
  Gitignored, never hand-edited; `schemaArtifact.test.ts` pins what the expansion has to hold.
  Nothing here resolves imports at runtime, which is why the package declares no @graphql-tools
  dependency of its own.
- `seed.ts` - imports the nine generated `data/*.json` files. Everything is imported from the
  workbook - there is no hand-written schedule - which is why the mock cannot drift from the
  operations record or decay with the wall clock.
- `components.ts` - the synthetic component layer: a catalog of real identities (lucuma-core enum
  tags) whose blocks are derived deterministically from the imported mountings. **The quarantine
  boundary** - swap this one file when the real catalog arrives.
- `store.ts` - the in-memory store, built fresh per consumer. It adds one thing to what the
  schedules hold: the semester a record came from.
- `resolvers.ts` - the ten queries, plus the `Timestamp` scalar and the derived `duration`.
- `schema.ts` / `server.ts` / `time.ts` - the harness. `buildMockSchema(sdl)` returns an executable
  schema over a fresh store; `server.ts` is the yoga dev server; `time.ts` does observing-night
  interval math (14:00 to 14:00 site-local, via `Intl`, correct across DST at Gemini South).
- `data/` and `fixtures/` - the imported JSON, and the workbook export it was parsed from, kept
  beside it as provenance. The reader itself is no longer in this package; it lives on the
  `resource/workbook-importer` branch. See [../CLAUDE.md](../CLAUDE.md).

## One schema, one file

`../src/gql/gen/schema.graphql` is the one file every consumer reads: the `:4000` server reads it
off disk, and the tests import it with `?raw` - including `src/test/mockClient.ts`, which wires the
same executable schema into Apollo via `SchemaLink` for the browser tests. **One file and no second
copy** is the property, not the number of readers: it is what stops a browser test and a GraphiQL
click-through disagreeing, and stops either disagreeing with the types codegen wrote from the same
source. **Preserve it** - `src/test/mockPipeline.test.ts` pins it, and if that test breaks they have
diverged. The app is not a consumer: it reads the live service over HTTP and carries no mock schema
(2026-08-14).

Two things that property does not give you for free:

- **SchemaLink executes without validating**, so an invalid selection would pass a page test
  unnoticed. `resolvers.test.ts` runs through `graphql()` instead, which validates.
- **Yoga masks errors the schema layer shows you.** Anything that is not a `GraphQLError` reaches
  the client as "Unexpected error.", so a resolver-level test can pass while `:4000` says nothing
  useful. The 400-night bound has a test that runs yoga's real `maskError` over it.

## Notes

- No database, no persistence across restarts, and a fresh store per test.
- The `Instrument` enum is the schedules' vocabulary, not lucuma-core's - `ALTAIR` and `CANOPUS` are
  AO subsystems and `CAL_ZORRO` names two things. Mapping it onto lucuma-core is deferred, still
  open with operations.
- Temporary. Point `tasks/codegen.ts` at `@gemini-hlsw/lucuma-schemas/resource` when the real
  backend ships.

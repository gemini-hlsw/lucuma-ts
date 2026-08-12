# Resource mock GraphQL server

A stand-in for the Scala Resource backend, used to develop the UI before it exists. It serves the
v1 API preview from the eight **real published schedules**, so what the UI draws is what Gemini
publishes rather than invented demo data - plus GS 2099B, the one hand-written synthetic semester,
flagged `demo: true` end to end so it can never pass for a published one.

`schema.graphql` is the API design deliverable circulated to operations for review
([PLAN.md](../PLAN.md) §5, Phase 2). `lucuma-odb/resource/docs/v1-graphql-api.md` is the wider
architecture; PLAN.md §3.3 records what this schema deliberately leaves out.

## Running

```bash
pnpm --filter @gemini-hlsw/resource-ui dev:mock-server   # http://localhost:4000/graphql
```

Yoga serves GraphiQL at that URL. The UI's Vite dev server proxies `/resource/graphql` to it.

**Treat port 4000 as untrusted at session start.** A server from an earlier session can outlive it
and serve a schema that no longer exists. `--watch` does not pick up `schema.graphql`, so restart
after any SDL change. Check with `lsof -nP -iTCP:4000 -sTCP:LISTEN`.

## The API

Seven queries, all read-only. Resource reproduces schedules that already exist, so there is
nothing to mutate - editing was descoped from v1 outright (PLAN.md Phase 4).

| Query                                                   | For                                               |
| ------------------------------------------------------- | ------------------------------------------------- |
| `publishedSemesters`                                    | the site + semester picker                        |
| `telescopeNight(site, observingNight)`                  | one night, every record clipped to it             |
| `telescopeNights(site, nights)`                         | the scheduler's only query; bounded at 400 nights |
| `instrumentAvailability(site, interval, clip)`          | the semester and week views                       |
| `telescopeAvailability(site, interval, clip)`           | closures, the other half of a semester view       |
| `components(site, instruments, componentTypes, search)` | the component browser's catalog                   |
| `instrumentComponentAvailability(site, interval, clip)` | where each piece is, over a window                |

Three contracts the resolvers exist to keep:

- **A night is a projection**, never a stored record: clip everything to the night's interval and
  report what is left. That is what makes partial nights work with no special case.
- **`dataAvailable: false`** with empty lists means "not entered". A consumer must never read an
  empty list as a closed telescope.
- **`clip: false`** (the default) returns stored intervals, so a view can draw a mounting running
  past the edge of the window it asked for. `clip: true` trims. The night projection always clips.

Types the real schema imports from `OdbSchema.graphql` - `TimestampInterval` with its `duration`,
`TimeSpan`, `NonEmptyString`, `PosInt`, and the `Timestamp` wire format - are reproduced field for
field, so the payload here is the payload the Scala service will send.

## Layout

- `schema.graphql` - the SDL. Codegen source (`tasks/codegen.ts`) **and** the served schema, so the
  UI's generated types cannot drift from what the mock answers with.
- `seed.ts` - imports the eight generated `data/*.json` files plus `demo.ts`, the one
  hand-written schedule (GS 2099B, `demo: true`, dated where no published semester can collide).
  Everything else is imported, which is why the mock cannot drift from the published sheets or
  decay with the wall clock.
- `components.ts` - the synthetic component layer: a catalog of real identities (lucuma-core enum
  tags) whose blocks are derived deterministically from the imported mountings. **The quarantine
  boundary** - swap this one file when the real catalog arrives.
- `store.ts` - the in-memory store, built fresh per consumer. Assigns each block a positional id.
- `resolvers.ts` - the seven queries, plus the `Timestamp` scalar and the derived `duration`.
- `schema.ts` / `server.ts` / `time.ts` - the harness. `buildMockSchema(sdl)` returns an executable
  schema over a fresh store; `server.ts` is the yoga dev server; `time.ts` does observing-night
  interval math (14:00 to 14:00 site-local, via `Intl`, correct across DST at Gemini South).
- `import/` - the published Excel-exported HTML to `data/*.json`. See [../CLAUDE.md](../CLAUDE.md).

## One schema, three consumers

`src/test/mockClient.ts` wires the same executable schema into Apollo via `SchemaLink` for the
browser tests, and `src/gql/ApolloConfigs.ts` does the same for the app's default **Demo data**
source - the deployed app carries this whole mock in its bundle and needs no server. All three
consumers (dev server, tests, demo source) exercise the same resolvers and the same SDL codegen
reads. **Preserve that property** - `src/test/mockPipeline.test.ts` pins it, and if it breaks they
have diverged.

Two things that property does not give you for free:

- **SchemaLink executes without validating**, so an invalid selection would pass a page test
  unnoticed. `resolvers.test.ts` runs through `graphql()` instead, which validates.
- **Yoga masks errors the schema layer shows you.** Anything that is not a `GraphQLError` reaches
  the client as "Unexpected error.", so a resolver-level test can pass while `:4000` says nothing
  useful. The 400-night bound has a test that runs yoga's real `maskError` over it.

## Notes

- No database, no persistence across restarts, and a fresh store per test.
- The `Instrument` enum is the schedules' vocabulary, not lucuma-core's - `ALTAIR` and `CANOPUS` are
  AO subsystems and `CAL_ZORRO` names two things. Mapping it onto lucuma-core is deferred
  ([../NEED-CLARIFICATION.md](../NEED-CLARIFICATION.md) questions 4 and 5).
- Block ids are plain strings, positional within a schedule. Gid prefixes are the backend's call
  (PLAN.md §3.3).
- Temporary. Point `tasks/codegen.ts` at `@gemini-hlsw/lucuma-schemas/resource` when the real
  backend ships.

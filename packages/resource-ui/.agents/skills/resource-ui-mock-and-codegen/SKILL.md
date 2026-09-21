---
name: resource-ui-mock-and-codegen
description: >
  The GraphQL pipeline behind resource-ui: codegen, the mock server on :4000, the SDL, and the
  imported schedule data. Use when changing packages/resource-ui's schema or GraphQL operations,
  running codegen, starting or debugging the mock server, or editing the schedule JSON under
  mock-server/data/.
---

# resource-ui: mock server and codegen

Engineering mechanics for the data pipeline behind `@gemini-hlsw/resource-ui`. Three other
documents own the neighbouring ground: `packages/resource-ui/CLAUDE.md` holds the package's
always-on rules, `packages/resource-ui/ENDPOINTS.md` holds the API contract the resolvers must
keep, and `packages/resource-ui/mock-server/README.md` is the reference for the mock's own files.

## GraphQL & codegen workflow

- Operations live in `src/gql/resource.ts` as `graphql(...)` tagged documents. Hooks returning
  **domain models** (not raw fragments) belong in `src/gql/hooks.ts`. `src/gql/ApolloConfigs.ts` is
  the client setup.
- Codegen source is `mock-server/schema.graphql`, configured in `tasks/codegen.ts`. It writes the
  typed operations and the resolved SDL into `src/gql/gen/`. `tasks/printSchemaPlugin.ts` prints the
  second one - named by path, not as `schema-ast`, because the CLI resolves a named plugin from its
  own install directory and in this workspace that lands on the copy built against graphql 17, whose
  type predicates answer false for this package's graphql 16 objects (`Unknown type BigDecimal.`).
- **After changing any operation or the schema, run `codegen`.** `prebuild` does it on build.
- The client preset only emits types an operation selects. If a type is missing from `gen/`, the fix
  is an operation that selects it, not a hand-written duplicate.
- When the backend ships, point `tasks/codegen.ts` at `@gemini-hlsw/lucuma-odb-schemas/resource`.
- `@graphql-eslint` operation linting runs in `eslint.config.js` against `mock-server/schema.graphql`.
  `require-selections` asks for an `id` wherever a type has one, which is why `InstrumentComponent`
  selections carry it and blocks - which have none - are unaffected. That config globs
  `./src/gql/**/*.graphql`, which also contains the generated SDL, and those rules read a `.graphql`
  file as **operations** (every type in a schema fails `executable-definitions`). The `src/*/gen`
  entry in `eslint.config.shared.js`'s `globalIgnores` is what keeps them apart, and it is
  load-bearing: narrowing it turns the generated schema into forty lint errors that say nothing about
  the code.

## Mock server

One typed mock serves the :4000 dev server and the browser tests from literally the same file of
SDL, which is why a browser test and a GraphiQL click-through cannot disagree. `mock-server/README.md`
covers what each file is, that property and how to preserve it, and SchemaLink executing without
validating. Four rules bite from outside that directory:

- **A night is a projection**: clip every record to the night's interval and report what is left.
  Nothing is stored per night, which is what makes partial nights work with no special case.
- **The `#import` line has to be `schema.graphql`'s first content.** The loader only looks for
  imports when the SDL _starts_ with one; a header comment above it silently turns every type below
  into an unknown type (`schemaArtifact.test.ts` catches this).
- **The generated artifact is only as fresh as the last `codegen` run.** A missing one fails loudly
  (`ENOENT`); a stale one starts fine and answers from the old schema. Hence `predev:mock-server`,
  whose accepted price is that an invalid document anywhere in `src/gql/` now fails
  `pnpm dev:mock-server`. **The dependency runs one way** - `mock-server/` reads from `src/gql/gen/`,
  nothing in `src/` imports from `mock-server/` outside the tests - so `mock-server/` neither
  typechecks nor starts until `codegen` has run.
- **Treat port 4000 as untrusted at session start.** A mock server from an old session can outlive
  it and serve a schema that no longer exists. Check with `lsof -nP -iTCP:4000 -sTCP:LISTEN` and
  restart through the pnpm script, which runs `codegen` first. Two routes get past that hook and
  re-serve the previous schema: invoking `node ./mock-server/server.ts` directly, and editing the
  SDL while `--watch` is already running. Run `codegen` by hand in either case.

## Where the schedule data came from

`mock-server/data/*.json` **is** the schedule source: nine semesters (GS 2024B-2026A, GN
2024B-2026B), parsed once out of the operations workbook export
(`mock-server/fixtures/telescope_schedules.xlsx`, kept as provenance), which supersedes the
published web overview sheets where they disagreed. Edit the JSON if the mock's data has to change.

Four reading decisions that the JSON cannot show you, each of which was a judgment call:

- **A row is an evening**, not an observing night ("Local Date" is the evening a night begins; the
  night is evening + 1). Semester split follows the evenings: Feb-Jul is A, Aug-Jan is B.
- **Open is a fact, not a gap.** The sheet states Open and Closed alike. "Shutdown" is a closure's
  reason only when Mode/Program names it; a night closed under an operating mode gets none and its
  **mode stays unrecorded**.
- **A blank `ToOs` column is served as Standard support**, wearing the assumption as the record's
  note. It is blank on every night of the current export. Defaulting it to "None" read as a recorded
  prohibition, and that was the bug.
- **The OIWFS columns were deliberately not imported** - an OIWFS is an instrument _component_, so
  importing them would cross the synthetic-component quarantine. GN's single trailing 2027A evening
  is an export artifact and is also dropped. An unrecognised port name becomes an UNKNOWN block,
  never a silent drop.

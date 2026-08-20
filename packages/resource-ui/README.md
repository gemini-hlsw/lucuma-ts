# @gemini-hlsw/resource-ui

Web UI for the GPP Resource service (telescope calendar and operational-resource manager):
an accurate, readable, interactive reproduction of the telescope schedules -
tonight, a week, and a semester of observing nights - plus the two inventory browsers,
the ICTD half: `/instruments` ("where is GNIRS, tonight - and if it is on no port, say
so") and `/components` ("where is the R400 grating"). **v1 is read-only**: Resource
reproduces schedules that already exist; nothing edits them. [CLAUDE.md](CLAUDE.md) is
the working guide and design record.

React 19 + Apollo Client + Highcharts (XRange) + react-big-calendar + PrimeReact +
Tailwind CSS 4. The real Scala backend does not exist yet, so the package carries a
standalone mock GraphQL server (see [`mock-server/README.md`](mock-server/README.md))
serving nine semesters imported from the operations workbook export - it is what the
browser tests execute against, what codegen reads and what `:4000` serves, and it is
**not** something the app can be pointed at. [ENDPOINTS.md](ENDPOINTS.md) is the
self-contained contract for the backend team - every query the UI and the scheduler
need, with the record types, the invariants and executable examples. CLAUDE.md records
the v1 scope trims.

## Development

```bash
pnpm resource-ui dev            # vite dev server on http://localhost:5173
```

The app reads **one backend**, over HTTP, at `/resource/graphql`. The vite proxy carries
that path to the real dev deployment, purely to sidestep CORS. That service does not
serve the v1 API yet, so `dev` shows an amber banner naming the situation and every view
is empty. **That is the expected state of this branch**, and it is what a deployed build
shows too.

To see the views with data, point the proxy at the local mock instead - two terminals:

```bash
pnpm resource-ui dev:mock-server   # mock GraphQL API on http://localhost:4000/graphql
pnpm resource-ui dev:mock          # dev server, proxying /resource/graphql to :4000
```

`dev:mock` is `RESOURCE_API=mock vite`. The switch is in the dev server, never in the
app: there is no control to choose a backend and no second Apollo link, because the mock
schema was once executed in the browser behind one and put 245 kB of server-side code
into the bundle. Start `dev:mock-server` first or every query 502s, and restart it after
editing the schema - a mock left over from an old session serves a schema that no longer
exists.

The mock server is also what to run on its own for GraphiQL, or for an external consumer
trying the API.

### Codegen

```bash
pnpm resource-ui codegen
```

Regenerates the typed GraphQL operations and the SDL the mock serves, both into
`src/gql/gen/` (gitignored). Run it whenever `mock-server/schema.graphql` or an
operation in `src/gql/` changes - the mock server reads the generated SDL, so until codegen
runs, `:4000` still serves the previous schema. `prebuild` runs it automatically on build.

### Tests and checks

```bash
pnpm resource-ui test           # vitest, runs in a real browser (Playwright chromium)
pnpm resource-ui build          # tsc -b && vite build
pnpm resource-ui lint:eslint
```

First-time browser tests need `pnpm resource-ui exec playwright install chromium`.

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

The app reads **one backend**: the live Resource service at `/resource/graphql`. The
vite proxy carries that path to the real dev deployment purely to sidestep CORS, never
to stand something else in for it. That service does not serve the v1 API yet, so `dev`
shows an amber banner naming the situation and every view is empty. **That is the
expected state of this branch**, in development and deployed alike - the views are
exercised against the mock by the browser tests, not by the dev server.

To look at what the contract answers - GraphiQL, or an external consumer trying the
API - run the mock server on :4000:

```bash
pnpm resource-ui dev:mock-server   # mock GraphQL API on http://localhost:4000/graphql
```

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

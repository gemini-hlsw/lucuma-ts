# @gemini-hlsw/resource-ui

Web UI for the GPP Resource service (telescope calendar and operational-resource manager):
an accurate, readable, interactive reproduction of the telescope schedules -
tonight, a week, and a semester of observing nights - plus the two inventory browsers,
the ICTD half: `/instruments` ("where is GNIRS, tonight - and if it is on no port, say
so") and `/components` ("where is the R400 grating"). **v1 is read-only**: Resource
reproduces schedules that already exist; nothing edits them. [CLAUDE.md](CLAUDE.md) is
the working guide and design record.

React 19 + Apollo Client + Highcharts (XRange) + PrimeReact + Tailwind CSS 4. The app
carries its own mock GraphQL API (see [`mock-server/README.md`](mock-server/README.md))
serving nine semesters imported from the operations workbook export; the real Scala
backend does not exist yet. [ENDPOINTS.md](ENDPOINTS.md) is the self-contained contract
for the backend team - every query the UI and the scheduler need, with the record types,
the invariants and executable examples. CLAUDE.md records the v1 scope trims.

## Development

```bash
pnpm resource-ui dev            # vite dev server on http://localhost:5173
```

That alone is a working app: the default **Demo data** source executes the mock
GraphQL schema in the browser. The masthead's Data control switches to the
**Live server** (`/resource/graphql`, proxied in dev to the real dev deployment
purely to sidestep CORS); it does not serve the v1 API yet, so selecting it
surfaces a banner with the way back to demo data.

To inspect the demo data over HTTP - GraphiQL, or an external consumer trying
the API - host the same mock on :4000:

```bash
pnpm resource-ui dev:mock-server   # mock GraphQL API on http://localhost:4000/graphql
```

### Codegen

```bash
pnpm resource-ui codegen
```

Regenerates the typed GraphQL operations in `src/gql/gen/` (gitignored). Run it whenever
`mock-server/schema.graphql` or an operation in `src/gql/` changes; `prebuild` also runs it
automatically.

### Tests and checks

```bash
pnpm resource-ui test           # vitest, runs in a real browser (Playwright chromium)
pnpm resource-ui build          # tsc -b && vite build
pnpm resource-ui lint:eslint
```

First-time browser tests need `pnpm resource-ui exec playwright install chromium`.

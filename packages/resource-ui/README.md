# @gemini-hlsw/resource-ui

Web UI for the GPP Resource service (telescope calendar and operational-resource manager):
an accurate, readable, interactive replacement of the published semester schedules -
tonight, a week, and a semester of observing nights - plus the component browser, the
ICTD half ("where is the R400 grating, tonight"). **v1 is read-only**: Resource
reproduces schedules that already exist; nothing edits them. [PLAN.md](PLAN.md) is the
design record.

React 19 + Apollo Client + Highcharts (XRange) + PrimeReact + Tailwind CSS 4. The app runs
against a local mock GraphQL API (see [`mock-server/README.md`](mock-server/README.md))
serving the eight real published schedules plus one labelled synthetic demo semester; the
real Scala backend does not exist yet. The v1 domain and API are specified in
`lucuma-odb/resource/docs/`, with the v1 trims recorded in PLAN.md §3.3.

## Development

```bash
pnpm resource-ui dev            # vite dev server on http://localhost:5173
```

That alone is a working app: the default **Demo data** source executes the mock
GraphQL schema in the browser. The masthead's Data control switches to the
**Live server** (`/resource/graphql`); in dev that proxies to the local mock
server, so run it in a second terminal to exercise the HTTP path (or to use
GraphiQL):

```bash
pnpm resource-ui dev:mock-server   # mock GraphQL API on http://localhost:4000/graphql
```

The live Resource service does not serve the v1 API yet; selecting it surfaces
a banner with the way back to demo data.

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

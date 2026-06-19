# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

`lucuma-ts` (`@gemini-hlsw/lucuma-ts`) is a pnpm monorepo (`pnpm`, Node + corepack) of TypeScript apps and libs supporting GPP. Individual package names mix `navigate-*`, `lucuma-*`, and `resource-*` prefixes — don't assume a package's name from its folder.

Packages (under `packages/*`):

- **ui** (`@gemini-hlsw/navigate-ui`) — React 19 web UI to configure the telescope. PrimeReact + Tailwind v4, Jotai state, Apollo Client, react-router.
- **configs** (`@gemini-hlsw/navigate-configs`) — GraphQL backend (graphql-yoga) over a Postgres DB via Prisma. Serves the `/db` endpoint the UI talks to.
- **resource-ui** (`@gemini-hlsw/resource-ui`) — separate React web UI for Resource, with its own mock GraphQL server for local dev.
- **common-ui** (`@gemini-hlsw/lucuma-common-ui`) — shared code/utilities/test setup imported by `ui` and `resource-ui`.
- **e2e** (`@gemini-hlsw/navigate-e2e`) — Playwright end-to-end tests that run real `ui` + `configs` + a `navigate-server` docker image.

## Common commands

Root scripts proxy into packages via filters — e.g. `pnpm ui <script>`, `pnpm configs <script>`, `pnpm resource-ui <script>`, `pnpm e2e <script>`, `pnpm all <script>` (runs across all).

```bash
pnpm install                 # requires 'pnpm config set "//npm.fontawesome.com/:_authToken" "$FONTAWESOME_NPM_AUTH_TOKEN"' (FontAwesome Pro)

# UI dev
pnpm ui dev                  # vite dev server
pnpm ui codegen              # regenerate GraphQL types (run after changing any *.graphql or gql documents)
pnpm ui codegen:watch
pnpm ui build                # tsc -b && vite build (runs codegen via prebuild)
pnpm ui test                 # vitest — runs in a real browser (Playwright/chromium)

# configs (backend) dev
pnpm configs generate        # prisma generate
pnpm configs codegen         # graphql-codegen
pnpm configs dev             # node --watch with .env
pnpm configs test            # node:test integration tests (spins up a Postgres testcontainer)

# resource-ui
pnpm resource-ui dev
pnpm resource-ui dev:mock-server   # local mock GraphQL server
pnpm resource-ui test

# lint (root, all packages)
pnpm lint                    # prettier --check + stylelint
pnpm <pkg> lint:eslint       # eslint per-package (eslint is configured per-package)
pnpm tsc:watch               # typecheck the whole build graph in watch mode

# e2e
pnpm e2e e2e:docker-up       # docker compose up the server stack
pnpm e2e test:e2e            # playwright test
```

Run a single test:

- UI/resource-ui (vitest): `pnpm ui test <path-or-name>` or `pnpm ui exec vitest run -t "<test name>"`.
- configs (node:test): `pnpm configs exec node --test --enable-source-maps src/integration/<file>.test.ts` (Docker must be running for the Postgres testcontainer).

## Architecture

### GraphQL is the backbone — three separate schemas in the UI

The UI talks to **three distinct GraphQL endpoints**, each with its own generated types under `packages/ui/src/gql/{odb,server,configs}/gen/` (configured in `packages/ui/tasks/codegen.ts`):

- **odb** — schema from `@gemini-hlsw/lucuma-schemas/odb` (the ODB / observation database; requires auth token).
- **server** — schema from `@gemini-hlsw/lucuma-schemas/navigate` (the navigate command server, at `/navigate/graphql` + `/navigate/ws` for subscriptions).
- **configs** — schema is the local `packages/configs/src/**/*.graphql` files, served at `/db`.

All three are wired into a single Apollo Client in `packages/ui/src/gql/ApolloConfigs.ts`, which routes operations to the right endpoint via Apollo links (HTTP for queries/mutations, `graphql-ws` for subscriptions), injects the ODB auth token, and surfaces errors as PrimeReact toasts. The base server URIs are derived at runtime from `window.location.origin`.

**When you change a `.graphql` schema file or a gql document, you must re-run codegen** (`pnpm ui codegen` / `pnpm configs codegen`) or types will be stale. The `prebuild` script does this automatically on build; CI runs `codegen` and (for configs) `generate` before lint/test/build.

### UI state: Jotai

App state lives in Jotai atoms under `packages/ui/src/components/atoms/` (auth token, server config, instrument, target, connection status, theme, etc.). A single shared store is created in `atoms/store.ts` and provided via `<Provider>` in `App.tsx`; non-React code (e.g. the Apollo links) reads/writes atoms directly through `store.get`/`store.set`. The app gates on loading `serverConfiguration` before rendering and retries on error.

### UI path aliases

`packages/ui/tsconfig.json` defines TS path aliases used throughout: `@/*` → `src/*`, plus `@gql/*`, `@Contexts/*`, `@Shared/*`, `@Telescope/*`, `@WavefrontSensors/*`, `@Guider/*`, `@assets/*`. Vite resolves these via `tsconfigPaths`. Prefer these aliases over deep relative imports, matching existing files.

### UI tests run in a real browser

Vitest is configured with the Playwright browser provider (`packages/ui/vite.config.ts`) — tests execute in chromium, not jsdom. Shared setup comes from `@gemini-hlsw/lucuma-common-ui/test/setup.ts`. Use `vitest-browser-react` for rendering.

### configs backend

- **Prisma**: schema at `packages/configs/prisma/schema.prisma`; the client is generated into `packages/configs/src/prisma/gen/` (run `pnpm configs generate`). `src/prisma/extend.ts` extends the client; `src/prisma/queries/` holds query/seed logic (`populateDb`).
- **GraphQL**: schema split across `src/graphql/schema/*.graphql`; resolvers in `src/graphql/resolvers/{Query,Mutation}/`; generated resolver types in `src/graphql/gen/`. The yoga server is assembled in `src/server.ts` (`makeYogaServer`).
- **Server entry** (`src/index.ts`) runs a Node `cluster` with one worker per CPU; `node src/index.ts populate` seeds the DB instead of serving.
- **Integration tests** (`src/integration/*.test.ts`) use `@testcontainers/postgresql` to spin up a real Postgres per fixture (`src/integration/setup.ts` exposes an `executeGraphql` helper) — **Docker is required** to run them.

## Conventions

- ESLint flat config is **per-package** (extending root `eslint.config.shared.js`); run `pnpm <pkg> lint:eslint`. Root `pnpm lint` only covers Prettier + Stylelint.
- TS configs extend `@tsconfig/strictest`; the React compiler (`babel-plugin-react-compiler`) is enabled in the UI build.
- Import sorting is enforced (`eslint-plugin-simple-import-sort`); lint-staged + Prettier run on commit via Husky.
- Generated code (`**/gen/`, `src/prisma/gen/`) is not committed and should never be hand-edited — change the source schema/documents and re-run codegen.

## CI & publishing

CI (`.github/workflows/ci.yml`) builds/lints/tests only changed packages (`...[origin/main]...` filters), runs the Playwright e2e job against a docker stack, and on tag push builds & publishes two docker images: `noirlab/gpp-nav-configs` (configs) and `noirlab/gpp-nav` (server + UI static files).

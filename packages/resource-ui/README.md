# @gemini-hlsw/resource-ui

Web UI for the GPP Resource service (telescope calendar and operational-resource manager):
an accurate, readable, interactive reproduction of the telescope schedules -
tonight, a week, and a semester of observing nights - plus the two inventory browsers,
the ICTD half: `/instruments` ("where is GNIRS, tonight - and if it is on no port, say
so") and `/components` ("where is the R400 grating"). **v1 is read-only**: Resource
reproduces schedules that already exist; nothing edits them. [CLAUDE.md](CLAUDE.md) is
the working guide and design record.

React 19 + Apollo Client + Highcharts (XRange) + react-big-calendar + PrimeReact +
Tailwind CSS 4. The schema is the backend's, from `@gemini-hlsw/lucuma-odb-schemas/resource`
(gemini-hlsw/lucuma-odb#3050); where it and this package disagree, the backend wins.
CLAUDE.md lists the operations the UI runs and records the v1 scope trims.

## Development

```bash
pnpm resource-ui dev            # vite dev server on http://localhost:5173
```

The app reads **one backend**, over HTTP, at `/resource/graphql`: the live Resource
service. The vite proxy carries that path to the dev deployment, purely to sidestep CORS.
Every data field needs an SSO sign-in, so signed out, `dev` shows an amber sign-in toast
and every view is empty. Signing in from a local dev server takes the setup below.

To try queries by hand, the service's GraphiQL playground is at
https://lucuma-resource-dev.lucuma.xyz/resource/playground.html.

### Signing in locally

The dev SSO admits any `lucuma.xyz` origin and refuses `localhost`, and its session cookie is
`SameSite=Strict`, which the browser sends only from an https page on that domain. So give the
dev server such a name and serve it over https:

```bash
sudo sh -c 'echo "127.0.0.1 local.lucuma.xyz" >> /etc/hosts'   # once
pnpm resource-ui dev:https                                         # RESOURCE_HTTPS=1 vite, self-signed
```

Open https://local.lucuma.xyz:5173 (accept the certificate once), then sign in from the app
menu with an ORCID account. A session started on any other lucuma.xyz app is already there.

### Codegen

```bash
pnpm resource-ui codegen
```

Regenerates the typed GraphQL operations into `src/gql/gen/` (gitignored). Run it whenever an
operation in `src/gql/` changes or the schema package is bumped. `prebuild` runs it automatically
on build.

### Tests and checks

```bash
pnpm resource-ui test           # vitest, runs in a real browser (Playwright chromium)
pnpm resource-ui build          # tsc -b && vite build
pnpm resource-ui lint:eslint
```

First-time browser tests need `pnpm resource-ui exec playwright install chromium`.

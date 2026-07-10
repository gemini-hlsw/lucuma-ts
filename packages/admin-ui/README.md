# GPP Admin UI

The internal Admin interface for editing program administrative information
(Shortcut epic [5747](https://app.shortcut.com/lucuma/epic/5747), GPP design
doc chapter 11). Five views:

- **Programs** (sc-9090) — administrative parameters of accepted programs:
  class, ToO, contact scientists, active period, time awards, private note.
- **Proposals** (sc-9092) — review Director's Time / Poor Weather proposals;
  accepting applies the time award. Each selection runs the conflict
  (sc-9243) and archive-duplication (sc-9244) checks.
- **Change Requests** (sc-9094) — approve/deny PI configuration-change
  requests, grouped by program, with the same two checks.
- **Users** (sc-9096) — assign staff & NGO roles via SSO `addRole` /
  `deleteRole` (sc-8978).
- **Calls for Proposals** (sc-9098) — create & edit calls.

Two GraphQL services back it: the **ODB** (programs, proposals, change
requests, calls — codegen-typed via `@gemini-hlsw/lucuma-schemas/odb`) and
**SSO** (the Users view's roster and role mutations, hand-written in
`src/auth/ssoGraphql.ts` since that schema isn't published). The SSO `users`
roster query is in development upstream (sc-9059); until it deploys, the
Users view surfaces SSO's error. The sc-9244 duplication check calls
archive.gemini.edu, which sends no CORS headers — the dev server proxies
`/archive`; a deployed equivalent (hosting proxy or archive-side CORS) is an
open question.

```bash
pnpm admin-ui dev        # dev server (proxies /odb, /sso-graphql, /archive to dev services)
pnpm admin-ui codegen    # regenerate ODB types (required after GraphQL edits)
pnpm admin-ui test       # Vitest in Chromium
pnpm admin-ui build      # typecheck + production bundle
```

Deploys to Firebase Hosting on merge to `main` (the `resource-ui` pattern),
via the `admin-changes` / `deploy-admin` CI jobs. The Firebase site,
`admin-ui-dev` GitHub environment, and `.firebaserc` site ids still need to
be provisioned before the deploy job can succeed.

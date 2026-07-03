# GPP Admin UI

The internal Admin interface for editing program administrative information
(Shortcut epic [5747](https://app.shortcut.com/lucuma/epic/5747), GPP design
doc chapter 11). Five views: Programs (sc-9090), Proposals (sc-9092), Change
Requests (sc-9094), Users (sc-9096), Calls for Proposals (sc-9098).

Two GraphQL services back it: the **ODB** (programs, proposals, change
requests, calls) and **SSO** (the Users view's roster and `addRole`). Note
that the SSO `users` roster query is not yet deployed — it lives on
lucuma-sso's `add-users-query` branch; the Users view depends on it.

```bash
pnpm admin-ui dev        # dev server (proxies /odb and /sso-graphql to dev)
pnpm admin-ui codegen    # regenerate ODB types (required after GraphQL edits)
pnpm admin-ui test       # Vitest in Chromium
pnpm admin-ui build      # typecheck + production bundle
```

Deploys to Firebase Hosting on merge to `main` (the `resource-ui` pattern),
via the `admin-ui-changes` / `deploy-admin-ui` CI jobs.

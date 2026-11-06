# CLAUDE.md - resource-ui

Rules for `@gemini-hlsw/resource-ui` that the code cannot state for itself. Product scope is
[PRODUCT.md](PRODUCT.md), every visual decision is [DESIGN.md](DESIGN.md), and commands and local
sign-in are [README.md](README.md). The root CLAUDE.md's conventions (Vitest, toasts, helpers,
Tailwind, codegen) apply unchanged and are not repeated here.

## Backend

- **One backend, over HTTP, at `/resource/graphql`.** Never execute a GraphQL schema in the
  browser: that ships an executable schema and the SDL in the bundle. Every data field needs the
  SSO bearer, so the session gate shows the sign-in screen until a session exists.
- **Signed-in dev means `https://local.gemini.edu:5173` and nothing else.** The SSO origin check
  refuses `localhost` and the session cookie is `SameSite=Strict`, so any other name loads signed
  out. README has the setup.

## Data

- **Response → `domain/adapters.ts` → `domain/types.ts` → components.** Null handling and
  timestamp parsing happen in the adapters; components never see a generated shape.
- **Every object type a document selects gets its own fragment in `src/gql/resource.ts`**, and
  the app imports the fragment type from `src/gql/types.ts` under its short name
  (`TimestampIntervalItem`, not `…Fragment`). A window sent as variables is a `ScheduleSpan`,
  never a fragment type, so `__typename` never enters a request.
- **Blocks have no `id`, on purpose.** The same block comes back clipped from the night query and
  unclipped from the range queries, so a block is a projection onto a window, not a record. With
  an `id` Apollo would normalize it and write one window's answer over another's, emptying a
  scheduled night. Row keys come from response position in the adapters.
- **Intervals only, never a `date` on a block.** Partial nights are first-class; a date field
  would make them a retrofit.
- **A gap means "not recorded", never "unavailable".** A blank port row stays, because a missing
  row would say the port does not exist.
- **`toLocation` in `domain/adapters.ts` is the only place that checks the `place`/`port` pair.**
  A contradictory record reads as off-port with a dev warning, never an error, so one bad record
  cannot empty a night. No location literals at call sites.

## Views

- **Every schedule view goes through `projectWindow` in `domain/timeline.ts`** (or
  `collectSchedule` once plus `placeWindow` per window, as the semester does per month). Nothing
  else reads an availability block. A view adds only its own axis and extras; chart pieces every
  view composes live in `features/timeline/timelineOptions.ts`.
- **`features/timeline/instruments.ts` owns every instrument's name, colour and ink.**
- **The two finder pages are not shared on purpose**: their shapes diverge, and a `FinderPage`
  with a dozen props would hide nothing.

## URL and state

- **Site rides the URL** through `app/useSelection.ts`, falling back to `app/useLastSite.ts`; it
  is the one parameter written back when absent, as a replace. Page parameters go through
  `app/useUrlParam.ts`, and a default is deleted from the URL, not written.
- **A link carries `site` and `night` and nothing else**, through `app/carriedSelection.ts`.
  Every other parameter is one page's and is dropped at the boundary.
- **A reader's habit is a `createPreference` from `app/preference.ts`**, never raw storage. The
  session token is not a habit: it lives in common-ui's `odbTokenAtom`, reached only through
  `@/components/atoms/auth`, and must not outlive the tab.

## Session

- **`src/auth/session.ts` runs on the store it is given**, as do the link factories in
  `gql/ApolloConfigs.ts`. `main.tsx` is the only non-test module that imports
  `components/atoms/store.ts`; everything else takes the store from the provider.
- **Nothing mounts before the session check settles.** `auth/SessionGateContainer.tsx` hands
  `sessionStatusAtom` to `auth/SessionGate.tsx`, which draws only the loading mark under the
  environment banner while the status is `checking`, then the splash signed out or the app signed
  in, at the URL that was opened. `auth/SplashContainer.tsx` makes the guest call and owns its
  state; `auth/Splash.tsx` only draws, from props, so its layout and focus tests need no SSO stub.
  The banner is the gate's, so the shell draws none.
- **Requests wait for the session check, the app does not.** `sessionHoldLink` holds each request
  until `sessionCheckedAtom` is true, so a cold load sends each query once, with the bearer. The
  check is bounded by `REFRESH_TIMEOUT_MS`, so a hung SSO releases the requests signed out.
- **A logout is announced on the `resource-session` BroadcastChannel**, so other tabs sign out
  without calling SSO. A sign-out only resets the keeper; the provider's unmount alone stops it,
  because a guest signs in on the same page and the keeper must still hear, renew and expire.
- **The token going to null clears the Apollo store** (`AuthSession.tsx`), whatever ended the
  session, so the next sign-in, by anyone, fetches every page afresh instead of reading this one's
  cache. It is `clearStore`, not `resetStore`: the gate unmounts every page, so there is nothing
  to repaint, and a reset's refetch would leave without the bearer and be refused.
- **Every notice about the session itself comes from `auth/SessionNoticesContainer.tsx`**, mounted
  by `AuthSession` above the shell. It reads only the session status and `sessionEndingAtom`, the
  one union that `signOut` and the keeper write to say how the session ended, and hands the
  screen-reader announcement to the `auth/SessionNotices.tsx` live region. The keeper records an
  ending only for a session that was signed in. The masthead shows none, because it is not mounted
  when they are due.

## Testing

- **The GraphQL answer at the link is the one seam.** No `vi.mock` of an app module: real
  children, the real router, a fresh Jotai store per render (`src/test/render.tsx`), and `vi.fn()`
  props. Mocks are built per operation by `src/test/fixtures/` with only the blocks the assertion
  needs; each answers once, and an unanswered query fails the test, so a fixture must match the
  variables the page sends.
- **Test files run as same-origin iframes of one tab and would share its `sessionStorage`.**
  `src/test/setup.ts` gives each file its own, because `odbTokenAtom` snapshots storage when its
  module loads. Two stores mounted in one test still share a token.
- **URL hooks are driven through the URL**, with `test/probe.tsx` inside the real router, never
  `renderHook`. One `Probe` per route: two at the same position with different hook counts is a
  hook-order violation.
- **PrimeReact overlays render into `document.body`.** Reach a dropdown through `openDropdown` /
  `selectDropdownOption` from `@gemini-hlsw/lucuma-common-ui/testing`.
- **A component that reads the store, the URL, a preference or SSO is an `XContainer`** beside a
  view `X` that draws only from props. The view's tests need no store, router or SSO stub; the
  container's tests own the outside-world behaviour, and no test lives in both.
- **Tests load no app stylesheet.** A test that needs styling to pass is testing the stylesheet.

## Styling

- **When a Tailwind utility loses to a PrimeReact control, the winner is `lucuma-ui-css`, not
  PrimeReact.** The theme wraps itself in `@layer primereact`, and `main.tsx` loads it after
  `global.css` has declared Tailwind's layers, so `primereact` sits above `utilities` and its
  rules (`.dark .p-tag`) beat a utility whatever the specificity. Declaring the layer order later
  does nothing: a layer keeps the place of its first mention. Override through the theme's own
  variables in `shell.css` first; where the theme hardcodes a value, a rule in `shell.css` wins
  because `shell.css` is unlayered; shape it `.dark .p-tag` so it reads as the rule it replaces.

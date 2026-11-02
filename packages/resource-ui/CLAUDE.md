# CLAUDE.md - resource-ui

Rules for `@gemini-hlsw/resource-ui` that the code cannot state for itself. Product scope is
[PRODUCT.md](PRODUCT.md), every visual decision is [DESIGN.md](DESIGN.md), and commands and local
sign-in are [README.md](README.md). The root CLAUDE.md's conventions (Vitest, toasts, helpers,
Tailwind, codegen) apply unchanged and are not repeated here.

## Backend

- **One backend, over HTTP, at `/resource/graphql`.** Never execute a GraphQL schema in the
  browser: that ships an executable schema and the SDL in the bundle. Every data field needs the
  SSO bearer, so signed out every view is empty under the sign-in toast; that is not a bug.
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
- **Requests wait for the session check, the app does not.** `sessionHoldLink` holds each request
  until `sessionCheckedAtom` is true, so a cold load sends each query once, with the bearer. The
  check is bounded by `REFRESH_TIMEOUT_MS`, so a hung SSO releases the requests signed out.
- **A logout is announced on the `resource-session` BroadcastChannel**, so other tabs sign out
  without calling SSO.

## Testing

- **The GraphQL answer at the link is the one seam.** No `vi.mock` of an app module: real
  children, the real router, a fresh Jotai store per render (`src/test/render.tsx`), and `vi.fn()`
  props. Mocks are built per operation by `src/test/fixtures/` with only the blocks the assertion
  needs; each answers once, and an unanswered query fails the test, so a fixture must match the
  variables the page sends.
- **`odbTokenAtom` snapshots `sessionStorage` when its module loads**, so two stores mounted in
  one test share a token.
- **URL hooks are driven through the URL**, with `test/probe.tsx` inside the real router, never
  `renderHook`. One `Probe` per route: two at the same position with different hook counts is a
  hook-order violation.
- **PrimeReact overlays render into `document.body`.** Reach a dropdown through `openDropdown` /
  `selectDropdownOption` from `@gemini-hlsw/lucuma-common-ui/testing`.
- **Tests load no app stylesheet.** A test that needs styling to pass is testing the stylesheet.

## Styling

- **When a Tailwind utility loses to a PrimeReact control, the winner is `lucuma-ui-css`, not
  PrimeReact.** `lucuma-ui.scss` loads the theme unlayered inside `.dark { }`, so its rules
  (`.dark .p-tag`, 0-2-0) beat a layered utility (0-1-0) twice over. Declaring PrimeReact's layer
  order does nothing here. Override through the theme's own variables in `shell.css` first; where
  the theme hardcodes a value, a `.dark .p-tag`-shaped rule in `shell.css` ties on specificity and
  wins on source order.

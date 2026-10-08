# CLAUDE.md - resource-ui

Working guide for `@gemini-hlsw/resource-ui`, the web UI for the GPP **Resource** service.
This file carries **engineering mechanics only**. Product truth lives in
[PRODUCT.md](PRODUCT.md); every visual and interface decision lives in [DESIGN.md](DESIGN.md).
When a change touches what the app looks like or how it behaves for a reader, those two files
are the authorities - do not record such decisions here. The package is unpublished and
pre-v1: what is written here are live constraints, not history. When something is removed, it
leaves this file with it.

## State of the package

The v1 read surface is complete; PRODUCT.md names the five destinations it draws.

**The app reads one backend, over HTTP** - the live Resource service at `/resource/graphql`
(gemini-hlsw/lucuma-odb#3050). In dev the vite proxy carries that path to the dev deployment,
purely to sidestep CORS. Every data field needs an SSO Bearer token: without one the service
answers "Field 'X' requires authentication.", and the app shows the sign-in toast
(`src/gql/ApolloConfigs.ts`). Introspection works anonymously, and the GraphiQL playground is at
https://lucuma-resource-dev.lucuma.xyz/resource/playground.html.

**No data source runs in the client.** The app must never execute a GraphQL schema in the
browser - that puts an executable schema and the SDL into a frontend bundle. There is no control
to choose a backend and no second link.

## Selection and URL state

The interaction rules for selection (masthead vs page controls, Tonight as the front door,
the clock toggle, finder scoping) are DESIGN.md's. The mechanics:

- **Three selections, three mechanisms.** Which belongs where is DESIGN.md's rule; these are
  the parts:
  - **Site** rides the URL through `app/useSelection.ts`, and its absence resolves to
    `app/useLastSite.ts` rather than a hard-coded GN. `setSite` writes both. It is also the one
    parameter written back when absent (a replace, so Back is unaffected) - DESIGN.md says why
    a remembered default cannot be left implicit the way every other default is.
  - **Semester** is `app/useSemester.ts`, which owns the page-scoped `semester` param through
    `useUrlParam` (clearing `month`) and resolves it with `domain/coverage.ts`'s
    `resolveSemester`. Only /semester may call it. Pages needing the night's own semester -
    the demo flag above all - use `semesterHolding`, which returns null outside coverage
    rather than reaching for the nearest.
  - **Clock** is `app/useClockPreference.ts`, built on `app/preference.ts`: a
    `useSyncExternalStore` over `localStorage`, so every reader re-renders on a write from any
    tree. It is not in the URL. `displayTimeZone` in `domain/siteTime.ts` is still the one zone
    resolver, threaded as a required parameter so no formatter can silently stay site-local.
- **`app/preference.ts` is the one way to persist a reader's habit.** Add a preference by
  calling `createPreference`, not by reaching for `localStorage`: it validates what it reads
  back, notifies every subscriber, and holds the session's own choice in a closure so a denied
  write costs the choice its persistence rather than its effect. Tests start with no habit -
  `src/test/setup.ts` clears storage and fires the storage event that invalidates that closure.
- **Every night-shaped thing opens its night view through `app/useOpenNight.ts`** - calendar
  squares, week cards, chart bars all route through the one hook.
- **Page-scoped parameters go through `app/useUrlParam.ts`.** Defaults are deleted from the
  URL, not written, and subordinate parameters drop in the same update: the calendar's month
  belongs to the calendar alone, so switching view or semester drops it.
- **A navigation carries `site` and `night` and nothing else**, through
  `app/carriedSelection.ts` - the one answer to what survives a link. A menu link to the
  inventory carries `site` alone (`carries` in `SidebarMenu.ts`), since those pages answer for
  tonight and never read a night. Every other parameter
  (`semester`, `month`, `view`, `q`, `instrument`, `type`, `location`) is one page's, and is
  dropped at the boundary rather than following the reader into a view that never reads it.
  This is react-router's own default for `to`; carrying more would be the hand-written
  override, so a new link needs no convention, only the helper where it wants site and night.
- The finder pages' window comes from `app/useRecentSpan.ts`: the 400 days ending tonight, the longest
  window the Resource service accepts.

## Auth mechanics

The masthead says who is signed in and the app menu holds the login and the logout. No view is
gated on a session - a signed-out reader can open every one - and what a session buys today is
the `Authorization: Bearer <JWT>` header every Resource data field requires; signed out, every
view is empty under the sign-in toast.

- **The token lives in common-ui's `odbTokenAtom`**, a sessionStorage-backed Jotai atom, and the
  app reaches it - and `userAtom`, `isLoggedInAtom`, `sessionStatusAtom` - only through
  `@/components/atoms/auth`. **`app/preference.ts` is not for it**: a session is not a reader's
  habit and must not outlive the tab.
- **`src/auth/session.ts` is the one session keeper** - a module-level controller over the store it
  is started with (`startSession(store)`). It bootstraps from the SSO cookie, re-refreshes from the
  token's own `exp`, keeps one request in flight, and backs off only when SSO is unreachable (30 s
  doubling to 16 min, with or without a token - the `SESSION_TIMINGS` defaults `startSession` takes,
  which tests shrink to tens of milliseconds to run on the real clock); a rejected refresh signs the
  reader out and arms no timer, though refocusing the tab still asks SSO for the cookie once 30 s
  have passed since the last attempt, which is how a session started in another lucuma.xyz tab gets
  picked up; a token leaves the store when its `exp` passes, at once if it is restored or arrives
  expired (with a console warning when SSO issued it that way), and the auth link also checks `exp`
  itself because a sleeping tab fires that timer late; `signOut` tears the keeper down whether or
  not SSO answers, so only a full page load can sign the reader back in. Before asking SSO it
  announces the logout on the `resource-session` BroadcastChannel, which a keeper holds open only
  while it runs; every other tab's keeper then signs out the same way without calling SSO, first
  setting `signedOutElsewhereAtom` so that tab's toast says where the logout happened. It
  announces again once the logout call settles, for a tab that loaded in between.
  Non-React callers - the Apollo links, `signOut` - take the store as an argument rather than a hook.
- **`auth/AuthSession.tsx` starts that keeper once**, wrapped around `<App />` in `main.tsx`, and
  renders the app at once. The requests wait instead: `sessionHoldLink`, first in the live chain
  (`gql/ApolloConfigs.ts`), holds each one until `sessionCheckedAtom` is true, so none goes out
  before the bearer is known and a signed-in cold load sends each query once, with the bearer.
  `AuthSession` also refetches every active query when the reader signs in or out later. The
  check is bounded: `refreshSession` gives up on SSO after 10 s and reads the silence as
  `unreachable`, so a hung answer releases the requests signed out and the keeper's backoff and
  token-retention rules take over.
- **Tests sign in through `renderWithContext`**: `renderWithContext(<Page />, { token: fakeJwt(standardUser('staff')) })`
  (`src/test/factories.ts`). Each render gets a Jotai store of its own, hydrated with the token and
  `sessionCheckedAtom`, the way ui's `renderWithContext` does. The keeper (`startSession(store)`),
  `signOut(store)` and the links (`liveLink(store, transport)`) take the store as an argument;
  components reach it through `useStore()`, so `AuthSession` and the Navbar hand the keeper and `signOut`
  whichever store the tree provides - `main.tsx` provides the app's own (`components/atoms/store.ts`),
  and `gql/ApolloConfigs.ts` builds `client` from that same store. `src/test/setup.ts` clears both
  storages before each test, because `odbTokenAtom` reads sessionStorage the first time a store touches it.
- **The SSO host is absolute in every environment** (`app/environment.ts`'s `ssoUri`) - the cookie
  flows cannot go through the dev-server proxy. Each SSO host admits origins under its own domain
  and refuses the rest: staging's `sso-test.gpp.gemini.edu` answers `gemini.edu` and not
  `resource-staging.lucuma.xyz`, so staging reads signed out until that host is admitted, and
  neither host answers a `localhost` origin, so `pnpm resource-ui dev` reads signed out (the
  blocked refresh takes the unreachable path and retries on its backoff). `dev:https` with
  `local.lucuma.xyz` aliased in `/etc/hosts` is the way in (README, "Signing in locally"): the
  name is admitted, and https is what lets the browser send the `SameSite=Strict` cookie.

## The views

**Do not give a view its own path from records to pixels.** Every view projects from the placed rows
`domain/timeline.ts` produced, never from an `InstrumentAvailabilityBlock`, and both charts build on `domain/timeline.ts`
plus `features/timeline/`. A view supplies its own axis and its own way of phrasing a span - dates and
nights for the semester and week, clock times for a night - and nothing else. Adding a fourth window
should not mean copying any of it. The one deliberate exception is `domain/calendarNews.ts`, which
reads raw records because its subject is the records' own boundaries rather than placed spans.

| View              | What it draws                                                                                             | Its module                                    |
| ----------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Night             | the chart alone, plus PWFS1/PWFS2/LGS subsystem rows no other view shows                                  | `features/night/`                             |
| Week              | the run chart, plus `WeekNightStrip` (a card per night, each one a button onto it) and `WeekChangesTable` | `domain/weekBriefing.ts`                      |
| Semester chart    | an xrange per month: how long a run lasts                                                                 | `features/semester/`                          |
| Semester calendar | night chrome plus single-evening critical-event chips                                                     | `domain/calendarNews.ts`, `calendarNights.ts` |
| `/instruments`    | a row per instrument the site's records name, expanding into its runs                                     | `domain/instrumentFinder.ts`                  |
| `/components`     | the ICTD half: the piece catalog grouped by instrument, expanding into its history                        | `domain/componentFinder.ts`                   |

What each view may draw and how (calendar chips, change-feed rules, subsystem rows, legend
order, colour and treatment) is specified in DESIGN.md. Structural rules the code does not
state for itself:

- **Every schedule view heads itself with the Telescope, Mode and ToO rows** when records
  reach its window, through `collectStateRows` in `domain/timeline.ts`
  (`NOTABLE_MODE`/`NOTABLE_TOO` mark the states DESIGN.md calls notable). All chart layout is
  derived from the rows inside the shared builders - no view passes categories or header
  counts alongside its data.
- **The two browser pages are deliberately not shared.** The shapes diverge - grouped subheaders against
  a flat list, two filters against one, different expansions - and a `FinderPage` taking a dozen props
  would hide nothing. Both open a row into `components/ui/RecordHistoryTable.tsx`.
- **A night no semester covers says what is covered** (`domain/coverage.ts`), and offers the nearest
  covered night. A demo semester never merges with a real one.

Three traps in the calendar, each of which has cost real time:

- A square is the **evening** a night begins, not the night's label, or it sits a day off the grid.
- All-day event **ends are exclusive** (local midnight after the last evening) or bars draw a day short.
- The calendar's height is **inline in the component**, not in `global.css` - the browser tests do not
  load the app stylesheet, and the height decides the week-row geometry.

## Shared modules

A thing drawn in two places is drawn from one module, taking a presentation shape rather than either page's
domain row. This is the rule the whole of `components/ui/` follows;
`src/features/components/componentCells.tsx` holds the one copy of each component cell, so no
two views can disagree about a closure. The visual and state rules for
these components are DESIGN.md's; this table is the ownership map.

| Module                                   | What it owns                                                                                                                                                                                                                                                                                                                                                             |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `WhereCell`                              | A `WhereReading`: coarse presence (on the telescope / off it / not recorded), the place in words, and the change tag. `componentLabels.componentWhere` and `InstrumentsPage.instrumentWhere` map onto it, one line each.                                                                                                                                                 |
| `PageHeader`                             | Every destination's title, synthetic flag, subtitle and right-hand controls slot.                                                                                                                                                                                                                                                                                        |
| `PageStatus`                             | The three page-state components (`ErrorAlert`, `Loading`, `EmptyPanel`); which state may look like what is DESIGN.md's.                                                                                                                                                                                                                                                  |
| `NightStepper`                           | The Tonight / arrows / date toolbar, its chrome, aria labels and cleared-input guard. The page owns the date vocabulary.                                                                                                                                                                                                                                                 |
| `LabelledControl`                        | Binds a caption to its control **by id**, as a render prop, so the caller decides which prop carries it (`id` on an input, `inputId` on a PrimeReact Dropdown). It must not wrap the control: implicit labelling only reaches a labelable element, and a label wrapping a Dropdown named nothing and swallowed the control's words into the name ("Instrument All All"). |
| `FilterField`                            | The finder bar's layout over `LabelledControl`. `filterOptions.countedOption` is the "(12)" suffix.                                                                                                                                                                                                                                                                      |
| `InstrumentSwatch`                       | Colour square plus name (in `features/timeline/`, beside the palette it reads).                                                                                                                                                                                                                                                                                          |
| `siteTime.eveningLabel` / `eveningRange` | The one evening formatter. Style is a parameter (`dayMonth`, `dayMonthYear`, `weekdayDayMonth`) because that choice is about what the page already says, never about what the date means.                                                                                                                                                                                |

- **Toasts go through the one PrimeReact `Toast` that `ToastOutlet` mounts in `main.tsx`.**
  `useToast()`, or `store.get(toastAtom)` outside React, returns its handle, null until it mounts.
  Show a module-level `ToastMessage` constant with string `summary` and `detail` (the live-server
  failure toasts carry a summary alone), and withdraw it
  with `remove(thatConstant)`: PrimeReact removes by deep equality. What a toast says and looks
  like is DESIGN.md's ("Toasts").

## Gotchas that cost real debugging

Fixed structurally - do not undo it.

- **Availability blocks are contextual values, never cache entities.** The same block type comes back
  clipped from the night projection and unclipped from the range queries (`clip: false` on every one), so a
  block is a projection onto a window rather than a record. A stable `id` lets Apollo normalize one window's
  answer onto another's and empty a scheduled night (empty chart, "no components tonight"). No block
  type has an `id`; `domain/adapters.ts` makes row keys from response position; `src/gql/cache.ts` sets
  `keyFields: false` on every `…Block` type as the second lock. No test holds that list to the schema any
  more, so a new `…Block` type goes on it by hand. `NightPage.test.tsx` "keeps a revisited night intact" is
  the behavioural pin. `InstrumentComponent` keeps its id and stays normalized, being identity-only.

## Commands

**`README.md` is the command reference** - every script, signing in locally, codegen, the
first-time `playwright install chromium`, and why `dev` shows the sign-in toast. It is not repeated here.

## GraphQL and codegen

The schema is `@gemini-hlsw/lucuma-odb-schemas/resource`, read by codegen (`tasks/codegen.ts`) and
by `@graphql-eslint` (`eslint.config.js`), which validates every document against it with the full
rule set, `no-unused-variables` included (the rule codegen's own validation skips). Lint collects
documents from the same globs as codegen, so no document can escape it. Codegen writes the typed
operations into `src/gql/gen/`. **After changing an operation or bumping the schema package, run
`codegen`**; `prebuild` does it on build.

- Operations live in `src/gql/resource.ts`. A nested shape gets a fragment of its own, as in ui
  (`InstrumentLocationItem`), and `src/gql/types.ts` re-exports each generated `XItemFragment` as `XItem`:
  import fragment types from there (adapters, hooks, fixtures), never by their generated names. Hooks in
  `src/gql/hooks.ts` return **domain models**, not fragments.
- The client preset only emits types an operation selects. If a type is missing from `gen/`, the fix
  is an operation that selects it, not a hand-written duplicate.
- `require-selections` asks for an `id` wherever a type has one, which is why `InstrumentComponent`
  selections carry it. The `src/*/gen` entry in `eslint.config.shared.js`'s `globalIgnores` keeps the
  generated code out of the operation rules, which would otherwise read every document a second time.

One request per page load; every view gets its whole window in one response, all range queries
`clip: false`:

| Operation            | What it reads                                                                                                           | Views                                            |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `PublishedSemesters` | `publishedSemesters`                                                                                                    | the shell's semester picker; every view's bounds |
| `SemesterSchedule`   | `instrumentAvailability`, `telescopeAvailability`, `tooSupport`, `telescopeMode`                                        | Semester; `/instruments`, over the past 400 days |
| `NightSchedule`      | `telescopeNight` (`dataAvailable` and the interval) plus those four and `telescopeSubsystemAvailability`                | Night                                            |
| `WeekSchedule`       | `telescopeNights` (per-night `dataAvailable`) plus the four of `SemesterSchedule` and `instrumentComponentAvailability` | Week                                             |
| `ComponentBrowser`   | `components`, `instrumentComponentAvailability`, `instrumentAvailability`                                               | `/components`, over the past 400 days            |

## Data flow

GraphQL response → **pure adapters** (`src/domain/adapters.ts`) → **UI domain models**
(`src/domain/types.ts`) → components. All null handling and timestamp parsing lives in the adapters;
components never touch generated fragment shapes.

`src/domain/` holds the pure modules - date, interval and semester math, the sky (`moon.ts`, `sun.ts`), the
timeline and calendar projections, the two finders, the week briefing - each with unit tests beside it. Keep
date math and chart builders pure; keep components focused on rendering and interaction.

## Non-negotiables

**The API contract half of these is the backend's**: half-open intervals, a block as a value rather
than an entity, partial nights as first-class, I4 absence and clipping are the Resource service's
rules. What follows is the half that is this app's, plus the rules with no
other home.

- **Never put a `date` on a block.** Intervals only. The moment a `LocalDate` becomes a field, partial
  nights turn into a retrofit. (Referred to across the code as **the partial-night non-negotiable**.)
- **A gap means "not recorded", never "unavailable"** (invariant **I4**, stated in PRODUCT.md;
  how gaps may render is DESIGN.md's).
- **`toLocation` in `domain/adapters.ts` is the only place the app re-checks the `place`/`port` pairing**,
  and a contradictory record reads as off-port/`UNKNOWN` with a dev-mode warning, never an error, because
  one bad record must not empty a night. Do not build a location literal at a call site, and do not push
  the pair past the adapter: the domain model carries the exclusive form (`InstrumentAvailabilityBlock.port` xor
  `InstrumentAvailabilityBlock.place`, whose type `OffPortPlace` excludes `PORT`).
- **A record's port is its row; there is no row label.** `domain/ports.ts` renders the label from the port
  - do not reintroduce a display string the model can derive. The row set is `TELESCOPE_PORTS` unioned
    with any port the records name, so a quiet port keeps its blank row (blank says "nothing recorded"; a
    missing row would say the port does not exist) and a record on an unexpected port still draws.
- **A block has no `id`**; row keys are the adapters'. `InstrumentComponent` keeps its id, being real
  hardware. The cache lock that enforces this is under "Gotchas" above.
- **One capability per commit**, with its tests. The message is one concise Conventional Commits
  subject that says what the commit did (`feat(resource-ui): sign in and out from the app menu`), no
  body unless it states a fact the diff cannot show. Fold fixes and test additions into the commit
  they belong to before opening a PR, so history reads as capabilities, and never add AI or tool
  attribution trailers.
- **Comments are the exception, not the default.** Ship code with none; add one sentence only where
  the code cannot carry a constraint from outside the file (a library quirk, a rejected approach and
  why). Never history, attribution, session talk, or a restatement of what the code says.

## Testing

Browser-mode Vitest (Playwright chromium). Pure functions get plain unit tests; components with behaviour
of their own get browser tests beside their source; pages get browser tests that mount through
`renderWithContext` (`src/test/render.tsx`) and drive real interactions with accessible queries
(`getByRole`, `getByLabelText`). A page's own test never mounts the shell (`Layout` has its own tests, with
stand-in children; only a test whose subject wraps the shell, `AuthSession`, mounts a page under it); where a
page reacts to a preference, set it directly (`setClockPreference('utc')`). `renderWithContext` gives each
render a fresh store, as ui's does. Every operation a page sends,
`PublishedSemesters` included, is answered by a mock from `src/test/fixtures/`, whose row factories name
the fields a row needs (`PickRequired<Row, 'instrument' | 'interval'>`) and default the rest, with only the
**Blocks** the assertion depends on; a fixture must match the variables the page sends. Link-chain tests (session
hold, auth header, toasts) run the real links ahead of canned answers through `src/test/linkClient.ts`.

- **Every control whose press, toggle or hover changes what is displayed gets a browser test driving the real
  interaction.** Test both directions where they exist: what must change with the control (the night chart's
  axis under the Site | UTC clock) _and_ what must not. Guard "must change" assertions non-empty first, so a
  blanked chart cannot pass as merely "different".
- **Anchor on fixture dates, never the wall clock.** Where a test must involve "now", derive it with the same
  function the page uses.
- **PrimeReact overlays render into `document.body`**, outside the render container, so a Dropdown panel is
  unreachable from the render's locators. Drive dropdowns through `src/test/helpers.ts` (`openDropdown` /
  `selectDropdownOption`), which reaches the panel via `page`, scoped through `getByRole('listbox')` so the
  hidden native `<select>` mirror does not also match.
- **The tests load no app stylesheet**: a test that needs styling to pass is testing the stylesheet.
  A test whose subject is behaviour the stylesheet decides - a breakpoint, a contrast swap, a pixel
  budget - is the exception, and imports only what it needs. Loading `global.css` + `main.css` means
  also putting `.dark` in scope, on the root as `main.tsx` does or around the subject, or none of the
  theme's rules apply. Grep the existing exceptions before adding one.
- **A value the stylesheet owns and code restates is pinned in `src/test/cssMirrors.test.ts`**: the chart
  copies of the type tokens, every `var()` the code names, the per-instrument ink contrast, each alert
  panel's ink on its own fill, the foreground ladder against every surface, and the hand-written masthead
  breakpoint. It reads the CSS as text rather
  than loading it, so it is not a fifth exception. The foreground block pins both directions, since
  "muted is decoration only" is a claim about what must _fail_ 4.5:1 as much as what must clear it. Add
  the pin with the mirror, or the next reader has no way to know the two must agree.
- **The URL hooks in `src/app/` are driven through the URL**, not through `renderHook`: `test/probe.tsx` renders
  a hook inside the real router, prints what a test asserts on and offers buttons standing in for the app's
  controls. One `Probe` per route, though - two routes rendering it at the same position let React reuse the
  fiber, and two `use` bodies with different hook counts is a hook-order violation.
- Prefer tests driven by configuration (e.g. `SIDEBAR_MENU_SECTIONS`) over hard-coded lists.
- Don't assert on internal React structure; don't over-mock.

## Styling mechanics

What the theme looks like - tokens, palette, density, type, component treatments - is
DESIGN.md's alone. The tokens themselves live in `src/styles/global.css` (`@theme`) and are
wired into PrimeReact by `shell.css`. What follows is only the mechanics of making a style
land.

**When a Tailwind utility loses to a PrimeReact control, the winner is `lucuma-ui-css`, not PrimeReact.**
PrimeReact's own classes are wrapped in `@layer primereact` and set almost nothing (`.p-tag` gets three
flexbox properties), so they lose to anything. The theme is `lucuma-ui-css`, and `lucuma-ui.scss` loads it
**unlayered** inside `.dark { }` - so its rules are `.dark .p-tag` at 0-2-0, beating a Tailwind utility at
0-1-0 in `@layer utilities` twice over: unlayered outranks layered, and the specificity is higher anyway.
Declaring PrimeReact's documented layer order (`@layer tailwind-base, primereact, tailwind-utilities`) does
nothing here, because PrimeReact's layer is not the competitor - do not reach for it.

Override through the variables first: `shell.css` re-tints `lucuma-ui-css` by reassigning its own
`--surface-*`, `--text-color`, `--primary-color` and `--highlight-*`, which is why the app matches without
fighting any selector. Where the theme hardcodes a value with no variable behind it - the `.p-tag` size,
fill and ink - a rule of the theme's own shape in `shell.css` (`.dark .p-tag`, and
`.dark .p-tag.p-tag-success, .dark .p-tag.p-tag-danger`) ties on specificity and wins on source order:
that is how the tag's Dense size and the success and danger inks land with no `!` at all. Reach for `!`
only when the override is one instance rather than a selector the theme already names - the single `!`
left in this package is `StatusTag`'s muted Spare tag, picked out by utility classes at 0-1-0 that cannot
otherwise reach `.dark .p-tag`'s 0-2-0 fill and ink.

**The type scale and the rem-versus-px rule are DESIGN.md's** - the steps and their roles, the
`DENSE`/`TICK` chart mirrors, and which values grow with the reader's own font-size setting. One
mechanic it does not carry:

- **An `aria-hidden` icon glyph takes its size from FontAwesome's own `size` prop** (`size="sm"` =
  0.875em, `size="xs"` = 0.75em, omitted = 1em), never a class of ours: FA's scale is already em and
  each step carries the `line-height` and `vertical-align` correction that keeps the glyph on the
  text's baseline, which a hand-rolled em utility gets wrong. **In the masthead, add `widthAuto`** -
  FontAwesome 7 pads every icon to a fixed 1.25em canvas and the bar cannot spare that width. Leave
  it padded in the app menu, where it aligns the icon column. The ORCID logo on the login item is an
  `<img>` with no `size` prop and takes that same box as `h-[1em] w-[1.25em] object-contain`, so it
  sits in the column.

Prefer Tailwind utilities over CSS files except where Tailwind can't express it (complex selectors,
keyframes, third-party overrides).

## Architecture docs

`lucuma-odb/resource/docs/` is authoritative for the v1 backend domain and API, with the v1 scope trims applied
here: the schedule lifecycle, change log and restrictions are out of scope - every view reads the one published
record, and editing was descoped from v1. When the backend schema and anything in this package disagree, the
backend wins (ADR 0001).

## Agent skills

- Domain docs: glossary at `packages/resource-ui/docs/GLOSSARY.md`, ADRs in `packages/resource-ui/docs/adr/`. See `packages/resource-ui/docs/agents/domain.md`.

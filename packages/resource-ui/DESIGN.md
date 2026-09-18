---
name: Resource
description: Dark, dense engineering console for Gemini telescope schedules, chrome-continuous with GPP Explore
colors:
  gpp: 'hsl(122deg 39% 49%)'
  gpp-dark: 'hsl(122deg 39% 43%)'
  gpp-light: 'hsl(122deg 39% 55%)'
  gpp-accent: 'rgb(144 238 144 / 80%)'
  action-info: 'rgb(33 108 165)'
  action-secondary: 'rgb(106 115 124)'
  canvas: '#000'
  surface: '#1e1e1e'
  panel: '#262626'
  panel-header: '#313131'
  surface-raised: '#414141'
  subtle: '#454545'
  foreground: 'rgb(255 255 255 / 87%)'
  foreground-secondary: 'rgb(255 255 255 / 60%)'
  foreground-muted: 'rgb(255 255 255 / 38%)'
  warning: 'oklch(87.9% 0.169 91.605deg)'
  warning-fill: 'oklch(41.4% 0.112 45.904deg)'
  warning-edge: 'oklch(66.6% 0.179 58.318deg)'
  warning-ink: 'oklch(96.2% 0.059 95.617deg)'
  danger: 'oklch(80.8% 0.114 19.571deg)'
  danger-fill: 'oklch(39.6% 0.141 25.723deg)'
  danger-edge: 'oklch(50.5% 0.213 27.518deg)'
  danger-ink: 'oklch(93.6% 0.032 17.717deg)'
  schedule-closed: '#b91c1c'
  state-routine: '#737373'
  state-notable: '#d4d4d4'
  instrument-unknown: '#a1a1aa'
typography:
  body:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"'
    fontSize: '0.875rem'
    fontWeight: 400
    lineHeight: '1.25rem'
  title:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"'
    fontSize: '1rem'
    fontWeight: 600
    lineHeight: '1.5rem'
  dense:
    fontSize: '0.75rem'
    lineHeight: '1rem'
  tick:
    fontSize: '0.625rem'
    lineHeight: '0.875rem'
  wordmark:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"'
    fontSize: '0.875rem'
    fontWeight: 700
    letterSpacing: '0.4em'
rounded:
  chip: '2px'
  control: '4px'
spacing:
  spacing: '3.5px'
  xp-masthead-height: '35px'
  xp-banner-height: '20px'
  xp-bottomnav-height: '49px'
  xp-target-floor: '24px'
  xp-touch-target: '44px'
components:
  button-primary:
    backgroundColor: '{colors.gpp}'
    textColor: '#fff'
    rounded: '{rounded.control}'
    padding: '4.2px 9.8px'
  button-primary-hover:
    backgroundColor: '{colors.gpp-light}'
  button-secondary:
    backgroundColor: '{colors.action-secondary}'
    textColor: '{colors.foreground}'
    rounded: '{rounded.control}'
  segment-idle:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.foreground-secondary}'
  segment-active:
    backgroundColor: '{colors.surface-raised}'
    textColor: '{colors.foreground}'
  table-header:
    backgroundColor: '{colors.surface-raised}'
    textColor: '{colors.foreground}'
  table-row:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.foreground}'
---

# Design System: Resource

Every visual and interface decision for `@gemini-hlsw/resource-ui` lives here or in
[PRODUCT.md](PRODUCT.md): product truth there, design here. CLAUDE.md carries engineering
mechanics only. The block above is a machine-readable digest of the chrome tokens, keyed by the
names the CSS gives them. `src/styles/global.css` (`@theme` and the chart variables) and
`src/styles/shell.css` are the normative source for every value; this document is normative for
every rule. The digest is deliberately partial - the fourteen-hue instrument palette, both block
inks, the `--timeline-*` variables, the washes and the grid lines have no place in it - so read
the CSS, not the block, to learn what a token holds. A value changed there changes here in the
same commit, and vice versa.

## Overview

**Creative North Star: "One Observatory Console"**

Resource is one console among the GPP applications, and it must feel like it: a reader coming
from Explore (https://explore-dev.lucuma.xyz/) stays in the same dark, dense, matter-of-fact
world. The chrome was measured from the running Explore application - the surface ladder, the
white-opacity text ladder, the action green, the lightgreen identity accent - and those
measured values are recorded here as tokens. Continuity is a floor, not a ceiling: where
Resource can achieve clearer hierarchy, stronger accessibility, better interaction design, or
more efficient use of space than Explore, it does, without breaking the family resemblance.

The surface is an information-dense engineering dashboard for experts - astronomers, night
operations, staff - who scan, compare, and monitor the same views repeatedly. Density wins
ties: condensed is correct here, airy is not. The interface recedes behind the record; colour
is spent on identity and alarm, never on decoration. Today every view reads; mutations, auth,
and a telescope scheduler builder are coming, so every pattern below is chosen to survive the
arrival of editing (see Future Readiness).

**Key characteristics:**

- Dark-first and only: black canvas, tonal layering, no glare, minimal chrome.
- Dense: type and the boxes that hold it in rem so a reader can scale them, spacing in px so it does not.
- Colour is semantic: hue = instrument identity, red = telescope closure, green = action.
- Honest: a gap draws as a gap; absence is hollow; unknown is grey. Nothing is decorated to
  look complete (invariant I4 in PRODUCT.md).
- WCAG 2.2 Level AA is the target, not an aspiration.

## Colors

A black-to-grey tonal ladder carries the chrome; nearly all hue is reserved for data.

### Primary

- **GPP Action Green** (`hsl(122deg 39% 49%)`, `--color-gpp`): the one action colour -
  primary buttons, the "now" line, "today" markers, the selected-segment underline, focus
  outlines on custom elements. This is the same colour as lucuma-ui's `--green-500`
  (`#4caf50`), Explore's primary-action green; treat the two as one token and prefer
  referencing the lucuma-ui variable where it is available at the point of use rather than
  restating the value. Hover: `--color-gpp-light`; pressed/dark: `--color-gpp-dark`.
- **Brand Light Green** (`rgb(144 238 144 / 80%)`, `--color-gpp-accent`): identity only -
  the environment banner, the About dialog's rule. It marks _what this is_, never _what to
  do_. It is never a button, never a link, never a state.

### Secondary

- **Info Blue** (`rgb(33 108 165)`, `--color-action-info`): Explore's info blue, for controls
  and messages that must not read as the primary action.
- **Secondary Slate** (`rgb(106 115 124)`, `--color-action-secondary`): secondary buttons.

### Neutral

The chrome ladder, measured from Explore. Climb it in order; never invent an intermediate
grey:

- **Canvas** `#000` - the page itself.
- **Surface** `#1e1e1e` - masthead, sidebar, table rows (Explore's tile surface).
- **Panel** `#262626` - cards and sections, one step above the chrome.
- **Panel Header** `#313131` - tile/section headers.
- **Raised** `#414141` - table headers, hover states.
- **Subtle** `#454545` - borders, dividers, active-navigation fills.

Text is a white-opacity ladder (Material dark), not a grey ramp:

- **Foreground** `rgb(255 255 255 / 87%)` - all informative text.
- **Secondary** `rgb(255 255 255 / 60%)` - supporting text, idle control labels.
- **Muted** `rgb(255 255 255 / 38%)` - decorative or duplicated text only. 38% white fails AA
  on every surface above, at any size, so it may never be the only carrier of information.
  `src/test/cssMirrors.test.ts` pins both halves of that against those surfaces.

### Data colours

- **Closure Red** (`#b91c1c` solid, `rgb(231 0 11 / 22%)` band wash): telescope shutdowns
  on the charts. Red has one meaning everywhere - closed, unavailable, or error - carried
  by more than one value: the chart closure tokens, the `--color-danger` family, and the
  Unavailable tag's PrimeReact danger. `--color-danger` is the weight a word takes on the
  canvas (the history table's alert tone); `--color-danger-fill` / `-edge` / `-ink` are the
  panel triplet `ErrorAlert` draws. One meaning, several values; nothing else may be red.
- **State neutrals** (`#737373` routine, `#d4d4d4` notable): schedule state rows (Open,
  Queue, ToOs) are monochrome bands - the quiet neutral for the ordinary state, the bright
  one for a state worth noticing.
- **Instrument palette** (one hue per instrument, keyed by the enum in
  `features/timeline/timelineOptions.ts` as `satisfies Record<Instrument, string>`, values in
  `global.css`): colour follows the instrument, never its position in a list, and a new
  instrument fails to compile until it has a colour. The palette was measured per site, not
  chosen: no chart shows all fourteen hues, so the assignment is optimised over the pairs
  that can actually share a chart (six subjects at GS, seven at GN). Re-run the two site
  sets, not all fourteen at once, before changing any hue.
- **Unknown** (`#a1a1aa` zinc): a reserved neutral outside the validated hue sets - it must
  read as "identity unresolved". Where an unknown run coincides with a named one, the named
  run wins the shared span.
- **Amber**: unknown/warning accents, one family end to end, named as `--color-warning` (the
  weight a warning word takes on the canvas: the calendar's and the week cards' "holiday",
  the PrimeReact warning tags) plus a panel triplet `--color-warning-fill` / `-edge` / `-ink`
  for the service-unavailable banner. Amber warns; it never celebrates. Two exceptions stay
  raw: the calendar's holiday day-inset ring, which is a date accent rather than a warning,
  and Cal-Zorro's identity hue, which happens to share the family.
- **Block ink** (`#fff` / `#0a0a0a`): bar labels take whichever of light or dark clears
  4.5:1 on the fill.

### Named rules

**The One Green Rule.** Action green acts; light-green accent identifies; no third green
exists. If a green element does nothing when pressed, it must be the accent; if it acts, it
must be `--color-gpp`.

**Red Is the Telescope's Alone (on the charts).** A shutdown is said once: a solid red block
on the Telescope row, one translucent band wash over the subject rows, the reason printed
once on the band, one legend key. Never per-row red painting - the ports are not each
closed, and no other row may claim red. Off the charts, red says only closed, unavailable,
or error.

**Hue Means Identity and Nothing Else.** Chart hue identifies an instrument. States are
monochrome; do not give a state a hue - a new state kind joins the two neutrals or the
closure red. Identity never rides on colour alone: every block, row and swatch carries its
published name in words.

**Treatment, Not a Second Palette.** Usability is a treatment over the identity hue: Science
is the plain bar; Engineering-use the same hue hatched; Not-available hollow with the hue on
the outline and a muted label - visually distinct from the ghost, and never red. Absence is
drawn hollow (`schedule-ghost`), never as another identity colour, and never red either.

**A Gap Is a Gap.** Empty cells, empty calendar squares, and unrecorded spans stay empty.
"Not recorded" must never be styled as "closed" or "unavailable" (invariant I4).

## Typography

**Font:** lucuma-ui's system stack, declared as `--font-family` in the theme and applied
through the `.dark` class on the root element: `-apple-system, BlinkMacSystemFont, "Segoe
UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI
Symbol"` - the same stack Explore renders. No display face, no webfont: the record is the
personality. (When verifying in a browser, Chrome serializes `BlinkMacSystemFont` as
`"system-ui"` in computed styles - that is the same stack, not drift.)

**Character:** quiet, engineered, label-heavy. Uppercase letter-spaced micro-labels do the
naming; data sits at body size in sentence case.

### The scale

Four steps, on the browser's own 16px root, where every one lands on a whole pixel:
16 / 14 / 12 / 10px, under Tailwind's t-shirt names. Tailwind's remaining steps are switched off in
`@theme`, which is what keeps a fifth size from arriving as `text-lg`. Every role below body size
is a token, so a call site says the role:

| Token                       | Size            | Role, and the rule for using it                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `--text-base` / `text-base` | 1rem (16px)     | **Title** (600). Name the destination the reader is on, once per page, in `PageHeader`, and nothing else. Exactly one element on a page may carry it.                                                                                                                                                                                                                                                                                                                                      |
| `--text-sm` / `text-sm`     | 0.875rem (14px) | **Body** (400). Set anything a reader reads as words - table cells, controls, prose, messages, empty states - at this, and reach for it by default. It is set once on `body`, so an unclassed surface inherits it rather than the root.                                                                                                                                                                                                                                                    |
| `--text-xs` / `text-xs`     | 0.75rem (12px)  | **Dense** (400-700). The chrome's own size and every dense data surface - buttons, page selects, the masthead right cluster, sidebar links, segmented controls, chart annotations, table captions, night card metadata. Pack a surface tighter than Body only where the reader is scanning rather than reading, and never go smaller. The weight is the call site's, since a chart label and a button want different emphasis at the one size. **This is the floor for informative text.** |
| `--text-2xs` / `text-2xs`   | 0.625rem (10px) | **Tick** (400). Number an axis tick - the day numbers on the semester chart, the hour times on the night chart. Nothing else may take it, ever.                                                                                                                                                                                                                                                                                                                                            |

Tick is the one step below the floor, and it earns the exception by carrying nothing: a tick number
is a scale marker, scanned rather than read, one or two characters, and redundant with the axis it
sits on. A bar label carries instrument identity and a gutter label carries a port, so both are
unique facts and both stay at Dense. Dense as the floor matches Primer, Carbon, Atlassian, Fluent
and Grafana, and the Fermilab ACORN control-room guide's 12 CSS px seated.

No size enters the scale without a role this document names and a surface that draws it. Four have
one today; a fifth would have to earn its own row here first, which nothing currently asks for. The
gate is what holds - a count would only tell whoever needs a fifth to break the rule or reach for an
arbitrary value instead.

`text-lg` and above do not exist: `--text-*: initial` in `@theme` removes the rest of Tailwind's
scale, so those classes compile to nothing and the text quietly renders at whatever it inherits.
`no-restricted-syntax` in `eslint.config.js` rejects them, since nothing else would - and rejects an
arbitrary size like `text-[20px]`, which does compile and is a size only its own component knows,
while leaving an arbitrary colour alone. A role added to
`@theme` is named in `FONT_SIZE_NAMES` in `src/styles/cn.ts`, which is what tells tailwind-merge it
is a size rather than a colour; `src/test/textTokens.test.ts` fails on a role missing from the list.

`DENSE` and `TICK` in `features/timeline/timelineOptions.ts` mirror `--text-xs` and `--text-2xs`
for the chart options, which need the number rather than the `var()` - a label measuring NaN
never draws.

**Below Body, hierarchy is weight, case and tracking - never a smaller size.** Micro-labels -
the environment banner, page-header control captions (SEMESTER), legend section names, calendar
weekday headers, chart gutter group headings, the phone bar, the calendar chip - are Dense set
uppercase with 0.05em tracking (`tracking-wider`), and semibold or bold where their neighbours
are not. Butterick gives 0.05-0.12em for all-caps and Bringhurst 0.05-0.10em, so 0.05em is the
floor rather than a preference. That dress is what separates them, so **set a micro-label in
anything but uppercase and it stops being one**. This is what dense scientific consoles do:
Grafana and Carbon ship nothing below 12px for reading, and Salt separates body from h4 by
weight at one size.

**Wordmark** is not a size either. "RESOURCE" sits at Body and takes its identity from 700
weight and 0.4em tracking.

### Named rules

**The One-Number Rule.** Density is one number: `--spacing` in `@theme`, **3.5px**. Every
Tailwind spacing utility compiles to `calc(var(--spacing) * n)`, so that one value sets every
gap, padding and margin written as a utility. Never fix a layout problem by nudging it.
**The number is not a single switch, though.** `shell.css` and `global.css` also carry
multiples of the step derived by hand and written as literals - 12.6, 9.8, 8.4, 7.7, 4.2, 3.5,
2.8 and 2.1px - and those do not move when `--spacing` does. Changing the step means
re-deriving every px figure in those two stylesheets in the same commit; half-done, the app
silently runs at two densities, which the Don't list forbids.

**The app sets no root font size**, which is what lets a reader's own browser font-size setting
scale the type. Comeau's question decides which unit a value takes: _should this grow when the
reader raises that setting?_ Type says yes, and so does any box whose job is to hold type - a
width or a height that has to grow with the words inside it, the chart's label gutter being the
worked example. Spacing says no and is written in px: gaps, padding, margins, border widths, and
the target tokens (`--xp-target-floor`, `--xp-touch-target`), because a finger is a finger. An
absolute px root would pin all of it and silently disable the setting.

**Dense Is The Floor.** No role carrying information sits below 12px. Tick is the single
named exception and it is not information: a tick number repeats what its axis already says. Secondary (60%) is the floor tone for
information at every size; muted carries only decoration or duplication (the same rule the
Colors ladder states).

### Shipped code that breaks these rules (queued, never precedent)

The rules above are the design being established; the shipped code predates them and falls
short of the type rules in three recurring patterns. A shipped counter-example is queued
work, never licence to add another. **The code is the catalogue** - search it before
extending or fixing, rather than trusting any prose list to stay complete.

Three patterns stand:

- **Foreground dimmed by opacity in CSS:** `.rbc-off-range` takes an out-of-month date number
  to 0.35, below the muted step. The square is chrome, so this reads as decoration rather than
  a tone violation, but it is an opacity dim and not a step on the ladder.
- **Muted carrying information at any size:** `text-foreground-muted` on text that is a
  fact's only rendering - the semester calendar's empty message, the Loading state, the About
  dialog's Endpoint caption (its value reads at Secondary) and its version line, and their kin.
  A note, an empty message, a "not recorded" where-reading and a history row's status word are
  the pattern already at Secondary; copy those. Grep `text-foreground-muted`; whatever is not
  genuinely decorative, a disabled affordance or a duplicate belongs to this set.
- **A fixed px size on a box that holds text:** the masthead and banner heights, the 28px control
  line, and the 196px sidebar column. The words do not grow their box. The bottom bar, the calendar
  height and the filter and page controls are already on the right side of the rule, being
  `min-height` and rem. A new fixed box is a bug, not a precedent.

Each fix lands as its own change. The pattern descriptions define the set; no instance list
here is ever complete.

## Layout

**Banner, masthead, sidebar, workspace.** A thin full-width strip (`--xp-banner-height`) sits
above everything and names the environment; production renders none. Under it, a 35px
masthead (surface, 1px subtle bottom border) carries four things and no more: the wordmark
(home link), the GN|GS site control beside it, a flexible gap, and the right cluster of
account name and menu. A fixed-width
(196px) sidebar groups navigation under uppercase section labels (SCHEDULE: Semester, Week,
Night; INVENTORY: Instruments, Components). The remaining viewport is the workspace: one
scroll container, `PageHeader` (title, subtitle, right-hand controls slot), then content at
full width. This structure is the starting point, not a law - if a future workflow (the
scheduler builder above all) needs a different frame, change the frame rather than forcing
the workflow into it, but keep masthead selections global and page controls local.

- **The chrome carries identity and context only; every other control lives where it acts.**
  Three selections, three homes, and no control in the chrome may be a no-op on the view
  behind it:
  - **Site is chrome.** It is identity - the bar reads "Resource at GN" - so it sits beside
    the wordmark and every view answers to it. It rides the URL, and it is also remembered:
    a visit with no `site` opens the site last left, never a fixed GN. A link naming one wins.
    **It is the one default this app writes into the URL rather than deleting**, because an
    absent site means "whichever this reader last used" - not a value a link can carry.
    Deleted, Back off a site change would pop the parameter and the memory would put the same
    site straight back, and a copied URL would open at the recipient's site, not the sender's.
  - **Semester is the semester page's.** Only /semester reads a semester, so its picker lives
    in that page's header beside Chart|Calendar, page-scoped through the URL with `month`
    dropping alongside. Night, week and the finders derive what they need from the night they
    report on. A stale `?semester=` elsewhere is unread, not scrubbed.
  - **Clock is the reader's.** Site time or UTC is a reading habit, not part of a shared link,
    so it lives in the menu under SETTINGS and persists per browser rather than in the URL.
    Page-scoped parameters live in the URL per page, defaults deleted rather than written.
- **Tonight is the front door.** The index route lands on `/night`; no night in the URL means
  the night in progress; the wordmark links home to it, and the night and week pages carry a
  Tonight button.
- **The finder pages are site-scoped, never semester-scoped.** "Where is Zorro" is not a
  semester question, and a piece's history does not restart in February. They report on the
  night in the URL, over the site's whole recorded span; no semester decides what they can see.
- **The clock choice belongs to the reader, literally.** Site time and UTC are both real
  working zones; the choice picks the zone every clock time renders in, while observing-night
  labels and evening dates stay on the site's own calendar. It is a per-browser preference:
  a link sent to a colleague opens in _their_ habit, not the sender's.
- **Density before whitespace.** Vertical rhythm comes from the 28px control line (every
  toolbar control is 28px tall) and compact table rows. The 28px is a literal repeated at four
  sites in `shell.css` rather than a custom property, so grep it; the other chrome heights are
  `--xp-*` tokens. Charts and tables stretch to the workspace width; there is no max-width
  column.
- **The masthead has a measured width budget.** The bar holds four things at every width:
  149.1px wordmark, 68.8px GN|GS, the flexible gap, and a 124.4px right cluster (68.8px below
  `md`, where the account name goes `sr-only` and the wordmark tightens to 132.3px). With 37.8px
  of gaps and 28px of padding that is 408.1px of fixed content, against 768px at the narrowest
  desktop width - the gap absorbs the rest. Below `md` the same bar measures 311.9px inside a
  320px viewport, **8.1px to spare**: the tightest figure in this file, and the one to check
  first when anything joins the bar - the SSO merge's signed-in states are its known next tenant,
  and they arrive in the right cluster. Nothing clips between 320px and 1440px. The controls in
  the bar are `lucuma-ui-css`'s and are sized in rem against a 16px root, so a reader who raises
  their browser font size spends this slack; re-measure rather than assuming it. Check the budget
  before adding an item: the flexible column is what gives way first, so whatever sits in it is
  what disappears.
- **320px and 640px are verification widths, not breakpoints.** Nothing is designed at them;
  every frontend change is checked at them. 640 CSS px is 200% zoom on a 1280px screen (WCAG
  1.4.4) and is exactly `sm`, so `max-sm:` reads natively as "below the AA zoom point". 320px is
  the reflow point (1.4.10), where a chart or a data table may scroll inside its own container -
  the criterion allows those two - but nothing may be lost or put out of reach. Check the width
  budget at both: the bar clears 640px with its menu whole and in view, and 320px by 8.1px.
  The two are checked separately, and a reader who raises their font size without zooming does
  combine them: at phone widths at 200% a control clips its own value, because the sidebar's
  `196px 1fr` grid holds the row wide whatever the viewport does. Where that starts depends on
  the route, so measure it rather than quoting a width. Ellipsis is the deliberate choice there -
  the shell clips, so the alternative is a control nothing can reach. Measure with the browser's
  own font-size setting, not a page-level `font-size`: only the setting moves the `rem`
  breakpoints, so an override reads a layout no reader gets.
- **Desktop-first, phone-supported.** Optimise for wide screens beside the other GPP tools;
  the phone is a supported secondary scene (PRODUCT.md): every destination stays reachable,
  legible and operable at phone widths, touch targets on the 24px floor, layout adapting
  rather than breaking.

### The phone shell

`md` (768px) is the shell's one breakpoint. Below it the frame changes; at and above it the
desktop shell above is untouched. The breakpoint is written 48rem in `shell.css` and `md:` in
Tailwind - the same 768px.

| Surface                                   | Below `md`                                            | At `md` and up          |
| ----------------------------------------- | ----------------------------------------------------- | ----------------------- |
| Environment banner (`--xp-banner-height`) | the same strip                                        | the same strip          |
| Masthead (`--xp-masthead-height`)         | wordmark, GN\|GS, gap, account icon, menu             | the same, plus the name |
| Navigation                                | bottom bar (`--xp-bottomnav-height`), icon over label | the 196px sidebar       |

- **One navigation at a width, never two.** The sidebar is the desktop's and the bottom bar is
  the phone's; each is `display: none` where the other answers, so only one is ever in the
  accessibility tree and they share one name. Both render the same configuration
  (`SIDEBAR_MENU_SECTIONS`) - the bar flattens the sections, having no room to name them.
- **One masthead row at every width.** The bar holds only identity and the menu, so it never
  needed a second row; what used to sit there moved to where it acts. The single thing that
  yields below `md` is the account name, which goes `sr-only` and is read from the menu header
  instead - its words stay in the accessibility tree at every width.
- **Nothing may force a width above the viewport at 320px.** The shell is `overflow-hidden`,
  so a bar wider than the screen is not scrolled to, it is lost. No shell element holds a
  natural width it cannot give up: the wordmark tightens its tracking, the account name goes
  `sr-only`, and the flexible gap absorbs whatever is left.
- **Touch targets are px, not rem** (`--xp-target-floor` 24px, `--xp-touch-target` 44px): a
  finger is the one size that must not grow with the reader's type, so the WCAG floor and the
  comfortable reach are both absolute. Every segmented control carries the 24px floor even at
  its compact size. **One exception, and it is the bar's height, not a choice:** the menu button
  gets the full 44px across but only the masthead's own 35px,
  because a 44px-tall target in a 35px bar reaches past it and takes taps from whatever the
  page puts under the chrome. It clears the 24px floor the Do list states; a full 44 square
  needs a taller bar.
- **A bottom-bar label is never truncated and never broken mid-word.** Each item is sized by its
  own label rather than to an equal share, which is what puts all five names on one line at
  320px; the five together measure about 276px of the 320 available. When a reader's text
  spacing (WCAG 1.4.12) or font size takes them past that, the bar wraps to a second row and
  grows on its `min-height` instead - a name may move, it may not be cut.
- **Five destinations is the bar's ceiling, not its current size.** The labels already fill the
  320px row, and Material's navigation bar is a three-to-five component by design. A sixth
  destination is a different component; it is not reached by narrowing this one.
- **The shell is `dvh`, not `vh`.** A phone browser's toolbar is inside `100vh` but outside the
  visible viewport, so a `vh` shell hides its own bottom bar under the toolbar on first load.
- **The bottom bar pads itself against `env(safe-area-inset-bottom)`**, and `index.html` asks
  for `viewport-fit=cover` so that inset is real rather than zero.

## Elevation & Depth

Flat, tonal, shadowless. Depth is stated by climbing the surface ladder, never by
box-shadow: a table header is raised because it is `#414141` on `#1e1e1e`, not because it
casts anything. The two exceptions:

- **Modal dialogs**: a `rgb(0 0 0 / 60%)` scrim with a 2px backdrop blur - the blur plus the
  darker scrim (60% vs the theme's 40%) together state that a modal is up.
- **Chart overlays**: tooltips sit on the darkest panel (`--timeline-tooltip-bg`) with a 1px
  border, not a shadow.

**The Flat-By-Default Rule.** No new shadow vocabulary. If a surface needs to read as above
another, move it up the ladder.

## Shapes

Rectangles, small radii, 1px borders. Controls and panels round at 4px; calendar chips at
2px; chart tooltips at 6px; nothing pill-shaped,
nothing circular except status dots and moon-phase icons. Form
language for schedule data is exact: bars are rectangles whose edges are facts (half-open
intervals - an end is exclusive; the deliberate 3px corner radius softens a corner without
moving one), so bars must never be given rounding or padding that would move an edge off
its time. Meaning rides on fill treatment: solid =
recorded use, hatched = engineering use, hollow dashed outline = absence, translucent wash =
closure band or daylight. A 1px `rgb(255 255 255 / 12%)` border separates adjacent blocks
that share a hue.

## Components

PrimeReact first for controls, Tailwind for layout and small adjustments; the theme is
lucuma-ui's CSS (`@gemini-hlsw/lucuma-ui-css`), re-tinted through its own variables in
`shell.css`. Do not recreate a component the shared stack already provides, and do not
restate a colour a token already holds. Where a design change is needed, change the variable
first (the mechanics of winning specificity battles are engineering and live in CLAUDE.md).

### Interaction states

Five states, stated once here because they are the app's and not any one component's. A section
below adds only what is particular to its component.

- **Focus.** Every interactive element shows a visible action-green focus indicator, using one of
  the two shared treatments - the calendar events' 2px outline offset 1px, or `FOCUS_RING` (a 2px
  inset ring, `components/ui/styles.ts`). The ring is the green's **light** step
  (`--color-gpp-light`): the base green measures 2.91:1 against the translucent green an active
  nav item fills with, under 1.4.11's 3:1 floor for a UI part, where the light step measures
  3.35:1 and gains contrast everywhere else too. A segmented control takes that same light green
  as an **outline** rather than a ring: its selected segment spends its box-shadow on the
  underline, so a focus shadow would simply be replaced by it and the selected segment - the one
  a keyboard lands on first - would show no focus at all.
- **Hover.** A hovered surface climbs one step of the ladder, to Raised (`#414141`), and its text
  brightens to foreground. The primary button is the one exception: it lightens its own fill to
  `--color-gpp-light` rather than climbing the neutral ladder.
- **Disabled.** An icon button drops to 40% opacity and takes the default cursor; a disabled
  navigation item drops its text to muted. Muted carrying a disabled affordance is the sanctioned
  case, not a tone violation. Whether a disabled control must also say _why_ is Future Readiness's
  rule, and it arrives with editing.
- **Selected.** The selected member of a set raises its surface, brightens its text to foreground,
  and carries a 2px inset action-green underline. Selection is never a green fill: choosing a view
  is navigation, not a success state, and a fill would compete with the real action.
- **Active.** The current destination fills with the action green at 40% and carries
  `aria-current="page"`, set by the router rather than by hand, so the highlight cannot drift from
  what is announced.

**Shipped shortfalls, queued like the type deviations:** week cards ride the browser-default ring,
chart bars are mouse-only with no keyboard path to a bar's open-night action (nights stay reachable
through the date controls until bars get a focusable treatment), and `FOCUS_RING` is worn only by
the masthead and the phone bar today.

### Buttons

- **Shape:** 4px radius, 4.2px x 9.8px padding, Dense type; every toolbar control sits
  on the 28px line.
- **Primary:** action green fill, white text. One primary action per view at most - today's
  views have none, which is correct for reading.
- **Secondary:** slate fill (`--color-action-secondary`), foreground text.
- **Icon buttons:** 28px square, transparent at rest, secondary-text glyph, taking the shared
  hover and disabled treatments. Every icon button has an accessible name; the icon clarifies,
  the name carries.
- **Glyph size is em, and it comes from FontAwesome's own scale.** A decorative glyph is
  measured against the label beside it, not against the root, so it keeps its proportion
  wherever that label sits on the type scale and it follows a reader's font-size setting.
  Use FA's `size` prop - omitted for a glyph that matches its label (1em), `size="sm"`
  (0.875em) for one that should sit under it, `size="xs"` (0.75em) for a menu row. Do not
  write a px or rem glyph size, and do not add a parallel em utility: FA's steps carry the
  baseline correction that keeps the glyph aligned, which a bare `font-size` does not.
  Note this is the one place the app spends a reader's font-size increase on width - the
  masthead's budget is the constraint, so masthead glyphs also take `widthAuto` to drop
  FontAwesome 7's fixed 1.25em canvas.

### Segmented controls (view/clock toggles)

Idle segments are surface-on-subtle with secondary text; the selected segment takes the shared
Selected treatment and the shared focus **outline**, both under Interaction states. Compact
variant (`seg-sm`) for chart-corner toggles.

### Page-header selects

The masthead carries no select at all: site is a segmented control, and the semester picker
belongs to /semester. A page's own Dropdown sits on the 28px control line, captioned by an
uppercase micro-label above it; the value never inherits the label's uppercase dress. The
caption is bound to the control by id (`LabelledControl`) and is the control's only
accessible name - no call site repeats it as an `aria-label`.

### The environment banner

A full-width strip above the masthead naming the build that is not production, in the
identity accent with dark ink (measured 9.34:1; the badge it replaces read 2.09:1 with white
on the same fill). It spans the viewport, so no width can clip it and nothing in the bar has
to yield to make room. Production renders nothing.

### Tables

- **Headers:** raised (`#414141`), 600 weight, body-size type, sortable where sorting means
  something.
- **Rows:** surface (`#1e1e1e`), compact, subtle stripe on alternates; an expansion is
  its row continued (one shade off, `rgb(255 255 255 / 1%)`). The row height is
  `lucuma-ui-css`'s, not this file's: its cell padding and row toggler are rem-sized, so a
  reader who scales their type gets taller rows.
- **History tables** (`RecordHistoryTable`): a plain `<table>` rather than a nested
  DataTable; columns keep their place even when empty; a note goes in a column that wraps,
  never a second line that truncates.
- Tables are real tables: header cells are `<th>`, data cells `<td>` - and every chart owes
  a table as its accessible reading (today only the semester chart has one; see the Do
  list).

### Status tags

One vocabulary everywhere, from `componentStatus`: **Science** (success green),
**Engineering** (info blue), **Spare** (neutral, muted tone), and **Unavailable** (danger
red, alert tone), rendered by `StatusTag`. The status cell shows the badge alone - the
presence dot belongs to `WhereCell`, and a record's note is its own column. Tag text clears
4.5:1 on its fill, and tag type sits at Dense, taken from the app's own token in `shell.css`
once for every tag rather than per call site - the theme restates the size as a literal, which
is free to drift off the scale.
The success green and the danger red take dark ink (7.56:1 and 7.22:1 measured)
rather than the theme's light text, retinted once in `shell.css`; info, warning and the
default blue already clear the bar with the ink the theme gives them.

### Page status (`PageStatus`)

The three states a page shows instead of content, as three distinct components, never one
that decides: `ErrorAlert` (reserved danger red, `role="alert"`, the error's own message
verbatim), `Loading`, and `EmptyPanel` (neutral - never red, never a warning: a gap means
"not recorded"). The night view alone has three distinct empty states, one carrying a
button.

### Charts (the signature component)

Every schedule view draws from the same timeline builders; a view supplies its axis and its
phrasing of a span, nothing else.

- **Structure:** state rows (Telescope, Mode, ToO) head every schedule view as a monochrome
  band; small-caps group headings in the gutter name "Telescope" and "Instruments" and double
  as the band's breathing room (group headings, not axis breaks - a break drops the gutter
  label out of line with its bar).
- **The night view draws the chart alone, deliberately bare** - its emptiness is a decision,
  not an omission; do not furnish it.
- **Subsystem rows** (PWFS1/PWFS2/LGS) are the night view's alone, draw in the one quiet
  neutral, and print their state in words - no legend section, because a colour key would
  key no distinction, and no appearance on the wide views, where three semester-constant
  rows per month would bury the runs.
- **Legend:** one section per state row, then Instruments, then Sky and Calendar where a
  view supplies them - six, in that order. The neutrals repeat across rows, so a repeated
  grey is keyed under the row it belongs to; a section with no keys does not render.
- **The calendar draws no run bars, ever** - single-evening chips only, for critical events
  (a port's instrument changing, the telescope closing with its reason, reopening). Of the
  state record it draws only the telescope closures (the wash and its chips); Mode and ToO
  spans do not reach the calendar at all - routine values every week would bury the runs.
  A window-edge boundary is furniture, not news. Empty squares stay empty. More news kinds
  are expected over time.
- **Change feeds** (week changes table, calendar news) read ports only: a shelf change is
  inventory, not a night's headline; a boundary on the window's edge is not a change.
- **Every night-shaped thing opens its night view** - calendar squares, week cards, chart bars
  route onto `/night`. What each of those must show on focus, and which of them still falls
  short, is Interaction states above.

### Navigation (sidebar and phone bar)

Uppercase section labels over icon+text items, the current one taking the shared Active
treatment under Interaction states. Sections are driven by configuration
(`SIDEBAR_MENU_SECTIONS`), not hard-coded lists. The phone's bottom bar draws the same
destinations icon-over-label with the same fill; which of the two is shown is the
Layout section's phone shell.

## Do's and Don'ts

### Do:

- **Do** climb the surface ladder in order; a new layer takes the next step, not a new hex.
- **Do** spend colour on data. Chrome stays neutral so instruments and alarms own the hue.
- **Do** put every control on the 28px line and every caption through `LabelledControl`.
- **Do** show the published name (`'Alopeke`, Maroon-X), never the enum, and keep the name
  in words beside every colour.
- **Do** give every chart a block-table reading - the semester chart's screen-reader table
  is the model, and the night and week charts still owe theirs - and drive tests through
  accessible queries.
- **Do** target WCAG 2.2 AA on every change: 4.5:1 text, 3:1 UI parts, visible focus,
  24px minimum targets (or spacing equivalents), full keyboard paths.
- **Do** design every new component with its editing states in mind (see Future Readiness),
  even while the app is read-only.

### Don't:

- **Don't** hard-code a colour in a component - extend from the tokens; components read
  variables.
- **Don't** give a schedule state a hue, a port its own red, or absence a colour.
- **Don't** decorate a gap. No skeleton rows, placeholder bars, or "probably fine" fills
  where the record holds nothing.
- **Don't** use the identity accent (`--color-gpp-accent`) on anything interactive.
- **Don't** put informative text below 60% white, or below Dense (12px), anywhere new (the
  shipped deviations are catalogued by pattern under Typography and queued to be fixed).
- **Don't** add a masthead item without re-measuring the width budget.
- **Don't** introduce a second density: no per-view font-size overrides to make something
  fit; fix the layout instead.
- **Don't** set a root font size on `html`. An absolute one disables the reader's own browser
  font-size setting; density belongs to `--spacing` and to the px chrome values.
- **Don't** copy an Explore weakness for continuity's sake - continuity binds palette,
  density and family resemblance, not defects.

## Future Readiness

The app is read-only today; mutations, authentication, and a telescope scheduler builder
are coming (PRODUCT.md). These rules keep today's surface from becoming tomorrow's rewrite.
None of this is to be built speculatively - it is room being reserved, not features.

- **States to design for, per component, as they are touched:** loading, empty, error (all
  three exist today in `PageStatus`), plus disabled-with-reason, unsaved-change, validation
  failure, save success, conflict (the record changed under you), and no-permission. A
  disabled control states why (tooltip + accessible description), never just greys out.
- **Auth arrives in the masthead right cluster.** "Guest User" is already a slot; identity,
  roles, and sign-in/out extend it without moving the selection controls. Permission
  differences render as capability (what you can press), never as a different theme.
- **Editing is a mode of the same views, not new views.** The scheduler builder will
  compose over the same timeline: selection (single and range), a contextual detail panel,
  drag-and-drop with a full keyboard equivalent for every drag, inline validation against
  the record's invariants (half-open intervals, ports, I4). Charts and tables therefore
  must not assume their rows are inert: row/block components take selection and focus
  states now, even while nothing sets them.
- **Green stays scarce.** When write actions arrive, the action green goes to the one
  commit action (Save / Publish); everything else stays secondary. A view acquiring ten
  green buttons has lost the plot.
- **Dirty state is loud, honest, and reversible:** an unsaved change is marked where it is
  and in the page chrome, blocking navigation only through an explicit choice, and a
  conflict shows both readings rather than silently overwriting either.

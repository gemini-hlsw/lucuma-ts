---
name: Resource
description: Dark, dense engineering console for Gemini telescope schedules, chrome-continuous with GPP Explore
colors:
  gpp-green: 'hsl(122deg 39% 49%)'
  gpp-green-dark: 'hsl(122deg 39% 43%)'
  gpp-green-light: 'hsl(122deg 39% 55%)'
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
  closure-red: '#b91c1c'
  state-routine: '#737373'
  state-notable: '#d4d4d4'
  instrument-unknown: '#a1a1aa'
typography:
  body:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"'
    fontSize: '1rem'
    fontWeight: 400
    lineHeight: 1.5
  title:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"'
    fontSize: '1.125rem'
    fontWeight: 600
  label:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"'
    fontSize: '0.65rem'
    fontWeight: 400
    letterSpacing: '0.025em'
  wordmark:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"'
    fontSize: '0.95rem'
    fontWeight: 700
    letterSpacing: '0.4em'
rounded:
  chip: '2px'
  control: '4px'
spacing:
  root: '14px'
  masthead: '2.5rem'
  env-banner: '1.4rem'
  control-line: '2rem'
  bottom-nav: '3.5rem'
  touch-target: '44px'
components:
  button-primary:
    backgroundColor: '{colors.gpp-green}'
    textColor: '#fff'
    rounded: '{rounded.control}'
    padding: '0.3rem 0.7rem'
  button-primary-hover:
    backgroundColor: '{colors.gpp-green-light}'
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
mechanics only. Tokens above are normative; the prose says how to apply them. The CSS source
of truth is `src/styles/global.css` (`@theme` and the chart variables) and
`src/styles/shell.css` - a value changed there changes here in the same commit, and vice
versa.

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
- Dense: one density number (a 14px root, matching Explore), everything in rem.
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
- **Muted** `rgb(255 255 255 / 38%)` - decorative or duplicated text only. At body sizes on
  dark surfaces 38% white fails AA contrast, so it may never be the only carrier of
  information.

### Data colours

- **Closure Red** (`#b91c1c` solid, `rgb(231 0 11 / 22%)` band wash): telescope shutdowns
  on the charts. Red has one meaning everywhere - closed, unavailable, or error - carried
  by more than one value: the chart closure tokens, `ErrorAlert`'s Tailwind reds, and the
  Unavailable tag's PrimeReact danger. One meaning, several values; nothing else may be
  red.
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
- **Amber**: unknown/warning accents, one family end to end - `amber-400` for the
  calendar's holiday day-inset and the week cards' holiday dates, `amber-300` for the
  calendar's "holiday" word, the PrimeReact warning tags, and the service-unavailable
  banner at the darker end (`amber-600/60` border, `amber-900/30` fill, `amber-100` text).
  Amber warns; it never celebrates. (Cal-Zorro's identity hue happens to share the family -
  that one is identity, not a warning.)
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

### Hierarchy

- **Wordmark** (700, 0.95rem, 0.4em tracking, uppercase): "RESOURCE" in the masthead only.
- **Title** (600, 1.125rem): one page title per destination, in `PageHeader`.
- **Body** (400, 1rem/1.5): table cells, controls, prose. The default; most of the interface
  is body text.
- **Label** (400-600, 0.65-0.78rem, +0.025em to +0.05em tracking, uppercase): the environment
  banner, page-header control captions (SEMESTER), legend section names, chart gutter group
  headings (small-caps "Telescope" /
  "Instruments", sized to fit the narrowest 92px gutter).
- **Data-small** (400, 0.75rem): chart annotations, calendar chips (down to 0.64rem), night
  card metadata. Reserved for dense data surfaces where the same fact is available at body
  size elsewhere (every chart owes a block-table reading for exactly this reason; today only
  the semester chart has one - see the Do list).

### Named rules

**The One-Number Rule.** Density is one number: the root font size, set once in
`shell.css`. The standard is **14px**, matching the root the running Explore application
renders at; everything is sized in rem, so that number is the only density control. Never
fix a layout problem by nudging the root. (Note: a media query's rem is the initial 16px,
not the app root.) Queued deviation: the shipped root is 13px - moving it to 14px is its
own change, and the masthead width budget below must be re-measured when it lands, since
every rem-sized width grows with the root.

**Small Type Is a Duplicate.** Anything below 0.75rem must be either decorative or a
duplicate of information available at body size. Informative text below 0.75rem uses
foreground (87%), never secondary or muted; at 0.75rem and above, secondary (60%) is the
floor for information. Muted carries only decoration or duplication, at every size (the
same rule the Colors ladder states).

### Known deviations (queued work, not precedent)

The rules above are the design being established; the shipped code predates them and falls
short of the type rules in three recurring patterns. A shipped counter-example is queued
work, never licence to add another. **The code is the catalogue** - search it before
extending or fixing, rather than trusting any prose list to stay complete:

- **Tags forced under the floor:** `<Tag>`s overridden below 0.75rem (today via
  `!text-[0.6rem]`), several pairing light text with a severity fill that fails 4.5:1 (the
  success and danger fills; the info tag ships dark ink and passes).
- **Sub-0.75rem informative text below the foreground tone**, declared four ways: in
  Tailwind classes (find them with `text-\[0\.[0-7]` near
  `foreground-muted`/`foreground-secondary` - table headers, cell and
  date-cell metadata); in CSS files the class grep cannot see (the calendar's `.rbc-header`
  column names); in chart options declaring `font-size:` in JS (the Highcharts gutter
  headings and inline labels on `--timeline-muted-text` - the gutter headings also ship
  `letter-spacing: 1px`, outside the Label spec); and as foreground dimmed by opacity (the
  calendar's published-moon word at `opacity-80`).
- **Muted carrying information at any size:** `text-foreground-muted` on text that is a
  fact's only rendering - record notes, page subtitles, the Loading state, sidebar section
  labels, and their kin. Grep `text-foreground-muted`; whatever is not genuinely decorative
  or a duplicate belongs to this set.

Each fix lands as its own change. The pattern descriptions define the set; no instance list
here is ever complete.

## Layout

**Banner, masthead, sidebar, workspace.** A thin full-width strip (`--xp-env-banner`) sits
above everything and names the environment; production renders none. Under it, a 2.5rem
masthead (surface, 1px subtle bottom border) carries four things and no more: the wordmark
(home link), the GN|GS site control beside it, a flexible gap, and the right cluster of
account name and menu. A fixed-width
(14rem) sidebar groups navigation under uppercase section labels (SCHEDULE: Semester, Week,
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
- **Density before whitespace.** Vertical rhythm comes from the 2rem control line (every
  toolbar control is 2rem tall) and compact table rows (~2.8rem). Charts and tables stretch
  to the workspace width; there is no max-width column.
- **The masthead has a measured width budget, and the overhaul made it slack.** The figures are
  taken at the shipped 13px root; every one moves when the root reaches its 14px standard -
  re-measure then. The bar holds four things at every width: 133.7px wordmark, 61.6px GN|GS,
  the flexible gap, and a 109.1px right cluster (67.1px below `md`, where the account name goes
  `sr-only`). With 35.1px of gaps and 26px of padding that is 365.5px of fixed content, against
  768px at the narrowest desktop width - the gap absorbs the rest. Below `md` the same bar
  measures 286.6px inside a 320px viewport, 33.5px to spare. Nothing clips between 320px and
  1400px. Check the budget before adding an item, and remember what the old bar taught: the
  flexible column is what gives way first, so whatever sits in it is what disappears.
- **Desktop-first, phone-supported.** Optimise for wide screens beside the other GPP tools;
  the phone is a supported secondary scene (PRODUCT.md): every destination stays reachable,
  legible and operable at phone widths, touch targets on the 24px floor, layout adapting
  rather than breaking.

### The phone shell

`md` (768px) is the shell's one breakpoint. Below it the frame changes; at and above it the
desktop shell above is untouched. A media query's rem is the initial 16px, not the app root,
so the breakpoint is 48rem in `shell.css` and `md:` in Tailwind - the same 768px.

| Surface                                | Below `md`                                            | At `md` and up          |
| -------------------------------------- | ----------------------------------------------------- | ----------------------- |
| Environment banner (`--xp-env-banner`) | the same strip                                        | the same strip          |
| Masthead (`--xp-masthead-height`)      | wordmark, GN\|GS, gap, account icon, menu             | the same, plus the name |
| Navigation                             | bottom bar (`--xp-bottomnav-height`), icon over label | the 14rem sidebar       |

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
  finger is the one size that must not ride the density root, so the WCAG floor and the
  comfortable reach are both absolute. Every segmented control carries the 24px floor even at
  its compact size. **One exception, and it is the bar's height, not a choice:** the menu button
  gets the full 44px across but only the masthead's own height (32.5px at the 13px root),
  because a 44px-tall target in a 32.5px bar reaches past it and takes taps from whatever the
  page puts under the chrome. It clears the 24px floor the Do list states; a full 44 square
  needs a taller bar.
- **A bottom-bar label wraps, never truncates.** The bar is sized by `min-height`, so a label
  that needs two lines gets them and the bar grows: a reader's own text spacing (WCAG 1.4.12)
  must not cost a destination its name.
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

Rectangles, small radii, 1px borders. Controls and panels round at 4px (the masthead icon
button alone at 0.4rem); calendar chips at 2px; chart tooltips at 6px; nothing pill-shaped,
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

### Buttons

- **Shape:** 4px radius, 0.3rem x 0.7rem padding, 0.82rem type; every toolbar control sits
  on the 2rem line.
- **Primary:** action green fill, white text; hover lightens to `--color-gpp-light`. One
  primary action per view at most - today's views have none, which is correct for reading.
- **Secondary:** slate fill (`--color-action-secondary`), foreground text.
- **Icon buttons:** 2rem square, transparent at rest, secondary-text glyph; hover raises the
  surface and brightens the glyph; disabled drops to 40% opacity. Every icon button has an
  accessible name; the icon clarifies, the name carries.

### Segmented controls (view/clock toggles)

Idle segments are surface-on-subtle with secondary text. The selected segment raises the
surface, brightens the text to foreground, and carries a 2px inset action-green underline.
Choosing a view is navigation, not a success state: a green fill would compete with the real
action. Compact variant (`seg-sm`) for chart-corner toggles.

### Page-header selects

The masthead carries no select at all: site is a segmented control, and the semester picker
belongs to /semester. A page's own Dropdown sits on the 2rem control line, captioned by an
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
- **Rows:** surface (`#1e1e1e`), ~2.8rem tall, subtle stripe on alternates; an expansion is
  its row continued (one shade off, `rgb(255 255 255 / 1%)`).
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
presence dot belongs to `WhereCell`, and a record's note is its own column. Target (the
shipped tags deviate; see Known deviations under Typography): tag text clears 4.5:1 on its
fill, with dark ink on the green rather than light if the measured pair fails, and tag type
at 0.75rem or above.

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
- **Every night-shaped thing opens its night view** - calendar squares, week cards, chart
  bars route onto `/night`. The rule: every interactive element shows a visible
  action-green focus indicator, using one of the two shared treatments - the calendar
  events' 2px outline offset 1px, or `FOCUS_RING` (a 2px inset ring,
  `components/ui/styles.ts`). The ring is the green's **light** step: the base green measures
  2.91:1 against the translucent green an active nav item fills with, under 1.4.11's 3:1 floor
  for a UI part, where the light step measures 3.35:1 and gains contrast everywhere else too.
  A segmented control takes that same light green as an **outline** rather than a ring: its
  selected segment spends its box-shadow on the underline, so a focus shadow would simply be
  replaced by it and the selected segment - the one a keyboard lands on first - would show no
  focus at all.
  Shipped shortfalls, queued like the type deviations: week
  cards ride the browser-default ring, chart bars are mouse-only with no keyboard path to a
  bar's open-night action (nights stay reachable through the date controls until bars get a
  focusable treatment), and `FOCUS_RING` is worn only by the masthead and the phone bar today.

### Navigation (sidebar and phone bar)

Uppercase section labels over icon+text items; the active item fills with a translucent
green and `aria-current="page"`. Sections are driven by configuration
(`SIDEBAR_MENU_SECTIONS`), not hard-coded lists. The phone's bottom bar draws the same
destinations icon-over-label with the same fill, reading the `aria-current` the router sets
so the highlight cannot drift from the announced state; which of the two is shown is the
Layout section's phone shell.

## Do's and Don'ts

### Do:

- **Do** climb the surface ladder in order; a new layer takes the next step, not a new hex.
- **Do** spend colour on data. Chrome stays neutral so instruments and alarms own the hue.
- **Do** put every control on the 2rem line and every caption through `LabelledControl`.
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
- **Don't** put informative text below 60% white, or below 0.75rem, anywhere new (the
  shipped deviations are catalogued by pattern under Typography and queued to be fixed).
- **Don't** add a masthead item without re-measuring the width budget.
- **Don't** introduce a second density: no per-view font-size overrides to make something
  fit; fix the layout instead.
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

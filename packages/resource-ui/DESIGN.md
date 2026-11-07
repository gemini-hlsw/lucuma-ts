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
  display:
    fontSize: '1.5rem'
    fontWeight: 600
    lineHeight: '2rem'
  section:
    fontSize: '1.125rem'
    fontWeight: 600
    lineHeight: '1.625rem'
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
    fontWeight: 400
    lineHeight: '0.875rem'
  wordmark:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"'
    fontSize: '0.875rem'
    fontWeight: 700
    letterSpacing: '0.4em'
rounded:
  swatch: '2px'
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
every rule. The digest is partial - the instrument palette, the block inks, the `--timeline-*`
variables, the washes and the grid lines are not in it - so read the CSS to learn what a token
holds. A value changed there changes here in the same commit.

## Overview

**Creative North Star: "One Observatory Console"**

Resource is one console among the GPP applications: a reader coming from Explore
(https://explore-dev.gemini.edu/) stays in the same dark, dense, matter-of-fact world. The
surface ladder, the white-opacity text ladder, the action green and the light-green identity
accent are Explore's, recorded here as tokens. Continuity is a floor, not a ceiling: where
Resource can be clearer, more accessible or denser than Explore, it is, without breaking the
family resemblance.

The surface is an information-dense engineering dashboard for experts - astronomers, night
operations, staff - who scan, compare and monitor the same views repeatedly. Density wins ties.
The interface recedes behind the record; colour is spent on identity and alarm, never on
decoration.

**Key characteristics:**

- Dark-first and only: black canvas, tonal layering, no glare, minimal chrome.
- Dense: type and the boxes that hold it in rem so a reader can scale them, spacing in px so it does not.
- Colour is semantic: hue = instrument identity, red = telescope closure, green = action.
- Honest: a gap draws as a gap; absence is hollow; unknown is grey. Nothing is decorated to
  look complete (invariant I4 in PRODUCT.md).
- WCAG 2.2 Level AA is the target.

## Colors

A black-to-grey tonal ladder carries the chrome; nearly all hue is reserved for data.

### Primary

- **GPP Action Green** (`--color-gpp`): the one action colour - primary buttons, the "now"
  line, "today" markers, the selected-segment underline, focus outlines on custom elements. It
  is lucuma-ui's `--green-500`, Explore's primary-action green; treat the two as one token and
  prefer the lucuma-ui variable where it is available at the point of use. Hover:
  `--color-gpp-light`; pressed: `--color-gpp-dark`.
- **Brand Light Green** (`--color-gpp-accent`): identity only - the environment banner, the
  About dialog's rule. It marks _what this is_, never _what to do_: never a button, a link or a
  state.

### Secondary

- **Info Blue** (`--color-action-info`): controls and messages that must not read as the
  primary action.
- **Secondary Slate** (`--color-action-secondary`): secondary buttons.

### Neutral

The chrome ladder. Climb it in order; never invent an intermediate grey:

- **Canvas** `#000` - the page itself.
- **Surface** `#1e1e1e` - masthead, sidebar, table rows.
- **Panel** `#262626` - cards and sections, one step above the chrome.
- **Panel Header** `#313131` - tile/section headers.
- **Raised** `#414141` - table headers, hover states.
- **Subtle** `#454545` - borders, dividers, active-navigation fills.

Text is a white-opacity ladder, not a grey ramp:

- **Foreground** `rgb(255 255 255 / 87%)` - all informative text.
- **Secondary** `rgb(255 255 255 / 60%)` - supporting text, idle control labels.
- **Muted** `rgb(255 255 255 / 38%)` - decorative or duplicated text only. It fails AA on
  every surface above, at any size, so it may never be the only carrier of information.

### Data colours

- **Closure Red** (`#b91c1c` solid, `rgb(231 0 11 / 22%)` band wash): telescope shutdowns on
  the charts. Red has one meaning everywhere - closed, unavailable, or error - carried by more
  than one value: the chart closure tokens, the `--color-danger` family, and the Unavailable
  tag's PrimeReact danger. `--color-danger` is the weight a word takes on the canvas;
  `--color-danger-fill` / `-edge` / `-ink` are the panel triplet `ErrorAlert` draws. Nothing
  else may be red.
- **State neutrals** (`#737373` routine, `#d4d4d4` notable): schedule state rows (Open, Queue,
  ToOs) are monochrome bands - the quiet neutral for the ordinary state, the bright one for a
  state worth noticing.
- **Instrument palette** (one hue per instrument, keyed by the enum in
  `features/timeline/instruments.ts` as `satisfies Record<ResourceInstrument, string>`, values
  in `global.css`): colour follows the instrument, never its position in a list, and a new
  instrument fails to compile until it has a colour. No chart shows every hue, so the palette is
  optimised over the pairs that can share a chart: the GS set and the GN set. Check those two
  sets, not all hues at once, before changing any hue.
- **Unknown** (`#a1a1aa` zinc): a reserved neutral outside the validated hue sets, reading as
  "identity unresolved". Where an unknown run coincides with a named one, the named run wins.
- **Amber**: the warn toast's panel triplet, `--color-warning-fill` / `-edge` / `-ink`. Amber
  warns; it never celebrates. Cal-Zorro's identity hue happens to share the family.
- **Block ink** (`#fff` / `#0a0a0a`): bar labels take whichever of light or dark clears 4.5:1
  on the fill.

### Named rules

**The One Green Rule.** Action green acts; light-green accent identifies; no third green
exists. If a green element does nothing when pressed, it must be the accent; if it acts, it
must be `--color-gpp`.

**Red Is the Telescope's Alone (on the charts).** A shutdown is said once: a solid red block
on the Telescope row, one translucent band wash over the subject rows, the reason printed once
on the band, one legend key. Never per-row red painting - the ports are not each closed, and
no other row may claim red. Off the charts, red says only closed, unavailable, or error.

**Hue Means Identity and Nothing Else.** Chart hue identifies an instrument. States are
monochrome; a new state kind joins the two neutrals or the closure red. Identity never rides on
colour alone: every block, row and swatch carries its published name in words.

**Treatment, Not a Second Palette.** Usability is a treatment over the identity hue: Science
is the plain bar; Engineering-use the same hue hatched; Not-available hollow with the hue on
the outline and a muted label - distinct from the ghost, and never red. Absence is drawn
hollow (`schedule-ghost`), never as another identity colour, and never red.

**A Gap Is a Gap.** Empty cells and unrecorded spans stay empty. "Not recorded" is never
styled as "closed" or "unavailable" (invariant I4).

## Typography

**Font:** lucuma-ui's system stack, declared as `--font-family` in the theme and applied
through the `.dark` class on the root element - the same stack Explore renders. No display
face, no webfont: the record is the personality. (Chrome serializes `BlinkMacSystemFont` as
`"system-ui"` in computed styles - the same stack, not drift.)

**Character:** quiet, engineered, label-heavy. Uppercase letter-spaced micro-labels do the
naming; data sits at body size in sentence case.

### The scale

Six steps on the browser's own 16px root, each a whole pixel: 24 / 18 / 16 / 14 / 12 / 10px,
under Tailwind's t-shirt names. The reading ladder is arithmetic at +2px - 10, 12, 14, 16, 18 -
and `2xl` at 24px breaks it on purpose, because a size read from a step back has to separate
itself from the sizes read at the keyboard. `text-xl` (20px) is absent: nothing sits between
Section and Display. Line heights tighten as the size grows - 1.5 at Title, 1.44 at Section,
1.33 at Display - and each lands on a whole even pixel.

| Token                       | Size            | Role, and the rule for using it                                                                                                                                                                                                                                                       |
| --------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--text-2xl` / `text-2xl`   | 1.5rem (24px)   | **Display** (600). The single glanceable fact a destination exists to answer, at most one per page, read from a step back. A destination with no such fact does not reach for it.                                                                                                     |
| `--text-lg` / `text-lg`     | 1.125rem (18px) | **Section** (600). Head a section within a destination, where a page has more than one. Never a substitute for Title.                                                                                                                                                                 |
| `--text-base` / `text-base` | 1rem (16px)     | **Title** (600). Name the destination the reader is on, once per page, in `PageHeader`, and nothing else.                                                                                                                                                                             |
| `--text-sm` / `text-sm`     | 0.875rem (14px) | **Body** (400). Anything a reader reads as words - table cells, controls, prose, messages, empty states. The default. Set once on `body`, so an unclassed surface inherits it.                                                                                                        |
| `--text-xs` / `text-xs`     | 0.75rem (12px)  | **Dense** (400-700). The chrome's own size and every dense data surface - buttons, page selects, the masthead right cluster, sidebar links, segmented controls, chart annotations, table captions. Only where the reader scans rather than reads. **The floor for informative text.** |
| `--text-2xs` / `text-2xs`   | 0.625rem (10px) | **Tick** (400). Axis tick numbers only - the day numbers on the semester chart, the hour times on the night chart. Nothing else may take it.                                                                                                                                          |

Tick earns the one step below the floor by carrying nothing: a tick number is a scale marker,
redundant with its axis. A bar label carries instrument identity and a gutter label a port, so
both stay at Dense. No size enters the scale without a role this document names and a surface
that draws it. `--text-*: initial` in `@theme` removes every Tailwind step these six do not
reinstate, so `text-xl` and `text-3xl` upward compile to nothing and the text renders at
whatever it inherits, with nothing to catch it. An arbitrary size like `text-[20px]` does
compile, which makes it the quieter mistake.

`DENSE` and `TICK` in `features/timeline/timelineOptions.ts` mirror `--text-xs` and `--text-2xs`
for the chart options, which need the number rather than the `var()`.

**Below Body, hierarchy is weight, case and tracking - never a smaller size.** Micro-labels -
the environment banner, page-header control captions (SEMESTER), legend section names, chart
gutter group headings, the phone bar - are Dense set uppercase with 0.05em tracking
(`tracking-wider`), and semibold or bold where their neighbours are not. 0.05em is the floor for
all-caps tracking (Butterick 0.05-0.12em, Bringhurst 0.05-0.10em). **Set a micro-label in
anything but uppercase and it stops being one.**

**Wordmark** is not a size either. "RESOURCE" sits at Body and takes its identity from 700
weight and 0.4em tracking.

### Named rules

**The One-Number Rule.** Density is one number: `--spacing` in `@theme`, **3.5px**. Every
Tailwind spacing utility compiles to `calc(var(--spacing) * n)`. Never fix a layout problem by
nudging it. `shell.css` and `global.css` also carry multiples of the step as px literals, which
do not move when `--spacing` does: changing the step means re-deriving every px figure in those
two stylesheets in the same commit, or the app runs at two densities.

**The app sets no root font size**, which is what lets a reader's own browser font-size setting
scale the type. One question decides a value's unit: _should this grow when the reader raises
that setting?_ Type says yes, and so does any box whose job is to hold type - the chart's label
gutter being the worked example. Spacing says no and is written in px: gaps, padding, margins,
border widths, and the target tokens (`--xp-target-floor`, `--xp-touch-target`), because a
finger is a finger. A fixed px height or width on a box that holds text is a defect, not a
precedent: such a box takes `min-height` or rem.

**Dense Is The Floor.** No role carrying information sits below 12px; Tick is the single
exception and carries no information. Secondary (60%) is the floor tone for information at
every size; muted carries only decoration or duplication.

## Layout

**Banner, masthead, sidebar, workspace.** A thin full-width strip (`--xp-banner-height`) sits
above everything and names the environment; production renders none. The session gate owns the
row under it, and the shell fills that row, not the viewport. In it, a 35px masthead
(surface, 1px subtle bottom border) carries four things and no more: the wordmark (home link),
the GN|GS site control beside it, a flexible gap, and the right cluster of account name and
menu. A fixed-width (196px) sidebar groups navigation under uppercase section labels
(SCHEDULE: Semester, Week, Night; INVENTORY: Instruments, Components). The rest is the
workspace: one scroll container, `PageHeader` (title, right-hand controls slot), then content at
full width. The structure is a starting point, not a law: a workflow that needs a different
frame changes the frame, but masthead selections stay global and page controls stay local.

- **The chrome carries identity and context only; every other control lives where it acts.**
  Three selections, three homes, and no control in the chrome may be a no-op on the view behind
  it:
  - **Site is chrome.** It is identity - the bar reads "Resource at GN" - so it sits beside the
    wordmark and every view answers to it. It rides the URL and is also remembered: a visit
    with no `site` opens the site last left, never a fixed GN; a link naming one wins. **It is
    the one default this app writes into the URL rather than deleting**, because an absent site
    means "whichever this reader last used", not a value a link can carry: deleted, Back off a
    site change would pop the parameter and the memory would put the same site straight back,
    and a copied URL would open at the recipient's site, not the sender's.
  - **Semester is the semester page's.** Only /semester reads a semester, so its picker lives
    in that page's header, page-scoped through the URL, listing each semester by its plain
    name. A stale `?semester=` elsewhere is unread, not scrubbed.
  - **Clock is the reader's.** Site time or UTC is a reading habit, not part of a shared link,
    so it lives in the menu under Clock and persists per browser, not in the URL: a link sent
    to a colleague opens in _their_ habit. The choice picks the zone every clock time renders
    in; observing-night labels and evening dates stay on the site's own calendar.
  - Page-scoped parameters live in the URL per page, defaults deleted rather than written.
- **The account control is the right cluster's.** It names whoever is here: the signed-in
  person's display name, or "Guest User", in the name's slot and under the name's rules (drawn
  from `md` up, `sr-only` below), the whole name in the control's `title`. The masthead is
  mounted only once a session exists, so the sign-in screen and the loading mark carry the
  signed-out and checking states, and the control always has a name to show. Signing in and out
  sit in the app menu's account block: a guest sees "Login with ORCID" then "Logout"; a person
  sees "Logout". Roles are not shown; permission differences render as capability, never as a
  different theme.
- **Tonight is the front door.** The index route lands on `/night`; no night in the URL means
  the night in progress; the wordmark links home to it, and the night and week pages carry a
  Tonight button.
- **The finder pages are site-scoped, never semester-scoped.** "Where is Zorro" is not a
  semester question. They report on tonight, over the 400 days ending tonight (the longest
  window the Resource service accepts); neither the semester nor the night in the URL decides
  what they show.
- **Density before whitespace.** Vertical rhythm comes from the 28px control line (every
  toolbar control is 28px tall, a literal in `shell.css`) and compact table rows; the other
  chrome heights are `--xp-*` tokens. Charts and tables stretch to the workspace width; there is
  no max-width column.
- **The masthead has a width budget.** Its fixed content must fit 768px at the narrowest desktop
  width and, below `md` (name `sr-only`, wordmark tracking tightened), 320px with almost nothing
  to spare. The signed-in name is the one item that varies with its content; `.xp-account-name`
  caps it at 8.75rem with an ellipsis, the whole name staying in the control's `title`. The bar's
  controls are sized in rem, so a raised browser font size spends this slack. Measure at 320 and
  768 before adding an item: the flexible column gives way first.
- **320px and 640px are verification widths, not breakpoints.** 640 CSS px is 200% zoom on a
  1280px screen (WCAG 1.4.4). 320px is the reflow point (1.4.10): a chart or a data table may scroll inside its own
  container, but nothing may be lost or put out of reach. At phone widths with a 200% font size a
  control clips its own value with an ellipsis, because the `196px 1fr` grid holds the row wide;
  the alternative is a control nothing can reach. Check with the browser's own font-size
  setting, not a page-level `font-size`: only the setting moves the `rem` breakpoints.
- **Desktop-first, phone-supported.** Optimise for wide screens beside the other GPP tools; the
  phone is a supported secondary scene (PRODUCT.md): every destination stays reachable, legible
  and operable at phone widths, touch targets on the 24px floor, layout adapting rather than
  breaking.

### The phone shell

`md` (768px) is the shell's one breakpoint, written 48rem in `shell.css` and `md:` in Tailwind.
Below it the frame changes; at and above it the desktop shell is untouched.

| Surface                                   | Below `md`                                            | At `md` and up          |
| ----------------------------------------- | ----------------------------------------------------- | ----------------------- |
| Environment banner (`--xp-banner-height`) | the same strip                                        | the same strip          |
| Masthead (`--xp-masthead-height`)         | wordmark, GN\|GS, gap, account icon, menu             | the same, plus the name |
| Navigation                                | bottom bar (`--xp-bottomnav-height`), icon over label | the 196px sidebar       |

- **One navigation at a width, never two.** Each is `display: none` where the other answers, so
  only one is ever in the accessibility tree, and they share one name. Both render
  `SIDEBAR_MENU_SECTIONS`; the bar flattens the sections, having no room to name them.
- **One masthead row at every width.** The bar holds only identity and the menu. The single
  thing that yields below `md` is the account name, which goes `sr-only` and is read from the
  menu header instead.
- **Nothing may force a width above the viewport at 320px.** The shell is `overflow-hidden`, so
  a bar wider than the screen is lost, not scrolled to. No shell element holds a natural width
  it cannot give up.
- **Touch targets are px, not rem** (`--xp-target-floor` 24px, `--xp-touch-target` 44px): a
  finger must not grow with the reader's type. Every segmented control carries the 24px floor
  even at its compact size. The one exception is the bar's height: the menu button gets the
  full 44px across but only the masthead's 35px, because a 44px-tall target in a 35px bar takes
  taps from whatever the page puts under the chrome.
- **A bottom-bar label is never truncated and never broken mid-word.** Each item is sized by its
  own label, which puts all five names on one line at 320px. When text spacing (WCAG 1.4.12) or
  font size takes them past that, the bar wraps to a second row and grows on its `min-height`.
- **Five destinations is the bar's ceiling.** The labels fill the 320px row, and Material's
  navigation bar is a three-to-five component. A sixth destination is a different component.
- **The gate's frame is `dvh`, not `vh`**, and the shell fills it. A phone browser's toolbar is
  inside `100vh` but outside the visible viewport, so a `vh` frame hides the shell's own bottom
  bar under the toolbar on first load.
- **The bottom bar pads itself against `env(safe-area-inset-bottom)`**, and `index.html` asks
  for `viewport-fit=cover` so that inset is real rather than zero.

## Elevation & Depth

Flat, tonal, shadowless. Depth is stated by climbing the surface ladder, never by box-shadow: a
table header is raised because it is `#414141` on `#1e1e1e`. The two exceptions:

- **Modal dialogs**: a `rgb(0 0 0 / 60%)` scrim with a 2px backdrop blur - the blur plus the
  darker scrim (60% vs the theme's 40%) together state that a modal is up.
- **Chart overlays**: tooltips sit on the darkest panel (`--timeline-tooltip-bg`) with a 1px
  border, not a shadow.

**The Flat-By-Default Rule.** No new shadow vocabulary. If a surface needs to read as above
another, move it up the ladder.

## Shapes

Rectangles, small radii, 1px borders. Controls and panels round at 4px; legend swatches at 2px;
chart tooltips at 6px; nothing pill-shaped, nothing circular except status dots. Bars are
rectangles whose edges are facts (half-open intervals - an end is exclusive; the 3px corner
radius softens a corner without moving one), so a bar never takes rounding or padding that
would move an edge off its time. Meaning rides on fill treatment: solid = recorded use, hatched
= engineering use, hollow dashed outline = absence, translucent wash = closure band. A 1px
`rgb(255 255 255 / 12%)` border separates adjacent blocks that share a hue.

## Components

PrimeReact first for controls, Tailwind for layout and small adjustments; the theme is
lucuma-ui's CSS (`@gemini-hlsw/lucuma-ui-css`), re-tinted through its own variables in
`shell.css`. Do not recreate a component the shared stack provides, and do not restate a colour
a token holds. Where a design change is needed, change the variable first (the mechanics of
winning specificity battles live in CLAUDE.md).

**The One-Library Rule.** Every component is PrimeReact's: buttons, dialogs, menus, tables,
inputs and overlays come from `primereact/*` and take the lucuma-ui theme. A hand-written
element that imitates a component PrimeReact ships is not an option; plain HTML with Tailwind
is for what PrimeReact has no component for - a caption, a live region, a line of text.

**The One-Glyph-Set Rule.** Every icon is a FontAwesome icon rendered through the project's
`FontAwesomeIcon`, sized by FontAwesome's own `size` prop: no inline SVG, no PrimeIcons. The one
image is the ORCID iD logo (`src/assets/orcid-logo.svg`), on the splash's ORCID control and the
menu's login item, in ORCID's own green rather than the theme's ink, because the mark identifies
the sign-in provider and is used as ORCID publishes it.

### Interaction states

Five states, stated once because they are the app's and not any one component's.

- **Focus.** Every interactive element shows a visible action-green focus indicator, using
  `FOCUS_RING` (a 2px inset ring, `components/ui/styles.ts`). The ring is the green's **light**
  step (`--color-gpp-light`): the base green falls under 1.4.11's 3:1 floor against the
  translucent green an active nav item fills with. A segmented control takes the light green as
  an **outline** rather than a ring: its selected segment spends its box-shadow on the
  underline, so a focus shadow would be replaced by it and the selected segment would show no
  focus at all. The splash controls take the same outline, from `shell.css`: the theme's own
  `:focus` shadow sits in a cascade layer above Tailwind's utilities, so the ring utility never
  paints on a PrimeReact button, and an outline also survives forced-colors mode, where a shadow
  does not. A toast's close button is an exception (see Toasts). Chart bars have no keyboard
  path; nights stay reachable through the date controls until bars get a focusable treatment.
- **Hover.** A hovered surface climbs one step of the ladder, to Raised, and its text brightens
  to foreground. The primary button instead lightens its own fill to `--color-gpp-light`.
- **Disabled.** An icon button drops to 40% opacity and takes the default cursor; muted carrying
  a disabled affordance is the sanctioned case. A disabled control that gates an action states
  why (tooltip + accessible description), never just greys out.
- **Selected.** The selected member of a set raises its surface, brightens its text to
  foreground, and carries a 2px inset action-green underline. Selection is never a green fill:
  choosing a site is navigation, not a success state.
- **Active.** The current destination fills with the action green at 40% and carries
  `aria-current="page"`, set by the router rather than by hand, so the highlight cannot drift
  from what is announced.

### Buttons

- **Shape:** 4px radius, 4.2px x 9.8px padding, Dense type; every toolbar control sits on the
  28px line.
- **Splash buttons:** the one control off the 28px line. `.dark .xp-splash .p-button` in
  `shell.css` gives Body type, 4.2px x 14px padding and a 36px minimum height, and pins the
  label to its icon so the pair centres as one unit; the controls are full width within
  `max-w-xs`.
- **Primary:** action green fill, white text. One primary action per view at most; a view that
  only reads has none. When write actions arrive, the green goes to the one commit action.
- **Secondary:** slate fill (`--color-action-secondary`), foreground text.
- **Icon buttons:** 28px square, transparent at rest, secondary-text glyph, taking the shared
  hover and disabled treatments. Every icon button has an accessible name. A `text` Button takes
  this treatment by wearing `xp-icon-btn`.
- **Glyph size is em, from FontAwesome's own scale.** A glyph is sized against the label beside
  it, so it keeps its proportion wherever that label sits on the scale. Use FA's `size` prop -
  omitted to match the label (1em), `size="sm"` (0.875em) to sit under it, `size="xs"` (0.75em)
  for a menu row. No px or rem glyph size and no parallel em utility: FA's steps carry the
  baseline correction a bare `font-size` does not. Masthead glyphs take `widthAuto` to drop
  FontAwesome's fixed 1.25em canvas, because the masthead budget is the constraint. The ORCID
  logo has no `size` prop, so it alone is given the menu glyphs' box, 1.25em by 1em, as utilities.
  The splash's hero mark is the one exception, at `size="5x"` below `md` and `size="8x"` at `md`
  and up, as two FontAwesome instances in `md:hidden` / `max-md:hidden` wrappers; those two FA
  steps are the whole allowance, still no px or rem.

### Segmented controls (the site toggle)

Idle segments are surface-on-subtle with secondary text; the selected segment takes the shared
Selected treatment and the shared focus **outline**. Sized compact, since its one home is the
masthead.

### Page-header selects

The masthead carries no select: site is a segmented control, and the semester picker belongs to
/semester. A page's own Dropdown sits on the 28px control line, captioned by an uppercase
micro-label above it; the value never inherits the label's uppercase dress. The caption is bound
to the control by id (`LabelledControl`) and is the control's only accessible name - no call
site repeats it as an `aria-label`.

### The environment banner

A full-width strip above the masthead naming the build that is not production, in the identity
accent with dark ink. It spans the viewport, so no width can clip it and nothing in the bar has
to yield to make room. Production renders nothing. It sits above the session gate, so it is the
one element common to the splash and the app; whatever the gate draws - the loading mark, the
splash, the shell - fills the row under it.

### The splash

The one full-bleed surface, drawn by the session gate under the environment banner for a reader
with no session. At `md` and up it is a two-column grid: identity on the left on Surface with a 1px
Subtle right border, hugging the inner edge and vertically centred (the Resource mark in action
green at FontAwesome `size="8x"`, "RESOURCE" in the wordmark treatment, the tagline at Body in
Secondary, right-aligned, wrapped at `max-w-2xs`); actions on the right on the canvas (the Title
heading "Sign in to read the schedule", then two equal Secondary buttons stacked at `max-w-xs`,
ORCID first with the ORCID iD logo, guest second with the Astronaut glyph). Below `md` it folds
into one centred column: mark at `size="5x"`, wordmark, tagline centred, heading, both buttons the
full width of the `max-w-xs` column; nothing below the fold at 390 by 844. Both buttons are 36px
tall at Body type, on the phone too, with icon and label centred together as one unit rather than
the icon pinned to the far edge of the wide control. The ORCID control is an
anchor wearing the secondary button's classes, because SSO sign-in is a navigation and PrimeReact's
Button renders only a `<button>`; it is the one sanctioned exception to the One-Library Rule.
On mount, focus goes to the splash's `main` landmark (`tabIndex={-1}`, `outline-none`), not
to the ORCID control: Chrome treats script-moved focus before any pointer input as keyboard
focus, so a focused control would paint its outline on every load for a reader who never touched
the keyboard. A screen reader announces the heading, and the first Tab reaches ORCID, the second
Guest. Both controls take the shared focus outline
(`.dark .xp-splash .p-button:focus-visible` in `shell.css`) and the secondary hover, the anchor by
its own selector in that hover rule; the splash is the page's `main`, named by its heading; the
logo is decorative. Nothing on it animates.

### Tables

- **Headers:** raised (`#414141`), 600 weight, body-size type, sortable where sorting means
  something.
- **Rows:** surface (`#1e1e1e`), compact, subtle stripe on alternates; an expansion is its row
  continued (one shade off, `rgb(255 255 255 / 1%)`). The row height is `lucuma-ui-css`'s: its
  cell padding and row toggler are rem-sized, so a reader who scales their type gets taller
  rows.
- **History tables** (`RecordHistoryTable`): a plain `<table>` rather than a nested DataTable;
  columns keep their place even when empty; a note goes in a column that wraps, never a second
  line that truncates.
- Tables are real tables: header cells are `<th>`, data cells `<td>`. Every chart owes a table
  as its accessible reading; the semester chart's screen-reader table is the model.

### Status tags

One vocabulary everywhere, from `componentStatus`: **Science** (success green), **Engineering**
(info blue), **Spare** (neutral, muted tone), and **Unavailable** (danger red, alert tone),
rendered by `StatusTag`. The status cell shows the badge alone - the presence dot belongs to
`WhereCell`, and a record's note is its own column. Tag text clears 4.5:1 on its fill. Tag type
sits at Dense, taken from the app's own token in `shell.css` once for every tag, because the
theme restates the size as a literal that is free to drift off the scale. The success green and
the danger red take dark ink rather than the theme's light text, retinted once in `shell.css`.

### Page status (`PageStatus`)

The three states a page shows instead of content, as three distinct components, never one that
decides: `ErrorAlert` (reserved danger red, `role="alert"`, the error's own message verbatim),
`Loading`, and `EmptyPanel` (neutral - never red, never a warning: a gap means "not recorded").
The night and week views each put an `EmptyPanel` in place of the chart when nothing is recorded
for any of their nights.

**The loader.** `Loading` is the one place the Resource mark (`LayerGroup`, the wordmark's
glyph) moves. It sits centred at the top of the data area in the brand green (`text-gpp`), at
three times the Dense size (36px), with the Dense words at Secondary beneath it; the session gate
draws the same loader under the environment banner while the session check runs; the words are
what a screen reader reads, and the mark is hidden from it. The mark performs `loader-hop`
(`--animate-loader-hop`), one 1.8s cycle of squash, hop, landing, wobble and rest, because the
gate's loader can wait the whole refresh timeout on the sign-in check (page loads no longer wait on
it) and a loop with a rest in it stays watchable that long where a spin or a pulse turns
mechanical. It stays invisible for its first 300 ms, then fades in
over 200 ms (`loader-appear`, `--animate-loader-appear`), so a short load never shows it; there
is no minimum, and the words stay in the accessibility tree while invisible. Under
`prefers-reduced-motion` the mark stands still and the loader appears at once. Nothing else in
the app animates the mark; the splash draws the same glyph, still, as its hero.

### Toasts

- **Purpose.** A toast says that something happened. A standing condition stays a `PageStatus`,
  except a live-server failure: a sticky warn toast, one at a time, gone at the next answer
  without errors. The app has one outlet, above navigation, so a toast survives a route change.
- **Place.** PrimeReact's bottom-right corner, 20px from the right and 36px from the bottom (the
  theme's 16px margin under each toast); on a phone, the full width inside 20px gutters.
- **Colour.** Warn takes the warning panel triplet (`--color-warning-fill`, `-edge`, `-ink`) and
  is opaque; it is the only severity restyled. Info (the other-tab sign-out) and error (the guest
  failure) keep the theme's look.
- **Words.** The summary says what happened in the reader's terms; the detail says why, or what
  to do next. The exceptions are a summary alone: the three live-server failure toasts
  (unreachable, sign-in, server error), the other-tab sign-out, "Your session ended", and the
  guest failure "Could not start a guest session".
- **Lifetime.** PrimeReact's, and a pointer resting on the toast holds it. Anything the reader
  must not miss is `sticky`.
- **Close.** The close button is named "Close". It sits on coloured fills no single green
  clears, so its focus outline takes the toast's own ink and clears 3:1 on every severity's
  fill.
- **Every toast is an alert**, whatever its severity, so keep toasts for events worth
  interrupting for.

### Charts (the signature component)

Every schedule view draws from the same timeline builders; a view supplies its axis and its
phrasing of a span, nothing else.

- **Structure:** state rows (Telescope, Mode, ToO) head every schedule view as a monochrome
  band; small-caps group headings in the gutter name "Telescope" and "Instruments" and double as
  the band's breathing room (group headings, not axis breaks - a break drops the gutter label
  out of line with its bar).
- **The night view draws the chart alone, deliberately bare** - its emptiness is a decision;
  do not furnish it.
- **No subsystem rows** (PWFS1/PWFS2/LGS) on any view: the three views draw the same rows, and
  nightly subsystem state would be three semester-constant rows per month on the wide views.
- **Legend:** one section per state row, then Instruments, then Calendar - five, in that order.
  The window's projection derives the keys from what it placed and the bar draws them; no view
  adds or removes one. A repeated grey is keyed under the row it belongs to; a section with no
  keys does not render.
- **The now marker is a bare line** in the today colour, with no word beside it; the legend's
  Now key (Today on the semester) names it.
- **Every night-shaped thing opens its night view** - chart bars route onto `/night`. Rows and
  blocks are not inert: they take selection and focus states even while nothing sets them, so
  editing can compose over the same timeline.

### Navigation (sidebar and phone bar)

Uppercase section labels over icon+text items, the current one taking the shared Active
treatment. Sections are driven by configuration (`SIDEBAR_MENU_SECTIONS`), not hard-coded
lists. The phone's bottom bar draws the same destinations icon-over-label with the same fill;
which of the two is shown is the phone shell's rule.

## Do's and Don'ts

### Do:

- **Do** climb the surface ladder in order; a new layer takes the next step, not a new hex.
- **Do** spend colour on data. Chrome stays neutral so instruments and alarms own the hue.
- **Do** put every control on the 28px line and every caption through `LabelledControl`.
- **Do** show the published name (`'Alopeke`, Maroon-X), never the enum, and keep the name in
  words beside every colour.
- **Do** give every chart a block-table reading, and drive tests through accessible queries.
- **Do** target WCAG 2.2 AA on every change: 4.5:1 text, 3:1 UI parts, visible focus, 24px
  minimum targets, full keyboard paths.
- **Do** design every new component with its editing states in mind (disabled-with-reason,
  unsaved change, validation failure, save success, conflict, no-permission), even while the
  app is read-only.

### Don't:

- **Don't** hard-code a colour in a component; components read variables.
- **Don't** give a schedule state a hue, a port its own red, or absence a colour.
- **Don't** decorate a gap: no skeleton rows, placeholder bars, or "probably fine" fills.
- **Don't** use the identity accent (`--color-gpp-accent`) on anything interactive.
- **Don't** put informative text below 60% white, or below Dense (12px).
- **Don't** add a masthead item without checking the width budget.
- **Don't** introduce a second density: no per-view font-size overrides; fix the layout instead.
- **Don't** set a root font size on `html`; density belongs to `--spacing` and the px chrome
  values.
- **Don't** copy an Explore weakness for continuity's sake; continuity binds palette, density
  and family resemblance, not defects.

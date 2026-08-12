# Need clarification

Questions that need an answer from operations (Bryan, Andrew, or science
operations) before the code can stop guessing. Each entry says what was assumed
in the meantime, so nothing is blocked and nothing is silently invented. Answered
questions move to the record at the bottom - kept, because they are why the code
is the way it is.

---

## Open

### 1. What does "A&G" mean on Gemini South's Port 4?

**Where:** `mock-server/import/blocks.ts`; it comes through as the `reason` on a
port closure.

GS prints "A&G" over Port 4's empty span in 2025A, 2026A and 2026B - for all of
2026B, the entire semester. Dan, 2026-08-07: "A&G is not the instrument, I don't
know what it actually means."

**Assumed:** it is free text on a port shutdown and is stored unparsed. If it
names a state the model should hold - acquisition and guidance being in use, say

- the closure record needs somewhere to put it.

### 2. Does Gemini North mark closures the same way?

**Where:** same.

GN marks its engineering shutdown with a _colour_ (`#cccccc`, "Engineering
Shutdown") rather than by leaving rows blank, so the two sites use opposite
conventions. GN rows are instruments, not ports, so "every row blank" there means
"no instrument usable", which may or may not mean the telescope is closed.

**Assumed:** the closure derivation runs for GS only. GN blank rows produce no
closure record.

### 3. Three GN colours are used but never listed in the sheet's key

**Where:** `mock-server/import/blocks.ts`; the blocks come through as `UNKNOWN`.

Seven blocks, all GN 2025B. Each keeps its colour and any printed note, so
answering this is a lookup, not a re-import. (`#ed7d31` was the eighth-through-
twelfth: resolved 2026-08-09 as Maroon-X via the operations workbook, now in
`instruments.ts` `UNKEYED_BACKGROUNDS`.)

| Colour    | Blocks | Where                                                                                                     |
| --------- | ------ | --------------------------------------------------------------------------------------------------------- |
| `black`   | 4      | All GN 2025-11-27, every row, no text. The workbook shows a normal Science night (it is US Thanksgiving). |
| `#cccccc` | 1      | "Engineering Shutdown" - which the workbook does not record (VALIDATION.md §3.3)                          |
| `#efefef` | 2      | "Onsky checks - as each system is checked out it becomes available for science"                           |

**Assumed:** these stay `UNKNOWN` and are excluded from the API's instrument
records rather than guessed at. `#cccccc` and `#efefef` look like operational
states rather than instruments, which may mean the model needs somewhere to put
an engineering state that is not an instrument.

### 4. Is `Engineering` really an instrument?

**Where:** `mock-server/import/instruments.ts`, the `Instrument` enum.

GN's colour key lists "Engineering" beside the instruments, so it resolves as one.

**Assumed:** modelled as an instrument for now, per Dan on 2026-08-07 ("model
them as instruments all for now"). If engineering time should instead be a
telescope mode or a `ResourceUsage` of `ENGINEERING` on the real instruments,
this changes.

### 5. Which published names map to which lucuma-core instruments?

**Where:** `mock-server/import/instruments.ts`.

The sheets publish thirteen names across both sites: Alopeke, Altair, Cal/ZORRO,
Canopus, Engineering, F2, GHOST, GMOS, GNIRS, GSAOI, IGRINS2, IQUEYE, Maroon-X.
Some are instruments, some are AO subsystems (Altair, Canopus), one is a state
(Engineering), and one names two things at once (Cal/ZORRO).

**Assumed:** all thirteen are `Instrument` enum values in Resource, keeping the
published spelling. Mapping onto the lucuma-core `Instrument` enum - and deciding
whether Altair and Canopus belong there or under subsystems - is deferred.

### 6. Four runs where the hand-built workbook and the published sheet disagree

**Where:** [VALIDATION.md](VALIDATION.md) §3.

Holding the importer against the scientist's workbook turned up four runs where
the two sources contradict each other. Every one is the same mistake in the same
direction - an instrument carried straight through a campaign that displaced it -
and in every one the published sheet names the replacement in both colour and
printed text:

| Site     | Row    | Dates                    | Workbook | Sheet                          |
| -------- | ------ | ------------------------ | -------- | ------------------------------ |
| GS 2026A | Port 4 | whole semester           | Canopus  | white; closure reading `A&G`   |
| GS 2025B | Port 4 | Aug, Sep                 | Canopus  | white                          |
| GS 2025A | Port 1 | 2025-04-07 to 2025-06-15 | GHOST    | `#EA9999` "GSAOI", "Laser run" |
| GS 2025A | Port 1 | 2025-02-10 to 2025-02-16 | GHOST    | `#FFEED5` "IQUEYE/C-1"         |

Dan found the two Port 4 runs from the published PDF, which shows the port shut
down; the two Port 1 runs came out of the comparison.

**Assumed:** the published sheet is authoritative, so the importer's reading
stands and the workbook is taken to be wrong on these 314 nights. If that is
backwards, then a published sheet can be wrong and re-importing a republished
semester cannot be trusted without a check.

### 7. Should a telescope closure hide the instruments on the ports?

**Where:** `mock-server/import/blocks.ts`; [VALIDATION.md](VALIDATION.md) §4.1.

During a shutdown the sheet uncolours every port and spells "Telescope Shutdown
A&G Maintenance" across the rows, so we record a closure and no mountings. The
workbook keeps naming the instrument bolted to each port - 124 nights' worth.

Both readings are true at once: the telescope is shut, _and_ GMOS is still on
Port 3. The model currently cannot say the second during a closure.

**Assumed:** a closure suppresses the mountings, because that is all the sheet
supports. If operations want "what is on the port" to survive a shutdown, the
mounting has to come from somewhere other than the colour.

### 8. Where does the 15% the sheet does not carry come from?

**Where:** [VALIDATION.md](VALIDATION.md) §4.2 and §4.3.

735 cells of the workbook have no counterpart in the published HTML, in both
directions: the sheet paints a row white where the workbook names an available
instrument (493 cells), and the sheet paints IGRINS-2 `lime` where the workbook
says Not Available (242 cells - mounted is not the same as usable).

Permanently-installed subsystems are the clearest sub-case - Canopus and GCAL are
standing facts about the telescope, not entries on a semester schedule, which may
be why the sheet stops printing them.

**Assumed:** Resource holds what the sheet says and no more. That is honest but
it means Resource cannot reproduce the scientist's schedule, which matters if the
scheduler is meant to consume it.

### 9. Where should moonrise and moonset come from?

**Where:** `src/domain/calendarNights.ts`, `src/domain/moon.ts`.

The calendar classifies each night dark / grey / bright, and reports hours of
astronomical dark. Both are weaker than they look:

- **Dark hours are sun-only.** Astronomical night is the sun below -18 degrees. A
  full moon riding high counts as dark, which for science planning it is not.
- **Brightness is phase only**, from a mean-synodic approximation accurate to
  about half a day, so nights near a boundary can be classified wrongly.

Dark time is not phase, it is whether the moon is _up_: a 90%-illuminated moon
setting at 23:00 still leaves six usable hours. `lucuma-core` already has the
real thing - `ImprovedSkyCalc` exposes `lunarElevation`,
`lunarIlluminatedFraction`, `lunarSkyBrightness` and `totalSkyBrightness` - but
`modules/npm` exports only formatters and ID parsers, so none of it reaches
TypeScript today.

**Assumed:** the approximation stands and is labelled as such, and the sheet's
own published new and full dates are drawn alongside it rather than replaced by
it. Three ways out, and this is an engineering call rather than an operations
one: have the Resource API compute it server-side and put it on the night;
add the skycalc exports to `lucuma-core/modules/npm`; or leave it approximate
and say so in the UI.

### 10. Does Gemini North publish holidays anywhere?

**Where:** `mock-server/import/calendarDays.ts`.

Gemini South paints its day-header row - one colour on every weekend, another on
Chilean public holidays - and the importer now reads both. All four Gemini North
sheets leave that row unpainted, so Resource holds no US or Hawaii holidays at
all, and the calendar's holiday layer is Gemini South only.

**Assumed:** GN genuinely does not publish them, the same way it marks closures by
colour where GS leaves rows blank (question 2). If operations want holidays at
both sites they have to come from somewhere other than the sheet.

---

## Answered (all by Dan, 2026-08-07)

- **A column headed "7" is the night beginning that evening** - the lucuma-core
  observing night labelled the 8th. The importer defaults to that
  (`nightLabelling: 'EVENING'`); sheet dates are kept verbatim so the convention
  can be re-derived without re-importing.
- **`instrument` is an enum in Resource**, everything on the sheets modelled as
  an instrument for now (open question 5 holds what that leaves unresolved).
- **Resource holds past and current semesters** - the eight imported (GN and GS,
  2025A-2026B) stand; adding one is a row in `publishedSets.ts`.
- **An empty cell on a port row means that port was shut down**, and a single
  port can be shut on its own (GS Port 4, all of 2026B). The importer turns the
  sheet's absence into explicit closure records - a span where every port is
  shut additionally records a telescope closure - which is what keeps "a gap
  means not recorded" intact in the API. Also confirmed: GS 2026B's shutdown
  did include 1 August, though the printed word covers only 08-02 onward.
- **A semester of records comes back in one response**, unpaged - the views
  display all of it.

# Validation against the operations schedule workbook

What happened when our importer's output was held against the telescope
schedule workbook the operations science team maintains
(`telescope_schedules.xlsx`). First validated 2026-08-08; re-run 2026-08-09
with the workbook confirmed as ground truth ("truthful for almost everything"),
which turned two of its findings into parser fixes. The short version:

> **Where the published sheet says something, we now read all of it.** After
> the two fixes below, there is no cell the sheet carries that we drop or
> misread - zero parse gaps across all seven overlapping semesters.
>
> **The workbook contains things the published sheet does not**, and a handful
> of runs where the two sources contradict each other outright. Neither is a
> parser gap to close; both are catalogued here for operations.

---

## 1. What was compared

|             |                                                                         |
| ----------- | ----------------------------------------------------------------------- |
| Workbook    | `telescope_schedules.xlsx`, two sheets (GS, GN), one row per local date |
| Ours        | the committed `mock-server/data/*.json`, i.e. what actually ships       |
| Overlap     | GS 2025A / 2025B / 2026A · GN 2025A / 2025B / 2026A / 2026B             |
| Not covered | **GS 2026B** - the workbook's GS sheet ends 2026-07-31                  |

The workbook's `Local Date` column is the **evening date**, the same date the
published sheet heads its columns. Verified by scoring the whole comparison at
-1, 0 and +1 day offsets: offset 0 wins and is the only alignment with no
contradictions. This independently confirms the night-labelling convention
PLAN.md §7 recorded as settled.

GS compares directly - the workbook names an instrument per port, and our GS
parse files blocks under the same port rows. GN compares presence against
status: the workbook gives Science / Engineering / Not Available per instrument
(including the visitors `Alopeke and MAROON-X), and our GN parse files a block
under a row when the sheet colours it. The 2026-08-09 run additionally joined
in the raw sheet cell behind every difference, so "the sheet never had it" and
"the parser dropped it" separate mechanically.

---

## 2. The numbers (2026-08-09, after the fixes)

Gemini South, 546 nights x 5 ports = 2,730 cells:

|                                          | cells |      |
| ---------------------------------------- | ----: | ---- |
| Agree on the mounted instrument          |  2180 |      |
| We say closed, workbook names instrument |   504 | §4.1 |
| Sources contradict each other            |    46 | §3.1 |
| **Parser gaps**                          | **0** | §5   |

Gemini North, 730 nights x 6 instruments = 4,380 cells:

|                                            | cells |            |
| ------------------------------------------ | ----: | ---------- |
| Agree (present-and-usable, or both absent) |  3542 |            |
| Sheet blank, workbook says Science         |   486 | §4.2       |
| Mounted is not usable (sheet coloured)     |   282 | §4.3       |
| Sheet says something else entirely         |    70 | §3.2, §4.4 |
| **Parser gaps**                            | **0** | §5         |

**We never invented a cell the workbook leaves blank**, at either site.

---

## 3. Where the two sources contradict each other

These need a ruling from operations. The parser's job is to read the sheet,
and in every one of these the sheet is unambiguous - so a republished semester
would re-import the same way until the sheet itself changes.

### 3.1 GS Port assignments (46 nights + the Port 4 runs)

| Site     | Row    | Dates                    | Workbook | Sheet, and us                        | Nights |
| -------- | ------ | ------------------------ | -------- | ------------------------------------ | ------ |
| GS 2026A | Port 4 | whole semester           | Canopus  | white cells; a closure reading `A&G` | 181    |
| GS 2025B | Port 4 | Aug, Sep                 | Canopus  | white cells                          | 61     |
| GS 2025A | Port 1 | 2025-04-07 to 2025-06-15 | GHOST    | `#EA9999` "GSAOI", "Laser run"       | 39     |
| GS 2025A | Port 1 | 2025-02-10 to 2025-02-16 | GHOST    | `#FFEED5` "IQUEYE/C-1"               | 7      |

The Port 1 runs are contradicted by the published sheet in both colour and
printed text; they are §2's 46-cell conflict bucket. The Port 4 runs sit inside
§4.1's closed-with-instrument count and may be both true at once - Canopus is
an AO bench, and "installed on the port" and "the port is usable" are different
facts; the sheet records the second, the workbook the first.

### 3.2 The 2025 Alopeke runs (39 nights, GN)

The sheets paint Alopeke visiting runs through 2025A (`#f9cb9c`, the key's own
Alopeke swatch) and 2025B (`#fce5cd` with the name printed: "`Alopeke"). The
workbook says `Alopeke was **Not Available every single night of 2025A and
2025B** - and marks MAROON-X Science on those same nights.

For 2026A and 2026B the workbook agrees exactly with the sheet's Alopeke runs
(status Science, `Mode/Program: Visitor: `Alopeke`). So either Alopeke's 2025
runs never happened and both published sheets are wrong, or the workbook's 2025
rows carry the same instrument-carried-through mistake as §3.1. Ops question.

### 3.3 Closures the workbook does not record

- Every GS telescope shutdown we derive (2025A Jul 7-24, 2025B Nov 6 in-situ
  wash, 2026A Jul 20-31) has `Telescope: Open, Mode/Program: Queue` in the
  workbook, with instruments still named on the ports (§4.1).
- GN's October 2025 engineering shutdown (`#cccccc`, "Engineering Shutdown",
  15 nights) is likewise `Open`/`Science` in the workbook - yet the GN
  2026-10-26/27 shutdown **is** recorded there as `Telescope: Closed`.

---

## 4. Differences that are not errors on either side

All one fact: **the published sheet and the workbook record different things.**

### 4.1 Closed ports still hold instruments (504 cells, GS)

During a telescope-wide closure (155 cells) or a port closure (349 cells) the
sheet uncolours the port and we record the closure. The workbook keeps naming
the instrument bolted to the port. Both are true and they are different facts:
the telescope is shut, _and_ GMOS is still on Port 3. Our model has no way to
say the second during a closure.

### 4.2 The sheet leaves a row blank (486 cells, GN)

The sheet paints a row white and the workbook marks the instrument Science.
Two flavours:

- **MAROON-X is fibre-fed and permanently available**: the workbook has it at
  Science all 365 nights of 2025A+2025B (mounted on Port 1) while the sheet's
  Visiting row only paints its discrete runs. Roughly a quarter of this bucket.
- Ordinary sparseness: GN Altair is painted only 9 nights of 2025A; GMOS-N,
  GNIRS and Altair each go white part-way through a semester the workbook keeps
  them at Science.

White is deliberate in the source (PLAN.md trap 3), not a parsing accident.

### 4.3 Mounted is not usable (282 cells, GN)

The sheet paints IGRINS-2 `lime` for long stretches the workbook calls Not
Available - 242 of these cells, confirming the 2026-08-07 "IGRINS2 mounted but
unusable" discussion behind the single `ResourceUsage` enum (PLAN.md §3.2).
The other 40 are the §3.2 Alopeke runs plus one border night.

### 4.4 Operational states painted over instrument rows (27 cells, GN)

"Engineering Shutdown" (`#cccccc`), "Onsky checks" (`#efefef`), one silver
"Shutdown", and the black one-night markers on 2025-11-27 (US Thanksgiving; a
normal Science night in the workbook). We serve them as `UNKNOWN` blocks with
their note kept - they are states, not instruments, and where they belong in
the model is NEED-CLARIFICATION question 3.

---

## 5. Parser gaps found, and fixed (2026-08-09)

Both were found by this comparison, confirmed against the workbook before
fixing, and are pinned by tests in `blocks.test.ts`:

1. **A colourless cell naming an instrument was dropped** (GS 2026A Port 5,
   2026-06-01, "F2"). Printed text that resolves to an instrument now mounts
   it, colour or not, and a closure splits around such a night.
2. **`#ed7d31` is MAROON-X** - unlisted in the GN key, 51 nights shipped as
   `UNKNOWN`. Now carried as an unkeyed background in `instruments.ts`; the
   sheet's own key still wins where present.

---

## 6. What this means

The importer reads the sheet exactly. The remaining findings are about the
**sources**: reproducing this workbook from the published overview HTML is not
possible, because a slice of the workbook (fibre-fed availability, instruments
behind closed ports, port assignments at GN) is simply not in the HTML - and a
handful of runs (§3) contradict outright.

Questions for operations, in order of consequence:

1. **§3.1 / §3.2** - which source is right for those runs?
2. **Should a closure suppress the instruments on the ports?** Today it does;
   §4.1's 504 cells are the argument that "installed" and "usable" want to be
   separate facts.
3. **Where does standing availability live?** MAROON-X-on-fibre and
   Canopus-on-Port-4 look like standing facts rather than schedule blocks
   (NEED-CLARIFICATION question 1).

The comparison itself ran as throwaway scripts over `mock-server/import/`;
worth committing as a fixture-backed test once §3 is settled - until then it
would pin whichever side turns out to be wrong.

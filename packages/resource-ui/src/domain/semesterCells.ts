/**
 * Timeline blocks -> one cell per night, which is what the heatmap and the
 * calendar draw.
 *
 * The chart draws blocks; those two draw nights. Both readings have to be
 * projected from the same place or they drift, and drift is exactly what
 * happened to the module this replaces. It built its own cells straight from
 * `Mounting` and `Closure`, so it never got any of the resolution `timeline.ts`
 * does in `collectBlocks`:
 *
 * - it never subtracted the telescope-wide spans, so the sheet's vertically
 *   spelled "Telescope Shutdown A&G Maintenance" came out one word per row and
 *   Port 2 read as though it were named "Telescope";
 * - it mapped every port closure to CLOSED, so A&G on Port 4 was painted as a
 *   six-month failure - the reading PLAN.md §7b and NEED-CLARIFICATION question
 *   1 say we do not have evidence for;
 * - it coloured by availability, which is the call §7 reversed.
 *
 * Nothing here reads a record. It reads `TimelineRow` and `TimelineBand`, after
 * `collectBlocks` has already resolved them, so none of the above can come back.
 *
 * ## Columns are evening dates
 *
 * A column headed 7 is the night that *begins* on the 7th, which is the
 * observing night labelled by the 8th. The sheet heads columns the first way and
 * the model stores the second; `TimelineNight` carries both, so the mapping is
 * read here rather than recomputed.
 */
import type { TimelineNight, TimelineRow } from './timeline';
import { clip, isNotableState } from './timeline';
import type { Instrument, Interval, ResourceUsage } from './types';

/** What a single night on a single row says. */
export type CellKind =
  /** One instrument, the whole night. Coloured by which. */
  | 'MOUNTED'
  /**
   * The sheet marks the night but names no instrument - "A&G" on Gemini South's
   * Port 4. Drawn hollow, not as a closure: what it means for availability is
   * still open (NEED-CLARIFICATION question 1).
   */
  | 'UNSCHEDULED'
  /** A recorded telescope state, on the Mode or ToO row. Drawn monochrome. */
  | 'STATE'
  /** A telescope-wide closure covers this night. One band, every row. */
  | 'CLOSED'
  /** More than one state within the night. Partial nights land here. */
  | 'MIXED'
  /** Nothing recorded. Never means "unavailable" (invariant I4). */
  | 'EMPTY';

export interface SemesterCell {
  /** The observing night, labelled by the date it ends. */
  readonly observingNight: string;
  /** The date the night begins - what the sheet heads the column with. */
  readonly eveningDate: string;
  readonly kind: CellKind;
  readonly instrument: Instrument | null;
  /** What a MOUNTED night's instrument can be used for; null otherwise. */
  readonly usage: ResourceUsage | null;
  /** Whether a STATE cell records a notable state (`isNotableState`). */
  readonly notable: boolean;
  /** What to print when this cell starts a run. Empty when nothing is named. */
  readonly label: string;
  /** The full sentence, for a tooltip or a screen reader. */
  readonly description: string;
  readonly isWeekend: boolean;
  /** True when this cell begins a run of the same content. */
  readonly startsRun: boolean;
  /** Nights the run beginning here covers; 0 unless `startsRun`. */
  readonly runLength: number;
  /**
   * How many nights of width the run's label may use.
   *
   * Its own length plus any immediately following runs that print nothing, so a
   * short run's name can spill across the blank nights after it instead of being
   * cut to "Alo…", while never reaching the next label.
   */
  readonly labelSpan: number;
}

export interface SemesterCellRow {
  /** Stable key: the port number or the instrument name. */
  readonly key: string;
  readonly label: string;
  readonly cells: readonly SemesterCell[];
}

/** Whether a span covers a night end to end, rather than part of it. */
const coversWholeNight = (span: Interval, night: Interval): boolean =>
  span.start <= night.start && span.end >= night.end;

/** Whether a span reaches into a night at all. */
const touchesNight = (span: Interval, night: Interval): boolean => clip(span, night) !== null;

type Bare = Omit<SemesterCell, 'startsRun' | 'runLength' | 'labelSpan' | 'description'>;

const describe = (cell: Bare, rowLabel: string): string => {
  // "beginning", the calendar's phrasing: a column is the evening a night
  // starts, and "night of" is reserved for the end-labelled observing night
  // the cell's click-through opens.
  const night = `night beginning ${cell.eveningDate}`;
  switch (cell.kind) {
    case 'MOUNTED':
    case 'STATE':
      return `${rowLabel}: ${cell.label}, ${night}`;
    case 'UNSCHEDULED':
      return `${rowLabel}: no instrument scheduled${cell.label === '' ? '' : ` - ${cell.label}`}, ${night}`;
    case 'CLOSED':
      return `${rowLabel}: closed${cell.label === '' ? '' : ` - ${cell.label}`}, ${night}`;
    case 'MIXED':
      return `${rowLabel}: changes during the ${night}`;
    default:
      return `${rowLabel}: nothing recorded, ${night}`;
  }
};

/**
 * What one row says on one night.
 *
 * A telescope-wide closure does not repaint the subject rows: the Telescope
 * row's own Closed cells are the red statement, the shutdown wash spans the
 * columns (semesterHeatmapOptions), and each row keeps its own record - which
 * during a shutdown is usually the sheet's own empty cell. Saying "closed"
 * once instead of once per row is the whole treatment (Dan, 2026-08-11).
 */
const cellFor = (row: TimelineRow, night: TimelineNight): Bare => {
  const base = {
    observingNight: night.observingNight,
    eveningDate: night.eveningDate,
    isWeekend: night.isWeekend,
    usage: null,
    notable: false,
  };

  const touching = row.blocks.filter((block) => touchesNight(block.interval, night.interval));
  const only = touching[0];
  if (only === undefined) {
    return { ...base, kind: 'EMPTY', instrument: null, label: '' };
  }
  if (touching.length > 1 || !coversWholeNight(only.interval, night.interval)) {
    // Two blocks in one night, or one that covers only part of it. Either way the
    // night is not uniform, which is the case PLAN.md §3.1 says a whole-night
    // cell must mark rather than flatten. The night view draws where it changes.
    return { ...base, kind: 'MIXED', instrument: null, label: '' };
  }
  if (only.state === 'TELESCOPE') {
    // The Telescope row's closed night is the closure and wears its red. The
    // cell prints "Closed", as the chart block does - the reason is the wash
    // band's label, so it is never said twice side by side. Open reads as the
    // quiet recorded state, like Queue.
    return only.variant === 'CLOSED'
      ? { ...base, kind: 'CLOSED', instrument: null, label: only.label }
      : { ...base, kind: 'STATE', instrument: null, label: only.label };
  }
  if (only.state === 'TOO' || only.state === 'MODE') {
    return { ...base, kind: 'STATE', instrument: null, label: only.label, notable: isNotableState(only) };
  }
  return only.state === 'MOUNTED'
    ? { ...base, kind: 'MOUNTED', instrument: only.instrument, usage: only.usage, label: only.label }
    : { ...base, kind: 'UNSCHEDULED', instrument: null, label: only.label };
};

/** Marks the first cell of each run, how far it reaches, and how wide its label may be. */
const withRuns = (cells: readonly Bare[], rowLabel: string): readonly SemesterCell[] => {
  const same = (a: Bare | undefined, b: Bare): boolean =>
    a?.kind === b.kind && a.instrument === b.instrument && a.label === b.label && a.usage === b.usage;

  const marked = cells.map((cell, index) => ({
    ...cell,
    description: describe(cell, rowLabel),
    startsRun: !same(cells[index - 1], cell),
    runLength: 0,
    labelSpan: 0,
  }));

  // One forward pass: each run's head accumulates the cells that continue it.
  let head: (typeof marked)[number] | undefined;
  for (const cell of marked) {
    if (cell.startsRun) {
      head = cell;
      cell.runLength = 1;
    } else if (head !== undefined) {
      head.runLength += 1;
    }
  }

  // A label may spill over the runs after it that print nothing themselves.
  const heads = marked.filter((cell) => cell.startsRun);
  heads.forEach((entry, index) => {
    let span = entry.runLength;
    for (let next = index + 1; next < heads.length; next += 1) {
      const following = heads[next];
      if (following?.label !== '') {
        break;
      }
      span += following.runLength;
    }
    entry.labelSpan = span;
  });
  return marked;
};

export interface BuildSemesterCellsOptions {
  readonly rows: readonly TimelineRow[];
  readonly nights: readonly TimelineNight[];
}

/**
 * Projects placed timeline rows onto one cell per night.
 *
 * Takes what `placeBlocks` already produced for a window, so a month's cells
 * and a month's bars are the same facts twice rather than two readings of the
 * source. The closure never repaints rows here: it lives on the Telescope
 * row's cells and the wash the view draws over the columns.
 */
export const buildSemesterCells = ({ rows, nights }: BuildSemesterCellsOptions): readonly SemesterCellRow[] =>
  rows.map((row) => ({
    key: row.key,
    label: row.label,
    cells: withRuns(
      nights.map((night) => cellFor(row, night)),
      row.label,
    ),
  }));

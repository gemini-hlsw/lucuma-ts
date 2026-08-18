/**
 * The instrument finder: what one row of the instrument browser says about one
 * instrument, on one night.
 *
 * The schedule views answer "what is on each port"; this answers the other
 * direction - "where is GNIRS" - which the ports' picture cannot, because an
 * instrument between mounts has no port and therefore no row there
 * (workbook.ts, Dan 2026-08-12).
 *
 * It is the mirror of `componentFinder`, one level up: same night-not-instant
 * reading, same "the night's last record decides", same honest absence. A
 * component's whereabouts resolve through its instrument's mounting; an
 * instrument's resolve through its own availability records.
 */
import { portRowLabel } from './ports';
import type { Instrument, Interval, Mounting, OffPortPlace, ResourceUsage } from './types';

export type InstrumentWhere =
  /** Mounted on a port over the night. */
  | { readonly kind: 'PORT'; readonly port: number }
  /**
   * Recorded usable, but on no port - a visitor between mounts. The workbook
   * does not say where it physically sits, so the place is whatever the record
   * carries, usually UNKNOWN.
   */
  | { readonly kind: 'OFF_PORT'; readonly place: OffPortPlace }
  /** No record covers the night. Never rendered as "unavailable" (I4). */
  | { readonly kind: 'NOT_RECORDED' };

export interface InstrumentRow {
  readonly instrument: Instrument;
  /** The name the schedule prints, e.g. "GMOS-S" - what the row label shows. */
  readonly publishedName: string;
  readonly where: InstrumentWhere;
  /** Null exactly when nothing is recorded for the night. */
  readonly usage: ResourceUsage | null;
  readonly note: string | null;
  /** The run covering the night, at its own full extent - null when none does. */
  readonly run: Interval | null;
  /** True when the instrument's record changes during this night. */
  readonly changesTonight: boolean;
  /** The instants the record changes during the night, in order. */
  readonly transitions: readonly number[];
}

const overlaps = (a: Interval, b: Interval): boolean => a.start < b.end && b.start < a.end;

/** Where consecutive runs meet, or the edges of the gap between them. */
const transitionsOf = (runs: readonly Mounting[]): readonly number[] =>
  runs.slice(1).flatMap((run, index) => {
    const previous = runs[index];
    return previous !== undefined && previous.interval.end < run.interval.start
      ? [previous.interval.end, run.interval.start]
      : [run.interval.start];
  });

// `?? 'UNKNOWN'` is unreachable: `Mounting` promises `place` is non-null exactly
// when `port` is null (`types.ts`). It stays because `Mounting` types the two
// fields independently, so the compiler cannot see that exclusivity - not
// because the invariant is soft.
const whereOf = (mounting: Mounting): InstrumentWhere =>
  mounting.port === null
    ? { kind: 'OFF_PORT', place: mounting.place ?? 'UNKNOWN' }
    : { kind: 'PORT', port: mounting.port };

export interface BuildInstrumentRowsOptions {
  /** Every mounting over the window - the browser's whole subject. */
  readonly mountings: readonly Mounting[];
  /** The observing night being asked about. */
  readonly night: Interval;
}

/**
 * One row per instrument the window's records name.
 *
 * Driven by the records rather than by the enum: a site's browser should list
 * what that site's schedule actually holds, not fourteen rows of which five
 * are permanently blank.
 *
 * Ordered by enum tag only to be deterministic - a view that prints a
 * different name (CAL_ZORRO reads "Zorro") sorts by what it shows.
 */
export const buildInstrumentRows = ({ mountings, night }: BuildInstrumentRowsOptions): readonly InstrumentRow[] => {
  const instruments = [...new Set(mountings.map((mounting) => mounting.instrument))].sort((a, b) => a.localeCompare(b));

  return instruments.map((instrument) => {
    const runs = mountings.filter((mounting) => mounting.instrument === instrument);
    const tonight = runs
      .filter((mounting) => overlaps(mounting.interval, night))
      .sort((a, b) => a.interval.start - b.interval.start);
    // The night's last record decides: an instrument that comes off a port
    // mid-night reports where it ended up, as the component finder does.
    const deciding = tonight.at(-1);
    const named = runs.find((mounting) => mounting.publishedName !== '')?.publishedName ?? instrument;

    if (deciding === undefined) {
      return {
        instrument,
        publishedName: named,
        where: { kind: 'NOT_RECORDED' },
        usage: null,
        note: null,
        run: null,
        changesTonight: false,
        transitions: [],
      };
    }
    const transitions = transitionsOf(tonight);
    return {
      instrument,
      publishedName: deciding.publishedName,
      where: whereOf(deciding),
      usage: deciding.usage,
      note: deciding.note,
      run: deciding.interval,
      changesTonight: transitions.length > 0,
      transitions,
    };
  });
};

/**
 * How a row's location reads - the one phrasing the Where cell prints and the
 * location filter groups by, so the two can never drift.
 *
 * A port reads as its schedule row, the same label the charts print
 * (`domain/ports.ts`). Everything else is the plain fact: the workbook records
 * usable-with-no-port without saying where the instrument sits, and an absence
 * stays an absence (I4) - never carried forward from the last night that had a
 * record.
 */
export const OFF_PORT_LABEL = 'Not on a port';
export const NOT_RECORDED_LABEL = 'Not recorded';

/**
 * Where an instrument sits when it is not on a port, in operations' words.
 *
 * UNKNOWN is the workbook's own off-port run - recorded usable with no port and
 * nothing said about the place - so it reads as the plain fact rather than
 * naming somewhere the record never named.
 */
export const PLACE_LABEL = {
  FLOOR: 'Dome floor',
  LAB: 'Summit lab',
  BASE: 'Base facility',
  UNKNOWN: OFF_PORT_LABEL,
} satisfies Record<OffPortPlace, string>;

/**
 * One reading of "where", in words - the only place the three cases are
 * phrased, so a row and the record behind it cannot answer differently.
 */
const whereLabel = (where: InstrumentWhere): string => {
  switch (where.kind) {
    case 'PORT':
      return portRowLabel(where.port);
    case 'OFF_PORT':
      return PLACE_LABEL[where.place];
    default:
      return NOT_RECORDED_LABEL;
  }
};

/** Where one record puts an instrument: its port, or the place it is stored. */
export const mountingLocationLabel = (mounting: Mounting): string => whereLabel(whereOf(mounting));

export const locationLabel = (row: InstrumentRow): string => whereLabel(row.where);

/**
 * The locations the rows actually hold, each with its count - ports in their
 * own order, then the two plain facts. Only what is there is offered, so a
 * filter never leads to an empty table.
 */
export const locationOptions = (rows: readonly InstrumentRow[]): readonly { label: string; count: number }[] => {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const label = locationLabel(row);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  // Ports first, then the places an instrument is stored, then the two plain
  // facts - so the list reads from "on the telescope" outwards.
  const places: readonly string[] = [PLACE_LABEL.FLOOR, PLACE_LABEL.LAB, PLACE_LABEL.BASE];
  const rank = (label: string): number =>
    label === NOT_RECORDED_LABEL ? 3 : label === OFF_PORT_LABEL ? 2 : places.includes(label) ? 1 : 0;
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => rank(a.label) - rank(b.label) || a.label.localeCompare(b.label));
};

/** An instrument's runs over the window, oldest first - the row expansion. */
export const runsOf = (instrument: Instrument, mountings: readonly Mounting[]): readonly Mounting[] =>
  mountings
    .filter((mounting) => mounting.instrument === instrument)
    .sort((a, b) => a.interval.start - b.interval.start);

/** Case-insensitive match on the enum tag or the name the schedule prints. */
export const matchesInstrument = (row: InstrumentRow, search: string): boolean => {
  const needle = search.trim().toLowerCase();
  return (
    needle === '' || [row.instrument, row.publishedName].some((identity) => identity.toLowerCase().includes(needle))
  );
};

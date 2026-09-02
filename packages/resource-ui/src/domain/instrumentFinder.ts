import { overlaps, transitionsOf } from './interval';
import { STORAGE_PLACE_LABEL } from './places';
import { portRowLabel } from './ports';
import type { Instrument, Interval, Mounting, OffPortPlace, ResourceUsage } from './types';

export type InstrumentWhere =
  /** Mounted on a port over the night. */
  | { readonly kind: 'PORT'; readonly port: number }
  /** Recorded usable but on no port. The workbook does not say where, so the place is usually UNKNOWN. */
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

// Unreachable: `Mounting` types `place` and `port` independently, so the compiler cannot see they are exclusive.
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

/** Driven by the records, not the enum: a site lists what its schedule holds, not permanently blank rows. */
export const buildInstrumentRows = ({ mountings, night }: BuildInstrumentRowsOptions): readonly InstrumentRow[] => {
  const instruments = [...new Set(mountings.map((mounting) => mounting.instrument))].sort((a, b) => a.localeCompare(b));

  return instruments.map((instrument) => {
    const runs = mountings.filter((mounting) => mounting.instrument === instrument);
    const tonight = runs
      .filter((mounting) => overlaps(mounting.interval, night))
      .sort((a, b) => a.interval.start - b.interval.start);
    // The night's last record decides, as the component finder does.
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

export const OFF_PORT_LABEL = 'Not on a port';
export const NOT_RECORDED_LABEL = 'Not recorded';

/** UNKNOWN reads as the plain fact rather than naming somewhere the record never named. */
export const PLACE_LABEL = {
  ...STORAGE_PLACE_LABEL,
  UNKNOWN: OFF_PORT_LABEL,
} satisfies Record<OffPortPlace, string>;

/** The only place the three cases are phrased, so a row and its record cannot answer differently. */
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

/** Only what is there is offered, so a filter never leads to an empty table. */
export const locationOptions = (rows: readonly InstrumentRow[]): readonly { label: string; count: number }[] => {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const label = locationLabel(row);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  // Ports first, then storage places, then the two plain facts: from "on the telescope" outwards.
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

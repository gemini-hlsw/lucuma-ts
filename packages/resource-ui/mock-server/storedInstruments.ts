import type { ImportedSchedule, ImportedUsage, ImportSite, Instrument, OffPortPlace } from './records.ts';

export type { OffPortPlace };

export type StoredInstrumentUsage = ImportedUsage;

/** Declared per instrument rather than derived from a hash, so one is the same example every time. */
export type StoredPattern =
  /** In the summit lab throughout - shelved, not being worked on. */
  | 'IN_LAB'
  /** Lab, then wheeled onto the dome floor for a fit check, then back. */
  | 'LAB_FLOOR_LAB'
  /** At the base facility, then up to the summit lab for commissioning. */
  | 'BASE_THEN_LAB'
  /** On the dome floor being commissioned, then in the lab. */
  | 'COMMISSIONING';

interface Entry {
  readonly instrument: Instrument;
  readonly site: ImportSite;
  readonly publishedName: string;
  readonly pattern: StoredPattern;
}

/** `publishedName` is the name operations would print, shown beside the enum label. */
const CATALOG: readonly Entry[] = [
  // Each telescope has an acquisition camera; one enum tag, two instruments.
  { instrument: 'ACQ_CAM', site: 'GN', publishedName: 'AcqCam', pattern: 'IN_LAB' },
  { instrument: 'ACQ_CAM', site: 'GS', publishedName: 'AcqCam', pattern: 'LAB_FLOOR_LAB' },
  { instrument: 'NIRI', site: 'GN', publishedName: 'NIRI', pattern: 'LAB_FLOOR_LAB' },
  { instrument: 'GPI', site: 'GS', publishedName: 'GPI', pattern: 'BASE_THEN_LAB' },
  { instrument: 'SCORPIO', site: 'GS', publishedName: 'SCORPIO', pattern: 'COMMISSIONING' },
];

export interface SynthesizedInstrumentBlock {
  readonly id: string;
  readonly site: ImportSite;
  readonly instrument: Instrument;
  readonly publishedName: string;
  /** Off the charts by construction: OffPortPlace cannot be PORT, and a view's rows are the ports. */
  readonly place: OffPortPlace;
  readonly usage: StoredInstrumentUsage;
  readonly start: string;
  readonly end: string;
  readonly note: string | null;
}

interface Span {
  readonly start: number;
  readonly end: number;
}

interface Stay {
  readonly place: OffPortPlace;
  readonly usage: StoredInstrumentUsage;
  readonly span: Span;
  readonly note: string | null;
}

const iso = (millis: number): string => new Date(millis).toISOString();

/** Rounded to the hour, so a boundary reads as a time someone could have written down. */
const within = (span: Span, fraction: number): number =>
  Math.round((span.start + (span.end - span.start) * fraction) / 3_600_000) * 3_600_000;

/** The whole span a site's schedules cover, from their own records. */
const siteSpan = (schedules: readonly ImportedSchedule[], site: ImportSite): Span | null => {
  const edges = schedules
    .filter((schedule) => schedule.site === site)
    .flatMap((schedule) => [...schedule.blocks, ...schedule.closures])
    .flatMap((record) => [Date.parse(record.start), Date.parse(record.end)]);
  return edges.length === 0 ? null : { start: Math.min(...edges), end: Math.max(...edges) };
};

const stay = (span: Span, place: OffPortPlace, usage: StoredInstrumentUsage, note: string | null = null): Stay => ({
  place,
  usage,
  span,
  note,
});

/** One instrument's stays over the site's span, per its declared pattern. */
const staysFor = (pattern: StoredPattern, span: Span): readonly Stay[] => {
  switch (pattern) {
    case 'IN_LAB':
      return [stay(span, 'LAB', 'UNAVAILABLE')];
    case 'LAB_FLOOR_LAB': {
      const out = within(span, 0.45);
      const back = within(span, 0.6);
      return [
        stay({ start: span.start, end: out }, 'LAB', 'UNAVAILABLE'),
        stay({ start: out, end: back }, 'FLOOR', 'ENGINEERING', 'On the dome floor for a fit check'),
        stay({ start: back, end: span.end }, 'LAB', 'UNAVAILABLE'),
      ];
    }
    case 'BASE_THEN_LAB': {
      const up = within(span, 0.7);
      return [
        stay({ start: span.start, end: up }, 'BASE', 'UNAVAILABLE', 'Stored at the base facility'),
        stay({ start: up, end: span.end }, 'LAB', 'ENGINEERING', 'Brought to the summit for rework'),
      ];
    }
    default: {
      const shelved = within(span, 0.55);
      return [
        stay({ start: span.start, end: shelved }, 'FLOOR', 'ENGINEERING', 'Commissioning'),
        stay({ start: shelved, end: span.end }, 'LAB', 'UNAVAILABLE'),
      ];
    }
  }
};

/** Anchored to each site's recorded span, so no consumer sees a location for an unknown night. */
export const synthesizeStoredInstruments = (
  schedules: readonly ImportedSchedule[],
): readonly SynthesizedInstrumentBlock[] =>
  CATALOG.flatMap((entry) => {
    const span = siteSpan(schedules, entry.site);
    if (span === null) {
      return [];
    }
    return staysFor(entry.pattern, span).map((held, index) => ({
      id: `i-${entry.site.toLowerCase()}-${entry.instrument}-${String(index)}`,
      site: entry.site,
      instrument: entry.instrument,
      publishedName: entry.publishedName,
      place: held.place,
      usage: held.usage,
      start: iso(held.span.start),
      end: iso(held.span.end),
      note: held.note,
    }));
  });

/**
 * The synthetic stored-instrument layer - instruments GPP knows about that the
 * workbook never schedules, and where they sit when they are not on a port.
 *
 * **This module is a quarantine boundary**, the same one `components.ts` draws:
 * nothing else in the mock knows these records are invented. Swap this one file
 * when operations record real instrument whereabouts.
 *
 * The rules it lives under, matching the component layer:
 *
 * - **Deterministic.** No PRNG and no wall clock. Each instrument declares a
 *   pattern; the spans are derived from the site's own schedule span, so a
 *   re-import moves them with the data rather than decaying against it.
 * - **Never on a port.** These records carry `port: null`, so no schedule view
 *   draws them - a view's rows are the ports - and the ports' picture stays
 *   exactly what the workbook says.
 * - **Never decides `dataAvailable`.** Invented records must not turn an
 *   un-entered night into a recorded one (resolvers.ts).
 *
 * ## Why these instruments
 *
 * `lucuma-core`'s `Instrument` enumerates fourteen; the workbook schedules a
 * subset. The four here - the acquisition cameras, GPI, NIRI and SCORPIO - are
 * real GPP instruments with no run in this export, so without them the browser
 * would answer "where is NIRI" with silence.
 *
 * **Site is fixed per instrument**: an instrument does not move between
 * telescopes, so each entry names its site and every record it produces carries
 * it. NIRI is Gemini North's, GPI and SCORPIO Gemini South's; the acquisition
 * camera is a facility instrument each telescope has one of, so it appears at
 * both under the one enum tag - exactly as GMOS does for GMOS-N and GMOS-S.
 * **Location is not fixed**: that is the point of these records - a stored
 * instrument moves between the summit lab, the dome floor and the base.
 */
import type { ImportedSchedule, ImportSite } from './import/blocks.ts';
import type { Instrument } from './import/instruments.ts';

/** Where a stored instrument sits - the schema's `InstrumentLocationType`. */
export type InstrumentPlace = 'FLOOR' | 'LAB' | 'BASE' | 'UNKNOWN';

export type StoredInstrumentUsage = 'SCIENCE' | 'ENGINEERING' | 'UNAVAILABLE';

/**
 * How a stored instrument's whereabouts move over a site's recorded span.
 *
 * Declared per instrument rather than derived from a hash, so a given
 * instrument is the same example in every conversation about it.
 */
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

/**
 * The stored instruments, per site.
 *
 * `publishedName` is the name operations would print, which is what the browser
 * shows beside the enum label.
 */
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
  /** Never PORT, which is what keeps these off the schedule charts. */
  readonly place: InstrumentPlace;
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
  readonly place: InstrumentPlace;
  readonly usage: StoredInstrumentUsage;
  readonly span: Span;
  readonly note: string | null;
}

const iso = (millis: number): string => new Date(millis).toISOString();

/** An instant `fraction` through a span, rounded to the hour so the boundaries
 *  read as times someone could have written down. */
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

const stay = (span: Span, place: InstrumentPlace, usage: StoredInstrumentUsage, note: string | null = null): Stay => ({
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

/**
 * Every stored-instrument record, derived from the imported schedules.
 *
 * Anchored to each site's own recorded span, so these records cover exactly the
 * window the schedules do and no consumer sees a location for a night the
 * schedule knows nothing about.
 */
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

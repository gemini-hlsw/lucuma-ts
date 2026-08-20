/**
 * A semester's blocks -> what is true of each *night*, which is what a calendar
 * square holds.
 *
 * ## Why this exists and the other two views do not need it
 *
 * The chart and the grid are both run views: which instrument was on which port,
 * over what span. Neither can say anything about a night itself. A calendar's
 * unit is the night, so it needs the facts that vary night to night and that
 * nothing else in the product carries - the moon, the length of darkness,
 * whether the date is a holiday, and whether anything changed.
 *
 * The first calendar drew one bar per port per week, which was the chart wrapped
 * at Sunday: five identical bars repeated down every week of a semester that
 * contains fourteen facts. This module is the replacement for that idea.
 *
 * ## What is honest here and what is approximate
 *
 * - **Holidays are published data.** The sheet paints them and the importer now
 *   reads them; nothing is inferred.
 * - **Dark hours are astronomical night** - sun below -18 degrees - not moonless
 *   time. We have no moonrise or moonset, so "dark" here means the sun is down,
 *   and a full moon riding high still counts. That is a real limitation and the
 *   label says so rather than implying we know better.
 * - **Brightness is phase only, from a mean-synodic approximation** (see
 *   `moon.ts`, accurate to about half a day). It is a reading aid, not a
 *   scheduling input, which is why the published new and full dates are shown
 *   alongside it rather than replaced by it.
 */
import { type MoonPhase, moonPhaseAt } from './moon';
import { addDays } from './semester';
import type { SemesterCellRow } from './semesterCells';
import { observingNightInterval } from './siteTime';
import { nightSunTimes } from './sun';
import type { Instrument, MoonEvent, Site } from './types';

/**
 * How much the moon is likely to hurt.
 *
 * The usual three-way split used for planning. Phase only: a bright moon that
 * has set is still counted bright here, which is the limitation named above.
 */
export type LunarBrightness = 'DARK' | 'GREY' | 'BRIGHT';

const DARK_BELOW = 0.25;
const BRIGHT_ABOVE = 0.65;

export const brightnessOf = (fraction: number): LunarBrightness =>
  fraction < DARK_BELOW ? 'DARK' : fraction > BRIGHT_ABOVE ? 'BRIGHT' : 'GREY';

/** One row's state on one night, reduced to what a chip needs to draw. */
export interface ComplementChip {
  readonly rowLabel: string;
  readonly instrument: Instrument | null;
  /** Mirrors `CellKind`, so the chip and the grid cell agree by construction. */
  readonly kind: SemesterCellRow['cells'][number]['kind'];
  readonly label: string;
}

export interface CalendarNight {
  /** The evening the night begins, which is what the calendar square is headed by. */
  readonly eveningDate: string;
  /** The observing night, labelled by the morning it ends on. */
  readonly observingNight: string;
  readonly isWeekend: boolean;
  readonly isHoliday: boolean;
  readonly moon: MoonPhase;
  readonly brightness: LunarBrightness;
  /** New or full, when the sheet prints one against this date. */
  readonly publishedMoon: MoonEvent['phase'] | null;
  /** Hours of astronomical night; null when the sun never clears -18 degrees. */
  readonly darkHours: number | null;
  /** True when a telescope-wide closure covers the night. */
  readonly closed: boolean;
  /** The closure's printed reason, when there is one. */
  readonly closureReason: string | null;
  readonly complement: readonly ComplementChip[];
  /**
   * What is different about this night from the one before it, in the sheet's
   * own words. Empty on the great majority of nights, which is the point: a
   * semester of fourteen facts should mark fourteen nights, not every one.
   */
  readonly changes: readonly string[];
  /** False when no row holds anything at all - "not recorded", never "closed". */
  readonly anyRecorded: boolean;
}

const isWeekendDate = (isoDate: string): boolean => {
  const day = new Date(`${isoDate}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
};

const MS_PER_HOUR = 3_600_000;

/** Astronomical night in hours, or null when the sun never gets far enough down. */
export const darkHoursOf = (site: Site, observingNight: string): number | null => {
  const { duskAstronomical, dawnAstronomical } = nightSunTimes(site, observingNightInterval(site, observingNight));
  return duskAstronomical === null || dawnAstronomical === null
    ? null
    : (dawnAstronomical - duskAstronomical) / MS_PER_HOUR;
};

/** What a chip says, per row, for one night. */
const complementAt = (rows: readonly SemesterCellRow[], index: number): readonly ComplementChip[] =>
  rows.map((row) => {
    const cell = row.cells[index];
    return {
      rowLabel: row.label,
      instrument: cell?.instrument ?? null,
      kind: cell?.kind ?? 'EMPTY',
      label: cell?.label ?? '',
    };
  });

/**
 * How this night's complement differs from the night before.
 *
 * Phrased per row, because that is how a reader checks it: "Port 1: GHOST"
 * rather than "something changed". A closure boundary is stated once, not once
 * per port, or a shutdown would report five changes.
 */
const changesBetween = (
  previous: readonly ComplementChip[] | null,
  current: readonly ComplementChip[],
  wasClosed: boolean,
  isClosed: boolean,
): readonly string[] => {
  if (previous === null) {
    return [];
  }
  if (isClosed !== wasClosed) {
    return [isClosed ? 'Shutdown begins' : 'Shutdown ends'];
  }
  if (isClosed) {
    return [];
  }
  return current.flatMap((chip, index) => {
    const before = previous[index];
    if (before === undefined || (before.kind === chip.kind && before.instrument === chip.instrument)) {
      return [];
    }
    if (chip.kind === 'MOUNTED') {
      return [`${chip.rowLabel}: ${chip.label}`];
    }
    if (before.kind === 'MOUNTED') {
      return [`${chip.rowLabel}: ${before.label} off`];
    }
    return [];
  });
};

export interface BuildCalendarNightsOptions {
  readonly site: Site;
  /** Per-row, per-night cells - the same projection the grid draws. */
  readonly rows: readonly SemesterCellRow[];
  /** Observing nights, in order, matching the cell columns. */
  readonly observingNights: readonly string[];
  readonly holidays: readonly string[];
  readonly moonEvents: readonly MoonEvent[];
  readonly bands: readonly { readonly interval: { start: number; end: number }; readonly label: string }[];
}

/**
 * Builds one entry per night.
 *
 * Takes the grid's own cells rather than the raw records, for the reason the
 * whole semester page works that way: a night must not be able to say one thing
 * in the calendar and another in the grid.
 */
export const buildCalendarNights = ({
  site,
  rows,
  observingNights,
  holidays,
  moonEvents,
  bands,
}: BuildCalendarNightsOptions): readonly CalendarNight[] => {
  const holidaySet = new Set(holidays);
  const publishedMoon = new Map(moonEvents.map((event) => [event.date, event.phase]));

  let previous: readonly ComplementChip[] | null = null;
  let wasClosed = false;

  return observingNights.map((observingNight, index) => {
    const eveningDate = addDays(observingNight, -1);
    const interval = observingNightInterval(site, observingNight);
    // Sampled at the middle of the night rather than at either boundary, so the
    // phase belongs to the night the square names.
    const moon = moonPhaseAt((interval.start + interval.end) / 2);

    const band = bands.find((entry) => entry.interval.start < interval.end && interval.start < entry.interval.end);
    const closed = band !== undefined;
    const complement = complementAt(rows, index);
    const changes = changesBetween(previous, complement, wasClosed, closed);

    previous = complement;
    wasClosed = closed;

    return {
      eveningDate,
      observingNight,
      // Weekends stay computed: the calendar knows them with certainty, and the
      // sheet occasionally leaves one unpainted.
      isWeekend: isWeekendDate(eveningDate),
      isHoliday: holidaySet.has(eveningDate),
      moon,
      brightness: brightnessOf(moon.fraction),
      publishedMoon: publishedMoon.get(eveningDate) ?? null,
      darkHours: darkHoursOf(site, observingNight),
      closed,
      closureReason: band?.label ?? null,
      complement,
      changes,
      anyRecorded: closed || complement.some((chip) => chip.kind !== 'EMPTY'),
    };
  });
};

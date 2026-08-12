/**
 * A semester's records -> the month-by-month timeline the semester view draws.
 *
 * The work of turning records into rows is in `timeline.ts`, shared with the
 * week and night views. What is specific to a semester is the split into months
 * and why a night belongs to one:
 *
 * A column headed 7 is the night that *begins* on the 7th, which is the
 * observing night labelled by the 8th. The published sheet groups columns by the
 * evening date's month, so a night is filed under the month its evening falls
 * in - not the month it ends in. That is the only reason this module knows about
 * calendar months at all.
 */
import { addDays } from './semester';
import { observingNightInterval } from './siteTime';
import {
  collectBlocks,
  collectStateRows,
  legendFor,
  placeBands,
  placeBlocks,
  type TimelineBand,
  type TimelineLegend,
  type TimelineNight,
  type TimelineRow,
} from './timeline';
import type { Closure, Interval, ModeBlock, Mounting, Site, TooBlock } from './types';

export interface TimelineMonth {
  readonly year: number;
  /** 1-based calendar month of the evening dates it groups. */
  readonly month: number;
  readonly label: string;
  /** First night's start to last night's end. */
  readonly interval: Interval;
  readonly nights: readonly TimelineNight[];
  readonly rows: readonly TimelineRow[];
  readonly bands: readonly TimelineBand[];
}

export interface SemesterTimeline extends TimelineLegend {
  readonly months: readonly TimelineMonth[];
  /**
   * The same blocks placed over the whole semester rather than per month, so a
   * run that crosses a month boundary is one row rather than six.
   *
   * This is what the block table reads. A semester is sixteen or so facts, and
   * that is the number a reader who is not looking at the picture should be
   * given - not the nine hundred cells the drawing needs.
   */
  readonly rows: readonly TimelineRow[];
  readonly bands: readonly TimelineBand[];
}

const MONTH_LABELS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

/** Nights from `first` to `last`, both inclusive. */
const nightsFrom = (first: string, last: string): readonly string[] => {
  const nights: string[] = [];
  for (let night = first; night <= last; night = addDays(night, 1)) {
    nights.push(night);
  }
  return nights;
};

const isWeekendDate = (isoDate: string): boolean => {
  const day = new Date(`${isoDate}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
};

export interface BuildSemesterTimelineOptions {
  readonly site: Site;
  readonly rowLabels: readonly string[];
  readonly firstNight: string;
  readonly lastNight: string;
  readonly mountings: readonly Mounting[];
  readonly closures: readonly Closure[];
  /** ToO support and telescope mode records over the semester; the state rows
   * head every month only when some exist, like the night view. */
  readonly tooBlocks?: readonly TooBlock[];
  readonly modeBlocks?: readonly ModeBlock[];
}

/** Builds the month-by-month timeline the semester view draws. */
export const buildSemesterTimeline = ({
  site,
  rowLabels,
  firstNight,
  lastNight,
  mountings,
  closures,
  tooBlocks = [],
  modeBlocks = [],
}: BuildSemesterTimelineOptions): SemesterTimeline => {
  const nights: readonly TimelineNight[] = nightsFrom(firstNight, lastNight).map((observingNight) => {
    const eveningDate = addDays(observingNight, -1);
    return {
      observingNight,
      eveningDate,
      interval: observingNightInterval(site, observingNight),
      isWeekend: isWeekendDate(eveningDate),
      // A semester spans hundreds of nights and asks for its records in one
      // range query, which carries no per-night flag. The night view is where
      // "not recorded" is stated.
      dataAvailable: true,
    };
  });

  // The state rows join once, here, so every month and the whole-semester rows
  // (the block table's reading) carry the same head.
  const collected = [
    ...collectStateRows(closures, tooBlocks, modeBlocks),
    ...collectBlocks({ rowLabels, mountings, closures }),
  ];

  // Group by the evening date's month, so a column sits under the month the
  // sheet prints it under.
  const byMonth = new Map<string, TimelineNight[]>();
  for (const night of nights) {
    const key = night.eveningDate.slice(0, 7);
    byMonth.set(key, [...(byMonth.get(key) ?? []), night]);
  }

  const months = [...byMonth.entries()].map(([key, monthNights]) => {
    const [year = '0', month = '1'] = key.split('-');
    const bounds: Interval = {
      start: monthNights[0]?.interval.start ?? 0,
      end: monthNights.at(-1)?.interval.end ?? 0,
    };

    return {
      year: Number(year),
      month: Number(month),
      label: `${MONTH_LABELS[Number(month) - 1] ?? key} ${year}`,
      interval: bounds,
      nights: monthNights,
      rows: placeBlocks(collected, bounds),
      bands: placeBands(closures, bounds),
    };
  });

  // Keyed off the whole semester rather than any one month, so the legend does
  // not change as you read down the page.
  const wholeSemester: Interval = {
    start: nights[0]?.interval.start ?? 0,
    end: nights.at(-1)?.interval.end ?? 0,
  };
  const rows = placeBlocks(collected, wholeSemester);
  const bands = placeBands(closures, wholeSemester);

  return { months, rows, bands, ...legendFor(rows, bands) };
};

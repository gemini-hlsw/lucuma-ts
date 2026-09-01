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
  /** Placed over the whole semester, so a run crossing a month boundary is one row rather than six. */
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
  readonly firstNight: string;
  readonly lastNight: string;
  readonly mountings: readonly Mounting[];
  readonly closures: readonly Closure[];
  /** The state rows head every month only when some records exist, like the night view. */
  readonly tooBlocks?: readonly TooBlock[];
  readonly modeBlocks?: readonly ModeBlock[];
}

export const buildSemesterTimeline = ({
  site,
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
      // One range query carries no per-night flag; the night view is where "not recorded" is stated.
      dataAvailable: true,
    };
  });

  // The state rows join once, so every month and the block table's rows carry the same head.
  const collected = [...collectStateRows(closures, tooBlocks, modeBlocks), ...collectBlocks({ mountings, closures })];

  // Group by the evening date's month, so a column sits under the month the sheet prints it under.
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

  // Keyed off the whole semester, so the legend does not change as you read down the page.
  const wholeSemester: Interval = {
    start: nights[0]?.interval.start ?? 0,
    end: nights.at(-1)?.interval.end ?? 0,
  };
  const rows = placeBlocks(collected, wholeSemester);
  const bands = placeBands(closures, wholeSemester);

  return { months, rows, bands, ...legendFor(rows, bands) };
};

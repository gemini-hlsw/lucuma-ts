import { addDays } from './semester';
import {
  collectSchedule,
  placeWindow,
  type TimelineBand,
  type TimelineNight,
  timelineNights,
  type TimelineRow,
  type WindowProjection,
} from './timeline';
import type { Interval, Schedule, Site } from './types';

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

export interface SemesterTimeline extends WindowProjection {
  readonly months: readonly TimelineMonth[];
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

export interface BuildSemesterTimelineOptions {
  readonly site: Site;
  readonly firstNight: string;
  readonly lastNight: string;
  readonly schedule: Schedule;
}

export const buildSemesterTimeline = ({
  site,
  firstNight,
  lastNight,
  schedule,
}: BuildSemesterTimelineOptions): SemesterTimeline => {
  // One range query carries no per-night flag; the night view is where "not recorded" is stated.
  const nights = timelineNights(site, nightsFrom(firstNight, lastNight));
  const collected = collectSchedule(schedule);

  // Group by the evening date's month, so a column sits under the month the sheet prints it under.
  const byMonth = new Map<string, TimelineNight[]>();
  for (const night of nights) {
    const key = night.eveningDate.slice(0, 7);
    byMonth.set(key, [...(byMonth.get(key) ?? []), night]);
  }

  const months = [...byMonth.entries()].map(([key, monthNights]) => {
    const [year = '0', month = '1'] = key.split('-');
    const { interval, rows, bands } = placeWindow(collected, monthNights);

    return {
      year: Number(year),
      month: Number(month),
      label: `${MONTH_LABELS[Number(month) - 1] ?? key} ${year}`,
      interval,
      nights: monthNights,
      rows,
      bands,
    };
  });

  // Projected over the whole semester, so a run crossing a month boundary is one row rather than
  // six and the legend does not change as you read down the page.
  return { ...placeWindow(collected, nights), months };
};

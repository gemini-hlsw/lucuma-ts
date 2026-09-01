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

/** Nights in a week window. Seven, and the rest of the view assumes it. */
export const WEEK_NIGHTS = 7;

export interface WeekTimeline extends TimelineLegend {
  readonly nights: readonly TimelineNight[];
  /** First night's start to last night's end; they abut, so it is continuous. */
  readonly interval: Interval;
  readonly rows: readonly TimelineRow[];
  readonly bands: readonly TimelineBand[];
}

export interface BuildWeekTimelineOptions {
  readonly site: Site;
  /** The first of the seven nights, labelled by the date it ends on. */
  readonly firstNight: string;
  readonly mountings: readonly Mounting[];
  readonly closures: readonly Closure[];
  /** The state rows head the chart only when some records exist, like the night view. */
  readonly tooBlocks?: readonly TooBlock[];
  readonly modeBlocks?: readonly ModeBlock[];
  /** Undefined while in flight, which is not empty: an empty set would grey out the whole week. */
  readonly nightsWithData: ReadonlySet<string> | undefined;
}

/** The seven observing-night labels a week window covers. */
export const weekNightLabels = (firstNight: string): readonly string[] =>
  Array.from({ length: WEEK_NIGHTS }, (_, index) => addDays(firstNight, index));

const isWeekendDate = (isoDate: string): boolean => {
  const day = new Date(`${isoDate}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
};

export const buildWeekTimeline = ({
  site,
  firstNight,
  mountings,
  closures,
  tooBlocks = [],
  modeBlocks = [],
  nightsWithData,
}: BuildWeekTimelineOptions): WeekTimeline => {
  const nights: readonly TimelineNight[] = weekNightLabels(firstNight).map((observingNight) => {
    const eveningDate = addDays(observingNight, -1);
    return {
      observingNight,
      eveningDate,
      interval: observingNightInterval(site, observingNight),
      isWeekend: isWeekendDate(eveningDate),
      dataAvailable: nightsWithData === undefined || nightsWithData.has(observingNight),
    };
  });

  const interval: Interval = {
    start: nights[0]?.interval.start ?? 0,
    end: nights.at(-1)?.interval.end ?? 0,
  };
  const rows = placeBlocks(
    [...collectStateRows(closures, tooBlocks, modeBlocks), ...collectBlocks({ mountings, closures })],
    interval,
  );
  const bands = placeBands(closures, interval);

  return { nights, interval, rows, bands, ...legendFor(rows, bands) };
};

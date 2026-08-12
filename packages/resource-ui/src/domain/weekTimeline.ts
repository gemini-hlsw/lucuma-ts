/**
 * A week of nights -> the rows the week view draws.
 *
 * The week sits between the semester and the night: wide enough to plan
 * against, narrow enough that each night gets real width, so a run that changes
 * partway through one is still drawn where it changes rather than rounded.
 *
 * Seven observing nights **starting at the night asked for**, not a calendar
 * week. An observing night is labelled by the morning it ends on, so a
 * Monday-to-Sunday week would have to pick which of those two dates it meant and
 * would be wrong for half its readers either way. "The next seven nights from
 * here" needs no such rule and is what stepping through a semester actually
 * looks like.
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
  /** ToO support and telescope mode records reaching the week; the state rows
   * head the chart only when some do, like the night view. */
  readonly tooBlocks?: readonly TooBlock[];
  readonly modeBlocks?: readonly ModeBlock[];
  /**
   * Which nights Resource holds anything for, from `telescopeNights`.
   *
   * Undefined while the answer is in flight, which is not the same as empty: an
   * empty set would grey out the whole week for as long as the query takes.
   */
  readonly nightsWithData: ReadonlySet<string> | undefined;
}

/** The seven observing-night labels a week window covers. */
export const weekNightLabels = (firstNight: string): readonly string[] =>
  Array.from({ length: WEEK_NIGHTS }, (_, index) => addDays(firstNight, index));

const isWeekendDate = (isoDate: string): boolean => {
  const day = new Date(`${isoDate}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
};

/** Builds the seven-night timeline the week view draws. */
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

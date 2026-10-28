import { addDays } from './semester';
import {
  collectBlocks,
  collectStateRows,
  legendFor,
  placeBands,
  placeBlocks,
  spanOfNights,
  type TimelineBand,
  type TimelineLegend,
  type TimelineNight,
  timelineNights,
  type TimelineRow,
} from './timeline';
import type {
  InstrumentAvailabilityBlock,
  Interval,
  Site,
  TelescopeAvailabilityBlock,
  TelescopeModeBlock,
  TooSupportBlock,
} from './types';

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
  readonly instrumentAvailability: readonly InstrumentAvailabilityBlock[];
  readonly telescopeAvailability: readonly TelescopeAvailabilityBlock[];
  /** The state rows head the chart only when some records exist, like the night view. */
  readonly tooSupport?: readonly TooSupportBlock[];
  readonly telescopeMode?: readonly TelescopeModeBlock[];
  /** Undefined while in flight, which is not empty: an empty set would grey out the whole week. */
  readonly nightsWithData: ReadonlySet<string> | undefined;
}

export const weekNightLabels = (firstNight: string): readonly string[] =>
  Array.from({ length: WEEK_NIGHTS }, (_, index) => addDays(firstNight, index));

export const buildWeekTimeline = ({
  site,
  firstNight,
  instrumentAvailability,
  telescopeAvailability,
  tooSupport = [],
  telescopeMode = [],
  nightsWithData,
}: BuildWeekTimelineOptions): WeekTimeline => {
  const nights = timelineNights(
    site,
    weekNightLabels(firstNight),
    (observingNight) => nightsWithData === undefined || nightsWithData.has(observingNight),
  );
  const interval = spanOfNights(nights);
  const rows = placeBlocks(
    [
      ...collectStateRows(telescopeAvailability, tooSupport, telescopeMode),
      ...collectBlocks({ instrumentAvailability, telescopeAvailability }),
    ],
    interval,
  );
  const bands = placeBands(telescopeAvailability, interval);

  return { nights, interval, rows, bands, ...legendFor(rows, bands) };
};

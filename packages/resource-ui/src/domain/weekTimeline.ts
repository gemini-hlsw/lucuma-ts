import { addDays } from './semester';
import { projectWindow, type TimelineNight, timelineNights, type WindowProjection } from './timeline';
import type { Schedule, Site } from './types';

/** Nights in a week window. Seven, and the rest of the view assumes it. */
export const WEEK_NIGHTS = 7;

export interface WeekTimeline extends WindowProjection {
  readonly nights: readonly TimelineNight[];
}

export interface BuildWeekTimelineOptions {
  readonly site: Site;
  /** The first of the seven nights, labelled by the date it ends on. */
  readonly firstNight: string;
  readonly schedule: Schedule;
  /** Undefined while in flight, which is not empty: an empty set would grey out the whole week. */
  readonly nightsWithData: ReadonlySet<string> | undefined;
}

export const weekNightLabels = (firstNight: string): readonly string[] =>
  Array.from({ length: WEEK_NIGHTS }, (_, index) => addDays(firstNight, index));

export const buildWeekTimeline = ({
  site,
  firstNight,
  schedule,
  nightsWithData,
}: BuildWeekTimelineOptions): WeekTimeline => {
  const nights = timelineNights(
    site,
    weekNightLabels(firstNight),
    (observingNight) => nightsWithData === undefined || nightsWithData.has(observingNight),
  );
  const window = projectWindow({ nights, schedule });

  return { ...window, nights };
};

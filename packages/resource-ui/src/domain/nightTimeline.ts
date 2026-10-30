import { projectWindow, timelineNights, type TimelineRow, type WindowProjection } from './timeline';
import type { Interval, Schedule, Site } from './types';

export interface NightTimeline extends WindowProjection {
  readonly observingNight: string;
  /** Empty while the sheets stay whole-night granular; populated the moment a partial night lands. */
  readonly transitions: readonly number[];
}

export interface BuildNightTimelineOptions {
  readonly site: Site;
  readonly observingNight: string;
  readonly schedule: Schedule;
}

/** Instants strictly inside the night where a block starts or ends. */
const transitionsIn = (rows: readonly TimelineRow[], night: Interval): readonly number[] => {
  const inside = new Set<number>();
  for (const row of rows) {
    for (const block of row.blocks) {
      for (const edge of [block.interval.start, block.interval.end]) {
        if (edge > night.start && edge < night.end) {
          inside.add(edge);
        }
      }
    }
  }
  return [...inside].sort((a, b) => a - b);
};

export const buildNightTimeline = ({ site, observingNight, schedule }: BuildNightTimelineOptions): NightTimeline => {
  const window = projectWindow({ nights: timelineNights(site, [observingNight]), schedule });

  return { ...window, observingNight, transitions: transitionsIn(window.rows, window.interval) };
};

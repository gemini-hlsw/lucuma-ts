import { observingNightInterval } from './siteTime';
import { type NightSunTimes, nightSunTimes } from './sun';
import {
  collectBlocks,
  collectStateRows,
  legendFor,
  placeBands,
  placeBlocks,
  type TimelineBand,
  type TimelineLegend,
  type TimelineRow,
} from './timeline';
import type { Closure, Interval, ModeBlock, Mounting, Site, SubsystemBlock, TooBlock } from './types';

export interface NightTimeline extends TimelineLegend {
  readonly observingNight: string;
  /** 14:00 local the previous day to 14:00 local on the labelling day. */
  readonly interval: Interval;
  readonly rows: readonly TimelineRow[];
  readonly bands: readonly TimelineBand[];
  readonly sun: NightSunTimes;
  /** Empty while the sheets stay whole-night granular; populated the moment a partial night lands. */
  readonly transitions: readonly number[];
}

export interface BuildNightTimelineOptions {
  readonly site: Site;
  readonly observingNight: string;
  readonly mountings: readonly Mounting[];
  readonly closures: readonly Closure[];
  /** ToO support records reaching the night. The row appears only when some do. */
  readonly tooBlocks?: readonly TooBlock[];
  /** Telescope mode records reaching the night. The row appears only when some do. */
  readonly modeBlocks?: readonly ModeBlock[];
  /** Subsystem records reaching the night. A row appears per subsystem with any. */
  readonly subsystemBlocks?: readonly SubsystemBlock[];
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

export const buildNightTimeline = ({
  site,
  observingNight,
  mountings,
  closures,
  tooBlocks = [],
  modeBlocks = [],
  subsystemBlocks = [],
}: BuildNightTimelineOptions): NightTimeline => {
  const interval = observingNightInterval(site, observingNight);
  const rows = placeBlocks(
    [...collectStateRows(closures, tooBlocks, modeBlocks, subsystemBlocks), ...collectBlocks({ mountings, closures })],
    interval,
  );
  const bands = placeBands(closures, interval);

  return {
    observingNight,
    interval,
    rows,
    bands,
    sun: nightSunTimes(site, interval),
    transitions: transitionsIn(rows, interval),
    ...legendFor(rows, bands),
  };
};

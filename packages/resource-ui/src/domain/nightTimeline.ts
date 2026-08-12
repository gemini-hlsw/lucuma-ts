/**
 * One night's records -> the rows the night view draws.
 *
 * The night is the smallest window and the only one where the model's central
 * claim is visible. A block that changes partway through the night is drawn
 * where it changes, because nothing here ever rounded it to a whole night in the
 * first place (PLAN.md §3.1). The semester and week can only say "mixed"; this
 * view says when.
 *
 * It is also where "not recorded" is stated out loud. Every other view infers an
 * empty row, which is honest but silent; here the API's `dataAvailable` answers
 * directly, so an un-entered night reads as un-entered rather than as a
 * telescope with nothing on it.
 */
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
import type { Closure, Interval, ModeBlock, Mounting, Site, TooBlock } from './types';

export interface NightTimeline extends TimelineLegend {
  readonly observingNight: string;
  /** 14:00 local the previous day to 14:00 local on the labelling day. */
  readonly interval: Interval;
  readonly rows: readonly TimelineRow[];
  readonly bands: readonly TimelineBand[];
  readonly sun: NightSunTimes;
  /**
   * Every instant inside the night where any row changes, in order.
   *
   * Empty when the night is uniform, which every published night currently is -
   * the sheets are whole-night granular. It is populated the moment a partial
   * night is recorded, and the view says so rather than leaving the reader to
   * spot two abutting bars.
   */
  readonly transitions: readonly number[];
}

export interface BuildNightTimelineOptions {
  readonly site: Site;
  readonly observingNight: string;
  readonly rowLabels: readonly string[];
  readonly mountings: readonly Mounting[];
  readonly closures: readonly Closure[];
  /** ToO support records reaching the night. The row appears only when some do. */
  readonly tooBlocks?: readonly TooBlock[];
  /** Telescope mode records reaching the night. The row appears only when some do. */
  readonly modeBlocks?: readonly ModeBlock[];
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

/** Builds the single-night timeline the night view draws. */
export const buildNightTimeline = ({
  site,
  observingNight,
  rowLabels,
  mountings,
  closures,
  tooBlocks = [],
  modeBlocks = [],
}: BuildNightTimelineOptions): NightTimeline => {
  const interval = observingNightInterval(site, observingNight);
  const rows = placeBlocks(
    [...collectStateRows(closures, tooBlocks, modeBlocks), ...collectBlocks({ rowLabels, mountings, closures })],
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

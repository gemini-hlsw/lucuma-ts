import type { Options, XAxisPlotLinesOptions } from 'highcharts';

import type { NightTimeline } from '@/domain/nightTimeline';
import { displayTimeZone, type TimeDisplay, zoneFormatters } from '@/domain/siteTime';
import type { TimelineBlock } from '@/domain/timeline';
import type { Site } from '@/domain/types';
import {
  type BlockDescriber,
  buildTimelineChart,
  closureBandPlotBand,
  MUTED_TICK,
  readerPx,
  WEEK_LINE_Z,
} from '@/features/timeline/timelineOptions';

export const ROW_HEIGHT_REM = 2.125;
const BOTTOM_MARGIN_REM = 2.125;
const HOUR_MS = 3_600_000;

const clockFormat = zoneFormatters('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });

export const clockLabel = (epochMillis: number, site: Site, display: TimeDisplay): string =>
  clockFormat(displayTimeZone(site, display)).format(new Date(epochMillis));

/** Whole minutes: a night's schedule is not precise enough to need seconds. */
export const durationLabel = (millis: number): string => {
  const minutes = Math.round(millis / 60_000);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) {
    return `${rest} m`;
  }
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} m`;
};

/** Clock times, not dates, and against the night rather than the block's whole run. */
export const nightDescriber = (site: Site, night: NightTimeline['interval'], display: TimeDisplay): BlockDescriber => ({
  range: (block: TimelineBlock) =>
    block.interval.start <= night.start && block.interval.end >= night.end
      ? 'all night'
      : `${clockLabel(block.interval.start, site, display)} to ${clockLabel(block.interval.end, site, display)}`,
  length: (block: TimelineBlock) => durationLabel(block.interval.end - block.interval.start),
});

/** A partial night is two abutting bars, which is easy to miss; the line names the seam. */
export const buildTransitionLines = (transitions: readonly number[]): XAxisPlotLinesOptions[] =>
  transitions.map((value) => ({
    value,
    color: 'var(--schedule-week-line)',
    width: 1,
    zIndex: WEEK_LINE_Z,
    className: 'night-transition',
  }));

interface NightChartModel {
  readonly night: NightTimeline;
  readonly site: Site;
  readonly timeDisplay: TimeDisplay;
}

export const buildNightChartOptions = ({ night, site, timeDisplay }: NightChartModel): Options =>
  buildTimelineChart({
    rows: night.rows,
    site,
    timeDisplay,
    nowLabel: 'now',
    describe: nightDescriber(site, night.interval, timeDisplay),
    rowHeightRem: ROW_HEIGHT_REM,
    bottomMarginRem: BOTTOM_MARGIN_REM,
    seriesName: `Night of ${night.observingNight}`,
    xAxis: {
      type: 'datetime',
      min: night.interval.start,
      max: night.interval.end,
      startOnTick: false,
      endOnTick: false,
      // Two-hourly, which lands on even hours from the 14:00 boundary and gives twelve labels.
      tickInterval: 2 * HOUR_MS,
      tickLength: 4,
      tickColor: 'var(--timeline-grid)',
      gridLineWidth: 1,
      gridLineColor: 'var(--schedule-night-line)',
      lineColor: 'var(--timeline-grid)',
      labels: {
        // Highcharts formats in `time.timezone`, which the shared frame sets from the masthead.
        format: '{value:%H:%M}',
        style: MUTED_TICK,
        y: readerPx(1.125),
      },
      plotBands: [...night.bands.map((band) => closureBandPlotBand(band, 0.875))],
      plotLines: buildTransitionLines(night.transitions),
    },
  });

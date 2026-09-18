import type { Options, XAxisPlotBandsOptions, XAxisPlotLinesOptions } from 'highcharts';

import type { NightTimeline } from '@/domain/nightTimeline';
import { displayTimeZone, type TimeDisplay, zoneFormatters } from '@/domain/siteTime';
import type { NightSunTimes } from '@/domain/sun';
import type { TimelineBlock } from '@/domain/timeline';
import type { Site } from '@/domain/types';
import {
  type BlockDescriber,
  buildTimelineChart,
  closureBandPlotBand,
  MARKER_LINE_Z,
  MUTED_LABEL,
  MUTED_TICK,
  NOW_LABEL,
  readerPx,
  WASH_Z,
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

/** Drawn over the bars: a bar spans the whole night, so a band behind it would be invisible. */
export const buildSunBands = (interval: NightTimeline['interval'], sun: NightSunTimes): XAxisPlotBandsOptions[] => {
  const bands: XAxisPlotBandsOptions[] = [];
  const wash = (from: number, to: number, color: string, className: string): void => {
    if (to > from) {
      bands.push({ from, to, color, className, zIndex: WASH_Z });
    }
  };
  if (sun.sunset !== null) {
    wash(interval.start, sun.sunset, 'var(--night-daylight-wash)', 'night-daylight');
  }
  if (sun.sunset !== null && sun.duskAstronomical !== null) {
    wash(sun.sunset, sun.duskAstronomical, 'var(--night-twilight-wash)', 'night-twilight');
  }
  if (sun.dawnAstronomical !== null && sun.sunrise !== null) {
    wash(sun.dawnAstronomical, sun.sunrise, 'var(--night-twilight-wash)', 'night-twilight');
  }
  if (sun.sunrise !== null) {
    wash(sun.sunrise, interval.end, 'var(--night-daylight-wash)', 'night-daylight');
  }
  return bands;
};

const sunLine = (value: number, text: string): XAxisPlotLinesOptions => ({
  value,
  color: 'var(--timeline-axis)',
  width: 1,
  dashStyle: 'Dash',
  zIndex: MARKER_LINE_Z,
  className: 'night-sun-line',
  label: {
    text,
    // Highcharts rotates a plot-line label 90 degrees by default, which turns "sunset" on its side.
    rotation: 0,
    align: 'left',
    x: 4,
    y: readerPx(0.75),
    style: MUTED_LABEL,
  },
});

/** Sunset and sunrise as marked lines; the twilight edges are the band edges. */
const buildSunLines = (sun: NightSunTimes): XAxisPlotLinesOptions[] => [
  ...(sun.sunset === null ? [] : [sunLine(sun.sunset, 'sunset')]),
  ...(sun.sunrise === null ? [] : [sunLine(sun.sunrise, 'sunrise')]),
];

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
  readonly now: number | null;
  readonly timeDisplay: TimeDisplay;
}

export const buildNightChartOptions = ({ night, site, now, timeDisplay }: NightChartModel): Options => {
  const showsNow = now !== null && now >= night.interval.start && now < night.interval.end;

  return buildTimelineChart({
    rows: night.rows,
    site,
    timeDisplay,
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
      plotBands: [
        ...buildSunBands(night.interval, night.sun),
        ...night.bands.map((band) => closureBandPlotBand(band, 0.875)),
      ],
      plotLines: [
        ...buildTransitionLines(night.transitions),
        ...buildSunLines(night.sun),
        ...(showsNow
          ? [
              {
                value: now,
                color: 'var(--schedule-today)',
                width: 2,
                zIndex: MARKER_LINE_Z,
                className: 'schedule-today',
                label: {
                  text: 'now',
                  style: NOW_LABEL,
                },
              },
            ]
          : []),
      ],
    },
  });
};

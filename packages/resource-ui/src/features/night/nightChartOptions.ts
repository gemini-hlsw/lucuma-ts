/**
 * The axis for one observing night. The rest of the chart is
 * `features/timeline/timelineOptions.ts`, shared with the semester and week.
 *
 * A night runs 14:00 local to 14:00 local, and most of that is daylight - the
 * telescope can only work between dusk and dawn. Drawn flat, half the width
 * would be time nobody can observe in, so the sun shades it: daylight is washed
 * out, twilight is dimmer, and the dark hours are the plain background. That is
 * the whole reason this axis differs from the others.
 */
import type { Options, XAxisPlotBandsOptions, XAxisPlotLinesOptions } from 'highcharts';

import type { NightTimeline } from '@/domain/nightTimeline';
import { displayTimeZone, type TimeDisplay, zoneFormatters } from '@/domain/siteTime';
import type { NightSunTimes } from '@/domain/sun';
import type { TimelineBlock } from '@/domain/timeline';
import type { Site } from '@/domain/types';
import { type BlockDescriber, buildTimelineChart } from '@/features/timeline/timelineOptions';

export const ROW_HEIGHT = 34;
const BOTTOM_MARGIN = 34;
const LABEL_GUTTER = 104;
const HOUR_MS = 3_600_000;

const clockFormat = zoneFormatters('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });

/** Clock time as "18:00", in the masthead's chosen clock - site local or UT. */
export const clockLabel = (epochMillis: number, site: Site, display: TimeDisplay): string =>
  clockFormat(displayTimeZone(site, display)).format(new Date(epochMillis));

/** "12 h 15 m", or "45 m" under the hour. Whole minutes; a night is not precise. */
export const durationLabel = (millis: number): string => {
  const minutes = Math.round(millis / 60_000);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) {
    return `${rest} m`;
  }
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} m`;
};

/**
 * A night describes a block in clock times, not dates - the units you read a
 * night in - and against the night rather than the block's whole run.
 *
 * `all night` rather than "24 h": the point of the phrase is that nothing
 * changes, and a night is 23 or 25 hours either side of a DST change anyway.
 */
export const nightDescriber = (site: Site, night: NightTimeline['interval'], display: TimeDisplay): BlockDescriber => ({
  range: (block: TimelineBlock) =>
    block.interval.start <= night.start && block.interval.end >= night.end
      ? 'all night'
      : `${clockLabel(block.interval.start, site, display)} to ${clockLabel(block.interval.end, site, display)}`,
  length: (block: TimelineBlock) => durationLabel(block.interval.end - block.interval.start),
});

/**
 * Daylight and twilight, so "when can science actually happen" is legible.
 *
 * Drawn *over* the bars, not behind them. An instrument mounted at noon is still
 * mounted, so its bar spans the whole night - which means a band behind it is
 * invisible, which is exactly how the first version of this chart came out. A
 * wash on top dims the hours nobody can observe in and leaves the dark hours at
 * full strength, which is the reading that matters.
 *
 * Built from the night's edges inward, so a missing crossing (a latitude where
 * the sun does not set, which the observatory does not have) simply leaves that
 * band out rather than shading the whole night.
 */
export const buildSunBands = (interval: NightTimeline['interval'], sun: NightSunTimes): XAxisPlotBandsOptions[] => {
  const bands: XAxisPlotBandsOptions[] = [];
  const wash = (from: number, to: number, color: string, className: string): void => {
    if (to > from) {
      bands.push({ from, to, color, className, zIndex: 5 });
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
  zIndex: 6,
  className: 'night-sun-line',
  label: {
    text,
    // Highcharts rotates a plot-line label 90 degrees by default, which put
    // "sunset" on its side in a 2px column and made it unreadable.
    rotation: 0,
    align: 'left',
    x: 4,
    y: 12,
    style: { color: 'var(--timeline-muted-text)', fontSize: '0.65rem' },
  },
});

/** Sunset and sunrise as marked lines; the twilight edges are the band edges. */
export const buildSunLines = (sun: NightSunTimes): XAxisPlotLinesOptions[] => [
  ...(sun.sunset === null ? [] : [sunLine(sun.sunset, 'sunset')]),
  ...(sun.sunrise === null ? [] : [sunLine(sun.sunrise, 'sunrise')]),
];

/**
 * Every instant where a row changes, marked.
 *
 * A partial night is two abutting bars, which is easy to miss; the line says a
 * change happened here without the reader having to spot a seam.
 */
export const buildTransitionLines = (transitions: readonly number[]): XAxisPlotLinesOptions[] =>
  transitions.map((value) => ({
    value,
    color: 'var(--schedule-week-line)',
    width: 1,
    zIndex: 2,
    className: 'night-transition',
  }));

export interface NightChartModel {
  readonly night: NightTimeline;
  readonly site: Site;
  /** Epoch millis of "now", drawn as a marker when it falls inside the night. */
  readonly now: number | null;
  /** The masthead's clock choice - the axis and tooltips render in it. */
  readonly timeDisplay: TimeDisplay;
}

/** Builds the Highcharts options for the night timeline. */
export const buildNightChartOptions = ({ night, site, now, timeDisplay }: NightChartModel): Options => {
  const showsNow = now !== null && now >= night.interval.start && now < night.interval.end;

  return buildTimelineChart({
    rows: night.rows,
    site,
    timeDisplay,
    describe: nightDescriber(site, night.interval, timeDisplay),
    rowHeight: ROW_HEIGHT,
    labelGutter: LABEL_GUTTER,
    bottomMargin: BOTTOM_MARGIN,
    seriesName: `Night of ${night.observingNight}`,
    xAxis: {
      type: 'datetime',
      min: night.interval.start,
      max: night.interval.end,
      startOnTick: false,
      endOnTick: false,
      // Two-hourly, which lands on even hours from the 14:00 boundary and gives
      // twelve labels across a night - enough to read a time off the chart.
      tickInterval: 2 * HOUR_MS,
      tickLength: 4,
      tickColor: 'var(--timeline-grid)',
      gridLineWidth: 1,
      gridLineColor: 'var(--schedule-night-line)',
      lineColor: 'var(--timeline-grid)',
      labels: {
        // Highcharts formats in `time.timezone`, which the shared frame sets
        // from the masthead's clock choice - the site's clock or UT, never the
        // reader's.
        format: '{value:%H:%M}',
        style: { color: 'var(--timeline-muted-text)', fontSize: '0.68rem' },
        y: 18,
      },
      plotBands: [
        ...buildSunBands(night.interval, night.sun),
        ...night.bands.map((band) => ({
          from: band.interval.start,
          to: band.interval.end,
          color: 'var(--schedule-band)',
          borderColor: 'var(--schedule-band-edge)',
          borderWidth: 1,
          zIndex: 4,
          className: 'schedule-closure-band',
          label: {
            text: band.label,
            style: { color: 'var(--timeline-text)', fontSize: '0.68rem', fontWeight: '600' },
            rotation: 0,
            align: 'center' as const,
            verticalAlign: 'top' as const,
            y: 14,
          },
        })),
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
                zIndex: 6,
                className: 'schedule-today',
                label: {
                  text: 'now',
                  style: { color: 'var(--schedule-today)', fontSize: '0.65rem', fontWeight: '700' },
                },
              },
            ]
          : []),
      ],
    },
  });
};

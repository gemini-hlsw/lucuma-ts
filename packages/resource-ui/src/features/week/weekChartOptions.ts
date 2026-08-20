/**
 * The axis for a week of nights. The rest of the chart is
 * `features/timeline/timelineOptions.ts`, shared with the semester and night.
 *
 * A week is seven nights on one continuous axis - observing nights abut exactly,
 * 14:00 to 14:00, so there is no gap to draw. Each night gets about a seventh of
 * the width, which is enough room for the sun to shade the hours nobody can
 * observe in. That is the week's whole reason for existing between the other
 * two: the semester cannot show a night's shape, and the night view only shows
 * one of them.
 */
import type { Options, XAxisPlotBandsOptions, XAxisPlotLinesOptions } from 'highcharts';

import { midpoint } from '@/domain/interval';
import { SITE_TIME_ZONES, zoneFormatters } from '@/domain/siteTime';
import { nightSunTimes } from '@/domain/sun';
import type { TimelineNight } from '@/domain/timeline';
import type { Site } from '@/domain/types';
import type { WeekTimeline } from '@/domain/weekTimeline';
import {
  buildTimelineChart,
  eveningDescriber,
  LABELLED_BAND_Z,
  MARKER_LINE_Z,
} from '@/features/timeline/timelineOptions';

const ROW_HEIGHT = 30;
const BOTTOM_MARGIN = 32;
const LABEL_GUTTER = 100;

const headingFormat = zoneFormatters('en-GB', { weekday: 'short', day: 'numeric' });

/** A night's column heading, as "Tue 17" - the evening it begins on. */
export const nightLabel = (night: TimelineNight, site: Site): string =>
  headingFormat(SITE_TIME_ZONES[site]).format(new Date(`${night.eveningDate}T12:00:00Z`));

/** Labels sit at each night's midpoint; the boundaries are the plot lines. */
export const weekTickPositions = (week: WeekTimeline): number[] => week.nights.map((night) => midpoint(night.interval));

/**
 * Weekend shading, the sun's wash over each night, un-entered nights, and the
 * telescope-wide closures.
 *
 * The sun wash goes over the bars for the same reason it does on the night view:
 * an instrument mounted at noon is still mounted, so a band behind its bar would
 * never be seen.
 */
export const buildWeekBands = (week: WeekTimeline, site: Site): XAxisPlotBandsOptions[] => [
  ...week.nights
    .filter((night) => night.isWeekend)
    .map((night) => ({
      from: night.interval.start,
      to: night.interval.end,
      color: 'var(--schedule-weekend)',
      className: 'schedule-weekend',
    })),
  ...week.nights.flatMap((night) => {
    const sun = nightSunTimes(site, night.interval);
    const wash = (from: number | null, to: number | null, color: string, className: string) =>
      from === null || to === null || to <= from ? [] : [{ from, to, color, className, zIndex: 5 }];
    return [
      ...wash(night.interval.start, sun.sunset, 'var(--night-daylight-wash)', 'night-daylight'),
      ...wash(sun.sunset, sun.duskAstronomical, 'var(--night-twilight-wash)', 'night-twilight'),
      ...wash(sun.dawnAstronomical, sun.sunrise, 'var(--night-twilight-wash)', 'night-twilight'),
      ...wash(sun.sunrise, night.interval.end, 'var(--night-daylight-wash)', 'night-daylight'),
    ];
  }),
  // I4 made visible: a night Resource holds nothing for is hatched, so it reads
  // as un-entered rather than as a telescope with nothing on it.
  ...week.nights
    .filter((night) => !night.dataAvailable)
    .map((night) => ({
      from: night.interval.start,
      to: night.interval.end,
      color: 'var(--schedule-no-data)',
      className: 'week-no-data',
      zIndex: LABELLED_BAND_Z,
      label: {
        text: 'not recorded',
        style: { color: 'var(--timeline-muted-text)', fontSize: '0.62rem' },
        rotation: 0,
        align: 'center' as const,
        verticalAlign: 'top' as const,
        y: 12,
      },
    })),
  ...week.bands.map((band) => ({
    from: band.interval.start,
    to: band.interval.end,
    color: 'var(--schedule-band)',
    borderColor: 'var(--schedule-band-edge)',
    borderWidth: 1,
    zIndex: LABELLED_BAND_Z,
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
];

/** One line per night boundary, so the seven nights are countable. */
export const buildWeekLines = (week: WeekTimeline): XAxisPlotLinesOptions[] =>
  week.nights.map((night) => ({
    value: night.interval.start,
    color: 'var(--schedule-week-line)',
    width: 1,
    zIndex: 2,
    className: 'week-night-line',
  }));

export interface WeekChartModel {
  readonly week: WeekTimeline;
  readonly site: Site;
  /** Epoch millis of "now", drawn as a marker when it lands inside the week. */
  readonly now: number | null;
}

/** Builds the Highcharts options for the week timeline. */
export const buildWeekChartOptions = ({ week, site, now }: WeekChartModel): Options => {
  const showsNow = now !== null && now >= week.interval.start && now < week.interval.end;

  return buildTimelineChart({
    rows: week.rows,
    site,
    describe: eveningDescriber(site),
    rowHeight: ROW_HEIGHT,
    labelGutter: LABEL_GUTTER,
    bottomMargin: BOTTOM_MARGIN,
    seriesName: 'Week',
    xAxis: {
      type: 'datetime',
      min: week.interval.start,
      max: week.interval.end,
      startOnTick: false,
      endOnTick: false,
      tickPositions: weekTickPositions(week),
      tickLength: 0,
      gridLineWidth: 0,
      lineColor: 'var(--timeline-grid)',
      labels: {
        padding: 0,
        formatter() {
          const night = week.nights.find((candidate) => midpoint(candidate.interval) === Number(this.value));
          return night === undefined ? '' : nightLabel(night, site);
        },
        style: { color: 'var(--timeline-muted-text)', fontSize: '0.68rem' },
        y: 18,
      },
      plotBands: buildWeekBands(week, site),
      plotLines: [
        ...buildWeekLines(week),
        ...(showsNow
          ? [
              {
                value: now,
                color: 'var(--schedule-today)',
                width: 2,
                zIndex: MARKER_LINE_Z,
                className: 'schedule-today',
              },
            ]
          : []),
      ],
    },
  });
};

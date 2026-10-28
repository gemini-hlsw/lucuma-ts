import type { Options, XAxisPlotBandsOptions, XAxisPlotLinesOptions } from 'highcharts';

import { SITE_TIME_ZONES, zoneFormatters } from '@/domain/siteTime';
import type { TimelineNight } from '@/domain/timeline';
import type { Site } from '@/domain/types';
import type { WeekTimeline } from '@/domain/weekTimeline';
import {
  buildTimelineChart,
  closureBandPlotBand,
  eveningDescriber,
  LABELLED_BAND_Z,
  midpointLabel,
  midpointTicks,
  MUTED_LABEL,
  nightLines,
  nowMarker,
  readerPx,
  weekendBands,
} from '@/features/timeline/timelineOptions';

const ROW_HEIGHT_REM = 1.875;
const BOTTOM_MARGIN_REM = 2;

const headingFormat = zoneFormatters('en-GB', { weekday: 'short', day: 'numeric' });

/** A night's column heading, as "Tue 17" - the evening it begins on. */
export const nightLabel = (night: TimelineNight, site: Site): string =>
  headingFormat(SITE_TIME_ZONES[site]).format(new Date(`${night.eveningDate}T12:00:00Z`));

/** Labels sit at each night's midpoint; the boundaries are the plot lines. */
export const weekTickPositions = (week: WeekTimeline): number[] => midpointTicks(week.nights);

export const buildWeekBands = (week: WeekTimeline): XAxisPlotBandsOptions[] => [
  ...weekendBands(week.nights),
  // I4 made visible: a night with nothing recorded is hatched, not drawn as an empty telescope.
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
        style: MUTED_LABEL,
        rotation: 0,
        align: 'center' as const,
        verticalAlign: 'top' as const,
        y: readerPx(0.75),
      },
    })),
  ...week.bands.map((band) => closureBandPlotBand(band, 0.875)),
];

export const buildWeekLines = (week: WeekTimeline): XAxisPlotLinesOptions[] => nightLines(week.nights, 'week');

interface WeekChartModel {
  readonly week: WeekTimeline;
  readonly site: Site;
  /** Epoch millis of "now", drawn as a marker when it lands inside the week. */
  readonly now: number | null;
}

export const buildWeekChartOptions = ({ week, site, now }: WeekChartModel): Options =>
  buildTimelineChart({
    rows: week.rows,
    site,
    describe: eveningDescriber(site),
    rowHeightRem: ROW_HEIGHT_REM,
    bottomMarginRem: BOTTOM_MARGIN_REM,
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
          return midpointLabel(week.nights, this.value, (night) => nightLabel(night, site));
        },
        style: MUTED_LABEL,
        y: readerPx(1.125),
      },
      plotBands: buildWeekBands(week),
      plotLines: [...buildWeekLines(week), ...nowMarker(now, week.interval)],
    },
  });

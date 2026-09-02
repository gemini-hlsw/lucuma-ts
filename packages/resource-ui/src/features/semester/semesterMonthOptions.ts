import type { Options, XAxisPlotBandsOptions, XAxisPlotLinesOptions } from 'highcharts';

import { midpoint } from '@/domain/interval';
import type { TimelineMonth } from '@/domain/semesterTimeline';
import type { Site } from '@/domain/types';
import {
  buildTimelineChart,
  closureBandPlotBand,
  eveningDescriber,
  MARKER_LINE_Z,
} from '@/features/timeline/timelineOptions';

/** Height of one row, headings and data rows alike. */
const ROW_HEIGHT = 26;

/** Room below the plot area, where the day numbers sit. */
const BOTTOM_MARGIN = 26;

/** Load-bearing: the group heading type is sized to fit it, so re-check the headings before narrowing. */
const LABEL_GUTTER = 92;

/** Derived from the night count, because a 28-night February fits numbers a 31-night August cannot. */
const PX_PER_LABEL = 15;
const PX_PER_LABEL_TIGHT = 8;

// The night and week charts keep their own geometry; no page reads both.
export const widthForEveryNight = (nightCount: number): number => nightCount * PX_PER_LABEL;
const widthForEveryOtherNight = (nightCount: number): number => nightCount * PX_PER_LABEL_TIGHT;

/** Chosen rather than left to Highcharts, which drops colliding labels one at a time. */
export const dayTickPositions = (month: TimelineMonth, step: number): number[] =>
  month.nights.filter((_, index) => index % step === 0).map((night) => midpoint(night.interval));

/** Weekend nights, shaded, plus the wash under a telescope-wide closure. */
export const buildMonthBands = (month: TimelineMonth): XAxisPlotBandsOptions[] => [
  ...month.nights
    .filter((night) => night.isWeekend)
    .map((night) => ({
      from: night.interval.start,
      to: night.interval.end,
      color: 'var(--schedule-weekend)',
      className: 'schedule-weekend',
    })),
  ...month.bands.map((band) => closureBandPlotBand(band, 12)),
];

/** The week starts on Sunday, so the chart and the calendar cannot sit a night apart. */
export const buildMonthLines = (month: TimelineMonth): XAxisPlotLinesOptions[] =>
  month.nights.map((night) => {
    const startsWeek = new Date(`${night.eveningDate}T00:00:00Z`).getUTCDay() === 0;
    return {
      value: night.interval.start,
      color: startsWeek ? 'var(--schedule-week-line)' : 'var(--schedule-night-line)',
      width: 1,
      zIndex: 1,
    };
  });

interface SemesterMonthModel {
  readonly month: TimelineMonth;
  readonly site: Site;
  /** Epoch millis of "now", drawn as a marker when it lands inside the month. */
  readonly now: number | null;
}

/** Builds the Highcharts options for one month block of the semester timeline. */
export const buildSemesterMonthOptions = ({ month, site, now }: SemesterMonthModel): Options => {
  const showsNow = now !== null && now >= month.interval.start && now < month.interval.end;

  return buildTimelineChart({
    rows: month.rows,
    site,
    describe: eveningDescriber(site),
    rowHeight: ROW_HEIGHT,
    labelGutter: LABEL_GUTTER,
    bottomMargin: BOTTOM_MARGIN,
    seriesName: month.label,
    xAxis: {
      type: 'datetime',
      min: month.interval.start,
      max: month.interval.end,
      startOnTick: false,
      endOnTick: false,
      tickPositions: dayTickPositions(month, 1),
      tickLength: 0,
      gridLineWidth: 0,
      lineColor: 'var(--timeline-grid)',
      labels: {
        // Highcharts reserves padding per label and blanks any whose box overlaps, so a two-digit day vanished.
        padding: 0,
        formatter() {
          const night = month.nights.find((candidate) => midpoint(candidate.interval) === Number(this.value));
          return night === undefined ? '' : String(Number(night.eveningDate.slice(8, 10)));
        },
        style: { color: 'var(--timeline-muted-text)', fontSize: '0.65rem' },
        y: 16,
      },
      plotBands: buildMonthBands(month),
      plotLines: [
        ...buildMonthLines(month),
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
    // A chart's width is not the viewport's, and only Highcharts measures its own container.
    responsive: {
      rules: [
        {
          condition: { maxWidth: widthForEveryNight(month.nights.length) },
          chartOptions: { xAxis: { tickPositions: dayTickPositions(month, 2) } },
        },
        {
          condition: { maxWidth: widthForEveryOtherNight(month.nights.length) },
          chartOptions: {
            xAxis: { tickPositions: dayTickPositions(month, 5) },
            yAxis: { labels: { style: { fontSize: '0.65rem' } } },
          },
        },
      ],
    },
  });
};

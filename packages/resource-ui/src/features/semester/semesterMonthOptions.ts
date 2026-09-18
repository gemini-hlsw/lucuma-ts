import type { Options, XAxisPlotBandsOptions, XAxisPlotLinesOptions } from 'highcharts';

import { midpoint } from '@/domain/interval';
import type { TimelineMonth } from '@/domain/semesterTimeline';
import type { Site } from '@/domain/types';
import {
  buildTimelineChart,
  closureBandPlotBand,
  eveningDescriber,
  MARKER_LINE_Z,
  MUTED_TICK,
  NIGHT_LINE_Z,
  readerPx,
} from '@/features/timeline/timelineOptions';

/** Height of one row, headings and data rows alike. */
const ROW_HEIGHT_REM = 1.625;

/** Room below the plot area, where the day numbers sit. */
const BOTTOM_MARGIN_REM = 1.625;

/** Derived from the night count, because a 28-night February fits numbers a 31-night August cannot. */
const PER_LABEL_REM = 0.9375;
const PER_LABEL_TIGHT_REM = 0.5;

export const pxPerLabel = (): number => readerPx(PER_LABEL_REM);
export const pxPerLabelTight = (): number => readerPx(PER_LABEL_TIGHT_REM);

// The night and week charts space their own axes; no page reads both.
export const widthForEveryNight = (nightCount: number): number => nightCount * pxPerLabel();
const widthForEveryOtherNight = (nightCount: number): number => nightCount * pxPerLabelTight();

/** Chosen rather than left to Highcharts, which drops colliding labels one at a time. */
export const dayTickPositions = (month: TimelineMonth, step: number): number[] =>
  month.nights.filter((_, index) => index % step === 0).map((night) => midpoint(night.interval));

export const buildMonthBands = (month: TimelineMonth): XAxisPlotBandsOptions[] => [
  ...month.nights
    .filter((night) => night.isWeekend)
    .map((night) => ({
      from: night.interval.start,
      to: night.interval.end,
      color: 'var(--schedule-weekend)',
      className: 'schedule-weekend',
    })),
  ...month.bands.map((band) => closureBandPlotBand(band, 0.75)),
];

/** The week starts on Sunday, so the chart and the calendar cannot sit a night apart. */
export const buildMonthLines = (month: TimelineMonth): XAxisPlotLinesOptions[] =>
  month.nights.map((night) => {
    const startsWeek = new Date(`${night.eveningDate}T00:00:00Z`).getUTCDay() === 0;
    return {
      value: night.interval.start,
      color: startsWeek ? 'var(--schedule-week-line)' : 'var(--schedule-night-line)',
      width: 1,
      zIndex: NIGHT_LINE_Z,
    };
  });

interface SemesterMonthModel {
  readonly month: TimelineMonth;
  readonly site: Site;
  /** Epoch millis of "now", drawn as a marker when it lands inside the month. */
  readonly now: number | null;
}

export const buildSemesterMonthOptions = ({ month, site, now }: SemesterMonthModel): Options => {
  const showsNow = now !== null && now >= month.interval.start && now < month.interval.end;

  return buildTimelineChart({
    rows: month.rows,
    site,
    describe: eveningDescriber(site),
    rowHeightRem: ROW_HEIGHT_REM,
    bottomMarginRem: BOTTOM_MARGIN_REM,
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
        // Highcharts reserves padding per label and blanks any whose box overlaps, so a two-digit day would otherwise vanish.
        padding: 0,
        formatter() {
          const night = month.nights.find((candidate) => midpoint(candidate.interval) === Number(this.value));
          return night === undefined ? '' : String(Number(night.eveningDate.slice(8, 10)));
        },
        style: MUTED_TICK,
        y: readerPx(1),
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
          },
        },
      ],
    },
  });
};

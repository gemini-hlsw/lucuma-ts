/**
 * The axis for one month of the semester timeline. The rest of the chart is
 * `timelineOptions.ts`, shared with the week and night views.
 *
 * ## Day numbers sit in the middle of their night
 *
 * An observing night runs 14:00 local to 14:00 local, so a tick at the boundary
 * sits at the *edge* of the night it opens and a number placed there reads as
 * though it belonged to the night before. The labels are therefore placed at
 * each night's midpoint and the boundaries drawn separately as plot lines - the
 * numbers land in the middle of the span they name, which is where the sheet
 * puts them.
 */
import type { Options, XAxisPlotBandsOptions, XAxisPlotLinesOptions } from 'highcharts';

import { midpoint } from '@/domain/interval';
import type { TimelineMonth } from '@/domain/semesterTimeline';
import type { Site } from '@/domain/types';
import {
  buildTimelineChart,
  eveningDescriber,
  LABELLED_BAND_Z,
  MARKER_LINE_Z,
} from '@/features/timeline/timelineOptions';

import { BOTTOM_MARGIN, LABEL_GUTTER, ROW_HEIGHT, widthForEveryNight, widthForEveryOtherNight } from './monthGeometry';

/**
 * Day-number positions, every `step` nights.
 *
 * The thinning is done by choosing the ticks rather than by `labels.step`, which
 * had no observable effect here, and certainly not by leaving it to Highcharts:
 * left alone it drops labels one at a time as they collide, which produced a
 * month numbered 1 to 9 and then blank for the rest. Choosing them keeps the
 * count deterministic, and testable without a browser.
 *
 * The first night is always numbered, so a month always starts from a known day.
 */
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
  ...month.bands.map((band) => ({
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
      y: 12,
    },
  })),
];

/** Night boundaries as a faint texture, with the week's first night stronger. */
export const buildMonthLines = (month: TimelineMonth): XAxisPlotLinesOptions[] =>
  month.nights.map((night) => {
    const startsWeek = new Date(`${night.eveningDate}T00:00:00Z`).getUTCDay() === 1;
    return {
      value: night.interval.start,
      color: startsWeek ? 'var(--schedule-week-line)' : 'var(--schedule-night-line)',
      width: 1,
      zIndex: 1,
    };
  });

export interface SemesterMonthModel {
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
        // Zero padding, because Highcharts reserves it per label and then blanks
        // any label whose reserved box overlaps its neighbour. With the default
        // 5px a two-digit day never fits a ~16px night, so a month rendered days
        // 1 to 9 and then nothing at all.
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
    // The grid puts two months side by side on a wide window and one on a narrow
    // one, so a chart's width is not the viewport's and a CSS media query cannot
    // see it. Highcharts measures its own container, which is the only thing that
    // knows how much room a day number actually has.
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

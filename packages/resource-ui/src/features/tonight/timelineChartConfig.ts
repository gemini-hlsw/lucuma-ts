/**
 * Highcharts configuration generator for the telescope night timeline chart.
 */
import type { ComponentProps } from 'react';
import type Highcharts from 'highcharts';

import type { PlotOptions, Tooltip, XAxis, YAxis } from '@highcharts/react';
import type { XRangeSeries } from '@highcharts/react/series/XRange';

import { timelineChartTheme } from './timelineChartTheme';
import { formatTime, getNowTimestamp, getTimestamp, isWithinInterval } from './time';
import type { TimelineTimeDisplay } from './time';
import type { TimelineBlock, TimelineRowData, TimestampInterval } from './types';
import type { Site } from '../../gql/gen/graphql';

interface TimelinePoint extends Highcharts.XrangePointOptionsObject {
  custom: {
    block: TimelineBlock;
    rowLabel: string;
  };
}

interface TimelineChartPoint extends Highcharts.Point {
  custom: {
    block: TimelineBlock;
    rowLabel: string;
  };
}

export interface TimelineChartConfig {
  chartOptions: Highcharts.Options;
  bottomAxisProps: ComponentProps<typeof XAxis>;
  topAxisProps: ComponentProps<typeof XAxis>;
  yAxisProps: ComponentProps<typeof YAxis>;
  tooltipProps: ComponentProps<typeof Tooltip>;
  plotOptionsProps: ComponentProps<typeof PlotOptions>;
  xrangeOptions: NonNullable<ComponentProps<typeof XRangeSeries>['options']>;
  points: TimelinePoint[];
}

interface CreateTimelineChartConfigArgs {
  site: Site;
  timeDisplay: TimelineTimeDisplay;
  displayInterval: TimestampInterval;
  rows: TimelineRowData[];
  onBlockSelect: (block: TimelineBlock) => void;
}

const theme = timelineChartTheme;

const getTimelineChartPoint = (point: Highcharts.Point): TimelineChartPoint => point as TimelineChartPoint;

const getNowLabel = (now: Date, site: Site, timeDisplay: TimelineTimeDisplay): string => `
  <span
    class="inline-flex items-center rounded-full border bg-neutral-900 px-2 py-1 text-[10px] font-bold whitespace-nowrap"
    style="color: var(--timeline-now); border-color: var(--timeline-now);"
  >
    NOW ${formatTime(now, site, timeDisplay)}
  </span>
`;

const getTooltipHtml = (
  block: TimelineBlock,
  rowLabel: string,
  site: Site,
  timeDisplay: TimelineTimeDisplay,
): string => `
  <strong>${rowLabel}: ${block.label}</strong><br />
  Start: ${formatTime(block.interval.start, site, timeDisplay)}<br />
  End: ${formatTime(block.interval.end, site, timeDisplay)}<br />
  Duration: ${getDurationLabel(block.interval.start, block.interval.end)}
`;

const getBlockLabelHtml = (block: TimelineBlock, site: Site, timeDisplay: TimelineTimeDisplay): string => `
  <span style="color:${theme.color.text}; font-weight:${theme.font.weightBold}">
    ${block.label}
  </span>
  <br />
  <span
    style="
      color:${theme.color.text};
      font-size:${theme.block.timeLabelFontSize};
      opacity:${theme.block.timeLabelOpacity};
    "
  >
    ${formatTime(block.interval.start, site, timeDisplay)}
    –
    ${formatTime(block.interval.end, site, timeDisplay)}
  </span>
`;

const getDurationLabel = (start: string, end: string): string => {
  const durationMinutes = Math.max(0, Math.round((getTimestamp(end) - getTimestamp(start)) / 60000));
  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;

  if (hours === 0) {
    return `${minutes}m`;
  }

  if (minutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${minutes}m`;
};

const getChartHeight = (rowCount: number): number =>
  theme.layout.topAxisHeight + theme.layout.bottomAxisHeight + rowCount * theme.layout.rowHeight;

const toTimelinePoints = (rows: TimelineRowData[]): TimelinePoint[] =>
  rows.flatMap((row, rowIndex) =>
    row.blocks.map((block) => ({
      x: getTimestamp(block.interval.start),
      x2: getTimestamp(block.interval.end),
      y: rowIndex,
      name: block.label,
      color: theme.color.variants[block.variant],
      custom: {
        block,
        rowLabel: row.label,
      },
    })),
  );

const createTimeAxisProps = (
  site: Site,
  timeDisplay: TimelineTimeDisplay,
  displayInterval: TimestampInterval,
  opposite: boolean,
): ComponentProps<typeof XAxis> => ({
  type: 'datetime',
  min: getTimestamp(displayInterval.start),
  max: getTimestamp(displayInterval.end),
  tickInterval: theme.axis.hourTickInterval,
  tickLength: theme.axis.tickLength,
  tickWidth: theme.axis.tickWidth,
  showFirstLabel: true,
  showLastLabel: true,
  opposite,
  lineColor: theme.color.axis,
  tickColor: theme.color.axis,
  gridLineColor: theme.color.grid,
  gridLineWidth: theme.axis.gridLineWidth,
  labels: {
    rotation: theme.axis.labelRotation,
    align: 'right',
    reserveSpace: true,
    y: opposite ? theme.axis.topLabelY : theme.axis.bottomLabelY,
    style: {
      color: theme.color.mutedText,
      fontSize: theme.axis.labelFontSize,
    },
    formatter() {
      return formatTime(new Date(Number(this.value)), site, timeDisplay);
    },
  },
});

const createNowPlotLine = (
  now: Date,
  site: Site,
  timeDisplay: TimelineTimeDisplay,
): NonNullable<ComponentProps<typeof XAxis>['plotLines']>[number] => ({
  value: now.getTime(),
  color: theme.color.now,
  width: theme.now.lineWidth,
  zIndex: theme.now.lineZIndex,
  label: {
    useHTML: true,
    text: getNowLabel(now, site, timeDisplay),
    align: 'center',
    verticalAlign: 'top',
    rotation: 0,
    y: theme.now.labelY,
  },
});

/**
 * Creates Highcharts React config for the night timeline.
 */
export const createTimelineChartConfig = ({
  site,
  timeDisplay,
  displayInterval,
  rows,
  onBlockSelect,
}: CreateTimelineChartConfigArgs): TimelineChartConfig => {
  const categories = rows.map((row) => row.label);
  const points = toTimelinePoints(rows);
  const now = new Date(getNowTimestamp());
  const showNow = isWithinInterval(now, displayInterval);

  const chartOptions: Highcharts.Options = {
    chart: {
      type: 'xrange',
      backgroundColor: theme.color.background,
      height: getChartHeight(rows.length),
      marginTop: theme.layout.topAxisHeight,
      marginBottom: theme.layout.bottomAxisHeight,
      marginLeft: theme.layout.marginLeft,
      marginRight: theme.layout.marginRight,
      spacing: theme.layout.spacing,
      style: {
        fontFamily: theme.font.family,
      },
    },
    title: {
      text: undefined,
    },
    credits: {
      enabled: false,
    },
    legend: {
      enabled: false,
    },
  };

  const bottomAxisProps: ComponentProps<typeof XAxis> = {
    ...createTimeAxisProps(site, timeDisplay, displayInterval, false),
    offset: theme.axis.offset,
    plotLines: showNow ? [createNowPlotLine(now, site, timeDisplay)] : [],
  };

  const topAxisProps: ComponentProps<typeof XAxis> = {
    ...createTimeAxisProps(site, timeDisplay, displayInterval, true),
    linkedTo: 0,
    offset: theme.axis.offset,
  };

  const yAxisProps: ComponentProps<typeof YAxis> = {
    categories,
    reversed: true,
    min: theme.axis.yMinPadding,
    max: categories.length - theme.axis.yMaxPadding,
    tickPositions: categories.map((_, index) => index),
    startOnTick: false,
    endOnTick: false,
    title: {
      text: undefined,
    },
    labels: {
      style: {
        color: theme.color.text,
        fontSize: theme.axis.rowLabelFontSize,
        fontWeight: theme.font.weightBold,
      },
    },
    gridLineColor: theme.color.grid,
  };

  const tooltipProps: ComponentProps<typeof Tooltip> = {
    outside: true,
    useHTML: true,
    backgroundColor: theme.color.tooltipBackground,
    borderColor: theme.color.tooltipBorder,
    borderRadius: theme.tooltip.borderRadius,
    style: {
      color: theme.color.text,
    },
    formatter() {
      const point = getTimelineChartPoint(this);

      return getTooltipHtml(point.custom.block, point.custom.rowLabel, site, timeDisplay);
    },
  };

  const plotOptionsProps: ComponentProps<typeof PlotOptions> = {
    series: {
      cursor: 'pointer',
      point: {
        events: {
          click() {
            const point = getTimelineChartPoint(this);

            onBlockSelect(point.custom.block);
          },
        },
      },
    },
  };

  const xrangeOptions: NonNullable<ComponentProps<typeof XRangeSeries>['options']> = {
    borderColor: theme.color.blockBorder,
    borderRadius: theme.block.borderRadius,
    pointWidth: theme.layout.pointWidth,
    dataLabels: {
      enabled: true,
      useHTML: true,
      formatter() {
        const point = getTimelineChartPoint(this);

        return getBlockLabelHtml(point.custom.block, site, timeDisplay);
      },
      style: {
        textOutline: 'none',
        fontSize: theme.block.labelFontSize,
        fontWeight: theme.font.weightBold,
      },
    },
    states: {
      hover: {
        brightness: theme.block.hoverBrightness,
      },
    },
  };

  return {
    chartOptions,
    bottomAxisProps,
    topAxisProps,
    yAxisProps,
    tooltipProps,
    plotOptionsProps,
    xrangeOptions,
    points,
  };
};

/**
 * Component for rendering the telescope night timeline chart, using Highcharts.
 */
import './timelineChart.css';

import { Chart, PlotOptions, Tooltip, XAxis, YAxis } from '@highcharts/react';
import { XRangeSeries } from '@highcharts/react/series/XRange';
import type { JSX } from 'react';

import type { Site, TimestampInterval } from '@/types';

import type { TimelineTimeDisplay } from './time';
import { createTimelineChartConfig } from './timelineChartConfig';
import type { TimelineBlock, TimelineRowData } from './types';

interface TimelineProps {
  site: Site;
  timeDisplay: TimelineTimeDisplay;
  displayInterval: TimestampInterval;
  rows: TimelineRowData[];
  onBlockSelect: (block: TimelineBlock) => void;
}

/**
 * Renders the observing-night timeline chart.
 */
export function Timeline({ site, timeDisplay, displayInterval, rows, onBlockSelect }: TimelineProps): JSX.Element {
  const config = createTimelineChartConfig({
    site,
    timeDisplay,
    displayInterval,
    rows,
    onBlockSelect,
  });

  return (
    <section>
      <Chart options={config.chartOptions}>
        <XAxis {...config.bottomAxisProps} />
        <XAxis {...config.topAxisProps} />
        <YAxis {...config.yAxisProps} />
        <Tooltip {...config.tooltipProps} />
        <PlotOptions {...config.plotOptionsProps} />

        <XRangeSeries name="Night timeline" data={config.points} options={config.xrangeOptions} />
      </Chart>
    </section>
  );
}

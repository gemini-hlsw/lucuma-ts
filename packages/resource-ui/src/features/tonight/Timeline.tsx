/**
 * Component for rendering the telescope night timeline chart, using Highcharts.
 */
import type { JSX } from 'react';
import { useMemo } from 'react';

import { Chart, PlotOptions, Tooltip, XAxis, YAxis } from '@highcharts/react';
import { XRangeSeries } from '@highcharts/react/series/XRange';

import { createTimelineChartConfig } from './timelineChartConfig';
import './timelineChart.css';
import type { TimelineTimeDisplay } from './time';
import type { TimelineBlock, TimelineRowData, TimestampInterval } from './types';
import type { Site } from '../../gql/gen/graphql';

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
  const config = useMemo(
    () =>
      createTimelineChartConfig({
        site,
        timeDisplay,
        displayInterval,
        rows,
        onBlockSelect,
      }),
    [displayInterval, onBlockSelect, rows, site, timeDisplay],
  );

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

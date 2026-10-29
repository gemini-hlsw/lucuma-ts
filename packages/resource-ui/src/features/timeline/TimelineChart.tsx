// Core must initialize before the modules extend its series prototypes.
import 'highcharts/es-modules/masters/highcharts.src.js';
import 'highcharts/es-modules/masters/modules/xrange.src.js';
// The engineering-use hatch on blocks (timelineOptions engineeringPattern).
import 'highcharts/es-modules/masters/modules/pattern-fill.src.js';

import { Chart, type HighchartsReactRefObject } from '@highcharts/react';
import type {
  Chart as HighchartsChart,
  ChartClickCallbackFunction,
  ChartClickEventObject,
  ChartRenderCallbackFunction,
  Options,
  PointClickCallbackFunction,
  TooltipFormatterCallbackFunction,
  XAxisPlotLinesOptions,
} from 'highcharts';
import { type JSX, useEffect, useRef } from 'react';

import type { TimelineLegend } from '@/domain/timeline';

import { INSTRUMENT_LABEL, instrumentColor } from './instruments';
import {
  CLOSURE_LABEL,
  formatterPoint,
  type LegendExtra,
  NOW_MARKER_ID,
  type TimelinePointCustom,
  tooltipHtml,
  UNSCHEDULED_LABEL,
  USAGE_LABEL,
} from './timelineOptions';

interface TimelineChartProps {
  readonly options: Options;
  readonly continuesLabel: string;
  readonly label: string;
  readonly testId: string;
  readonly heading?: JSX.Element;
  /** Called with the axis instant under a click: the target is the night, not the block. */
  readonly onInstantClick?: (instant: number) => void;
}

type InstantHandler = (instant: number) => void;

// Declared over the plain pointer event, but a chart click always carries the axis coordinates.
const chartClick =
  (onInstantClick: InstantHandler): ChartClickCallbackFunction =>
  (event) => {
    const instant = (event as ChartClickEventObject).xAxis[0]?.value;
    if (instant !== undefined) {
      onInstantClick(instant);
    }
  };

// A bar resolves the instant under the cursor itself, not point.x, which can be nights away.
const pointClick = (onInstantClick: InstantHandler): PointClickCallbackFunction =>
  function (event) {
    const axis = this.series.chart.xAxis[0];
    if (axis !== undefined) {
      onInstantClick(axis.toValue(event.chartX));
    }
  };

/** Keyed on the chart, not a ref: a ref passed around during render is a compiler and lint error. */
const rearmOnRender = new WeakMap<HighchartsChart, () => void>();

const chartRender = (inner: ChartRenderCallbackFunction | undefined): ChartRenderCallbackFunction =>
  function (event) {
    inner?.call(this, event);
    rearmOnRender.get(this)?.();
  };

const tooltipFormatter = (continuesLabel: string): TooltipFormatterCallbackFunction =>
  function () {
    const custom = formatterPoint<TimelinePointCustom>(this)?.custom;
    return custom === undefined ? '' : tooltipHtml(custom, continuesLabel);
  };

/** Structural, because Highcharts does not type the live `Axis.plotLines` items. */
interface PlotLineItem {
  readonly id?: string;
  update(options: XAxisPlotLinesOptions, redraw?: boolean): void;
}

const nowLine = (chart: HighchartsChart): PlotLineItem | undefined =>
  (chart.xAxis[0] as { plotLines?: readonly PlotLineItem[] } | undefined)?.plotLines?.find(
    (line) => line.id === NOW_MARKER_ID,
  );

const MIN_TICK_MS = 60_000;
const MAX_TICK_MS = 24 * 3_600_000;

/** One pixel of marker travel per tick, as vis-timeline does, inside a minute-to-day band. */
const markerTickMs = (chart: HighchartsChart): number => {
  const axis = chart.xAxis[0];
  if (axis === undefined) {
    return MAX_TICK_MS;
  }
  const msPerPixel = Math.abs(axis.toValue(1, true) - axis.toValue(0, true));
  return Math.min(MAX_TICK_MS, Math.max(MIN_TICK_MS, msPerPixel));
};

/** Plot-line `update` redraws the line alone, so a tick fires no `render` and cannot re-arm itself. */
const moveMarker = (chart: HighchartsChart): void => {
  nowLine(chart)?.update({ value: Date.now() });
};

export function TimelineChart({
  options,
  continuesLabel,
  label,
  testId,
  heading,
  onInstantClick,
}: TimelineChartProps): JSX.Element {
  const chartRef = useRef<HighchartsReactRefObject>(null);

  const withTooltip: Options = {
    ...options,
    chart: {
      ...options.chart,
      events: {
        ...options.chart?.events,
        render: chartRender(options.chart?.events?.render),
        ...(onInstantClick === undefined ? {} : { click: chartClick(onInstantClick) }),
      },
    },
    ...(onInstantClick === undefined
      ? {}
      : {
          plotOptions: {
            ...options.plotOptions,
            xrange: {
              ...options.plotOptions?.xrange,
              cursor: 'pointer' as const,
              point: { events: { click: pointClick(onInstantClick) } },
            },
          },
        }),
    tooltip: { ...options.tooltip, formatter: tooltipFormatter(continuesLabel) },
  };

  // Also after an options change: the wrapper's `chart.update` has run by then, on the same slot.
  useEffect(() => {
    const chart = chartRef.current?.chart;
    if (chart === undefined) {
      return;
    }
    let timer: ReturnType<typeof setInterval> | undefined;
    const arm = (): void => {
      clearInterval(timer);
      timer = setInterval(() => moveMarker(chart), markerTickMs(chart));
    };
    // A background tab slows its timers, so the line catches up the moment the tab is seen again.
    const onVisible = (): void => {
      if (document.visibilityState === 'visible') {
        moveMarker(chart);
        arm();
      }
    };
    moveMarker(chart);
    arm();
    rearmOnRender.set(chart, arm);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      rearmOnRender.delete(chart);
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [options, onInstantClick, continuesLabel]);

  return (
    // Highcharts observes its own render target, so nothing here drives the reflow.
    <section className="min-w-0" aria-label={label} data-testid={testId}>
      {heading}
      <Chart ref={chartRef} options={withTooltip} />
    </section>
  );
}

const SWATCH = 'inline-block h-3 w-4 rounded-[2px]';

function LegendSection({ label, entries }: { label: string; entries: readonly LegendExtra[] }): JSX.Element | null {
  if (entries.length === 0) {
    return null;
  }
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2" role="group" aria-label={label}>
      <span className="text-xs font-semibold tracking-wider text-foreground uppercase">{label}</span>
      <ul className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {entries.map((entry) => (
          <li key={entry.key} className="flex items-center gap-1.5">
            <span aria-hidden className={SWATCH} style={entry.swatch} />
            {entry.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Only what the window contains, in sections, so a grey repeated across rows is keyed under its row. */
export function TimelineLegendBar({
  legend,
  telescope = [],
  mode = [],
  too = [],
  calendar = [],
}: {
  legend: TimelineLegend;
  telescope?: readonly LegendExtra[];
  mode?: readonly LegendExtra[];
  too?: readonly LegendExtra[];
  calendar?: readonly LegendExtra[];
}): JSX.Element {
  const closureKey: LegendExtra = {
    key: 'closure',
    label: CLOSURE_LABEL,
    swatch: { backgroundColor: 'var(--schedule-closed)' },
  };
  const unscheduledKey: LegendExtra = {
    key: 'unscheduled',
    label: UNSCHEDULED_LABEL,
    swatch: { backgroundColor: 'var(--schedule-ghost-fill)', border: '1px dashed var(--schedule-ghost-edge)' },
  };
  // Usage is a treatment over any hue, so its keys wear neutral swatches.
  const engineeringKey: LegendExtra = {
    key: 'engineering-use',
    label: USAGE_LABEL.ENGINEERING,
    swatch: {
      backgroundImage:
        'repeating-linear-gradient(135deg, var(--color-foreground-secondary) 0 2px, transparent 2px 5px)',
    },
  };
  const unavailableKey: LegendExtra = {
    key: 'unavailable',
    label: USAGE_LABEL.UNAVAILABLE,
    swatch: { backgroundColor: 'transparent', border: '1.5px solid var(--color-foreground-secondary)' },
  };

  return (
    <div
      className="mb-3 flex flex-wrap items-center gap-x-8 gap-y-2 text-xs text-foreground-secondary"
      aria-label="Legend"
    >
      <LegendSection label="Telescope" entries={[...telescope, ...(legend.hasClosure ? [closureKey] : [])]} />
      <LegendSection label="Mode" entries={mode} />
      <LegendSection label="ToO" entries={too} />
      <LegendSection
        label="Instruments"
        entries={[
          ...legend.instruments.map((instrument) => ({
            key: instrument,
            label: INSTRUMENT_LABEL[instrument],
            swatch: { backgroundColor: instrumentColor(instrument) },
          })),
          ...(legend.hasEngineeringUse ? [engineeringKey] : []),
          ...(legend.hasUnavailable ? [unavailableKey] : []),
          ...(legend.hasUnscheduled ? [unscheduledKey] : []),
        ]}
      />
      <LegendSection label="Calendar" entries={calendar} />
    </div>
  );
}

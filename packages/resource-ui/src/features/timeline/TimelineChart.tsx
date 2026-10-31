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
import { type CSSProperties, type JSX, useEffect, useRef } from 'react';

import { contains } from '@/domain/interval';
import {
  NOTABLE_MODE,
  NOTABLE_TOO,
  TELESCOPE_AVAILABILITY_LABEL,
  TELESCOPE_MODE_LABEL,
  type TimelineLegend,
  TOO_SUPPORT_LABEL,
} from '@/domain/timeline';
import type { Interval } from '@/domain/types';

import { INSTRUMENT_LABEL, instrumentColor } from './instruments';
import {
  CLOSURE_LABEL,
  formatterPoint,
  NOW_MARKER_ID,
  stateFill,
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

interface LegendKey {
  readonly key: string;
  readonly label: string;
  readonly swatch: CSSProperties;
}

const swatchFill = (backgroundColor: string): CSSProperties => ({ backgroundColor });

const OPEN_KEY: LegendKey = {
  key: 'telescope-open',
  label: TELESCOPE_AVAILABILITY_LABEL.OPEN,
  swatch: swatchFill(stateFill(false)),
};
const CLOSURE_KEY: LegendKey = { key: 'closure', label: CLOSURE_LABEL, swatch: swatchFill('var(--schedule-closed)') };
const UNSCHEDULED_KEY: LegendKey = {
  key: 'unscheduled',
  label: UNSCHEDULED_LABEL,
  swatch: { backgroundColor: 'var(--schedule-ghost-fill)', border: '1px dashed var(--schedule-ghost-edge)' },
};
// Usage is a treatment over any hue, so its keys wear neutral swatches.
const ENGINEERING_KEY: LegendKey = {
  key: 'engineering-use',
  label: USAGE_LABEL.ENGINEERING,
  swatch: {
    backgroundImage: 'repeating-linear-gradient(135deg, var(--color-foreground-secondary) 0 2px, transparent 2px 5px)',
  },
};
const UNAVAILABLE_KEY: LegendKey = {
  key: 'unavailable',
  label: USAGE_LABEL.UNAVAILABLE,
  swatch: { backgroundColor: 'transparent', border: '1.5px solid var(--color-foreground-secondary)' },
};
const WEEKEND_KEY: LegendKey = { key: 'weekend', label: 'Weekend', swatch: swatchFill('var(--schedule-weekend)') };
// A line, not a fill - the swatch says so rather than reading as a block.
const NOW_SWATCH: CSSProperties = { backgroundColor: 'transparent', borderLeft: '2px solid var(--schedule-today)' };
const NO_DATA_KEY: LegendKey = {
  key: 'no-data',
  label: 'Nothing recorded',
  swatch: swatchFill('var(--schedule-no-data)'),
};

/** A window of one night is read at a moment; the semester is read on a day. The view says which. */
type NowLabel = 'Now' | 'Today';

// Not common-ui's `when`: the sections spread lists, so an absent key must be an empty list, not undefined.
const onlyWhen = (isPresent: boolean, key: LegendKey): readonly LegendKey[] => (isPresent ? [key] : []);

/** The one table from a legend key to its words and swatch; every chart's legend is read from here. */
const sectionsOf = (
  legend: TimelineLegend,
  hasNow: boolean,
  nowLabel: NowLabel,
): readonly { readonly label: string; readonly keys: readonly LegendKey[] }[] => [
  { label: 'Telescope', keys: [...onlyWhen(legend.hasOpen, OPEN_KEY), ...onlyWhen(legend.hasClosure, CLOSURE_KEY)] },
  {
    label: 'Mode',
    keys: legend.modes.map((mode) => ({
      key: `mode-${mode}`,
      label: TELESCOPE_MODE_LABEL[mode],
      swatch: swatchFill(stateFill(NOTABLE_MODE[mode])),
    })),
  },
  {
    label: 'ToO',
    keys: legend.toos.map((too) => ({
      key: `too-${too}`,
      label: TOO_SUPPORT_LABEL[too],
      swatch: swatchFill(stateFill(NOTABLE_TOO[too])),
    })),
  },
  {
    label: 'Instruments',
    keys: [
      ...legend.instruments.map((instrument) => ({
        key: instrument,
        label: INSTRUMENT_LABEL[instrument],
        swatch: swatchFill(instrumentColor(instrument)),
      })),
      ...onlyWhen(legend.hasEngineeringUse, ENGINEERING_KEY),
      ...onlyWhen(legend.hasUnavailable, UNAVAILABLE_KEY),
      ...onlyWhen(legend.hasUnscheduled, UNSCHEDULED_KEY),
    ],
  },
  {
    label: 'Calendar',
    keys: [
      ...onlyWhen(legend.hasWeekend, WEEKEND_KEY),
      ...onlyWhen(hasNow, { key: 'now', label: nowLabel, swatch: NOW_SWATCH }),
      ...onlyWhen(legend.hasNoData, NO_DATA_KEY),
    ],
  },
];

function LegendSection({ label, keys }: { label: string; keys: readonly LegendKey[] }): JSX.Element | null {
  if (keys.length === 0) {
    return null;
  }
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2" role="group" aria-label={label}>
      <span className="text-xs font-semibold tracking-wider text-foreground uppercase">{label}</span>
      <ul className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {keys.map((entry) => (
          <li key={entry.key} className="flex items-center gap-1.5">
            <span aria-hidden className={SWATCH} style={entry.swatch} />
            {entry.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Only what the window contains, in sections, so a grey repeated across rows is keyed under its row.
 * The now key is decided here, off the clock prop, so no window takes `now` as a dependency (see `useNow`).
 */
export interface TimelineLegendBarProps {
  legend: TimelineLegend;
  /** The window's interval, which the clock is judged against for the Now key. */
  span: Interval;
  now: number;
  nowLabel?: NowLabel;
}

export function TimelineLegendBar({ legend, span, now, nowLabel = 'Now' }: TimelineLegendBarProps): JSX.Element {
  return (
    <div
      className="mb-3 flex flex-wrap items-center gap-x-8 gap-y-2 text-xs text-foreground-secondary"
      aria-label="Legend"
    >
      {sectionsOf(legend, contains(span, now), nowLabel).map((section) => (
        <LegendSection key={section.label} label={section.label} keys={section.keys} />
      ))}
    </div>
  );
}

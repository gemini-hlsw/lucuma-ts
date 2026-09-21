// Core must initialize before the modules extend its series prototypes.
import 'highcharts/es-modules/masters/highcharts.src.js';
import 'highcharts/es-modules/masters/modules/xrange.src.js';
// The engineering-use hatch on blocks (timelineOptions engineeringPattern).
import 'highcharts/es-modules/masters/modules/pattern-fill.src.js';

import { Chart } from '@highcharts/react';
import type { ChartClickEventObject, Options, Point, PointClickEventObject, PointerEventObject } from 'highcharts';
import type { JSX } from 'react';

import type { TimelineLegend } from '@/domain/timeline';

import {
  CLOSURE_LABEL,
  formatterPoint,
  INSTRUMENT_LABEL,
  instrumentColor,
  type LegendExtra,
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

export function TimelineChart({
  options,
  continuesLabel,
  label,
  testId,
  heading,
  onInstantClick,
}: TimelineChartProps): JSX.Element {
  const withTooltip: Options = {
    ...options,
    ...(onInstantClick === undefined
      ? {}
      : {
          chart: {
            ...options.chart,
            events: {
              // Must spread the existing chart.events, or the builder's render handler (band-label fitting) is lost.
              ...options.chart?.events,
              // Declared over the plain pointer event, but a chart click always carries the axis coordinates.
              click(event: PointerEventObject) {
                const instant = (event as ChartClickEventObject).xAxis[0]?.value;
                if (instant !== undefined) {
                  onInstantClick(instant);
                }
              },
            },
          },
          plotOptions: {
            ...options.plotOptions,
            xrange: {
              ...options.plotOptions?.xrange,
              cursor: 'pointer' as const,
              point: {
                events: {
                  // A bar resolves the instant under the cursor itself, not point.x, which can be nights away.
                  click(this: Point, event: PointClickEventObject) {
                    const axis = this.series.chart.xAxis[0];
                    if (axis !== undefined) {
                      onInstantClick(axis.toValue(event.chartX));
                    }
                  },
                },
              },
            },
          },
        }),
    tooltip: {
      ...options.tooltip,
      formatter() {
        const custom = formatterPoint<TimelinePointCustom>(this)?.custom;
        return custom === undefined ? '' : tooltipHtml(custom, continuesLabel);
      },
    },
  };

  return (
    // Highcharts observes its own render target, so nothing here drives the reflow.
    <section className="min-w-0" aria-label={label} data-testid={testId}>
      {heading}
      <Chart options={withTooltip} />
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
  sky = [],
  calendar = [],
}: {
  legend: TimelineLegend;
  telescope?: readonly LegendExtra[];
  mode?: readonly LegendExtra[];
  too?: readonly LegendExtra[];
  sky?: readonly LegendExtra[];
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
      <LegendSection label="Sky" entries={sky} />
      <LegendSection label="Calendar" entries={calendar} />
    </div>
  );
}

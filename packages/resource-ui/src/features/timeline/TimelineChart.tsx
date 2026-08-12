/**
 * The React side every timeline view shares: the chart wrapper and the legend.
 *
 * The options come from a pure builder per view (`semesterMonthOptions`,
 * `nightChartOptions`, `weekChartOptions`); what is here is the wiring that
 * would otherwise be written three times - the HTML tooltip, and the key that
 * lists only the instruments a window actually contains.
 */
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
  INSTRUMENT_LABEL,
  instrumentColor,
  type LegendExtra,
  type TimelinePointCustom,
  tooltipHtml,
  UNSCHEDULED_LABEL,
  USAGE_LABEL,
} from './timelineOptions';

// Re-exported so legend consumers need not know which module owns the type.
export type { LegendExtra } from './timelineOptions';

export interface TimelineChartProps {
  readonly options: Options;
  /** How this window says a block reaches past its edge. */
  readonly continuesLabel: string;
  readonly label: string;
  readonly testId: string;
  /** Rendered above the chart, inside the labelled region. */
  readonly heading?: JSX.Element;
  /**
   * Called with the axis instant under a click. Both a bar and the background
   * fire it, because the click-through target is the night, not the block - a
   * click lands where it lands, and the caller resolves it (`nightAt`).
   */
  readonly onInstantClick?: (instant: number) => void;
}

/** One timeline chart, with the shared tooltip wired in. */
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
              // Spread first: the builder wires `render` (band-label fitting),
              // and replacing the object would silently drop it.
              ...options.chart?.events,
              // The callback is declared over the plain pointer event, but a
              // chart click always carries the axis coordinates.
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
                  // A click on a bar never reaches the chart's own handler, so
                  // the bar resolves the instant under the cursor itself - not
                  // point.x, which is the bar's start and can be nights away.
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
        const custom = (this as unknown as { point?: { custom?: TimelinePointCustom } }).point?.custom;
        return custom === undefined ? '' : tooltipHtml(custom, continuesLabel);
      },
    },
  };

  // The chart remounts when its window moves, and only then. Stepping the
  // night view to a cached night swaps the axis extremes and the series data
  // in one chart.update, which Highcharts 12 answers with an empty xrange -
  // the bars never come back. A per-window key makes that transition a fresh
  // chart, while same-window updates (data arriving, the "now" marker
  // ticking) still update in place.
  const axis = Array.isArray(options.xAxis) ? options.xAxis[0] : options.xAxis;
  const windowKey = `${String(axis?.min)}:${String(axis?.max)}`;

  return (
    // Highcharts redraws itself when its render target resizes - it observes it
    // (Core/Chart/Chart.js) - so nothing here needs to drive the reflow. min-w-0
    // only overrides a grid item's default min-width:auto, so the column is free
    // to narrow before the chart follows it rather than racing the two.
    <section className="min-w-0" aria-label={label} data-testid={testId}>
      {heading}
      <Chart key={windowKey} options={withTooltip} />
    </section>
  );
}

const SWATCH = 'inline-block h-3 w-4 rounded-[2px]';

/** One labelled group of keys. Renders nothing when it has no entries. */
function LegendSection({ label, entries }: { label: string; entries: readonly LegendExtra[] }): JSX.Element | null {
  if (entries.length === 0) {
    return null;
  }
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2" role="group" aria-label={label}>
      <span className="text-[0.62rem] font-semibold tracking-wider text-foreground-muted uppercase">{label}</span>
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

/**
 * The key to the colours, above the charts, in sections: one per state row -
 * Telescope (open/closed), Mode, ToO - then the instruments, so the
 * vocabularies never read as one line of colours, and a grey repeated across
 * rows is keyed under the row it belongs to (Dan, 2026-08-11). A section a
 * window has no keys for does not render. Only what the window actually
 * contains: a fixed list of all thirteen instruments would mostly be keys to
 * colours that are not on the page.
 *
 * The name still rides on every block as well. The legend makes the colours
 * learnable; the labels make them unnecessary, which is what keeps the view
 * readable for someone who cannot tell two of the hues apart.
 */
export function TimelineLegendBar({
  legend,
  telescope = [],
  mode = [],
  too = [],
  subsystems = [],
  extras = [],
}: {
  legend: TimelineLegend;
  /** The Telescope section's keys ahead of the shared closure key - the Open
   * fill (`telescopeLegendExtras`). */
  telescope?: readonly LegendExtra[];
  /** The Mode section's keys (`modeLegendExtras`). */
  mode?: readonly LegendExtra[];
  /** The ToO section's keys (`tooLegendExtras`). */
  too?: readonly LegendExtra[];
  /** The Subsystems section's keys (`subsystemLegendExtras`). */
  subsystems?: readonly LegendExtra[];
  /** Extra keys for the Instruments section - the grid's cell states. */
  extras?: readonly LegendExtra[];
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
  // Usage is a treatment over any hue, so its keys wear neutral swatches: the
  // hatch, and the hollow outline.
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
      <LegendSection label="Subsystems" entries={subsystems} />
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
          ...extras,
        ]}
      />
    </div>
  );
}

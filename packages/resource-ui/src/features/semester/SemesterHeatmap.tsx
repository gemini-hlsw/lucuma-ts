/**
 * The published semester schedule, drawn as the sheet's cell grid.
 *
 * Small multiples per month, the same arrangement the xrange view uses and for
 * the same reason: the sheet's month rhythm is where its readability comes from,
 * and each chart reflows to the column it is given rather than to a fixed column
 * width. That is the half of this the DOM table it replaces could never do - its
 * columns were pinned at 1.5rem, so it was the same size on a phone as on a 4K
 * display and scrolled sideways on both.
 */
// Core must initialize before the modules extend its series prototypes.
import 'highcharts/es-modules/masters/highcharts.src.js';
import 'highcharts/es-modules/masters/modules/heatmap.src.js';
// The engineering-use hatch on cells (timelineOptions engineeringPattern).
import 'highcharts/es-modules/masters/modules/pattern-fill.src.js';

import { Chart } from '@highcharts/react';
import type { ChartClickEventObject, Options, Point, PointerEventObject } from 'highcharts';
import { type JSX, useMemo } from 'react';

import { useOpenNight } from '@/app/useOpenNight';
import { addDays } from '@/domain/semester';
import { buildSemesterCells, type CellKind, type SemesterCellRow } from '@/domain/semesterCells';
import type { SemesterTimeline as Timeline, TimelineMonth } from '@/domain/semesterTimeline';
import type { Site } from '@/domain/types';
import { type LegendExtra, TimelineLegendBar } from '@/features/timeline/TimelineChart';

import { buildSemesterHeatmapOptions, type HeatmapPointCustom } from './semesterHeatmapOptions';

const escapeHtml = (value: string): string =>
  value.replace(
    /[&<>"']/g,
    (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ?? character,
  );

const KIND_HEADING = {
  MOUNTED: '',
  STATE: '',
  UNSCHEDULED: 'No instrument scheduled',
  CLOSED: 'Closed',
  MIXED: 'Changes during the night',
  EMPTY: 'Nothing recorded',
} satisfies Record<CellKind, string>;

/** The kinds whose heading is the cell's own label - a name, not a category. */
const named = (kind: CellKind): boolean => kind === 'MOUNTED' || kind === 'STATE';

/**
 * A cell's tooltip.
 *
 * A night, not a span - which is the difference from the xrange tooltip and the
 * reason it is written here rather than shared. A mixed night says so and points
 * at the night view, because that is the only place the change is legible.
 */
const cellTooltip = (custom: HeatmapPointCustom): string => {
  const heading = named(custom.kind) ? custom.label : KIND_HEADING[custom.kind];
  const rows = [
    `<div style="font-weight:600">${escapeHtml(heading)}</div>`,
    `<div style="color:var(--timeline-muted-text)">${escapeHtml(custom.rowLabel)}</div>`,
    `<div style="margin-top:4px">Night of ${escapeHtml(custom.eveningDate)}</div>`,
  ];
  if (custom.usageLabel !== null) {
    rows.push(`<div style="margin-top:4px">${escapeHtml(custom.usageLabel)}</div>`);
  }
  if (named(custom.kind) && custom.runLength > 1) {
    rows.push(`<div style="color:var(--timeline-muted-text)">${custom.runLength} nights from here</div>`);
  }
  if (custom.kind === 'MIXED') {
    rows.push(`<div style="color:var(--timeline-muted-text)">Open the night view to see where</div>`);
  }
  if (!named(custom.kind) && custom.label !== '' && custom.label !== KIND_HEADING[custom.kind]) {
    rows.push(`<div style="margin-top:4px">${escapeHtml(custom.label)}</div>`);
  }
  return `<div style="min-width:9rem;line-height:1.35">${rows.join('')}</div>`;
};

function MonthGrid({ month, site }: { month: TimelineMonth; site: Site }): JSX.Element {
  const openNight = useOpenNight();

  // Explicit memoization, deliberately: the options embed Highcharts callbacks
  // that receive `this`, which bails the React Compiler out of memoizing them,
  // and a fresh options object per render means a Highcharts `update()` per
  // render - which the heatmap answers by garbling its cells (Highcharts 12).
  // Stability here is semantic, not a performance nicety: the chart must only
  // ever see new options when what it draws changes.
  const options: Options = useMemo(() => {
    const rows: readonly SemesterCellRow[] = buildSemesterCells({ rows: month.rows, nights: month.nights });

    // Every cell is a night, so every cell opens its night view - the same
    // jump the calendar squares make. A column is one night on every row, so
    // the row clicked does not matter, only the column.
    const openColumn = (column: number): void => {
      const evening = rows[0]?.cells[column]?.eveningDate;
      if (evening !== undefined) {
        openNight(addDays(evening, 1));
      }
    };

    const base = buildSemesterHeatmapOptions({
      rows,
      nights: month.nights,
      bands: month.bands,
      site,
      seriesName: month.label,
    });
    return {
      ...base,
      chart: {
        ...base.chart,
        events: {
          // Spread first: the builder wires `render` (band-label fitting), and
          // replacing the object would silently drop it.
          ...base.chart?.events,
          // A click the cells never see - the closure band hangs its label over
          // them and takes the pointer - still lands on a column. The callback
          // is declared over the plain pointer event, but a chart click always
          // carries the axis coordinates.
          click(event: PointerEventObject) {
            const value = (event as ChartClickEventObject).xAxis[0]?.value;
            if (value !== undefined) {
              openColumn(Math.round(value));
            }
          },
        },
      },
      plotOptions: {
        ...base.plotOptions,
        heatmap: {
          ...base.plotOptions?.heatmap,
          cursor: 'pointer' as const,
          point: {
            events: {
              // A heatmap point's x is its column index.
              click(this: Point) {
                openColumn(this.x);
              },
            },
          },
        },
      },
      tooltip: {
        ...base.tooltip,
        formatter() {
          const custom = (this as unknown as { point?: { custom?: HeatmapPointCustom } }).point?.custom;
          return custom === undefined ? '' : cellTooltip(custom);
        },
      },
    };
  }, [month, site, openNight]);

  // The chart remounts when its window moves, and only then - the same rule
  // TimelineChart applies, and doubly load-bearing here: Highcharts 12
  // answers an in-place heatmap update by garbling the cell geometry, so a
  // site or semester switch must be a fresh chart, never an update.
  const windowKey = `${String(month.interval.start)}:${String(month.interval.end)}`;

  return (
    // min-w-0 overrides a grid item's default min-width:auto, so the column is
    // free to narrow before the chart follows rather than the two racing.
    <section className="min-w-0" aria-label={month.label} data-testid={`semester-heatmap-${month.label}`}>
      <h3 className="mb-1 text-xs font-semibold tracking-wide text-foreground-secondary uppercase">{month.label}</h3>
      <Chart key={windowKey} options={options} />
    </section>
  );
}

/** The two keys only a whole-night cell can need. */
const cellLegendExtras = (rows: readonly SemesterCellRow[]): readonly LegendExtra[] => {
  const kinds = new Set(rows.flatMap((row) => row.cells.map((cell) => cell.kind)));
  return [
    ...(kinds.has('MIXED')
      ? [
          {
            key: 'MIXED',
            label: 'Changes during the night',
            swatch: {
              backgroundColor: 'var(--schedule-mixed)',
              border: '1px solid var(--schedule-mixed-edge)',
            },
          },
        ]
      : []),
    ...(kinds.has('EMPTY')
      ? [
          {
            key: 'EMPTY',
            label: 'Nothing recorded',
            swatch: { backgroundColor: 'transparent', border: '1px solid var(--timeline-grid)' },
          },
        ]
      : []),
  ];
};

export function SemesterHeatmapLegend({
  timeline,
  telescope = [],
  mode = [],
  too = [],
}: {
  timeline: Timeline;
  /** The page's state section keys; the cell-state keys join the Instruments
   * section, since only subject cells can be mixed or empty. */
  telescope?: readonly LegendExtra[];
  mode?: readonly LegendExtra[];
  too?: readonly LegendExtra[];
}): JSX.Element {
  const cellExtras = cellLegendExtras(
    timeline.months.flatMap((month) => buildSemesterCells({ rows: month.rows, nights: month.nights })),
  );

  return <TimelineLegendBar legend={timeline} telescope={telescope} mode={mode} too={too} extras={cellExtras} />;
}

export function SemesterHeatmap({ timeline, site }: { timeline: Timeline; site: Site }): JSX.Element {
  return (
    <div
      data-testid="semester-heatmap"
      // auto-fit rather than a breakpoint: the shell's sidebar takes width the
      // viewport query cannot see, so the grid reacts to the space it actually has.
      className="grid [grid-template-columns:repeat(auto-fit,minmax(min(30rem,100%),1fr))] gap-x-8 gap-y-5"
    >
      {timeline.months.map((month) => (
        <MonthGrid key={`${month.year}-${month.month}`} month={month} site={site} />
      ))}
    </div>
  );
}

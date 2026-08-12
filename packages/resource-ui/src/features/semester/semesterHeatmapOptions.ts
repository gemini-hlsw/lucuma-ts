/**
 * One month of the semester, drawn as the published sheet's cell grid.
 *
 * ## Why a second view at all
 *
 * The xrange chart draws a block as a block: one point, its true interval, a
 * mid-night change drawn where it happens. That is the honest reading and it is
 * the default. What it cannot do is line every night up in a column you can
 * count along, which is how the published sheet is read and how it is checked.
 *
 * So this view decomposes the same blocks into one cell per night - the thing
 * `timeline.ts` argues against doing *by default*, done deliberately, in one
 * view, for the one job it is better at. The decomposition happens in
 * `domain/semesterCells.ts`, from the placed timeline rows, so a cell and a bar
 * cannot disagree about what a night says.
 *
 * ## What a cell costs
 *
 * A whole-night cell cannot show a night that changes partway through, so it
 * marks it `MIXED` and the night view is where the change is legible. That is
 * PLAN.md §3.1's own corollary - "show the single value when uniform, otherwise
 * mark it mixed" - and it is why this is a toggle rather than a replacement.
 */
import type {
  AxisLabelsFormatterContextObject,
  Options,
  PatternObject,
  PointOptionsObject,
  XAxisPlotBandsOptions,
} from 'highcharts';

import type { CellKind, SemesterCell, SemesterCellRow } from '@/domain/semesterCells';
import { SITE_TIME_ZONES } from '@/domain/siteTime';
import { clip, stateRowCount, type TimelineBand, type TimelineNight } from '@/domain/timeline';
import type { Site } from '@/domain/types';
import {
  engineeringPattern,
  fitBandLabels,
  groupedRowLayout,
  headingLabelHtml,
  INSTRUMENT_INK_DARK,
  instrumentColor,
  instrumentInk,
  stateFill,
  stateFillInk,
  UNSCHEDULED_LABEL,
  USAGE_LABEL,
} from '@/features/timeline/timelineOptions';

const ROW_HEIGHT = 26;
const BOTTOM_MARGIN = 26;
const LABEL_GUTTER = 92;
const TOP_MARGIN = 8;

/** Rough advance of the label font (0.68rem, semibold), for the fit test. */
const LABEL_CHAR_WIDTH = 6.2;
const LABEL_PADDING = 4;

/**
 * The fill for a cell.
 *
 * A mounted night takes its instrument's hue, which is the whole point of the
 * view: the sheet encodes identity as colour and so does this. Everything else
 * is an absence or a question and takes a chrome token, never an instrument one.
 */
export const cellColor = (cell: SemesterCell): string | PatternObject => {
  switch (cell.kind) {
    case 'MOUNTED':
      if (cell.instrument === null) {
        return 'var(--schedule-ghost-fill)';
      }
      // Usability is a treatment over the identity hue, exactly as the xrange
      // draws it: hatched for engineering use, hollow for not available.
      if (cell.usage === 'ENGINEERING') {
        return engineeringPattern(cell.instrument);
      }
      if (cell.usage === 'UNAVAILABLE') {
        return 'transparent';
      }
      return instrumentColor(cell.instrument);
    // A recorded telescope state is monochrome, like the xrange's state rows:
    // quiet for the ordinary value, bright for a notable one, never a hue.
    case 'STATE':
      return stateFill(cell.notable);
    // Only the Telescope row's cells: the one solid red statement of a closure.
    case 'CLOSED':
      return 'var(--schedule-closed)';
    case 'MIXED':
      return 'var(--schedule-mixed)';
    // An unrecorded night and a night with no instrument scheduled are both
    // absences and both drawn hollow. They differ in the tooltip, not the fill:
    // inventing a colour for "nothing recorded" would make it look like a state.
    default:
      return 'var(--schedule-ghost-fill)';
  }
};

/** The outline an unavailable instrument's hollow cell keeps its hue on. */
export const cellBorder = (cell: SemesterCell): string | null =>
  cell.kind === 'MOUNTED' && cell.instrument !== null && cell.usage === 'UNAVAILABLE'
    ? instrumentColor(cell.instrument)
    : null;

/**
 * The label ink for a cell.
 *
 * The instrument fills are too bright for one fixed ink - white manages 1.3:1
 * on GSAOI's lime - so a mounted cell takes the ink measured for its fill, the
 * same choice the xrange makes. The chrome fills are all dark washes: absences
 * write muted, as the xrange writes them, and the closure and mixed washes
 * take full text.
 */
export const cellInk = (cell: SemesterCell): string => {
  if (cell.kind === 'MOUNTED' && cell.instrument !== null) {
    return cell.usage === 'UNAVAILABLE' ? 'var(--timeline-muted-text)' : instrumentInk(cell.instrument);
  }
  if (cell.kind === 'STATE') {
    return stateFillInk(cell.notable);
  }
  return cell.kind === 'CLOSED' || cell.kind === 'MIXED' ? 'var(--timeline-text)' : 'var(--timeline-muted-text)';
};

/** The stroke, handed to the stylesheet by class where a fill cannot express it. */
const cellClass = (kind: CellKind): string | undefined => {
  switch (kind) {
    case 'UNSCHEDULED':
      return 'schedule-ghost';
    case 'MIXED':
      return 'schedule-mixed';
    case 'EMPTY':
      return 'schedule-empty';
    default:
      return undefined;
  }
};

/** Extra per-point data carried through Highcharts to the tooltip. */
export interface HeatmapPointCustom {
  readonly rowLabel: string;
  readonly kind: CellKind;
  readonly label: string;
  /** "Engineering use" or "Not available"; null for ordinary science use. */
  readonly usageLabel: string | null;
  readonly description: string;
  readonly eveningDate: string;
  /** Nights the run this cell heads covers; 0 unless it heads one. */
  readonly runLength: number;
  /**
   * Cells of width the label may use, so the fit test can measure. A dark-ink
   * label gets only the run's own cells: past its fill lie the near-black
   * ghost cells, where dark ink vanishes. Light ink reads on those too, so a
   * light-ink label keeps the full spill.
   */
  readonly labelSpan: number;
}

export interface HeatmapPoint extends PointOptionsObject {
  readonly custom: HeatmapPointCustom;
}

/** What the data-label formatter needs off the rendered point. */
interface PointContext {
  readonly custom?: HeatmapPointCustom;
  readonly shapeArgs?: { readonly width?: number };
}

const toPoint = (cell: SemesterCell, x: number, y: number, rowLabel: string): HeatmapPoint => {
  const ink = cellInk(cell);
  const span = ink === INSTRUMENT_INK_DARK ? Math.min(cell.labelSpan, cell.runLength) : cell.labelSpan;
  const border = cellBorder(cell);
  return {
    x,
    y,
    // Heatmap wants a value even when the colour is explicit; the axis is off, so
    // it is never read as a magnitude.
    value: 1,
    color: cellColor(cell),
    ...(cellClass(cell.kind) === undefined ? {} : { className: cellClass(cell.kind) }),
    ...(border === null ? {} : { borderColor: border, borderWidth: 1.5 }),
    dataLabels: { style: { color: ink } },
    custom: {
      rowLabel,
      kind: cell.kind,
      label: cell.label === '' && cell.kind === 'UNSCHEDULED' ? UNSCHEDULED_LABEL : cell.label,
      usageLabel: cell.usage !== null && cell.usage !== 'SCIENCE' ? USAGE_LABEL[cell.usage] : null,
      description: cell.description,
      eveningDate: cell.eveningDate,
      runLength: cell.startsRun ? cell.runLength : 0,
      labelSpan: cell.startsRun ? span : 0,
    },
  };
};

/** The flat point list for one month's grid. Exported for testing. */
export const buildHeatmapPoints = (rows: readonly SemesterCellRow[]): readonly HeatmapPoint[] =>
  rows.flatMap((row, y) => row.cells.map((cell, x) => toPoint(cell, x, y, row.label)));

/**
 * Weekend columns, shaded behind the cells.
 *
 * Category axis, so a band runs from one half-step before the column to one
 * half-step after - which is what makes it cover the column rather than sit on
 * its boundary.
 */
export const buildWeekendBands = (cells: readonly SemesterCell[]): XAxisPlotBandsOptions[] =>
  cells
    .map((cell, index) => ({ cell, index }))
    .filter(({ cell }) => cell.isWeekend)
    .map(({ index }) => ({
      from: index - 0.5,
      to: index + 0.5,
      color: 'var(--schedule-weekend)',
      className: 'schedule-weekend',
    }));

/**
 * The shutdown wash and its phrase, once across the whole closure.
 *
 * The same treatment every chart view gives a closure: the columns the band
 * touches are washed - never each row's cells repainted - and the reason is
 * written once over the wash. A cell's own data label could not carry it:
 * "Telescope Shutdown A&G Maintenance" over a six-night closure is thirty-four
 * characters in sixty pixels, so the fit test would drop it and the reason
 * would disappear from the page.
 *
 * A closure too narrow even for the band label loses it at render instead
 * (`fitBandLabels`) - the legend and the Telescope row's tooltips carry what
 * it said.
 */
export const buildClosureBands = (
  nights: readonly TimelineNight[],
  bands: readonly TimelineBand[],
): XAxisPlotBandsOptions[] =>
  bands.flatMap((band) => {
    const touched = nights
      .map((night, index) => ({ night, index }))
      .filter(({ night }) => clip(band.interval, night.interval) !== null)
      .map(({ index }) => index);
    const first = touched[0];
    const last = touched.at(-1);
    if (first === undefined || last === undefined) {
      return [];
    }
    return [
      {
        from: first - 0.5,
        to: last + 0.5,
        color: 'var(--schedule-band)',
        borderColor: 'var(--schedule-band-edge)',
        borderWidth: 1,
        zIndex: 5,
        className: 'schedule-closure-band',
        label: {
          text: band.label,
          style: { color: 'var(--timeline-text)', fontSize: '0.62rem', fontWeight: '600' },
          rotation: 0,
          align: 'center' as const,
          verticalAlign: 'top' as const,
          y: 12,
        },
      },
    ];
  });

export interface SemesterHeatmapModel {
  readonly rows: readonly SemesterCellRow[];
  /** The month's nights and its telescope-wide closures, for the wash. */
  readonly nights: readonly TimelineNight[];
  readonly bands: readonly TimelineBand[];
  readonly site: Site;
  readonly seriesName: string;
}

/**
 * Day numbers, thinned to what the container can hold.
 *
 * Same problem the xrange has and the same reason it is solved by choosing tick
 * positions rather than by `labels.step`: left to drop labels on collision,
 * Highcharts numbers the first nine days of a month and then nothing.
 */
export const dayTickPositions = (nightCount: number, step: number): number[] =>
  Array.from({ length: nightCount }, (_, index) => index).filter((index) => index % step === 0);

const PX_PER_LABEL = 15;
const PX_PER_LABEL_TIGHT = 8;

export const widthForEveryNight = (nightCount: number): number => nightCount * PX_PER_LABEL;
export const widthForEveryOtherNight = (nightCount: number): number => nightCount * PX_PER_LABEL_TIGHT;

/** Builds the Highcharts options for one month block of the semester heatmap. */
export const buildSemesterHeatmapOptions = ({
  rows,
  nights,
  bands,
  site,
  seriesName,
}: SemesterHeatmapModel): Options => {
  // Everything derives from the rows, matching the xrange builder: a list
  // passed alongside the data is a mismatch waiting for a window whose state
  // rows differ. The state rows and subjects sit under the same group
  // headings the charts draw.
  const headerRows = stateRowCount(rows);
  const { categories, headingPositions, offsetFor } = groupedRowLayout(
    rows.map((row) => row.label),
    headerRows,
  );
  const cells = rows[0]?.cells ?? [];
  const nightCount = cells.length;

  return {
    chart: {
      type: 'heatmap',
      events: {
        render() {
          fitBandLabels(this);
        },
      },
      backgroundColor: 'transparent',
      height: TOP_MARGIN + BOTTOM_MARGIN + categories.length * ROW_HEIGHT,
      marginTop: TOP_MARGIN,
      marginBottom: BOTTOM_MARGIN,
      marginLeft: LABEL_GUTTER,
      marginRight: 8,
      spacing: [0, 0, 0, 0],
      style: { fontFamily: 'inherit' },
    },
    time: { timezone: SITE_TIME_ZONES[site] },
    title: { text: undefined },
    credits: { enabled: false },
    legend: { enabled: false },
    // The hidden block table carries the accessible reading. Announcing a grid
    // of nine hundred points would bury sixteen facts.
    accessibility: { enabled: false },
    // Colour is set per point, so the axis exists only to stop Highcharts
    // deriving one and repainting the cells by value.
    colorAxis: { visible: false, min: 0, max: 1 },
    xAxis: {
      categories: cells.map((cell) => String(Number(cell.eveningDate.slice(8, 10)))),
      tickPositions: dayTickPositions(nightCount, 1),
      tickLength: 0,
      lineColor: 'var(--timeline-grid)',
      gridLineWidth: 0,
      labels: {
        // Zero padding: Highcharts reserves it per label and blanks any whose box
        // overlaps a neighbour, which at ~16px a night drops most of the month.
        padding: 0,
        style: { color: 'var(--timeline-muted-text)', fontSize: '0.65rem' },
        y: 16,
      },
      plotBands: [...buildWeekendBands(cells), ...buildClosureBands(nights, bands)],
    },
    yAxis: {
      categories: [...categories],
      reversed: true,
      min: 0,
      max: categories.length - 1,
      title: { text: undefined },
      gridLineWidth: 0,
      lineWidth: 0,
      tickLength: 0,
      labels: {
        style: { color: 'var(--timeline-text)', fontSize: '0.72rem', fontWeight: '600' },
        // Group headings read as headings; every data row keeps the
        // full-strength label, matching the xrange charts (Dan, 2026-08-11).
        formatter(this: AxisLabelsFormatterContextObject) {
          return headingPositions.has(this.pos) ? headingLabelHtml(String(this.value)) : String(this.value);
        },
      },
    },
    tooltip: {
      useHTML: true,
      outside: true,
      backgroundColor: 'var(--timeline-tooltip-bg)',
      borderColor: 'var(--timeline-tooltip-border)',
      borderRadius: 6,
      shadow: false,
      style: { color: 'var(--timeline-text)', fontSize: '0.75rem' },
    },
    plotOptions: {
      heatmap: {
        // One pixel of border on every cell is the sheet's grid, and the whole
        // reason this reads as a spreadsheet where the xrange does not.
        //
        // A light translucent rule, not the dark chrome one: the sheet rules its
        // cells in white over the colour, and a dark line over a bright fill cuts
        // a run into thirty-one boxes instead of ruling one run.
        borderWidth: 1,
        borderColor: 'var(--timeline-block-border)',
        states: { hover: { brightness: 0.14 } },
      },
    },
    responsive: {
      rules: [
        {
          condition: { maxWidth: widthForEveryNight(nightCount) },
          chartOptions: { xAxis: { tickPositions: dayTickPositions(nightCount, 2) } },
        },
        {
          condition: { maxWidth: widthForEveryOtherNight(nightCount) },
          chartOptions: {
            xAxis: { tickPositions: dayTickPositions(nightCount, 5) },
            yAxis: { labels: { style: { fontSize: '0.65rem' } } },
          },
        },
      ],
    },
    series: [
      {
        type: 'heatmap',
        name: seriesName,
        data: buildHeatmapPoints(rows).map((point) =>
          point.y === undefined || point.y === null ? point : { ...point, y: offsetFor(point.y) },
        ) as PointOptionsObject[],
        dataLabels: {
          enabled: true,
          overflow: 'allow',
          crop: false,
          align: 'left',
          verticalAlign: 'middle',
          x: 3,
          // A run is labelled once, at its head, and the label may spill across
          // the cells the run covers plus any unlabelled ones after it. Anything
          // that still will not fit is dropped rather than truncated - "Eng…"
          // tells a reader nothing the tooltip would not tell them better.
          formatter() {
            const point = (this as unknown as { point?: PointContext }).point;
            const custom = point?.custom;
            if (custom === undefined || custom.labelSpan === 0 || custom.label === '') {
              return '';
            }
            const available = (point?.shapeArgs?.width ?? 0) * custom.labelSpan - LABEL_PADDING * 2;
            return custom.label.length * LABEL_CHAR_WIDTH <= available ? custom.label : '';
          },
          style: {
            color: 'var(--timeline-text)',
            fontSize: '0.68rem',
            fontWeight: '600',
            textOutline: 'none',
            // A label is decoration and must not take the pointer - without
            // this, hovering the cells beneath "GHOST" lands on the <text> and
            // the tooltip never comes. Same rule as timelineOptions.ts.
            pointerEvents: 'none',
          },
        },
      },
    ],
  };
};

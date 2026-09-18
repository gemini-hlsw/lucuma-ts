import type {
  AxisLabelsFormatterContextObject,
  Options,
  PatternObject,
  XAxisOptions,
  XAxisPlotBandsOptions,
  XrangePointOptionsObject,
} from 'highcharts';
import type { CSSProperties } from 'react';

import { displayTimeZone, eveningLabel, firstEveningDate, lastEveningDate, type TimeDisplay } from '@/domain/siteTime';
import {
  type BlockState,
  isNotableState,
  NOTABLE_MODE,
  NOTABLE_TOO,
  stateRowCount,
  TELESCOPE_MODE_LABEL,
  type TimelineBand,
  type TimelineBlock,
  type TimelineRow,
  TOO_SUPPORT_LABEL,
  USAGE_LABEL,
} from '@/domain/timeline';

// Re-exported beside the fills that draw it, so chart code has one import.
export { USAGE_LABEL } from '@/domain/timeline';
import type { Closure, Instrument, ModeBlock, Site, TelescopeModeType, TooBlock, TooSupport } from '@/domain/types';

/** Keyed by the enum, so a new instrument fails to compile until it has a colour. */
const INSTRUMENT_COLOR = {
  ACQ_CAM: 'var(--instrument-acq-cam)',
  ALOPEKE: 'var(--instrument-alopeke)',
  ALTAIR: 'var(--instrument-altair)',
  CAL_ZORRO: 'var(--instrument-cal-zorro)',
  CANOPUS: 'var(--instrument-canopus)',
  ENGINEERING: 'var(--instrument-engineering)',
  F2: 'var(--instrument-f2)',
  GCAL: 'var(--instrument-gcal)',
  GHOST: 'var(--instrument-ghost)',
  GMOS: 'var(--instrument-gmos)',
  GNIRS: 'var(--instrument-gnirs)',
  GPI: 'var(--instrument-gpi)',
  GSAOI: 'var(--instrument-gsaoi)',
  IGRINS2: 'var(--instrument-igrins2)',
  IQUEYE: 'var(--instrument-iqueye)',
  MAROON_X: 'var(--instrument-maroon-x)',
  NIRI: 'var(--instrument-niri)',
  SCORPIO: 'var(--instrument-scorpio)',
  UNKNOWN: 'var(--instrument-unknown)',
} satisfies Record<Instrument, string>;

const INSTRUMENT_INK_LIGHT = 'var(--instrument-ink-light)';

/** Legible only on the bright instrument fill it was chosen for; light ink reads on every chrome fill. */
const INSTRUMENT_INK_DARK = 'var(--instrument-ink-dark)';

/** Whichever ink clears 4.5:1 on that fill. */
const INSTRUMENT_INK = {
  ACQ_CAM: INSTRUMENT_INK_DARK,
  ALOPEKE: INSTRUMENT_INK_DARK,
  ALTAIR: INSTRUMENT_INK_LIGHT,
  CAL_ZORRO: INSTRUMENT_INK_DARK,
  CANOPUS: INSTRUMENT_INK_LIGHT,
  ENGINEERING: INSTRUMENT_INK_DARK,
  F2: INSTRUMENT_INK_DARK,
  GCAL: INSTRUMENT_INK_DARK,
  GHOST: INSTRUMENT_INK_DARK,
  GMOS: INSTRUMENT_INK_DARK,
  GNIRS: INSTRUMENT_INK_DARK,
  GPI: INSTRUMENT_INK_DARK,
  GSAOI: INSTRUMENT_INK_DARK,
  IGRINS2: INSTRUMENT_INK_DARK,
  IQUEYE: INSTRUMENT_INK_DARK,
  MAROON_X: INSTRUMENT_INK_LIGHT,
  NIRI: INSTRUMENT_INK_DARK,
  SCORPIO: INSTRUMENT_INK_DARK,
  UNKNOWN: INSTRUMENT_INK_DARK,
} satisfies Record<Instrument, string>;

/** Published spellings, so a legend reads as the sheet does, not as the enum. */
export const INSTRUMENT_LABEL = {
  ACQ_CAM: 'AcqCam',
  ALOPEKE: "'Alopeke",
  ALTAIR: 'Altair',
  CAL_ZORRO: 'Zorro',
  CANOPUS: 'Canopus',
  ENGINEERING: 'Engineering',
  F2: 'F2',
  GCAL: 'GCAL',
  GHOST: 'GHOST',
  GMOS: 'GMOS',
  GNIRS: 'GNIRS',
  GPI: 'GPI',
  GSAOI: 'GSAOI',
  IGRINS2: 'IGRINS2',
  IQUEYE: 'IQUEYE',
  MAROON_X: 'Maroon-X',
  NIRI: 'NIRI',
  SCORPIO: 'SCORPIO',
  UNKNOWN: 'Unknown',
} satisfies Record<Instrument, string>;

export const instrumentColor = (instrument: Instrument): string => INSTRUMENT_COLOR[instrument];

export const instrumentInk = (instrument: Instrument): string => INSTRUMENT_INK[instrument];

export const UNSCHEDULED_LABEL = 'No instrument scheduled';
/** The one name a closure has everywhere; the reason rides on the record, never on the key. */
export const CLOSURE_LABEL = 'Closed';

/** Hue means instrument identity and nothing else, so the state rows are two neutrals: quiet and bright. */
export const stateFill = (notable: boolean): string => (notable ? 'var(--state-notable)' : 'var(--state-routine)');

/** The bright neutral takes dark text, the quiet one white (global.css). */
export const stateFillInk = (notable: boolean): string => (notable ? INSTRUMENT_INK_DARK : INSTRUMENT_INK_LIGHT);

const modeColor = (mode: TelescopeModeType): string => stateFill(NOTABLE_MODE[mode]);

const tooColor = (too: TooSupport): string => stateFill(NOTABLE_TOO[too]);

/** A key a view adds to the shared legend, rather than growing a second one that drifts from it. */
export interface LegendExtra {
  readonly key: string;
  readonly label: string;
  readonly swatch: CSSProperties;
}

/** Open only: a Closed span draws in the closure red, which the "Closed" key already names. */
export const telescopeLegendExtras = (closures: readonly Closure[]): LegendExtra[] =>
  closures.some((closure) => closure.port === null && closure.availability === 'OPEN')
    ? [{ key: 'telescope-open', label: 'Open', swatch: { backgroundColor: stateFill(false) } }]
    : [];

export const modeLegendExtras = (modeBlocks: readonly ModeBlock[]): LegendExtra[] =>
  [...new Set(modeBlocks.map((block) => block.mode))].map((mode) => ({
    key: `mode-${mode}`,
    label: TELESCOPE_MODE_LABEL[mode],
    swatch: { backgroundColor: modeColor(mode) },
  }));

export const tooLegendExtras = (tooBlocks: readonly TooBlock[]): LegendExtra[] =>
  [...new Set(tooBlocks.map((block) => block.tooSupport))].map((too) => ({
    key: `too-${too}`,
    label: TOO_SUPPORT_LABEL[too],
    swatch: { backgroundColor: tooColor(too) },
  }));

/** Naming the washes is what stops a reader taking the largest painted areas for schedule facts. */
export const skyLegendExtras = (): LegendExtra[] => [
  { key: 'daylight', label: 'Daylight', swatch: { backgroundColor: 'var(--night-daylight-wash)' } },
  { key: 'twilight', label: 'Twilight', swatch: { backgroundColor: 'var(--night-twilight-wash)' } },
];

export const calendarLegendExtras = (options: {
  readonly weekend?: boolean;
  readonly now?: string | false;
  readonly noData?: boolean;
}): LegendExtra[] => [
  ...(options.weekend === true
    ? [{ key: 'weekend', label: 'Weekend', swatch: { backgroundColor: 'var(--schedule-weekend)' } }]
    : []),
  ...(typeof options.now === 'string'
    ? [
        {
          key: 'now',
          label: options.now,
          // A line, not a fill - the swatch says so rather than reading as a block.
          swatch: { backgroundColor: 'transparent', borderLeft: '2px solid var(--schedule-today)' },
        },
      ]
    : []),
  ...(options.noData === true
    ? [
        {
          key: 'no-data',
          label: 'Nothing recorded',
          swatch: { backgroundColor: 'var(--schedule-no-data)' },
        },
      ]
    : []),
];

/** The instrument's own hue hatched with its measured ink: identity on the hue, stripes say reserved. */
const engineeringPattern = (instrument: Instrument): PatternObject => ({
  pattern: {
    path: { d: 'M 0 8 L 8 0', strokeWidth: 2.5 },
    width: 8,
    height: 8,
    color: INSTRUMENT_INK[instrument],
    backgroundColor: INSTRUMENT_COLOR[instrument],
  },
});

/** An unavailable instrument goes hollow, so it reads as neither a plain run nor the grey ghost. */
const blockColor = (block: TimelineBlock): string | PatternObject => {
  if (block.state === 'TELESCOPE') {
    // Closed takes the reserved closure red, the one meaning red ever has on these charts.
    return block.variant === 'CLOSED' ? 'var(--schedule-closed)' : stateFill(false);
  }
  if (block.state === 'TOO' || block.state === 'MODE' || block.state === 'SUBSYSTEM') {
    return stateFill(isNotableState(block));
  }
  if (block.instrument === null) {
    return 'var(--schedule-ghost-fill)';
  }
  if (block.usage === 'ENGINEERING') {
    return engineeringPattern(block.instrument);
  }
  if (block.usage === 'UNAVAILABLE') {
    return 'transparent';
  }
  return INSTRUMENT_COLOR[block.instrument];
};

const blockBorder = (block: TimelineBlock): string | null =>
  block.state === 'MOUNTED' && block.instrument !== null && block.usage === 'UNAVAILABLE'
    ? INSTRUMENT_COLOR[block.instrument]
    : null;

const blockInk = (block: TimelineBlock): string => {
  if (block.state === 'TELESCOPE') {
    return block.variant === 'CLOSED' ? 'var(--timeline-text)' : stateFillInk(false);
  }
  if (block.state === 'TOO' || block.state === 'MODE' || block.state === 'SUBSYSTEM') {
    return stateFillInk(isNotableState(block));
  }
  if (block.instrument === null || block.usage === 'UNAVAILABLE') {
    return 'var(--timeline-muted-text)';
  }
  return INSTRUMENT_INK[block.instrument];
};

export interface TimelinePointCustom {
  readonly blockId: string;
  readonly rowLabel: string;
  readonly label: string;
  readonly state: BlockState;
  /** "Engineering use" or "Not available"; null for ordinary science use. */
  readonly usageLabel: string | null;
  /** When the block runs, phrased for the window: dates, or clock times. */
  readonly rangeLabel: string;
  /** How long it runs, phrased for the window: nights, or hours. */
  readonly lengthLabel: string;
  readonly detail: string | null;
  readonly clipped: boolean;
}

export interface TimelinePoint extends XrangePointOptionsObject {
  readonly custom: TimelinePointCustom;
  /** The xrange series honours a per-point outline, though the typings only declare the series option. */
  readonly borderColor?: string;
  readonly borderWidth?: number;
}

/** The fit maths need the number, and `Number.parseFloat` on a `var(...)` is NaN. */
const DENSE_REM = 0.75;
export const DENSE = `${String(DENSE_REM)}rem`;

/** DESIGN.md's tick tier, mirroring `--text-2xs`: numeric axis ticks and nothing else. */
export const TICK = '0.625rem';

/** A label the reader is meant to read: row headings, band names, bar labels. */
export const CHART_LABEL = { color: 'var(--timeline-text)', fontSize: DENSE, fontWeight: '600' } as const;

/** A label that names the chart's own scaffolding rather than the schedule: axis headings, captions. */
export const MUTED_LABEL = { color: 'var(--timeline-muted-text)', fontSize: DENSE } as const;

/** A numeric axis tick, the only thing DESIGN.md lets down to the tick tier. */
export const MUTED_TICK = { color: 'var(--timeline-muted-text)', fontSize: TICK } as const;

/** The now marker's own label, which takes the marker's colour so the two read as one thing. */
export const NOW_LABEL = { color: 'var(--schedule-today)', fontSize: DENSE, fontWeight: '700' } as const;

/**
 * Advance of semibold label type, in px per rem of font size, and an over-estimate on purpose: a
 * label the estimate calls narrower than it draws gets drawn and clipped. The short all-caps
 * instrument names are the widest per character, so they set it, not the sentence-shaped labels.
 * It bounds label-shaped text, not any string - a closure reason in capitals can still beat it.
 */
export const LABEL_ADVANCE_PER_REM = 12.4;

/** The root size the measured constants here were taken against. */
export const BASE_ROOT_PX = 16;

/** The app sets no root size, so this is the reader's own browser setting and every rem below tracks it. */
const rootFontSizePx = (): number =>
  Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || BASE_ROOT_PX;

/** A rem in the pixels chart options take, since Highcharts measures in numbers rather than lengths. */
export const readerPx = (rem: number): number => rem * rootFontSizePx();

/** Over-estimated width of `characters` of label type set at `fontRem`, in the reader's own pixels. */
const labelWidthPx = (characters: number, fontRem: number, rootPx: number): number =>
  characters * fontRem * (rootPx / BASE_ROOT_PX) * LABEL_ADVANCE_PER_REM;

const LABEL_PADDING = 4;

/** Dropped rather than truncated: a clipped label costs the row its identity and says nothing. */
const labelIfItFits = (label: string, availablePx: number, rootPx: number): string =>
  labelWidthPx(label.length, DENSE_REM, rootPx) <= availablePx ? label : '';

/** Highcharts wraps a band label at spaces and hyphens, so "In-Situ Wash" can clip to "In-". */
const longestUnbreakable = (text: string): number =>
  Math.max(0, ...text.split(/\s+/u).flatMap((word) => word.split(/(?<=-)/u).map((part) => part.length)));

/** Structural, because Highcharts does not type `Axis.plotLinesAndBands`. */
export interface BandFitChart {
  readonly xAxis: readonly {
    toPixels(value: number, paneCoordinates: boolean): number;
    readonly plotLinesAndBands?: readonly {
      readonly options: {
        readonly from?: number;
        readonly to?: number;
        readonly label?: { readonly text?: string; readonly style?: { readonly fontSize?: string } };
      };
      readonly label?: { show(): unknown; hide(): unknown };
    }[];
  }[];
}

/** Called post-render, because only the rendered chart knows the band pixel width. */
export const fitBandLabels = (chart: BandFitChart, rootPx: number): void => {
  for (const axis of chart.xAxis) {
    for (const band of axis.plotLinesAndBands ?? []) {
      const { from, to, label } = band.options;
      if (band.label === undefined || from === undefined || to === undefined) {
        continue;
      }
      const width = Math.abs(axis.toPixels(to, false) - axis.toPixels(from, false));
      const rem = Number.parseFloat(label?.style?.fontSize ?? '') || DENSE_REM;
      const fits = labelWidthPx(longestUnbreakable(label?.text ?? ''), rem, rootPx) <= width;
      if (fits) {
        band.label.show();
      } else {
        band.label.hide();
      }
    }
  }
};

interface FormatterPoint<C> {
  readonly custom?: C;
  readonly shapeArgs?: { readonly width?: number };
}

/** The one place `point.custom` is cast, so no formatter can describe the payload differently. */
export const formatterPoint = <C>(context: unknown): FormatterPoint<C> | undefined =>
  (context as { point?: FormatterPoint<C> }).point;

/** How a view phrases a block's extent. Nights read differently from months. */
export interface BlockDescriber {
  readonly range: (block: TimelineBlock) => string;
  readonly length: (block: TimelineBlock) => string;
}

/** Both ends are the evening the night begins; `lastEveningDate` because an interval end is exclusive. */
export const eveningDescriber = (site: Site): BlockDescriber => ({
  range: (block: TimelineBlock) => {
    // "7 Aug", no year: a chart window never spans one, and the axis says it.
    const from = eveningLabel(firstEveningDate(site, block.fullInterval), 'dayMonth');
    const to = eveningLabel(lastEveningDate(site, block.fullInterval), 'dayMonth');
    return from === to ? from : `${from} to ${to}`;
  },
  length: (block: TimelineBlock) => `${block.nights} ${block.nights === 1 ? 'night' : 'nights'}`,
});

const toPoint = (block: TimelineBlock, rowIndex: number, describe: BlockDescriber): TimelinePoint => {
  const border = blockBorder(block);
  return {
    x: block.interval.start,
    x2: block.interval.end,
    y: rowIndex,
    color: blockColor(block),
    // The ghost stroke comes from its stylesheet class; an unavailable outline is per point instead.
    ...(block.state === 'UNSCHEDULED' ? { className: 'schedule-ghost' } : {}),
    ...(border === null ? {} : { borderColor: border, borderWidth: 1.5 }),
    dataLabels: { style: { color: blockInk(block) } },
    custom: {
      blockId: block.id,
      rowLabel: block.rowLabel,
      label: block.label === '' ? UNSCHEDULED_LABEL : block.label,
      state: block.state,
      usageLabel: block.usage !== null && block.usage !== 'SCIENCE' ? USAGE_LABEL[block.usage] : null,
      rangeLabel: describe.range(block),
      lengthLabel: describe.length(block),
      detail: block.detail,
      clipped: block.continuesBefore || block.continuesAfter,
    },
  };
};

export const buildTimelinePoints = (rows: readonly TimelineRow[], describe: BlockDescriber): readonly TimelinePoint[] =>
  rows.flatMap((row, rowIndex) => row.blocks.map((block) => toPoint(block, rowIndex, describe)));

interface TimelineChartModel {
  readonly rows: readonly TimelineRow[];
  readonly site: Site;
  readonly describe: BlockDescriber;
  readonly xAxis: XAxisOptions;
  /** Rem: a row has to hold its gutter label at whatever size the reader reads at. */
  readonly rowHeightRem: number;
  /** Rem: the axis labels are drawn in it. */
  readonly bottomMarginRem: number;
  readonly responsive?: Options['responsive'];
  readonly seriesName: string;
  /** Reaches Highcharts as `time.timezone`, so only labels Highcharts itself formats move with it. */
  readonly timeDisplay?: TimeDisplay;
}

const TOP_MARGIN = 8;

const BAR_INSET = 8;

/** How the y axis lays grouped rows out: heading rows over each group. */
interface GroupedRowLayout {
  readonly categories: readonly string[];
  readonly headingPositions: ReadonlySet<number>;
  /** The category index a data row lands on, past the headings. */
  readonly offsetFor: (rowIndex: number) => number;
}

/** The closure band all three views draw; `labelYRem` is the one thing they legitimately differ on. */
export const closureBandPlotBand = (band: TimelineBand, labelYRem: number): XAxisPlotBandsOptions => ({
  from: band.interval.start,
  to: band.interval.end,
  color: 'var(--schedule-band)',
  borderColor: 'var(--schedule-band-edge)',
  borderWidth: 1,
  zIndex: LABELLED_BAND_Z,
  className: 'schedule-closure-band',
  label: {
    text: band.label,
    style: CHART_LABEL,
    rotation: 0,
    align: 'center' as const,
    verticalAlign: 'top' as const,
    y: readerPx(labelYRem),
  },
});

/*
 * Every chart's stacking order, bottom to top: night lines are texture under the week lines that
 * group them; the sun washes cover both; the heading mask hides all three where a heading row runs;
 * a band labelled in that row has to clear the mask; the now marker clears everything.
 */
export const NIGHT_LINE_Z = 1;
export const WEEK_LINE_Z = 2;
export const WASH_Z = 5;
const HEADING_MASK_Z = 6;
export const LABELLED_BAND_Z = 8;
export const MARKER_LINE_Z = 9;

export const GUTTER_HEADINGS = ['Telescope', 'Instruments'] as const;

const [STATE_HEADING, INSTRUMENT_HEADING] = GUTTER_HEADINGS;

/** Not an axis break: a break inflates the adjacent slot and drops its gutter label out of line. */
const groupedRowLayout = (labels: readonly string[], headerRows: number): GroupedRowLayout => {
  if (headerRows === 0) {
    return { categories: [...labels], headingPositions: new Set(), offsetFor: (rowIndex) => rowIndex };
  }
  return {
    categories: [STATE_HEADING, ...labels.slice(0, headerRows), INSTRUMENT_HEADING, ...labels.slice(headerRows)],
    headingPositions: new Set([0, headerRows + 1]),
    offsetFor: (rowIndex) => (rowIndex < headerRows ? rowIndex + 1 : rowIndex + 2),
  };
};

/** Highcharts' own `labels.distance`, which is chrome between the gutter type and the plot. */
const LABEL_DISTANCE = 15;

/**
 * What the gutter reserves for type, in rem, so a reader who raises their font size gets a wider
 * gutter rather than a clipped heading. `labelAdvance.test.ts` measures every string the gutter can
 * print against it, under the letter-spacing WCAG 1.4.12 lets a reader impose.
 */
const GUTTER_TEXT_REM = 7;

export const gutterTextWidth = (): number => readerPx(GUTTER_TEXT_REM);

/**
 * One gutter for all three views, so their plot areas align - the situation Highcharts names as the
 * reason to override its own label-aware sizing at all.
 */
export const labelGutter = (): number => gutterTextWidth() + LABEL_DISTANCE;

/** A gutter heading's dress, tracked in em so it scales with the type; widening it spends the gutter. */
export const HEADING_LABEL = { fontSize: DENSE, fontWeight: '700', letterSpacing: '0.05em' } as const;

const headingLabelHtml = (value: string): string =>
  `<span style="color: var(--timeline-text); font-size: ${HEADING_LABEL.fontSize}; font-weight: ${HEADING_LABEL.fontWeight}; letter-spacing: ${HEADING_LABEL.letterSpacing};">${value.toUpperCase()}</span>`;

export const buildTimelineChart = ({
  rows,
  site,
  describe,
  xAxis,
  rowHeightRem,
  bottomMarginRem,
  responsive,
  seriesName,
  timeDisplay = 'site',
}: TimelineChartModel): Options => {
  // One read for the whole options object, so the bar and band fit tests judge at the same root.
  const rootPx = rootFontSizePx();
  const rowHeight = readerPx(rowHeightRem);
  const bottomMargin = readerPx(bottomMarginRem);
  // Derived from the rows, never passed alongside them, so a category list cannot disagree with the data.
  const headerRows = stateRowCount(rows);
  const { categories, headingPositions, offsetFor } = groupedRowLayout(
    rows.map((row) => row.label),
    headerRows,
  );
  const points = buildTimelinePoints(rows, describe).map((point) =>
    point.y === undefined ? point : { ...point, y: offsetFor(point.y) },
  );

  return {
    chart: {
      type: 'xrange',
      events: {
        render() {
          fitBandLabels(this, rootPx);
        },
      },
      backgroundColor: 'transparent',
      height: TOP_MARGIN + bottomMargin + categories.length * rowHeight,
      marginTop: TOP_MARGIN,
      marginBottom: bottomMargin,
      marginLeft: labelGutter(),
      marginRight: 8,
      spacing: [0, 0, 0, 0],
      style: { fontFamily: 'inherit' },
    },
    // Never the browser zone: a GS night spans two UTC dates, so the viewer zone would shift every label.
    time: { timezone: displayTimeZone(site, timeDisplay) },
    title: { text: undefined },
    credits: { enabled: false },
    legend: { enabled: false },
    // The table view carries the accessible reading; the a11y module would announce every point.
    accessibility: { enabled: false },
    xAxis,
    yAxis: {
      categories: [...categories],
      reversed: true,
      // One opaque strip per heading row: an xAxis band spans the full plot height and painted through them.
      plotBands: [...headingPositions].map((position) => ({
        from: position - 0.5,
        to: position + 0.5,
        color: 'var(--color-canvas)',
        zIndex: HEADING_MASK_Z,
        className: 'timeline-heading-mask',
      })),
      // Pinned to the row count, or Highcharts drops a row with nothing on it and stretches the rest.
      min: 0,
      max: categories.length - 1,
      title: { text: undefined },
      gridLineWidth: 0,
      lineWidth: 0,
      tickLength: 0,
      labels: {
        // Highcharts guards ellipsizing on this, so a label outgrowing the gutter renders whole and
        // overhangs instead of losing three characters.
        style: { ...CHART_LABEL, whiteSpace: 'nowrap' },
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
      style: { color: 'var(--timeline-text)', fontSize: DENSE },
    },
    plotOptions: {
      xrange: {
        borderRadius: 3,
        borderColor: 'var(--timeline-block-border)',
        borderWidth: 1,
        pointWidth: rowHeight - BAR_INSET,
        states: { hover: { brightness: 0.14 } },
      },
    },
    ...(responsive === undefined ? {} : { responsive }),
    series: [
      {
        type: 'xrange',
        name: seriesName,
        data: [...points] as XrangePointOptionsObject[],
        dataLabels: {
          enabled: true,
          overflow: 'allow',
          crop: false,
          // Highcharts has no fit test for xrange labels, so measure against the rendered width.
          formatter() {
            const point = formatterPoint<TimelinePointCustom>(this);
            const custom = point?.custom;
            if (custom === undefined) {
              return '';
            }
            return labelIfItFits(custom.label, (point?.shapeArgs?.width ?? 0) - LABEL_PADDING * 2, rootPx);
          },
          style: {
            ...CHART_LABEL,
            textOutline: 'none',
            // A label must not take the pointer: it sits over its own bar and would swallow the hover.
            pointerEvents: 'none',
          },
        },
      },
    ],
  };
};

const escapeHtml = (value: string): string =>
  value.replace(
    /[&<>"']/g,
    (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ?? character,
  );

/** Values lead and labels follow; sheet names are escaped rather than interpolated raw. */
export const tooltipHtml = (custom: TimelinePointCustom, continuesLabel: string): string => {
  const rows = [
    `<div style="font-weight:600">${escapeHtml(custom.label)}</div>`,
    `<div style="color:var(--timeline-muted-text)">${escapeHtml(custom.rowLabel)}</div>`,
    ...(custom.usageLabel === null ? [] : [`<div style="margin-top:4px">${escapeHtml(custom.usageLabel)}</div>`]),
    `<div style="margin-top:4px">${escapeHtml(custom.rangeLabel)}</div>`,
    `<div style="color:var(--timeline-muted-text)">${escapeHtml(custom.lengthLabel)}${
      custom.clipped ? `, ${escapeHtml(continuesLabel)}` : ''
    }</div>`,
  ];
  if (custom.detail !== null && custom.detail !== custom.label) {
    rows.push(`<div style="margin-top:4px">${escapeHtml(custom.detail)}</div>`);
  }
  return `<div style="min-width:126px;line-height:1.35">${rows.join('')}</div>`;
};

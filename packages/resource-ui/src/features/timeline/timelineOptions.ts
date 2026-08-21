/**
 * The chart frame the semester, week and night views share.
 *
 * All three draw the same thing over a different window: rows of instrument
 * runs on a real-time axis, with a band where the telescope was shut. What
 * differs is only the axis - day numbers over a month, weekday names over a
 * week, clock times over a night - so each view supplies its own `xAxis` and
 * its own way of describing a span, and everything else is settled here.
 *
 * Kept free of React so it can be unit-tested directly: every label, colour and
 * tooltip string is prepared here, never computed inside a chart callback.
 *
 * ## The axis is real time, in the site's clock
 *
 * Blocks carry instants, so the axis carries instants. That is what lets a block
 * changing mid-night be drawn where it actually changes rather than rounded to a
 * whole column, and it is the reason the night view can exist at all.
 */
import type {
  AxisLabelsFormatterContextObject,
  Options,
  PatternObject,
  XAxisOptions,
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
  type TimelineBlock,
  type TimelineRow,
  TOO_SUPPORT_LABEL,
  USAGE_LABEL,
} from '@/domain/timeline';

// Re-exported beside the fills that draw it, so chart code has one import.
export { USAGE_LABEL } from '@/domain/timeline';
import type { Closure, Instrument, ModeBlock, Site, TelescopeModeType, TooBlock, TooSupport } from '@/domain/types';

/**
 * One colour per instrument. Keyed by the enum, not by position, so colour
 * follows the instrument: a window with fewer of them does not repaint the ones
 * that remain.
 *
 * `satisfies Record<Instrument, string>` is the point of writing it this way -
 * a new instrument in the schema fails to compile until it has a colour, rather
 * than falling through to a default and reading as some other instrument. The
 * measurement behind these values is in global.css.
 */
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

/**
 * The dark ink. Exported by name so a caller can ask whether a fill takes it:
 * light ink reads on every dark chrome fill as well, but dark ink is legible
 * only on the bright instrument fill it was chosen for.
 */
export const INSTRUMENT_INK_DARK = 'var(--instrument-ink-dark)';

/**
 * Whichever of light or dark ink clears 4.5:1 on that instrument's fill.
 *
 * Measured, not guessed: white manages only 1.30:1 on GSAOI's lime and 1.33:1 on
 * 'Alopeke's yellow, so most of these take dark text. The three that take white
 * are the deepest fills - Altair, Canopus and Maroon-X.
 */
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
  // Measured 2026-08-12: dark ink clears 4.5:1 on all four of the browser-only
  // hues (7.3-8.8:1), where white would sit at 2.3-2.7:1.
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

/** The ink that clears 4.5:1 on that instrument's fill - see INSTRUMENT_INK. */
export const instrumentInk = (instrument: Instrument): string => INSTRUMENT_INK[instrument];

/** What an absence is called, wherever it is named. */
export const UNSCHEDULED_LABEL = 'No instrument scheduled';
/**
 * The one name a telescope closure has, everywhere: the Telescope row's red
 * block, the band's legend key, the calendar's bar. The reason rides on the
 * record and its tooltip, never on the key.
 */
export const CLOSURE_LABEL = 'Closed';

/**
 * The telescope-state rows, monochrome on purpose: hue on these charts means
 * instrument identity and nothing else (the decision and the measurements are
 * on the tokens in global.css). The ordinary state reads as the quiet neutral;
 * a notable one - the classification is the domain's, `NOTABLE_MODE` and
 * `NOTABLE_TOO` in `domain/timeline.ts` - is the same neutral turned bright.
 * The value is printed on every block and the tooltip repeats it, so the fill
 * only ever says "ordinary" or "look". A recorded fact is always a filled
 * block, never the hollow "not recorded" treatment (I4).
 */
export const stateFill = (notable: boolean): string => (notable ? 'var(--state-notable)' : 'var(--state-routine)');

/** The bright neutral takes dark text, the quiet one white (global.css). */
export const stateFillInk = (notable: boolean): string => (notable ? INSTRUMENT_INK_DARK : INSTRUMENT_INK_LIGHT);

/** The Mode row's fill for a recorded mode - the legend's swatch source. */
export const modeColor = (mode: TelescopeModeType): string => stateFill(NOTABLE_MODE[mode]);

/** The ToO row's fill for a recorded support level - the legend's swatch source. */
export const tooColor = (too: TooSupport): string => stateFill(NOTABLE_TOO[too]);

/**
 * A key a view adds to the legend's shared ones.
 *
 * The section helpers below phrase what a window actually holds - the state
 * rows' values, the sky and calendar chrome - and pass them through here
 * rather than letting any view grow a second legend that drifts from the
 * shared one.
 */
export interface LegendExtra {
  readonly key: string;
  readonly label: string;
  readonly swatch: CSSProperties;
}

/*
 * The state rows' legend keys: the values the window actually holds, in the
 * words the blocks print, each with the fill it draws in - so a reader can
 * find "Queue" or "Open" in the legend exactly as it appears on the chart, and
 * the neutrals never read as instruments. Distinct values only, in the order
 * the window records them. One helper per legend section.
 */

/**
 * The Telescope row's keys. Open only: a Closed span draws in the closure red,
 * and the "Closed" key already names that red - a second red entry would key
 * one fact twice.
 */
export const telescopeLegendExtras = (closures: readonly Closure[]): LegendExtra[] =>
  closures.some((closure) => closure.port === null && closure.availability === 'OPEN')
    ? [{ key: 'telescope-open', label: 'Open', swatch: { backgroundColor: stateFill(false) } }]
    : [];

/** The Mode row's keys - they join the Telescope legend section. */
export const modeLegendExtras = (modeBlocks: readonly ModeBlock[]): LegendExtra[] =>
  [...new Set(modeBlocks.map((block) => block.mode))].map((mode) => ({
    key: `mode-${mode}`,
    label: TELESCOPE_MODE_LABEL[mode],
    swatch: { backgroundColor: modeColor(mode) },
  }));

/** The ToO row's keys - the ToO legend section. */
export const tooLegendExtras = (tooBlocks: readonly TooBlock[]): LegendExtra[] =>
  [...new Set(tooBlocks.map((block) => block.tooSupport))].map((too) => ({
    key: `too-${too}`,
    label: TOO_SUPPORT_LABEL[too],
    swatch: { backgroundColor: tooColor(too) },
  }));

/**
 * The sky keys - the washes a reader sees before any bar.
 *
 * Daylight and twilight are the largest painted areas on a night or week
 * chart and had no key at all; naming them is what stops a reader reading
 * them as schedule facts.
 */
export const skyLegendExtras = (): LegendExtra[] => [
  { key: 'daylight', label: 'Daylight', swatch: { backgroundColor: 'var(--night-daylight-wash)' } },
  { key: 'twilight', label: 'Twilight', swatch: { backgroundColor: 'var(--night-twilight-wash)' } },
];

/** What the calendar chrome marks: weekends, the moment now, un-entered nights. */
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

/*
 * No subsystem legend section, deliberately: every subsystem span draws in the
 * one quiet neutral (`isNotableState`) and prints its state in words, so a
 * colour key there would key no distinction. The gutter label names the row.
 */

/**
 * The engineering-use treatment: the instrument's own hue, hatched with its
 * measured ink - identity stays on the hue, the stripes say "reserved". The
 * pattern-fill module renders it (loaded by the chart components); the ink
 * guarantees the stripes separate on every fill.
 */
export const engineeringPattern = (instrument: Instrument): PatternObject => ({
  pattern: {
    path: { d: 'M 0 8 L 8 0', strokeWidth: 2.5 },
    width: 8,
    height: 8,
    color: INSTRUMENT_INK[instrument],
    backgroundColor: INSTRUMENT_COLOR[instrument],
  },
});

/**
 * A block's fill. A string for every plain fill; the engineering hatch is a
 * pattern object. An unavailable instrument goes hollow - transparent, with
 * its own hue on the outline (`blockBorder`) - so "mounted but unusable" never
 * reads as either a plain run or the grey "nothing scheduled" ghost.
 */
const blockColor = (block: TimelineBlock): string | PatternObject => {
  if (block.state === 'TELESCOPE') {
    // Open is the ordinary state and reads quiet; Closed takes the reserved
    // closure red - the one meaning red ever has on these charts.
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

/** The outline an unavailable instrument's hollow block keeps its hue on. */
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

/** Extra per-point data carried through Highcharts to the tooltip. */
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
  /** Per-point outline - the unavailable treatment's hue. The xrange series
   * honours it, though the shipped typings only declare the series option. */
  readonly borderColor?: string;
  readonly borderWidth?: number;
}

/** Rough advance of the label font (0.68rem, semibold), for the fit test. */
const LABEL_CHAR_WIDTH = 6.2;

/** Breathing room a data label keeps at each end of the shape it sits in. */
export const LABEL_PADDING = 4;

/** The same advance normalised per rem, for labels set at other sizes. */
const LABEL_CHAR_WIDTH_PER_REM = LABEL_CHAR_WIDTH / 0.68;

/**
 * The label, or `''` when it will not fit the space it has.
 *
 * A label wider than its shape is dropped rather than truncated: the DOM grid
 * this superseded printed "I…" and "Eng…", which tell a reader nothing the
 * tooltip would not tell them better. Highcharts has no fit test of its own
 * for xrange data labels, so every view measures - and this is the one place
 * the measurement lives, so two views cannot answer the same label
 * differently. Callers subtract `LABEL_PADDING * 2` from the rendered width
 * to get `availablePx`.
 */
export const labelIfItFits = (label: string, availablePx: number): string =>
  label.length * LABEL_CHAR_WIDTH <= availablePx ? label : '';

/**
 * The pieces a wrapped band label breaks into. Highcharts wraps a plot-band
 * label to the band's width, breaking at spaces and at hyphens (the hyphen
 * stays with its line) - which is how "In-Situ Wash" over a one-night closure
 * came out as a clipped "In-".
 */
const longestUnbreakable = (text: string): number =>
  Math.max(0, ...text.split(/\s+/u).flatMap((word) => word.split(/(?<=-)/u).map((part) => part.length)));

/** The slice of a rendered chart the band-label fit pass reads. Structural,
 * because Highcharts does not type `Axis.plotLinesAndBands`. */
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

/**
 * Hides a band label its band cannot hold, on render and again on every resize.
 *
 * Wrapping serves the wide closures - "Telescope Shutdown A&G Maintenance"
 * reads well over six nights - but once the band is narrower than the label's
 * longest unbreakable piece the wrap degenerates into clipped syllables, which
 * name nothing. The whole label is dropped instead, the same choice every
 * block label makes: the legend's "Closed" key still says what the band is,
 * and the reason stays on the Telescope row's block and its tooltip.
 *
 * A render-time pass because only the rendered chart knows the band's pixel
 * width; wired through `chart.events.render` by every options builder.
 */
export const fitBandLabels = (chart: BandFitChart): void => {
  for (const axis of chart.xAxis) {
    for (const band of axis.plotLinesAndBands ?? []) {
      const { from, to, label } = band.options;
      if (band.label === undefined || from === undefined || to === undefined) {
        continue;
      }
      const width = Math.abs(axis.toPixels(to, false) - axis.toPixels(from, false));
      const rem = Number.parseFloat(label?.style?.fontSize ?? '') || 0.68;
      const fits = longestUnbreakable(label?.text ?? '') * rem * LABEL_CHAR_WIDTH_PER_REM <= width;
      if (fits) {
        band.label.show();
      } else {
        band.label.hide();
      }
    }
  }
};

/**
 * What a formatter needs off the rendered point: the per-point payload every
 * view carries through Highcharts, and - for the data-label formatters - the
 * rendered width to measure a label against.
 */
interface FormatterPoint<C> {
  readonly custom?: C;
  readonly shapeArgs?: { readonly width?: number };
}

/**
 * The point a Highcharts formatter is called for.
 *
 * Highcharts does not type `point.custom`, and a formatter's `this` is untyped
 * besides, so reaching either needs a cast. This is the one place that cast
 * happens - four formatters wrote it out with four hand-written inline types,
 * free to describe the payload differently from the type the points were
 * actually built with.
 */
export const formatterPoint = <C>(context: unknown): FormatterPoint<C> | undefined =>
  (context as { point?: FormatterPoint<C> }).point;

/** How a view phrases a block's extent. Nights read differently from months. */
export interface BlockDescriber {
  readonly range: (block: TimelineBlock) => string;
  readonly length: (block: TimelineBlock) => string;
}

/**
 * Published dates and whole nights - the units the sheet is read in. The
 * semester and week both phrase a span this way; only the night view needs its
 * own describer, because a night is read in clock times.
 *
 * Both ends are the evening the night begins, which is what the sheet heads its
 * columns with. The end needs `lastEveningDate` rather than arithmetic on the
 * instant: an interval's end is exclusive and sits at 14:00 on the last night's
 * *label* date, so naming the date an hour earlier reports the label and is a
 * day late - a run ending on the "31" column read as "1 Feb". Nor can a fixed
 * offset fix it: a night is 23 or 25 hours across a DST change at Gemini South.
 */
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
    // The hollow treatment is a stroke, which the ghost's stylesheet class
    // supplies; an unavailable instrument's outline instead keeps its own hue,
    // set per point.
    ...(block.state === 'UNSCHEDULED' ? { className: 'schedule-ghost' } : {}),
    ...(border === null ? {} : { borderColor: border, borderWidth: 1.5 }),
    dataLabels: { style: { color: blockInk(block) } },
    custom: {
      blockId: block.id,
      rowLabel: block.rowLabel,
      label: block.label === '' ? UNSCHEDULED_LABEL : block.label,
      state: block.state,
      // Stated only when it is not the ordinary science use.
      usageLabel: block.usage !== null && block.usage !== 'SCIENCE' ? USAGE_LABEL[block.usage] : null,
      rangeLabel: describe.range(block),
      lengthLabel: describe.length(block),
      detail: block.detail,
      clipped: block.continuesBefore || block.continuesAfter,
    },
  };
};

/** The flat point list for a window's xrange series. Exported for testing. */
export const buildTimelinePoints = (rows: readonly TimelineRow[], describe: BlockDescriber): readonly TimelinePoint[] =>
  rows.flatMap((row, rowIndex) => row.blocks.map((block) => toPoint(block, rowIndex, describe)));

export interface TimelineChartModel {
  readonly rows: readonly TimelineRow[];
  readonly site: Site;
  readonly describe: BlockDescriber;
  /** The view's own axis: extent, ticks, labels, bands and lines. */
  readonly xAxis: XAxisOptions;
  readonly rowHeight: number;
  readonly labelGutter: number;
  readonly bottomMargin: number;
  readonly responsive?: Options['responsive'];
  readonly seriesName: string;
  /**
   * The masthead's clock choice. It reaches Highcharts as `time.timezone`, so
   * only labels Highcharts itself formats move with it - the night axis's
   * `%H:%M`. The week and semester axes print dates through their own
   * formatters and stay put, so those views need not pass it.
   */
  readonly timeDisplay?: TimeDisplay;
}

/** Room above the plot area. */
export const TOP_MARGIN = 8;

/** How much of a row's height its bar leaves free. */
const BAR_INSET = 8;

/** How the y axis lays grouped rows out: heading rows over each group. */
export interface GroupedRowLayout {
  /** The category list, headings included. */
  readonly categories: readonly string[];
  /** Category indices that are headings, for the label formatter. */
  readonly headingPositions: ReadonlySet<number>;
  /** The category index a data row lands on, past the headings. */
  readonly offsetFor: (rowIndex: number) => number;
}

/**
 * Lays the rows out under group headings: "Telescope" over the state rows,
 * "Instruments" over the subjects (Dan, 2026-08-11) - so each group is named
 * above its bars, and the heading row doubles as the band's breathing room. A
 * window with no state rows gets no headings: one group needs no name.
 */
/**
 * Where the heading-row mask sits in the band stack, and what must clear it.
 *
 * Below it: the sun and weekend washes, the axis grid, the night boundaries -
 * everything whose job is to shade the *data*. Above it: any band or line that
 * must still be seen or that hangs a label in the top row.
 */
export const HEADING_MASK_Z = 6;
/** A band whose label lives in the heading row, so it draws over the mask. */
export const LABELLED_BAND_Z = 8;
/** A marker line that must stay visible the whole chart height. */
export const MARKER_LINE_Z = 9;

export const groupedRowLayout = (labels: readonly string[], headerRows: number): GroupedRowLayout => {
  if (headerRows === 0) {
    return { categories: [...labels], headingPositions: new Set(), offsetFor: (rowIndex) => rowIndex };
  }
  return {
    categories: ['Telescope', ...labels.slice(0, headerRows), 'Instruments', ...labels.slice(headerRows)],
    headingPositions: new Set([0, headerRows + 1]),
    offsetFor: (rowIndex) => (rowIndex < headerRows ? rowIndex + 1 : rowIndex + 2),
  };
};

/** A heading category's gutter label: small caps, muted, tracked out. Sized
 * so "INSTRUMENTS" fits the narrowest gutter (the 92px semester charts). */
export const headingLabelHtml = (value: string): string =>
  `<span style="color: var(--timeline-muted-text); font-size: 0.55rem; font-weight: 700; letter-spacing: 1px;">${value.toUpperCase()}</span>`;

/** Builds the Highcharts options every timeline view shares. */
export const buildTimelineChart = ({
  rows,
  site,
  describe,
  xAxis,
  rowHeight,
  labelGutter,
  bottomMargin,
  responsive,
  seriesName,
  timeDisplay = 'site',
}: TimelineChartModel): Options => {
  // Everything derived from the rows, never passed alongside them: a category
  // list or header count that could disagree with the data is a mismatch
  // waiting for a window whose state rows differ.
  //
  // The telescope-state rows and the subjects each sit under their own group
  // heading (`groupedRowLayout`), which names the group above its bars and
  // gives the band its breathing room. Heading rows rather than an axis
  // break: a break inflates the adjacent category's slot and drops its gutter
  // label half a row out of line with its bar.
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
          fitBandLabels(this);
        },
      },
      backgroundColor: 'transparent',
      height: TOP_MARGIN + bottomMargin + categories.length * rowHeight,
      marginTop: TOP_MARGIN,
      marginBottom: bottomMargin,
      marginLeft: labelGutter,
      marginRight: 8,
      spacing: [0, 0, 0, 0],
      style: { fontFamily: 'inherit' },
    },
    // Times are the site's (or UT, when the masthead says so) - never the
    // browser's: a night at Gemini South spans two UTC dates, so the viewer's
    // zone would shift every label.
    time: { timezone: displayTimeZone(site, timeDisplay) },
    title: { text: undefined },
    credits: { enabled: false },
    legend: { enabled: false },
    // The table view carries the accessible reading of this data, and the chart is
    // reachable from it; Highcharts' own a11y module would announce every point.
    accessibility: { enabled: false },
    xAxis,
    yAxis: {
      categories: [...categories],
      reversed: true,
      /*
       * The group-heading rows are gutter labels, not data - so the washes must
       * stop at them. An xAxis plot band spans the whole plot height, which
       * painted the daylight, twilight and weekend shading straight through the
       * "Telescope" and "Instruments" heading rows and made each read as a
       * filled row (Dan, 2026-08-12). One opaque strip per heading row, above
       * the washes (zIndex 5) and below the bands that hang a label in the top
       * row - the closure's reason and the week's "not recorded".
       */
      plotBands: [...headingPositions].map((position) => ({
        from: position - 0.5,
        to: position + 0.5,
        color: 'var(--color-canvas)',
        zIndex: HEADING_MASK_Z,
        className: 'timeline-heading-mask',
      })),
      // Pinned to the row count: Highcharts otherwise derives the extremes from
      // the data and drops a row with nothing on it, stretching the rest.
      min: 0,
      max: categories.length - 1,
      title: { text: undefined },
      gridLineWidth: 0,
      lineWidth: 0,
      tickLength: 0,
      labels: {
        style: { color: 'var(--timeline-text)', fontSize: '0.72rem', fontWeight: '600' },
        // Group headings read as headings; every data row - state and subject
        // alike - keeps the full-strength label (Dan, 2026-08-11).
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
          // A label wider than its block is dropped rather than truncated
          // (`labelIfItFits`); Highcharts has no fit test of its own for
          // xrange, so measure against the rendered width.
          formatter() {
            const point = formatterPoint<TimelinePointCustom>(this);
            const custom = point?.custom;
            if (custom === undefined) {
              return '';
            }
            return labelIfItFits(custom.label, (point?.shapeArgs?.width ?? 0) - LABEL_PADDING * 2);
          },
          style: {
            color: 'var(--timeline-text)',
            fontSize: '0.68rem',
            fontWeight: '600',
            textOutline: 'none',
            // A label is decoration and must not take the pointer: it sits over
            // the middle of its own bar, so without this anything aimed at the
            // block - hover, or a future interaction - lands on the <text>
            // instead. Kept from the removed editing work, where it cost a day.
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

/**
 * The tooltip.
 *
 * Values lead and labels follow: the reader already knows which bar they are
 * pointing at and wants the dates. Names come from the published sheet, so they
 * are escaped rather than interpolated raw.
 */
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
  return `<div style="min-width:9rem;line-height:1.35">${rows.join('')}</div>`;
};

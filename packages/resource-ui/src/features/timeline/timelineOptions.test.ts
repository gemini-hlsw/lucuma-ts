import { describe, expect, it } from 'vitest';

import { portRowLabel } from '@/domain/ports';
import type { TimelineBand, TimelineRow } from '@/domain/timeline';

import {
  type BandFitChart,
  BASE_ROOT_PX,
  buildTimelineChart,
  closureBandPlotBand,
  DENSE,
  eveningDescriber,
  fitBandLabels,
  labelGutter,
  TICK,
  type TimelinePointCustom,
} from './timelineOptions';

const band = (from: number, to: number, text: string, fontSize = DENSE) => {
  const calls: string[] = [];
  return {
    calls,
    band: {
      options: { from, to, label: { text, style: { fontSize } } },
      label: {
        show: () => calls.push('show'),
        hide: () => calls.push('hide'),
      },
    },
  };
};

/** An axis where one unit is one pixel, so widths read directly. */
const chartOf = (...bands: ReturnType<typeof band>[]): BandFitChart => ({
  xAxis: [
    {
      toPixels: (value: number) => value,
      plotLinesAndBands: bands.map((entry) => entry.band),
    },
  ],
});

describe(fitBandLabels, () => {
  it('keeps the label of a closure wide enough to wrap it', () => {
    const wide = band(0, 200, 'Telescope Shutdown A&G Maintenance');

    fitBandLabels(chartOf(wide), BASE_ROOT_PX);

    expect(wide.calls).toEqual(['show']);
  });

  it('drops the label of a closure narrower than its longest piece', () => {
    const narrow = band(0, 17, 'In-Situ Wash');

    fitBandLabels(chartOf(narrow), BASE_ROOT_PX);

    expect(narrow.calls).toEqual(['hide']);
  });

  it('judges by the wrap pieces, breaking at spaces and hyphens alike', () => {
    // This width holds every hyphen-split piece but no whole word, which is what Highcharts renders.
    const hyphenated = band(0, 40, 'In-Situ Wash');

    fitBandLabels(chartOf(hyphenated), BASE_ROOT_PX);

    expect(hyphenated.calls).toEqual(['show']);
  });

  it('scales the advance to the label font, so a smaller-set label judges at its own size', () => {
    // One width, two font sizes: it holds the tick-tier label and not the chart-sized one.
    const atChartSize = band(0, 34, 'Wash');
    const atSmallSize = band(0, 34, 'Wash', TICK);

    fitBandLabels(chartOf(atChartSize, atSmallSize), BASE_ROOT_PX);

    expect(atChartSize.calls).toEqual(['hide']);
    expect(atSmallSize.calls).toEqual(['show']);
  });

  it('re-fits on every pass, so a resize can bring a label back', () => {
    const entry = band(0, 17, 'In-Situ Wash');
    const grown = { xAxis: [{ toPixels: (value: number) => value * 10, plotLinesAndBands: [entry.band] }] };

    fitBandLabels(chartOf(entry), BASE_ROOT_PX);
    fitBandLabels(grown, BASE_ROOT_PX);

    expect(entry.calls).toEqual(['hide', 'show']);
  });

  it('leaves the label-less weekend bands alone', () => {
    const weekend = { options: { from: 0, to: 10 } };

    expect(() => {
      fitBandLabels({ xAxis: [{ toPixels: (value: number) => value, plotLinesAndBands: [weekend] }] }, BASE_ROOT_PX);
    }).not.toThrow();
  });
});

const MODEL = {
  rows: [],
  site: 'GS',
  describe: eveningDescriber('GS'),
  xAxis: {},
  rowHeightRem: 2.125,
  bottomMarginRem: 2.125,
  seriesName: 'Schedule',
} as const satisfies Parameters<typeof buildTimelineChart>[0];

describe(buildTimelineChart, () => {
  const options = buildTimelineChart(MODEL);

  const custom = (label: string): TimelinePointCustom => ({
    blockId: 'b1',
    rowLabel: 'Port 3',
    label,
    state: 'MOUNTED',
    usageLabel: null,
    rangeLabel: 'all night',
    lengthLabel: '1 night',
    detail: null,
    clipped: false,
  });

  /** Highcharts passes the point through `this`, not as an argument. */
  const barLabel = (point: { custom?: TimelinePointCustom; shapeArgs?: { width?: number } } | undefined): unknown => {
    const series = options.series?.[0] as { dataLabels?: { formatter?: (this: unknown) => unknown } } | undefined;
    const formatter = series?.dataLabels?.formatter;
    if (formatter === undefined) {
      throw new Error('expected a data-label formatter');
    }
    return formatter.call({ point });
  };

  it('prints a bar label whole when the bar holds it', () => {
    expect(barLabel({ custom: custom('GMOS'), shapeArgs: { width: 60 } })).toBe('GMOS');
  });

  it('drops - never truncates - a label wider than its bar', () => {
    expect(barLabel({ custom: custom('Telescope Shutdown A&G Maintenance'), shapeArgs: { width: 60 } })).toBe('');
  });

  it('measures bar and band labels with the one advance, so the two agree at the same width', () => {
    // One word, so both judge the same characters; the bar formatter spends 4px of padding a side,
    // hence the +8 where a bar is compared with a band.
    const cramped = band(0, 37, 'Wash');
    const roomy = band(0, 38, 'Wash');

    fitBandLabels(chartOf(cramped, roomy), BASE_ROOT_PX);

    expect(cramped.calls).toEqual(['hide']);
    expect(barLabel({ custom: custom('Wash'), shapeArgs: { width: 37 + 8 } })).toBe('');
    expect(roomy.calls).toEqual(['show']);
    expect(barLabel({ custom: custom('Wash'), shapeArgs: { width: 38 + 8 } })).toBe('Wash');
  });

  it('shows nothing for a bar not yet laid out, rather than throwing', () => {
    expect(barLabel({ custom: custom('GMOS') })).toBe('');
  });

  it('shows nothing when the point carries no payload', () => {
    expect(barLabel(undefined)).toBe('');
  });
});

/*
 * Highcharts takes pixels, so every one of these is a rem the builder resolves - and a resolved
 * number is indistinguishable from a frozen one until the root moves. Each case reads the geometry
 * at two roots, which is what a dropped conversion cannot survive.
 */
describe("the chart geometry against the reader's root font size", () => {
  const rowsOf = (count: number): TimelineRow[] =>
    Array.from({ length: count }, (_, index) => ({ key: `p${String(index)}`, label: portRowLabel(index), blocks: [] }));

  const geometryAt = (rootPx: number, rowCount: number) => {
    document.documentElement.style.fontSize = `${String(rootPx)}px`;
    try {
      const chart = buildTimelineChart({ ...MODEL, rows: rowsOf(rowCount) }).chart;
      // Highcharts types a height it also accepts as a percentage string; the builder only ever sets pixels.
      return { marginLeft: chart?.marginLeft, height: Number(chart?.height), gutter: labelGutter() };
    } finally {
      document.documentElement.style.removeProperty('font-size');
    }
  };

  // The margins cancel, so the difference between a one-row and a two-row chart is one row height.
  const rowHeightAt = (rootPx: number): number => geometryAt(rootPx, 2).height - geometryAt(rootPx, 1).height;

  it.each([BASE_ROOT_PX, BASE_ROOT_PX * 2])('reserves the derived gutter at a %ipx root', (rootPx) => {
    const geometry = geometryAt(rootPx, 1);

    expect(geometry.marginLeft).toBe(geometry.gutter);
  });

  it("measures a row in the reader's own pixels, so a raised root cannot squeeze its label out", () => {
    expect(rowHeightAt(BASE_ROOT_PX)).toBe(MODEL.rowHeightRem * BASE_ROOT_PX);
    expect(rowHeightAt(BASE_ROOT_PX * 2)).toBe(MODEL.rowHeightRem * BASE_ROOT_PX * 2);
  });

  it('follows a reader who asks for smaller type as readily as one who asks for larger', () => {
    expect(rowHeightAt(9)).toBe(MODEL.rowHeightRem * 9);
  });
});

describe(closureBandPlotBand, () => {
  const shutdown: TimelineBand = {
    id: 'wide',
    interval: { start: 1_800_000_000_000, end: 1_800_432_000_000 },
    label: 'Telescope Shutdown A&G Maintenance',
  };

  it('spans the closure, opening instant to closing instant', () => {
    const plotBand = closureBandPlotBand(shutdown, 0.875);

    expect(plotBand.from).toBe(shutdown.interval.start);
    expect(plotBand.to).toBe(shutdown.interval.end);
  });

  it('washes the closure in the band fill, edged so its ends are readable', () => {
    expect(closureBandPlotBand(shutdown, 0.875)).toMatchObject({
      className: 'schedule-closure-band',
      color: 'var(--schedule-band)',
      borderColor: 'var(--schedule-band-edge)',
      borderWidth: 1,
      // Over the mask that hides the heading row, or the label it hangs there is covered.
      zIndex: 8,
    });
  });

  // The suite runs at the base root, where the view's rem and these pixels are the same measurement.
  it('hangs the label upright in the heading row, at the height the view asks for', () => {
    expect(closureBandPlotBand(shutdown, 0.875).label).toMatchObject({
      text: shutdown.label,
      y: 14,
      rotation: 0,
      align: 'center',
      verticalAlign: 'top',
    });
    expect(closureBandPlotBand(shutdown, 0.75).label?.y).toBe(12);
  });
});

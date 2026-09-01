import { describe, expect, it } from 'vitest';

import { type BandFitChart, fitBandLabels } from './timelineOptions';

/** A rendered band the fit pass can read, recording show/hide calls. */
const band = (from: number, to: number, text: string, fontSize = '0.68rem') => {
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
    // Six nights hold "Maintenance" per wrapped line, the treatment the wide closures rely on.
    const wide = band(0, 200, 'Telescope Shutdown A&G Maintenance');

    fitBandLabels(chartOf(wide));

    expect(wide.calls).toEqual(['show']);
  });

  it('drops the label of a closure narrower than its longest piece', () => {
    // "In-Situ Wash" over one night wraps at the hyphen and clips to "In-", which names nothing.
    const narrow = band(0, 17, 'In-Situ Wash');

    fitBandLabels(chartOf(narrow));

    expect(narrow.calls).toEqual(['hide']);
  });

  it('judges by the wrap pieces, breaking at spaces and hyphens alike', () => {
    // 30px holds no whole word but every hyphen-split piece, which is what Highcharts renders.
    const hyphenated = band(0, 30, 'In-Situ Wash');

    fitBandLabels(chartOf(hyphenated));

    expect(hyphenated.calls).toEqual(['show']);
  });

  it('scales the advance to the label font, so a smaller-set label judges at its own size', () => {
    // "Wash" needs ~25px at 0.68rem but ~23px at 0.62rem; 23px of band holds only the smaller.
    const atChartSize = band(0, 23, 'Wash', '0.68rem');
    const atSmallSize = band(0, 23, 'Wash', '0.62rem');

    fitBandLabels(chartOf(atChartSize, atSmallSize));

    expect(atChartSize.calls).toEqual(['hide']);
    expect(atSmallSize.calls).toEqual(['show']);
  });

  it('re-fits on every pass, so a resize can bring a label back', () => {
    const entry = band(0, 17, 'In-Situ Wash');
    const grown = { xAxis: [{ toPixels: (value: number) => value * 10, plotLinesAndBands: [entry.band] }] };

    fitBandLabels(chartOf(entry));
    fitBandLabels(grown);

    expect(entry.calls).toEqual(['hide', 'show']);
  });

  it('leaves the label-less weekend bands alone', () => {
    const weekend = { options: { from: 0, to: 10 } };

    expect(() => {
      fitBandLabels({ xAxis: [{ toPixels: (value: number) => value, plotLinesAndBands: [weekend] }] });
    }).not.toThrow();
  });
});

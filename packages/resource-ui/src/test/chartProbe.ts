import { textsOf } from '@/test/helpers';

/**
 * Every bar's geometry and fill under `scope`, as one comparable string.
 * A pattern fill carries a per-render hash, so a comparison across renders drops it.
 */
export const drawnBars = (scope: string, { patternHash = 'keep' }: { patternHash?: 'keep' | 'drop' } = {}): string =>
  [...document.querySelectorAll(`${scope} path.highcharts-point`)]
    .map((bar) => {
      const fill = bar.getAttribute('fill') ?? '';
      return `${bar.getAttribute('d') ?? ''}#${patternHash === 'drop' ? fill.replace(/pattern-\d+-\w+/u, 'pattern') : fill}`;
    })
    .join('|');

export const nightAxisLabels = (): readonly string[] =>
  textsOf('[data-testid="night-timeline"] .highcharts-xaxis-labels text');

/** Highcharts keeps a plot line it will not draw as a hidden or path-less element, so presence proves nothing. */
export const drawnPlotLineX = (selector: string): readonly number[] =>
  [...document.querySelectorAll<SVGPathElement>(`.highcharts-plot-line${selector}`)]
    .filter((line) => line.getAttribute('d') !== null && getComputedStyle(line).visibility !== 'hidden')
    .map((line) => Number(/M\s*([\d.]+)/u.exec(line.getAttribute('d') ?? '')?.[1]));

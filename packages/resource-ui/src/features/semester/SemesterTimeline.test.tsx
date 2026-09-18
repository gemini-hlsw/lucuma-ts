/*
 * A grid item defaults to `min-width: auto`, so the column wedges open at the first width.
 *
 * The gutter is a pixel budget, and a budget spent in the wrong face measures nothing, so this file
 * loads the app's styling for its font stack - the fourth exception CLAUDE.md names.
 */
import '@/styles/global.css';
import '@/styles/main.css';

import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { render as renderBare } from 'vitest-browser-react';

import { buildSemesterTimeline } from '@/domain/semesterTimeline';
import { observingNightInterval } from '@/domain/siteTime';
import type { Mounting } from '@/domain/types';
import { ROOT_FONT_SIZE } from '@/test/styleProbe';

import { SemesterTimeline } from './SemesterTimeline';

// A router, because every chart is also a click-through into its nights.
const render = async (element: ReactElement) => renderBare(<MemoryRouter>{element}</MemoryRouter>);

const night = (label: string) => observingNightInterval('GS', label);
const MOUNTINGS: readonly Mounting[] = [
  {
    id: 'ghost',
    instrument: 'GHOST',
    publishedName: 'GHOST',
    usage: 'SCIENCE',
    port: 1,
    place: null,
    note: null,
    interval: { start: night('2026-08-08').start, end: night('2026-09-01').end },
  },
];

const timeline = buildSemesterTimeline({
  site: 'GS',
  firstNight: '2026-08-02',
  lastNight: '2026-09-01',
  mountings: MOUNTINGS,
  closures: [],
});

/** Carries a whole-telescope record, because the group headings only head a chart that has state rows. */
const headedTimeline = buildSemesterTimeline({
  site: 'GS',
  firstNight: '2026-08-02',
  lastNight: '2026-09-01',
  mountings: MOUNTINGS,
  closures: [
    {
      id: 'open',
      availability: 'OPEN',
      port: null,
      interval: { start: night('2026-08-02').start, end: night('2026-09-01').end },
      reason: null,
    },
  ],
});

const chartWidth = (container: HTMLElement): number =>
  Math.round(container.querySelector('.highcharts-container')?.getBoundingClientRect().width ?? 0);

const gutterLabels = (container: HTMLElement): SVGTextElement[] => [
  ...container.querySelectorAll<SVGTextElement>('.highcharts-yaxis-labels text'),
];

/** Highcharts keeps a label it will not draw in the DOM and hides it, so presence proves nothing. */
const drawnGutterLabels = (container: HTMLElement): string[] =>
  gutterLabels(container)
    .filter((label) => getComputedStyle(label).visibility !== 'hidden')
    .map((label) => label.textContent ?? '');

/** Highcharts hangs a `title` on an axis label only where it truncated the text to fit. */
const truncatedLabels = (container: HTMLElement): string[] =>
  gutterLabels(container).flatMap((label) =>
    [...label.querySelectorAll('title')].map((title) => title.textContent ?? ''),
  );

describe(SemesterTimeline, () => {
  beforeAll(() => {
    // The lucuma-ui theme carries the font stack and is scoped under `.dark`, as `main.tsx` scopes it.
    document.documentElement.classList.add('dark');
  });

  afterEach(() => {
    document.documentElement.style.fontSize = '';
  });

  it('resizes its charts when the container does, not when the window does', async () => {
    const screen = await render(
      <div style={{ width: '900px' }} data-testid="host">
        <SemesterTimeline timeline={timeline} site="GS" now={null} />
      </div>,
    );

    const host = screen.getByTestId('host').element() as HTMLElement;
    await expect.poll(() => chartWidth(host)).toBeGreaterThan(700);

    host.style.width = '400px';

    // No window resize on purpose: only the container changes, as when the grid drops a column.
    await expect.poll(() => chartWidth(host)).toBeLessThan(450);
  });

  it('never lets a chart push the page sideways', async () => {
    const screen = await render(
      <div style={{ width: '320px' }} data-testid="host">
        <SemesterTimeline timeline={timeline} site="GS" now={null} />
      </div>,
    );

    const host = screen.getByTestId('host').element() as HTMLElement;
    await expect.poll(() => chartWidth(host)).toBeLessThanOrEqual(320);
  });

  it('leaves the gutter wide enough to draw a group heading whole', async () => {
    document.documentElement.style.fontSize = ROOT_FONT_SIZE;

    const screen = await render(
      <div style={{ width: '900px' }} data-testid="host">
        <SemesterTimeline timeline={headedTimeline} site="GS" now={null} />
      </div>,
    );

    const host = screen.getByTestId('host').element() as HTMLElement;
    // Guarded on the heading drawn at all, or an unrendered chart passes as a gutter with nothing truncated.
    await expect
      .poll(() => gutterLabels(host).filter((label) => label.textContent?.startsWith('INSTRUME')).length)
      .toBeGreaterThan(0);
    expect(truncatedLabels(host)).toStrictEqual([]);
  });

  /*
   * Highcharts hides every other axis label once they stop clearing each other vertically, which
   * costs half the rows their name while their bars keep drawing. Only a raised root shows it.
   */
  it('keeps every row label when the reader doubles their font size', async () => {
    document.documentElement.style.fontSize = ROOT_FONT_SIZE;
    const base = await render(
      <div style={{ width: '900px' }} data-testid="base">
        <SemesterTimeline timeline={headedTimeline} site="GS" now={null} />
      </div>,
    );
    const baseHost = base.getByTestId('base').element() as HTMLElement;
    await expect.poll(() => drawnGutterLabels(baseHost).length).toBeGreaterThan(0);
    const expected = drawnGutterLabels(baseHost);

    document.documentElement.style.fontSize = '32px';
    const doubled = await render(
      <div style={{ width: '900px' }} data-testid="doubled">
        <SemesterTimeline timeline={headedTimeline} site="GS" now={null} />
      </div>,
    );
    const doubledHost = doubled.getByTestId('doubled').element() as HTMLElement;

    await expect.poll(() => drawnGutterLabels(doubledHost)).toStrictEqual(expected);
  });

  it('draws a region per month, named so it can be navigated', async () => {
    const screen = await render(<SemesterTimeline timeline={timeline} site="GS" now={null} />);

    await expect.element(screen.getByRole('region', { name: 'August 2026' })).toBeVisible();
  });
});

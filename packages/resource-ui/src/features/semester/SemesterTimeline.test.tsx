/*
 * A grid item defaults to `min-width: auto`, so the column wedges open at the first width.
 *
 * The gutter is a pixel budget, and a budget spent in the wrong face measures nothing, so this file
 * loads the app's styling for its font stack.
 */
import '@/styles/global.css';
import '@/styles/main.css';

import type { ReactElement } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildSemesterTimeline, type SemesterTimeline as Timeline } from '@/domain/semesterTimeline';
import { observingNightInterval } from '@/domain/siteTime';
import { domainInstrumentBlock, domainTelescopeBlock, nightsSpan, scheduleOf } from '@/test/fixtures/domain';
import { renderWithRoute } from '@/test/render';
import { ROOT_FONT_SIZE } from '@/test/styleProbe';

import { SemesterTimeline } from './SemesterTimeline';

// A router, because every chart is also a click-through into its nights.
const render = async (element: ReactElement) => renderWithRoute(element, { route: '/semester?site=GS' });

/** Inside August, so every chart also carries the now marker these measurements must not depend on. */
const NOW = observingNightInterval('GS', '2026-08-10').start;
const INSTRUMENT_BLOCKS = [
  domainInstrumentBlock({
    id: 'ghost',
    instrument: 'GHOST',
    interval: nightsSpan('GS', '2026-08-08', '2026-09-01'),
  }),
];

const timeline = buildSemesterTimeline({
  site: 'GS',
  firstNight: '2026-08-02',
  lastNight: '2026-09-01',
  schedule: scheduleOf({ instrumentAvailability: INSTRUMENT_BLOCKS }),
});

/** Carries a whole-telescope record, because the group headings only head a chart that has state rows. */
const headedTimeline = buildSemesterTimeline({
  site: 'GS',
  firstNight: '2026-08-02',
  lastNight: '2026-09-01',
  schedule: scheduleOf({
    instrumentAvailability: INSTRUMENT_BLOCKS,
    telescopeAvailability: [
      domainTelescopeBlock({ id: 'open', interval: nightsSpan('GS', '2026-08-02', '2026-09-01') }),
    ],
  }),
});

/** The timeline inside a host of the given width, as the page grid hands it one. */
const renderInHost = async (width: number, subject: Timeline, id = 'host'): Promise<HTMLElement> => {
  const screen = await render(
    <div style={{ width: `${String(width)}px` }} data-testid={id}>
      <SemesterTimeline timeline={subject} site="GS" />
    </div>,
  );
  return screen.getByTestId(id).element() as HTMLElement;
};

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

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    document.documentElement.style.fontSize = '';
    vi.useRealTimers();
  });

  it('resizes its charts when the container does, not when the window does', async () => {
    const host = await renderInHost(900, timeline);
    await expect.poll(() => chartWidth(host)).toBeGreaterThan(700);

    host.style.width = '400px';

    // No window resize on purpose: only the container changes, as when the grid drops a column.
    await expect.poll(() => chartWidth(host)).toBeLessThan(450);
  });

  it('never lets a chart push the page sideways', async () => {
    const host = await renderInHost(320, timeline);
    await expect.poll(() => chartWidth(host)).toBeLessThanOrEqual(320);
  });

  it('leaves the gutter wide enough to draw a group heading whole', async () => {
    document.documentElement.style.fontSize = ROOT_FONT_SIZE;

    const host = await renderInHost(900, headedTimeline);
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
    const baseHost = await renderInHost(900, headedTimeline, 'base');
    await expect.poll(() => drawnGutterLabels(baseHost).length).toBeGreaterThan(0);
    const expected = drawnGutterLabels(baseHost);

    document.documentElement.style.fontSize = '32px';
    const doubledHost = await renderInHost(900, headedTimeline, 'doubled');

    await expect.poll(() => drawnGutterLabels(doubledHost)).toStrictEqual(expected);
  });

  it('draws a region per month, named so it can be navigated', async () => {
    const screen = await render(<SemesterTimeline timeline={timeline} site="GS" />);

    await expect.element(screen.getByRole('region', { name: 'August 2026' })).toBeVisible();
  });
});

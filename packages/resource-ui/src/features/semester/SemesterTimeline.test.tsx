/**
 * Rendering behaviour that only a real browser can show: whether the charts
 * actually resize with their container.
 *
 * Highcharts redraws itself when its render target resizes, but a grid item
 * defaults to `min-width: auto` and will not shrink below its content - so the
 * column wedges open at whatever width the chart first rendered at, the chart is
 * never asked to narrow, and the layout silently stops being responsive. A
 * screenshot at one width cannot show that, which is why it is pinned here.
 */
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { render as renderBare } from 'vitest-browser-react';

import { buildSemesterTimeline } from '@/domain/semesterTimeline';
import { observingNightInterval } from '@/domain/siteTime';
import type { Mounting } from '@/domain/types';

import { SemesterTimeline } from './SemesterTimeline';

// A router, because every chart is also a click-through into its nights. The
// resize behaviour under test needs nothing from it.
const render = async (element: ReactElement) => renderBare(<MemoryRouter>{element}</MemoryRouter>);

const night = (label: string) => observingNightInterval('GS', label);
const ROWS = ['Port 1-up', 'Port 2', 'Port 3'];

const MOUNTINGS: readonly Mounting[] = [
  {
    id: 'ghost',
    rowLabel: 'Port 1-up',
    instrument: 'GHOST',
    publishedName: 'GHOST',
    usage: 'SCIENCE',
    port: 1,
    locationType: 'PORT',
    note: null,
    interval: { start: night('2026-08-08').start, end: night('2026-09-01').end },
  },
];

const timeline = buildSemesterTimeline({
  site: 'GS',
  rowLabels: ROWS,
  firstNight: '2026-08-02',
  lastNight: '2026-09-01',
  mountings: MOUNTINGS,
  closures: [],
});

const chartWidth = (container: HTMLElement): number =>
  Math.round(container.querySelector('.highcharts-container')?.getBoundingClientRect().width ?? 0);

describe('SemesterTimeline', () => {
  it('resizes its charts when the container does, not when the window does', async () => {
    const screen = await render(
      <div style={{ width: '900px' }} data-testid="host">
        <SemesterTimeline timeline={timeline} site="GS" now={null} />
      </div>,
    );

    const host = screen.getByTestId('host').element() as HTMLElement;
    await expect.poll(() => chartWidth(host)).toBeGreaterThan(700);

    host.style.width = '400px';

    // No window resize is fired on purpose: only the container changes, which is
    // all that happens when the grid drops from two columns to one.
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

  it('draws a region per month, named so it can be navigated', async () => {
    const screen = await render(<SemesterTimeline timeline={timeline} site="GS" now={null} />);

    await expect.element(screen.getByRole('region', { name: 'August 2026' })).toBeVisible();
  });
});

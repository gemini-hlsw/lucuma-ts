import { describe, expect, it } from 'vitest';

import { DAY_MS, observingNightInterval, observingNightOf } from '@/domain/siteTime';
import type { Site } from '@/domain/types';
import { Probe } from '@/test/probe';
import { renderApp } from '@/test/renderApp';

import { RECENT_DAYS, useRecentSpan } from './useRecentSpan';

const openSpan = async (route: string) =>
  renderApp({
    route,
    mocks: [],
    element: (
      <Probe
        use={useRecentSpan}
        readout={(span) => ({
          end: span.end,
          days: String((Date.parse(span.end) - Date.parse(span.start)) / DAY_MS),
        })}
      />
    ),
  });

const tonightEnds = (site: Site): string =>
  new Date(observingNightInterval(site, observingNightOf(site, Date.now())).end).toISOString();

describe(useRecentSpan, () => {
  it('covers the longest window the service accepts, ending with tonight', async () => {
    const screen = await openSpan('/components?site=GS');

    await expect.element(screen.getByTestId('probe-end')).toHaveTextContent(tonightEnds('GS'));
    await expect.element(screen.getByTestId('probe-days')).toHaveTextContent(String(RECENT_DAYS));
  });

  it('follows the site, ending at its own observing-night boundary', async () => {
    const screen = await openSpan('/components?site=GN');

    await expect.element(screen.getByTestId('probe-end')).toHaveTextContent(tonightEnds('GN'));
  });

  it('ignores the semester and night in the URL', async () => {
    const screen = await openSpan('/components?site=GS&semester=2024B&night=2024-09-01');

    await expect.element(screen.getByTestId('probe-end')).toHaveTextContent(tonightEnds('GS'));
    await expect.element(screen.getByTestId('probe-days')).toHaveTextContent(String(RECENT_DAYS));
  });
});

import { describe, expect, it, vi } from 'vitest';

import { observingNightInterval, observingNightOf } from '@/domain/siteTime';
import { Probe, PROBE_URL_TESTID } from '@/test/probe';
import { renderApp } from '@/test/renderApp';

import { useSelection } from './useSelection';

const openSelection = async (route: string) =>
  renderApp({
    route,
    element: (
      <Probe
        use={useSelection}
        readout={(selection) => ({
          site: selection.site,
          night: selection.observingNight,
          tonight: selection.tonight,
        })}
        actions={(selection) => [
          { label: 'to GS', run: () => selection.setSite('GS') },
          { label: 'tonight', run: selection.clearObservingNight },
        ]}
      />
    ),
    mocks: [],
  });

describe(useSelection, () => {
  it('reads the whole selection out of the query string', async () => {
    const screen = await openSelection('/night?site=GS&night=2025-11-14');

    await expect.element(screen.getByTestId('probe-site')).toHaveTextContent('GS');
    await expect.element(screen.getByTestId('probe-night')).toHaveTextContent('2025-11-14');
  });

  it('opens on the night in progress when the URL names none, never a fixed date', async () => {
    const screen = await openSelection('/night?site=GS');

    // Derived with the function the page uses, so this cannot decay the way a hardcoded date would.
    const inProgress = observingNightOf('GS', Date.now());
    await expect.element(screen.getByTestId('probe-night')).toHaveTextContent(inProgress);
  });

  it('rolls tonight over at 14:00 site time', async () => {
    // The clock only, so the router and the locators keep their real timers.
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    try {
      vi.setSystemTime(observingNightInterval('GS', '2025-11-14').end - 60_000);
      const screen = await openSelection('/night?site=GS');
      await expect.element(screen.getByTestId('probe-tonight')).toHaveTextContent('2025-11-14');
      await expect.element(screen.getByTestId('probe-night')).toHaveTextContent('2025-11-14');

      vi.advanceTimersByTime(2 * 60_000);

      await expect.element(screen.getByTestId('probe-tonight')).toHaveTextContent('2025-11-15');
      await expect.element(screen.getByTestId('probe-night')).toHaveTextContent('2025-11-15');
    } finally {
      vi.useRealTimers();
    }
  });

  it('reads an unknown site as Gemini North rather than rendering nothing', async () => {
    const screen = await openSelection('/night?site=elsewhere');

    await expect.element(screen.getByTestId('probe-site')).toHaveTextContent('GN');
  });

  it('keeps the semester across a site change, since both sites publish the same semesters', async () => {
    const screen = await openSelection('/semester?site=GN&semester=2026B');

    await screen.getByRole('button', { name: 'to GS' }).click();

    await expect.element(screen.getByTestId(PROBE_URL_TESTID)).toMatchTextContent('site=GS');
    await expect.element(screen.getByTestId(PROBE_URL_TESTID)).toMatchTextContent('semester=2026B');
  });

  it('drops the night from the URL for Tonight, rather than writing today into it', async () => {
    const screen = await openSelection('/night?site=GS&night=2025-11-14');

    await screen.getByRole('button', { name: 'tonight' }).click();

    await expect.element(screen.getByTestId(PROBE_URL_TESTID)).toHaveTextContent('/night?site=GS');
    await expect.element(screen.getByTestId('probe-night')).toHaveTextContent(observingNightOf('GS', Date.now()));
  });
});

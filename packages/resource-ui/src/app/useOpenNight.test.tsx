import type { JSX } from 'react';
import { useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';

import { Probe, PROBE_URL_TESTID } from '@/test/probe';
import { renderApp } from '@/test/renderApp';

import { useOpenNight } from './useOpenNight';
import { useSelection } from './useSelection';

/** Its own component, not a second `Probe`: two routes at one position would reuse the fiber. */
function NightProbe(): JSX.Element {
  const { observingNight } = useSelection();
  const location = useLocation();

  return (
    <div>
      <span data-testid={PROBE_URL_TESTID}>{`${location.pathname}${location.search}`}</span>
      <span data-testid="probe-night">{observingNight}</span>
    </div>
  );
}

/** A per-value counter: a changed number is exactly the `update()` that redraws the chart. */
const identities = new Map<unknown, number>();
const identityOf = (value: unknown): string => {
  const seen = identities.get(value);
  if (seen !== undefined) {
    return String(seen);
  }
  const next = identities.size + 1;
  identities.set(value, next);
  return String(next);
};

const openProbe = async (route: string) =>
  renderApp({
    route,
    element: (
      <Probe
        use={() => ({ openNight: useOpenNight(), selection: useSelection() })}
        readout={({ openNight }) => ({ identity: identityOf(openNight) })}
        actions={({ openNight, selection }) => [
          { label: 'open 2025-12-24', run: () => openNight('2025-12-24') },
          { label: 'to UTC', run: () => selection.setTimeDisplay('utc') },
        ]}
      />
    ),
    extraRoutes: [{ path: '/night', element: <NightProbe /> }],
  });

describe(useOpenNight, () => {
  it('lands on the night view at the night asked for', async () => {
    const screen = await openProbe('/semester?site=GS&semester=2025B');

    await screen.getByRole('button', { name: 'open 2025-12-24' }).click();

    await expect.element(screen.getByTestId(PROBE_URL_TESTID)).toHaveTextContent('/night');
    await expect.element(screen.getByTestId('probe-night')).toHaveTextContent('2025-12-24');
  });

  it('carries the rest of the selection over, so the jump does not change the site or the clock', async () => {
    const screen = await openProbe('/semester?site=GS&semester=2025B&clock=utc&view=calendar');

    await screen.getByRole('button', { name: 'open 2025-12-24' }).click();

    const url = screen.getByTestId(PROBE_URL_TESTID);
    await expect.element(url).toHaveTextContent('site=GS');
    await expect.element(url).toHaveTextContent('semester=2025B');
    await expect.element(url).toHaveTextContent('clock=utc');
  });

  it('replaces a night already in the URL rather than appending a second one', async () => {
    const screen = await openProbe('/semester?site=GS&night=2025-11-14');

    await screen.getByRole('button', { name: 'open 2025-12-24' }).click();

    await expect.element(screen.getByTestId('probe-night')).toHaveTextContent('2025-12-24');
    await expect.element(screen.getByTestId(PROBE_URL_TESTID)).not.toHaveTextContent('2025-11-14');
  });

  it('keeps one identity across a URL change, so a chart holding it is not asked to redraw', async () => {
    const screen = await openProbe('/semester?site=GS&semester=2025B');
    const before = screen.getByTestId('probe-identity').element().textContent;

    await screen.getByRole('button', { name: 'to UTC' }).click();
    await expect.element(screen.getByTestId(PROBE_URL_TESTID)).toHaveTextContent('clock=utc');

    await expect.element(screen.getByTestId('probe-identity')).toHaveTextContent(before ?? '');
  });

  it('opens the night the current URL asks for, not the one it was created under', async () => {
    // The callback reads the location through a ref; a stale closure would carry the first clock.
    const screen = await openProbe('/semester?site=GS&semester=2025B');

    await screen.getByRole('button', { name: 'to UTC' }).click();
    await expect.element(screen.getByTestId(PROBE_URL_TESTID)).toHaveTextContent('clock=utc');

    await screen.getByRole('button', { name: 'open 2025-12-24' }).click();

    await expect.element(screen.getByTestId(PROBE_URL_TESTID)).toHaveTextContent('clock=utc');
    await expect.element(screen.getByTestId('probe-night')).toHaveTextContent('2025-12-24');
  });
});

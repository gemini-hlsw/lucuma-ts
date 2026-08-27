/**
 * `useOpenNight` - the one way into a night view.
 *
 * Two things it has to do, and the second is the reason it is a hook rather
 * than a line of code at each call site. It must carry the rest of the
 * selection across the jump, so a click from a UTC-clocked GS calendar does
 * not land on a GN night in site time. And it must be **one stable identity**
 * for the life of the component: the function is embedded in Highcharts
 * options, and a fresh identity per URL change triggers `update()` on every
 * masthead clock toggle - a needless redraw of any chart holding it.
 */
import type { JSX } from 'react';
import { useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';

import { Probe, PROBE_URL_TESTID } from '@/test/probe';
import { renderApp } from '@/test/renderApp';

import { useOpenNight } from './useOpenNight';
import { useSelection } from './useSelection';

/**
 * The night view's stand-in, as its own component rather than a second
 * `Probe`.
 *
 * Two routes rendering the same component type at the same position let React
 * reuse the fiber across the navigation, and these two call different numbers
 * of hooks - which is a hook-order violation, not a test artefact.
 */
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

/**
 * The identity of the returned function, as a printable value.
 *
 * A per-value counter rather than a render count: what a chart cares about is
 * whether the *same function* comes back after a re-render, and a changed
 * number here is exactly the `update()` that redraws the chart.
 */
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

    // The masthead clock toggle: a URL change that must not reach the chart.
    await screen.getByRole('button', { name: 'to UTC' }).click();
    await expect.element(screen.getByTestId(PROBE_URL_TESTID)).toHaveTextContent('clock=utc');

    await expect.element(screen.getByTestId('probe-identity')).toHaveTextContent(before ?? '');
  });

  it('opens the night the current URL asks for, not the one it was created under', async () => {
    // The identity is stable, so the callback reads the location through a ref
    // rather than a closure. That is the trap: a stale closure would carry the
    // clock the component first rendered with.
    const screen = await openProbe('/semester?site=GS&semester=2025B');

    await screen.getByRole('button', { name: 'to UTC' }).click();
    await expect.element(screen.getByTestId(PROBE_URL_TESTID)).toHaveTextContent('clock=utc');

    await screen.getByRole('button', { name: 'open 2025-12-24' }).click();

    await expect.element(screen.getByTestId(PROBE_URL_TESTID)).toHaveTextContent('clock=utc');
    await expect.element(screen.getByTestId('probe-night')).toHaveTextContent('2025-12-24');
  });
});

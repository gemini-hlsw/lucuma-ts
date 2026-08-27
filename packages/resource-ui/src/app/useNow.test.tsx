/**
 * `useNow` and the `nowWithin` contract behind the timeline's NOW marker.
 *
 * Two things worth pinning. The clock has to actually advance, or the marker
 * freezes where the page opened. And it has to stop advancing when the
 * component goes: an interval left running after unmount sets state on nothing
 * and keeps a timer alive for the life of the tab.
 */
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';

import { nowWithin, useNow } from './useNow';

function Clock({ intervalMs }: { intervalMs: number }): React.JSX.Element {
  return <span data-testid="clock">{String(useNow(intervalMs))}</span>;
}

describe(useNow, () => {
  it('starts at the current time rather than at zero', async () => {
    const before = Date.now();
    const screen = await render(<Clock intervalMs={60_000} />);

    const shown = Number(screen.getByTestId('clock').element().textContent);
    expect(shown).toBeGreaterThanOrEqual(before);
    expect(shown).toBeLessThanOrEqual(Date.now());
  });

  it('advances on its own interval, so the NOW marker does not freeze where the page opened', async () => {
    const screen = await render(<Clock intervalMs={20} />);
    const first = screen.getByTestId('clock').element().textContent;

    // Real timers and a real assertion on the DOM: the marker's whole job is
    // to move, and `expect.poll` retries until it has.
    await expect.poll(() => screen.getByTestId('clock').element().textContent).not.toBe(first);
  });

  it('stops when the component does, so no timer outlives what it was updating', async () => {
    // Fake timers only here, and only for the negative assertion - the timer
    // must *never* fire again. React's own scheduler stays on real timers.
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    try {
      const screen = await render(<Clock intervalMs={20} />);
      await screen.unmount();

      const pending = vi.getTimerCount();
      expect(pending).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe(nowWithin, () => {
  const interval = { start: 100, end: 200 };

  it('reports the instant when it falls inside the window', () => {
    expect(nowWithin(150, interval)).toBe(150);
  });

  it('includes the start and excludes the end, like every interval here', () => {
    expect(nowWithin(100, interval)).toBe(100);
    expect(nowWithin(200, interval)).toBeNull();
  });

  it('reports nothing outside the window, so no marker is drawn off the axis', () => {
    expect(nowWithin(99, interval)).toBeNull();
    expect(nowWithin(201, interval)).toBeNull();
  });

  it('reports nothing when there is no window at all', () => {
    expect(nowWithin(150, undefined)).toBeNull();
  });
});

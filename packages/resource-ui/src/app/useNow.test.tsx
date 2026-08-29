/**
 * `useNow`, the clock behind the timeline's NOW marker.
 *
 * Two things worth pinning. The clock has to actually advance, or the marker
 * freezes where the page opened. And it has to stop advancing when the
 * component goes: an interval left running after unmount sets state on nothing
 * and keeps a timer alive for the life of the tab.
 */
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';

import { useNow } from './useNow';

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

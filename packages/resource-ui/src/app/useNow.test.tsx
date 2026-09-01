/** The clock has to advance, and has to stop advancing when the component goes. */
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
    // Fake timers only here, and only for the negative assertion; React's scheduler stays real.
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

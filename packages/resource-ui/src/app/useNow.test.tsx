import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';

import { observingNightInterval, observingNightOf } from '@/domain/siteTime';

import { every, nightBoundaries, type TickSchedule, useNow } from './useNow';

function Clock({ schedule }: { schedule: TickSchedule }): React.JSX.Element {
  return <span data-testid="clock">{String(useNow(schedule))}</span>;
}

const shown = (screen: Awaited<ReturnType<typeof render>>): number =>
  Number(screen.getByTestId('clock').element().textContent);

describe(useNow, () => {
  it('starts at the current time rather than at zero', async () => {
    const before = Date.now();
    const screen = await render(<Clock schedule={every(60_000)} />);

    expect(shown(screen)).toBeGreaterThanOrEqual(before);
    expect(shown(screen)).toBeLessThanOrEqual(Date.now());
  });

  it('advances on its own schedule, so the NOW marker does not freeze where the page opened', async () => {
    const screen = await render(<Clock schedule={every(20)} />);
    const first = shown(screen);

    await expect.poll(() => shown(screen)).not.toBe(first);
  });

  describe(nightBoundaries, () => {
    const night = observingNightInterval('GS', '2025-11-14');

    it('waits for 14:00 site time rather than ticking before it', async () => {
      vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
      try {
        vi.setSystemTime(night.end - 30_000);
        const screen = await render(<Clock schedule={nightBoundaries('GS')} />);
        const opened = shown(screen);

        vi.advanceTimersByTime(20_000);
        await expect.poll(() => shown(screen)).toBe(opened);

        vi.advanceTimersByTime(40_000);
        await expect.poll(() => shown(screen)).toBeGreaterThanOrEqual(night.end);
        expect(observingNightOf('GS', shown(screen))).toBe('2025-11-15');
      } finally {
        vi.useRealTimers();
      }
    });

    it('re-reads the clock when the tab comes back, since a sleeping tab fires its timers late', async () => {
      vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
      try {
        vi.setSystemTime(night.start + 6 * 3_600_000);
        const screen = await render(<Clock schedule={nightBoundaries('GS')} />);

        vi.setSystemTime(night.end + 6 * 3_600_000);
        document.dispatchEvent(new Event('visibilitychange'));

        await expect.poll(() => shown(screen)).toBe(night.end + 6 * 3_600_000);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  it('stops when the component does, so no timer outlives what it was updating', async () => {
    // Fake timers only here, and only for the negative assertion; React's scheduler stays real.
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    try {
      const screen = await render(<Clock schedule={every(20)} />);
      await screen.unmount();

      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});

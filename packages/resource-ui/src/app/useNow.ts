import { useEffect, useState } from 'react';

import { DAY_MS, nextNightBoundary } from '@/domain/siteTime';
import type { Site } from '@/domain/types';

/** Given the clock now, the instant the clock should next be read. */
export type TickSchedule = (now: number) => number;

const everySchedules = new Map<number, TickSchedule>();

export const every = (ms: number): TickSchedule => {
  let schedule = everySchedules.get(ms);
  if (schedule === undefined) {
    schedule = (now) => now + ms;
    everySchedules.set(ms, schedule);
  }
  return schedule;
};

const nightSchedules = new Map<Site, TickSchedule>();

/** Ticks at 14:00 site-local, for every reader that only needs to know which night it is. */
export const nightBoundaries = (site: Site): TickSchedule => {
  let schedule = nightSchedules.get(site);
  if (schedule === undefined) {
    schedule = (now) => nextNightBoundary(site, now);
    nightSchedules.set(site, schedule);
  }
  return schedule;
};

/**
 * For labels alone. Never pass the value to a helper that also takes a timeline: the React Compiler keys
 * that helper's scope on `now`, the chart options take a new identity, and the Highcharts wrapper answers
 * with a full `chart.update` every tick, which is the redraw that lost bars sharing a start night.
 */
export function useNow(schedule: TickSchedule): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    // An interval re-armed per tick, not a setTimeout: the page tests fake setInterval alone so that
    // their polling keeps the real setTimeout.
    const arm = (from: number): void => {
      clearInterval(timer);
      timer = setInterval(tick, Math.min(DAY_MS, Math.max(0, schedule(from) - from)));
    };
    const tick = (): void => {
      const current = Date.now();
      setNow(current);
      arm(current);
    };
    // A sleeping tab fires its timers late, so the clock is re-read when the tab comes back.
    const onVisible = (): void => {
      if (document.visibilityState === 'visible') {
        tick();
      }
    };
    arm(Date.now());
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [schedule]);
  return now;
}

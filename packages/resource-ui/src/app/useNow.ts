/**
 * The current time as epoch milliseconds, refreshed on an interval.
 *
 * Drives the timeline's NOW marker; a minute of drift is invisible at night scale,
 * so the default tick is 60 s.
 */
import { useEffect, useState } from 'react';

export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** `now` when it falls inside the interval, else null - the timeline marker contract. */
export const nowWithin = (now: number, interval: { start: number; end: number } | undefined): number | null =>
  interval !== undefined && now >= interval.start && now < interval.end ? now : null;

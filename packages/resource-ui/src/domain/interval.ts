/** Shared interval predicates for night-scoped block math. */
import type { Interval } from './types';

/** True when the block's interval contains the whole night. */
export const coversNight = (interval: Interval, night: Interval): boolean =>
  interval.start <= night.start && interval.end >= night.end;

/** The instant halfway through - where the week and month axes put a night's tick. */
export const midpoint = (interval: Interval): number => (interval.start + interval.end) / 2;

/** Shared interval helpers for night-scoped block math. */
import type { Interval } from './types';

/** The instant halfway through - where the week and month axes put a night's tick. */
export const midpoint = (interval: Interval): number => (interval.start + interval.end) / 2;

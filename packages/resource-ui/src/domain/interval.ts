import type { Interval } from './types';

/** The overlap of two intervals, or null when they miss. */
export const clip = (interval: Interval, bounds: Interval): Interval | null => {
  const start = Math.max(interval.start, bounds.start);
  const end = Math.min(interval.end, bounds.end);
  return start < end ? { start, end } : null;
};

export const overlaps = (a: Interval, b: Interval): boolean => clip(a, b) !== null;

/** Where consecutive records meet, or the two edges of the gap between them. */
export const transitionsOf = (records: readonly { readonly interval: Interval }[]): readonly number[] =>
  records.slice(1).flatMap((record, index) => {
    const previous = records[index];
    return previous !== undefined && previous.interval.end < record.interval.start
      ? [previous.interval.end, record.interval.start]
      : [record.interval.start];
  });

/** The instant halfway through - where the week and month axes put a night's tick. */
export const midpoint = (interval: Interval): number => (interval.start + interval.end) / 2;

/** Shared interval helpers for night-scoped block math. */
import type { Interval } from './types';

/** Both finders ask this of their own record type, so it is generic over anything with an interval. */
export const overlaps = (a: Interval, b: Interval): boolean => a.start < b.end && b.start < a.end;

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

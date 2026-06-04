/**
 * Time and interval utilities for the tonight timeline.
 */
import type { Site } from '../../gql/gen/graphql';
import type { TimestampInterval } from './types';

const DEMO_NOW = '2026-08-02T00:30:00-10:00';

export type TimelineTimeDisplay = 'site' | 'utc';

const siteTimezones = {
  GN: 'Pacific/Honolulu',
  GS: 'America/Santiago',
} satisfies Record<Site, string>;

const getTimeZone = (site: Site, timeDisplay: TimelineTimeDisplay): string =>
  timeDisplay === 'utc' ? 'UTC' : siteTimezones[site];

/**
 * Converts an ISO timestamp into epoch milliseconds.
 */
export const getTimestamp = (value: string): number => new Date(value).getTime();

/**
 * Formats a timestamp for compact timeline display.
 */
export const formatTime = (value: string | Date, site: Site, timeDisplay: TimelineTimeDisplay): string =>
  new Date(value).toLocaleTimeString([], {
    timeZone: getTimeZone(site, timeDisplay),
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

/**
 * Returns the fixed current timestamp used by the demo timeline.
 */
export const getNowTimestamp = (): string => DEMO_NOW;

/**
 * Returns true when a timestamp falls within a half-open interval.
 */
export const isWithinInterval = (value: string | Date, interval: TimestampInterval): boolean => {
  const timestamp = value instanceof Date ? value.getTime() : getTimestamp(value);

  return timestamp >= getTimestamp(interval.start) && timestamp < getTimestamp(interval.end);
};

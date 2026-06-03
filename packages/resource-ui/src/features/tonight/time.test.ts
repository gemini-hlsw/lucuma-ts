import { describe, expect, it } from 'vitest';

import { timelineFactory } from '../../test/factories';
import { formatTime, getNowTimestamp, getTimestamp, isWithinInterval } from './time';

const observingNightInterval = timelineFactory.interval('2026-08-01T19:00:00-10:00', '2026-08-02T08:00:00-10:00');

describe(getTimestamp.name, () => {
  it('converts an ISO timestamp to epoch milliseconds', () => {
    expect(getTimestamp('2026-08-01T19:00:00-10:00')).toBe(new Date('2026-08-01T19:00:00-10:00').getTime());
  });
});

describe(formatTime.name, () => {
  it('formats Gemini North times in the telescope site timezone', () => {
    expect(formatTime('2026-08-02T05:00:00Z', 'GN', 'site')).toBe('19:00');
  });

  it('formats Gemini South times in the telescope site timezone', () => {
    expect(formatTime('2026-08-01T23:00:00Z', 'GS', 'site')).toBe('19:00');
  });

  it('formats times in UTC when UTC display is selected', () => {
    expect(formatTime('2026-08-02T05:00:00Z', 'GN', 'utc')).toBe('05:00');
  });
});

describe(getNowTimestamp.name, () => {
  it('returns the fixed demo timestamp', () => {
    expect(getNowTimestamp()).toBe('2026-08-02T00:30:00-10:00');
  });
});

describe(isWithinInterval.name, () => {
  it('returns true for a timestamp inside the interval', () => {
    expect(isWithinInterval('2026-08-02T00:30:00-10:00', observingNightInterval)).toBe(true);
  });

  it('includes the interval start', () => {
    expect(isWithinInterval('2026-08-01T19:00:00-10:00', observingNightInterval)).toBe(true);
  });

  it('excludes the interval end', () => {
    expect(isWithinInterval('2026-08-02T08:00:00-10:00', observingNightInterval)).toBe(false);
  });

  it('accepts Date values', () => {
    expect(isWithinInterval(new Date('2026-08-02T00:30:00-10:00'), observingNightInterval)).toBe(true);
  });
});

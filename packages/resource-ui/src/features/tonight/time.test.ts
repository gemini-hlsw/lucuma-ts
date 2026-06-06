import { describe, expect, it } from 'vitest';

import { formatTime, getDurationLabel, getNowTimestamp, getTimestamp } from './time';

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

describe(getDurationLabel.name, () => {
  it('formats seconds as minutes', () => {
    expect(getDurationLabel(45 * 60)).toBe('45 minutes');
  });

  it('formats seconds as hours and minutes', () => {
    expect(getDurationLabel(11.5 * 60 * 60)).toBe('11 hours 30 minutes');
  });

  it('formats seconds as days and hours', () => {
    expect(getDurationLabel((2 * 24 + 4) * 60 * 60)).toBe('2 days 4 hours');
  });
});

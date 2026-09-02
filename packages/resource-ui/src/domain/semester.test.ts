import { describe, expect, it } from 'vitest';

import { addDays, isWeekendDate } from './semester';

describe(addDays, () => {
  it('crosses month boundaries', () => {
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01');
  });
});

// 7 to 10 August 2026 runs Friday, Saturday, Sunday, Monday.
describe(isWeekendDate, () => {
  it('takes Saturday and Sunday', () => {
    expect(isWeekendDate('2026-08-08')).toBe(true);
    expect(isWeekendDate('2026-08-09')).toBe(true);
  });

  it('leaves out the weekdays on either side of them', () => {
    expect(isWeekendDate('2026-08-07')).toBe(false);
    expect(isWeekendDate('2026-08-10')).toBe(false);
  });
});

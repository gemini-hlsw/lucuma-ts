import { describe, expect, it } from 'vitest';

import { addDays } from './semester';

describe(addDays, () => {
  it('crosses month boundaries', () => {
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01');
  });
});

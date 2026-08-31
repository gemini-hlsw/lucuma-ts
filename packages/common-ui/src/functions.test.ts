import {
  firstIfOnlyOne,
  formatDateTime,
  formatToSignedArcseconds,
  isNotNullish,
  isNullish,
  parseNumber,
  round,
  when,
} from './functions.ts';

describe(isNullish, () => {
  it('should return true for null or undefined', () => {
    expect(isNullish(null)).toBe(true);
    expect(isNullish(undefined)).toBe(true);
  });

  it('should return false for non-nullish values', () => {
    expect(isNullish(0)).toBe(false);
    expect(isNullish('')).toBe(false);
    expect(isNullish([])).toBe(false);
    expect(isNullish({})).toBe(false);
    expect(isNullish(1)).toBe(false);
  });
});

describe(isNotNullish, () => {
  it('should return false for null or undefined', () => {
    expect(isNotNullish(null)).toBe(false);
    expect(isNotNullish(undefined)).toBe(false);
  });

  it('should return true for non-nullish values', () => {
    expect(isNotNullish(0)).toBe(true);
    expect(isNotNullish('')).toBe(true);
    expect(isNotNullish([])).toBe(true);
    expect(isNotNullish({})).toBe(true);
    expect(isNotNullish(1)).toBe(true);
  });
});

describe(formatToSignedArcseconds, () => {
  it('should format signed arcseconds correctly', () => {
    expect(formatToSignedArcseconds(360 * 60 * 60)).toBe('0.00');
    expect(formatToSignedArcseconds(180 * 60 * 60)).toBe('-648000.00');
    expect(formatToSignedArcseconds(90 * 60 * 60)).toBe('324000.00');
    expect(formatToSignedArcseconds(-90 * 60 * 60)).toBe('-324000.00');
    expect(formatToSignedArcseconds(270 * 60 * 60)).toBe('-324000.00');
  });

  it('should handle string inputs', () => {
    expect(formatToSignedArcseconds('1.234567'), 'Custom Default').toBe('1.23');
    expect(formatToSignedArcseconds('-1.234567')).toBe('-1.23');
    expect(formatToSignedArcseconds('0')).toBe('0.00');
  });

  it('should return "N/A" for nullish values', () => {
    expect(formatToSignedArcseconds(null)).toBe('N/A');
    expect(formatToSignedArcseconds(undefined)).toBe('N/A');
  });

  it('should return default value for non-numeric strings', () => {
    expect(formatToSignedArcseconds('not a number')).toBe('N/A');
  });

  it('should return custom default value', () => {
    expect(formatToSignedArcseconds(null, 'Custom Default')).toBe('Custom Default');
    expect(formatToSignedArcseconds(undefined, 'Custom Default')).toBe('Custom Default');
  });
});

describe(round, () => {
  it('should round numbers correctly', () => {
    expect(round(1.23, 2)).toBe('1.23');
    expect(round(1.2349, 2)).toBe('1.23');
    expect(round(1.235, 2)).toBe('1.24');
    expect(round(-1.2349, 2)).toBe('-1.23');
    expect(round(-1.235, 2)).toBe('-1.24');
    expect(round(1.2, 3)).toBe('1.200');
    expect(round(1.9999, 3)).toBe('2.000');
  });

  it('should handle zero decimals', () => {
    expect(round(1.5, 0)).toBe('2');
    expect(round(1.4, 0)).toBe('1');
  });

  it('throws for negative decimals', () => {
    expect(() => round(1.2345, -2)).toThrow();
  });
});

describe(when, () => {
  it('should return the value when condition is not nullish', () => {
    expect(when('value', (t) => t)).toBe('value');
    expect(when(true, () => 'value')).toBe('value');
  });
  it('should return undefined when condition is nullish', () => {
    expect(when(null, (t) => t)).toBeUndefined();
    expect(when(undefined, (t) => t)).toBeUndefined();
    expect(when(false, (t) => t)).toBeUndefined();
  });

  it('should return third arg when condition is nullish', () => {
    expect(
      when(
        null,
        (t) => t,
        () => 'default',
      ),
    ).toBe('default');
    expect(
      when(
        undefined,
        (t) => t,
        () => 'default',
      ),
    ).toBe('default');
  });
});

describe(firstIfOnlyOne, () => {
  it('should return the first element if there is only one', () => {
    expect(firstIfOnlyOne([1])).toBe(1);
    expect(firstIfOnlyOne(['a'])).toBe('a');
  });

  it('should return null if there are multiple elements', () => {
    expect(firstIfOnlyOne([1, 2])).toBeNull();
    expect(firstIfOnlyOne(['a', 'b'])).toBeNull();
  });

  it('should return null for an empty array', () => {
    expect(firstIfOnlyOne([])).toBeNull();
  });

  it('should return null for undefined input', () => {
    expect(firstIfOnlyOne(undefined)).toBeNull();
  });
});

describe(formatDateTime, () => {
  it('should format date with seconds', () => {
    const date = new Date('2024-01-01 12:34:56');
    expect(formatDateTime(date)).toBe('2024-01-01 12:34:56');
  });

  it('should format date without seconds', () => {
    const date = new Date('2024-01-01 12:34:56');
    expect(formatDateTime(date, false)).toBe('2024-01-01 12:34');
  });

  it('should handle string input', () => {
    expect(formatDateTime('2024-01-01 12:34:56')).toBe('2024-01-01 12:34:56');
  });
});

describe(parseNumber, () => {
  it('should parse strings', () => {
    expect(parseNumber('1.5')).toBe(1.5);
    expect(parseNumber('-3')).toBe(-3);
  });

  it('should pass numbers through', () => {
    expect(parseNumber(1.5)).toBe(1.5);
    expect(parseNumber(0)).toBe(0);
  });

  it('should convert bigints', () => {
    expect(parseNumber(42n)).toBe(42);
    expect(parseNumber(-7n)).toBe(-7);
  });

  it('should return undefined for undefined input', () => {
    expect(parseNumber(undefined)).toBeUndefined();
  });

  it('should return NaN for non-numeric strings', () => {
    expect(parseNumber('not a number')).toBeUndefined();
  });
});

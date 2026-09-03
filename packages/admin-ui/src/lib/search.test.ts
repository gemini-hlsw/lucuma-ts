import { describe, expect, it } from 'vitest';

import { matchesQuery } from './search';

describe(matchesQuery, () => {
  const fields = ['G-2027B-0123-Q', 'Ada Lovelace', 'Globular clusters'];

  it('matches a case-insensitive substring in any field', () => {
    expect(matchesQuery(fields, 'lovelace')).toBe(true);
    expect(matchesQuery(fields, 'CLUSTERS')).toBe(true);
    expect(matchesQuery(fields, '0123')).toBe(true);
  });

  it('returns false when no field contains the query', () => {
    expect(matchesQuery(fields, 'nebula')).toBe(false);
  });

  it('treats an empty or whitespace-only query as "match everything"', () => {
    expect(matchesQuery(fields, '')).toBe(true);
    expect(matchesQuery(fields, '   ')).toBe(true);
    expect(matchesQuery([], '')).toBe(true);
  });

  it('trims surrounding whitespace before comparing', () => {
    expect(matchesQuery(fields, '  ada  ')).toBe(true);
  });

  it('skips nullish fields rather than throwing', () => {
    expect(matchesQuery([null, undefined, 'Ada'], 'ada')).toBe(true);
    expect(matchesQuery([null, undefined], 'ada')).toBe(false);
  });
});

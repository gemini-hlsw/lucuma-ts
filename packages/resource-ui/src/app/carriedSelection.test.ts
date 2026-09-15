import { describe, expect, it } from 'vitest';

import { carrySelection, searchString } from './carriedSelection';

describe(carrySelection, () => {
  it('copies only the carried keys that are present, dropping every other parameter', () => {
    const params = new URLSearchParams('site=GS&night=2025-01-01&semester=2025B&q=foo');

    const carried = carrySelection(params);

    expect([...carried.entries()]).toEqual([
      ['site', 'GS'],
      ['night', '2025-01-01'],
    ]);
  });

  it('omits a carried key entirely rather than writing it empty when the source lacks it', () => {
    const params = new URLSearchParams('site=GS');

    const carried = carrySelection(params);

    expect(carried.has('night')).toBe(false);
  });

  it('returns an empty result when none of the carried keys are present', () => {
    const params = new URLSearchParams('semester=2025B&view=calendar');

    expect([...carrySelection(params).keys()]).toEqual([]);
  });

  it('carries a caller-supplied key list instead of the default site and night', () => {
    const params = new URLSearchParams('site=GS&night=2025-01-01');

    const carried = carrySelection(params, ['site']);

    expect([...carried.keys()]).toEqual(['site']);
  });

  it('leaves the source params untouched', () => {
    const params = new URLSearchParams('site=GS&night=2025-01-01');

    carrySelection(params);

    expect(params.toString()).toBe('site=GS&night=2025-01-01');
  });
});

describe(searchString, () => {
  it('renders no query string at all for empty params', () => {
    expect(searchString(new URLSearchParams())).toBe('');
  });

  it('prefixes a non-empty query string with exactly one "?"', () => {
    expect(searchString(new URLSearchParams('site=GS'))).toBe('?site=GS');
  });
});

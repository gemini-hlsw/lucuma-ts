import { describe, expect, it } from 'vitest';

import { CURRENT_ENV } from '@/auth/environments';

import { exploreProgramUrl } from './explore';

describe(exploreProgramUrl, () => {
  it('addresses the program by its reference under the running environment', () => {
    // Tests run on localhost, which resolves to the local-dev entry — its
    // Explore is the dev deployment, never production (see environments.ts).
    expect(exploreProgramUrl('G-2026B-0298-P')).toBe(`${CURRENT_ENV.exploreUri}/G-2026B-0298-P`);
    expect(exploreProgramUrl('G-2026B-0298-P')).toBe('https://explore-dev.lucuma.xyz/G-2026B-0298-P');
  });

  it('leaves an ordinary reference label untouched', () => {
    // Every real label is already URL-safe, so encoding must not alter it —
    // otherwise the link would break for the only inputs that actually occur.
    for (const label of ['G-2026B-0298-P', 'G-2027A-0001-Q', 'GS-2025B-FT-218']) {
      expect(exploreProgramUrl(label)).toBe(`${CURRENT_ENV.exploreUri}/${label}`);
    }
  });

  it('escapes a label that would otherwise change the URL it addresses', () => {
    // Labels are ODB-assigned and safe today, but nothing in the type system
    // says so: a slash would walk the path and a query character would start a
    // query string, both pointing the link somewhere other than the program.
    expect(exploreProgramUrl('../admin')).toBe(`${CURRENT_ENV.exploreUri}/..%2Fadmin`);
    expect(exploreProgramUrl('G-1?x=1')).toBe(`${CURRENT_ENV.exploreUri}/G-1%3Fx%3D1`);
    expect(exploreProgramUrl('a b')).toBe(`${CURRENT_ENV.exploreUri}/a%20b`);
  });
});

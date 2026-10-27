import { describe, expect, it } from 'vitest';

import { resolveSemester } from './coverage';
import type { PublishedSemester } from './types';

const semester = (
  over: Partial<PublishedSemester> & Pick<PublishedSemester, 'semester' | 'firstNight' | 'lastNight'>,
): PublishedSemester => ({
  site: 'GS',
  ...over,
});

const GS = [
  semester({ semester: '2025A', firstNight: '2025-02-02', lastNight: '2025-08-01' }),
  semester({ semester: '2025B', firstNight: '2025-08-02', lastNight: '2026-02-01' }),
  semester({ semester: '2026B', firstNight: '2026-08-02', lastNight: '2027-02-01' }),
];

describe(resolveSemester, () => {
  it('honours an explicit request that names a semester the site holds', () => {
    // Even when the night sits in another semester: a /semester link means the semester it says.
    expect(resolveSemester(GS, 'GS', '2025A', '2025-11-14')?.semester).toBe('2025A');
  });

  it('follows the night when the request is absent or names nothing the site holds', () => {
    expect(resolveSemester(GS, 'GS', null, '2025-11-14')?.semester).toBe('2025B');
    // The stale name a link can carry - another site's semester.
    expect(resolveSemester(GS, 'GS', '2031A', '2025-11-14')?.semester).toBe('2025B');
  });

  it('lands on the nearest semester when the night is beyond every one of them', () => {
    // Tonight walking past the data's edge must not blank the control.
    expect(resolveSemester(GS, 'GS', null, '2027-06-15')?.semester).toBe('2026B');
    expect(resolveSemester(GS, 'GS', null, '2024-06-15')?.semester).toBe('2025A');
    // 2026-05-01 is 89 nights from 2025B's end and 93 from 2026B's start.
    expect(resolveSemester(GS, 'GS', null, '2026-05-01')?.semester).toBe('2025B');
    expect(resolveSemester(GS, 'GS', null, '2026-07-01')?.semester).toBe('2026B');
  });

  it('never answers with another site, and is null only when the site holds nothing', () => {
    expect(resolveSemester(GS, 'GN', '2025B', '2025-11-14')).toBeNull();
    expect(resolveSemester([], 'GS', '2025B', '2025-11-14')).toBeNull();
  });
});

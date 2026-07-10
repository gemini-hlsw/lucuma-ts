import { describe, expect, it } from 'vitest';

import { type AdminCfpsResult, cfpPropertiesInput, currentSemester, mapCfps, semesterDates } from './cfp';

type RawCfp = AdminCfpsResult['callsForProposals']['matches'][number];
type RawLimits = NonNullable<RawCfp['gemini']>['coordinateLimits']['north'];
type RawPartner = RawCfp['partners'][number];

function limits(raStart: number, raEnd: number, decStart: number, decEnd: number): RawLimits {
  return {
    __typename: 'CoordinateLimits',
    raStart: { __typename: 'RightAscension', hours: raStart },
    raEnd: { __typename: 'RightAscension', hours: raEnd },
    decStart: { __typename: 'Declination', degrees: decStart },
    decEnd: { __typename: 'Declination', degrees: decEnd },
  };
}

function partner(
  geminiPartner: RawPartner['geminiPartner'],
  deadline: string | null,
  override: string | null,
): RawPartner {
  return {
    __typename: 'CallForProposalsPartner',
    geminiPartner,
    submissionDeadline: deadline,
    submissionDeadlineOverride: override,
  };
}

function call(overrides: Partial<RawCfp>): RawCfp {
  return {
    __typename: 'CallForProposals',
    id: 'c-101',
    title: '2025A Regular Semester',
    semester: '2025A',
    active: { __typename: 'DateInterval', start: '2025-02-01', end: '2025-07-31' },
    submissionDeadlineDefault: null,
    partners: [],
    gemini: {
      __typename: 'GeminiCallProperties',
      type: 'REGULAR_SEMESTER',
      allowsNonPartnerPi: false,
      nonPartnerDeadline: null,
      proprietaryMonths: 12,
      instruments: [],
      coordinateLimits: {
        __typename: 'SiteCoordinateLimits',
        north: limits(0, 24, -37, 90),
        south: limits(0, 24, -90, 28),
      },
    },
    ...overrides,
  };
}

const result = (matches: RawCfp[]): AdminCfpsResult => ({
  callsForProposals: { __typename: 'CallsForProposalsSelectResult', matches },
});

describe('mapCfps', () => {
  it('returns an empty array on no matches', () => {
    expect(mapCfps(result([]))).toEqual([]);
  });

  it('projects a Gemini call, keeping instrument enum values and every partner', () => {
    const gemini = call({}).gemini;
    const [c] = mapCfps(
      result([
        call({
          gemini: {
            ...gemini!,
            allowsNonPartnerPi: true,
            nonPartnerDeadline: '2099-01-01T00:00:00Z',
            instruments: ['GMOS_NORTH', 'GMOS_SOUTH', 'FLAMINGOS2', 'GNIRS'],
            coordinateLimits: {
              __typename: 'SiteCoordinateLimits',
              north: limits(4, 1, 323, 90),
              south: limits(5, 2, 270, 28),
            },
          },
          partners: [
            partner('US', '2099-01-01T00:00:00Z', '2099-01-01T00:00:00Z'),
            partner('CA', '2099-01-01T00:00:00Z', null),
          ],
        }),
      ]),
    );
    expect(c?.id).toBe('c-101');
    expect(c?.semester).toBe('2025A');
    // Enum values pass through untouched; labels are applied at render time.
    expect(c?.instruments).toEqual(['GMOS_NORTH', 'GMOS_SOUTH', 'FLAMINGOS2', 'GNIRS']);
    expect(c?.activeStart).toBe('2025-02-01');
    expect(c?.north).toEqual({ raStart: 4, raEnd: 1, decStart: 323, decEnd: 90 });
    expect(c?.south).toEqual({ raStart: 5, raEnd: 2, decStart: 270, decEnd: 28 });
    // EVERY participating partner appears, override or not.
    expect(c?.partners).toEqual([
      { partner: 'US', deadlineOverride: '2099-01-01T00:00:00Z' },
      { partner: 'CA', deadlineOverride: undefined },
    ]);
  });

  it('drops non-Gemini calls (no gemini property block)', () => {
    expect(mapCfps(result([call({ gemini: null })]))).toEqual([]);
  });

  it('is open while today is before the latest partner deadline, closed once all have passed', () => {
    const [open, closed, untracked] = mapCfps(
      result([
        call({ id: 'c-open', partners: [partner('US', '2099-01-01T00:00:00Z', null)] }),
        call({ id: 'c-closed', partners: [partner('US', '2000-01-01T00:00:00Z', null)] }),
        call({ id: 'c-untracked', partners: [] }),
      ]),
    );
    expect(open?.active).toBe(true);
    expect(closed?.active).toBe(false);
    expect(untracked?.active).toBe(false); // no deadlines at all → not yet open
  });
});

describe('cfpPropertiesInput', () => {
  it('serializes an edited call, Gemini properties under `gemini`', () => {
    const input = cfpPropertiesInput({
      id: 'c-101',
      title: '  2025A Regular Semester  ',
      type: 'REGULAR_SEMESTER',
      semester: '2025A',
      activeStart: '2025-02-01',
      activeEnd: '2025-07-31',
      active: true,
      allowsNonPartnerPi: true,
      proprietaryMonths: 12,
      defaultDeadline: '2024-10-01 23:59:59',
      north: { raStart: 4, raEnd: 1, decStart: -37, decEnd: 90 },
      south: { raStart: 5, raEnd: 2, decStart: -90, decEnd: 28 },
      instruments: ['GMOS_NORTH'],
      partners: [
        { partner: 'US', deadlineOverride: '2024-09-15 23:59:59' },
        { partner: 'CA', deadlineOverride: undefined },
      ],
    });
    expect(input).toEqual({
      semester: '2025A',
      title: '2025A Regular Semester',
      activeStart: '2025-02-01',
      activeEnd: '2025-07-31',
      submissionDeadlineDefault: '2024-10-01 23:59:59',
      partners: [{ geminiPartner: 'US', submissionDeadlineOverride: '2024-09-15 23:59:59' }, { geminiPartner: 'CA' }],
      gemini: {
        type: 'REGULAR_SEMESTER',
        proprietaryMonths: 12,
        coordinateLimits: {
          north: { raStart: { hours: 4 }, raEnd: { hours: 1 }, decStart: { degrees: -37 }, decEnd: { degrees: 90 } },
          south: { raStart: { hours: 5 }, raEnd: { hours: 2 }, decStart: { degrees: -90 }, decEnd: { degrees: 28 } },
        },
        instruments: ['GMOS_NORTH'],
      },
    });
    // allowsNonPartnerPi is ODB-derived and must never be sent.
    expect(input.gemini).not.toHaveProperty('allowsNonPartnerPi');
  });
});

describe('currentSemester', () => {
  it('assigns Feb-Jul to A and Aug-Dec to B', () => {
    expect(currentSemester(new Date('2027-02-01T00:00:00Z'))).toBe('2027A');
    expect(currentSemester(new Date('2027-07-31T23:59:59Z'))).toBe('2027A');
    expect(currentSemester(new Date('2027-08-01T00:00:00Z'))).toBe('2027B');
    expect(currentSemester(new Date('2027-12-31T23:59:59Z'))).toBe('2027B');
  });

  it("assigns January to the previous year's B semester", () => {
    expect(currentSemester(new Date('2028-01-15T12:00:00Z'))).toBe('2027B');
  });
});

describe('semesterDates', () => {
  it('spans Feb-Aug for A and Aug-Feb (of the next year) for B', () => {
    expect(semesterDates('2027A')).toEqual({ activeStart: '2027-02-01', activeEnd: '2027-08-01' });
    expect(semesterDates('2027B')).toEqual({ activeStart: '2027-08-01', activeEnd: '2028-02-01' });
  });
});

import { describe, expect, it } from 'vitest';

import type { CallForProposals } from '../types';
import { type AdminCfpsResult, cfpPropertiesInput, mapCfps, newCallInput, semesterDates } from './cfp';

type RawCfp = AdminCfpsResult['callsForProposals']['matches'][number];
type RawLimits = NonNullable<RawCfp['keck']>['coordinateLimits'];
type RawPartner = RawCfp['partners'][number];
type RawExchangePartner = NonNullable<RawCfp['gemini']>['exchangePartners'][number];

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

function exchangePartner(
  who: RawExchangePartner['exchangePartner'],
  deadline: string | null,
  override: string | null,
): RawExchangePartner {
  return {
    __typename: 'CallForProposalsExchangePartner',
    exchangePartner: who,
    submissionDeadline: deadline,
    submissionDeadlineOverride: override,
  };
}

/** The fields common to every call fixture; each `…Call` helper adds exactly
 *  one observatory block, mirroring the ODB one-of invariant. */
function base(overrides: Partial<RawCfp>): Omit<RawCfp, 'observatory' | 'gemini' | 'keck' | 'subaru'> {
  return {
    __typename: 'CallForProposals',
    id: 'c-101',
    existence: 'PRESENT',
    title: '2025A Regular Semester',
    semester: '2025A',
    active: { __typename: 'DateInterval', start: '2025-02-01', end: '2025-07-31' },
    submissionDeadlineDefault: null,
    partners: [],
    ...overrides,
  };
}

function geminiCall(overrides: Partial<RawCfp> = {}, gemini: Partial<NonNullable<RawCfp['gemini']>> = {}): RawCfp {
  return {
    ...base(overrides),
    observatory: 'GEMINI',
    gemini: {
      __typename: 'GeminiCallProperties',
      type: 'REGULAR_SEMESTER',
      allowsNonPartnerPi: false,
      nonPartnerDeadline: null,
      proprietaryMonths: 12,
      instruments: [],
      exchangePartners: [],
      coordinateLimits: {
        __typename: 'SiteCoordinateLimits',
        north: limits(0, 24, -37, 90),
        south: limits(0, 24, -90, 28),
      },
      ...gemini,
    },
    keck: null,
    subaru: null,
  };
}

function keckCall(overrides: Partial<RawCfp> = {}): RawCfp {
  return {
    ...base({ id: 'c-368', title: '2026B Keck Exchange', ...overrides }),
    observatory: 'KECK',
    gemini: null,
    keck: {
      __typename: 'KeckCallProperties',
      instruments: ['HIRES'],
      coordinateLimits: limits(1, 2, -30, 60),
    },
    subaru: null,
  };
}

function subaruCall(overrides: Partial<RawCfp> = {}): RawCfp {
  return {
    ...base({ id: 'c-367', title: '2026B Subaru Exchange', ...overrides }),
    observatory: 'SUBARU',
    gemini: null,
    keck: null,
    subaru: {
      __typename: 'SubaruCallProperties',
      type: 'NORMAL',
      instruments: ['HSC', 'PFS'],
      coordinateLimits: limits(3, 4, -20, 70),
    },
  };
}

const result = (matches: RawCfp[]): AdminCfpsResult => ({
  callsForProposals: { __typename: 'CallsForProposalsSelectResult', matches },
});

describe(mapCfps, () => {
  it('returns an empty array on no matches', () => {
    expect(mapCfps(result([]))).toEqual([]);
  });

  it('projects a Gemini call, keeping instrument enum values and every partner', () => {
    const [c] = mapCfps(
      result([
        geminiCall(
          {
            partners: [
              partner('US', '2099-01-01T00:00:00Z', '2099-01-01T00:00:00Z'),
              partner('CA', '2099-01-01T00:00:00Z', null),
            ],
          },
          {
            allowsNonPartnerPi: true,
            nonPartnerDeadline: '2099-01-01T00:00:00Z',
            instruments: ['GMOS_NORTH', 'GMOS_SOUTH', 'FLAMINGOS2', 'GNIRS'],
            exchangePartners: [
              exchangePartner('KECK', '2099-01-01T00:00:00Z', '2099-01-01T00:00:00Z'),
              exchangePartner('SUBARU', '2099-01-01T00:00:00Z', null),
            ],
            coordinateLimits: {
              __typename: 'SiteCoordinateLimits',
              north: limits(4, 1, 323, 90),
              south: limits(5, 2, 270, 28),
            },
          },
        ),
      ]),
    );
    expect(c?.id).toBe('c-101');
    expect(c?.semester).toBe('2025A');
    expect(c?.activeStart).toBe('2025-02-01');
    expect(c?.details.observatory).toBe('GEMINI');
    if (c?.details.observatory !== 'GEMINI') throw new Error('expected Gemini');
    // Enum values pass through untouched; labels are applied at render time.
    expect(c.details.instruments).toEqual(['GMOS_NORTH', 'GMOS_SOUTH', 'FLAMINGOS2', 'GNIRS']);
    expect(c.details.north).toEqual({ raStart: 4, raEnd: 1, decStart: 323, decEnd: 90 });
    expect(c.details.south).toEqual({ raStart: 5, raEnd: 2, decStart: 270, decEnd: 28 });
    // EVERY participating partner appears, override or not.
    expect(c.partners).toEqual([
      { partner: 'US', deadlineOverride: '2099-01-01T00:00:00Z' },
      { partner: 'CA', deadlineOverride: undefined },
    ]);
    // Exchange partners map the same way (sc-9610), keyed by ExchangePartner.
    expect(c.details.exchangePartners).toEqual([
      { partner: 'KECK', deadlineOverride: '2099-01-01T00:00:00Z' },
      { partner: 'SUBARU', deadlineOverride: undefined },
    ]);
  });

  it('projects a Keck exchange call (single-site limits, no type) — sc-9608 / sc-10123', () => {
    const [c] = mapCfps(result([keckCall()]));
    expect(c?.id).toBe('c-368');
    expect(c?.details.observatory).toBe('KECK');
    if (c?.details.observatory !== 'KECK') throw new Error('expected Keck');
    expect(c.details.instruments).toEqual(['HIRES']);
    expect(c.details.limits).toEqual({ raStart: 1, raEnd: 2, decStart: -30, decEnd: 60 });
  });

  it('projects a Subaru exchange call (its own type + instruments) — sc-9608 / sc-10123', () => {
    const [c] = mapCfps(result([subaruCall()]));
    expect(c?.id).toBe('c-367');
    expect(c?.details.observatory).toBe('SUBARU');
    if (c?.details.observatory !== 'SUBARU') throw new Error('expected Subaru');
    expect(c.details.type).toBe('NORMAL');
    expect(c.details.instruments).toEqual(['HSC', 'PFS']);
    expect(c.details.limits).toEqual({ raStart: 3, raEnd: 4, decStart: -20, decEnd: 70 });
  });

  it('keeps calls of every observatory, one row each (no longer drops exchange calls)', () => {
    const rows = mapCfps(result([geminiCall(), keckCall(), subaruCall()]));
    expect(rows.map((c) => c.details.observatory)).toEqual(['GEMINI', 'KECK', 'SUBARU']);
  });

  it('maps existence to visible (PRESENT visible, DELETED not) — sc-9612', () => {
    const [present] = mapCfps(result([geminiCall({ existence: 'PRESENT' })]));
    const [deleted] = mapCfps(result([geminiCall({ existence: 'DELETED' })]));
    expect(present?.visible).toBe(true);
    expect(deleted?.visible).toBe(false);
  });

  it('is open while today is before the latest partner deadline, closed once all have passed', () => {
    const [open, closed, untracked] = mapCfps(
      result([
        geminiCall({ id: 'c-open', partners: [partner('US', '2099-01-01T00:00:00Z', null)] }),
        geminiCall({ id: 'c-closed', partners: [partner('US', '2000-01-01T00:00:00Z', null)] }),
        geminiCall({ id: 'c-untracked', partners: [] }),
      ]),
    );
    expect(open?.active).toBe(true);
    expect(closed?.active).toBe(false);
    expect(untracked?.active).toBe(false); // no deadlines at all → not yet open
  });

  it('stays open on an exchange-partner deadline alone (sc-9610)', () => {
    const [c] = mapCfps(
      result([
        geminiCall({ id: 'c-exch' }, { exchangePartners: [exchangePartner('KECK', '2099-01-01T00:00:00Z', null)] }),
      ]),
    );
    // No regular partners, but Keck's window is open — the call is open.
    expect(c?.active).toBe(true);
  });
});

/** A view-model call with the common fields filled and the given observatory
 *  details — the shape the editor hands to cfpPropertiesInput. */
function viewCall(details: CallForProposals['details'], overrides: Partial<CallForProposals> = {}): CallForProposals {
  return {
    id: 'c-101',
    visible: true,
    title: '2025A Regular Semester',
    semester: '2025A',
    activeStart: '2025-02-01',
    activeEnd: '2025-07-31',
    active: true,
    defaultDeadline: '',
    partners: [],
    details,
    ...overrides,
  };
}

describe(cfpPropertiesInput, () => {
  it('serializes a Gemini call under `gemini`, trimming the title and dropping ODB-derived fields', () => {
    const input = cfpPropertiesInput(
      viewCall(
        {
          observatory: 'GEMINI',
          type: 'REGULAR_SEMESTER',
          allowsNonPartnerPi: true,
          proprietaryMonths: 12,
          instruments: ['GMOS_NORTH'],
          exchangePartners: [
            { partner: 'KECK', deadlineOverride: '2024-10-04 23:59:59' },
            { partner: 'SUBARU', deadlineOverride: undefined },
          ],
          north: { raStart: 4, raEnd: 1, decStart: -37, decEnd: 90 },
          south: { raStart: 5, raEnd: 2, decStart: -90, decEnd: 28 },
        },
        {
          title: '  2025A Regular Semester  ',
          defaultDeadline: '2024-10-01 23:59:59',
          partners: [
            { partner: 'US', deadlineOverride: '2024-09-15 23:59:59' },
            { partner: 'CA', deadlineOverride: undefined },
          ],
        },
      ),
    );
    expect(input).toEqual({
      existence: 'PRESENT',
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
        exchangePartners: [
          { exchangePartner: 'KECK', submissionDeadlineOverride: '2024-10-04 23:59:59' },
          { exchangePartner: 'SUBARU' },
        ],
      },
    });
    // allowsNonPartnerPi is ODB-derived and must never be sent; only one
    // observatory block may be present.
    expect(input.gemini).not.toHaveProperty('allowsNonPartnerPi');
    expect(input.keck).toBeUndefined();
    expect(input.subaru).toBeUndefined();
  });

  it('serializes a Keck call under `keck` alone (single-site limits, no type) — sc-9608', () => {
    const input = cfpPropertiesInput(
      viewCall({
        observatory: 'KECK',
        instruments: ['HIRES'],
        limits: { raStart: 1, raEnd: 2, decStart: -30, decEnd: 60 },
      }),
    );
    expect(input.keck).toEqual({
      instruments: ['HIRES'],
      coordinateLimits: {
        raStart: { hours: 1 },
        raEnd: { hours: 2 },
        decStart: { degrees: -30 },
        decEnd: { degrees: 60 },
      },
    });
    expect(input.gemini).toBeUndefined();
    expect(input.subaru).toBeUndefined();
  });

  it('serializes a Subaru call under `subaru` alone, keeping its type — sc-9608', () => {
    const input = cfpPropertiesInput(
      viewCall({
        observatory: 'SUBARU',
        type: 'INTENSIVE',
        instruments: ['HSC'],
        limits: { raStart: 3, raEnd: 4, decStart: -20, decEnd: 70 },
      }),
    );
    expect(input.subaru).toEqual({
      type: 'INTENSIVE',
      instruments: ['HSC'],
      coordinateLimits: {
        raStart: { hours: 3 },
        raEnd: { hours: 4 },
        decStart: { degrees: -20 },
        decEnd: { degrees: 70 },
      },
    });
    expect(input.gemini).toBeUndefined();
    expect(input.keck).toBeUndefined();
  });

  it('sends existence DELETED when not visible, PRESENT when visible — sc-9612', () => {
    const details = {
      observatory: 'KECK',
      instruments: [],
      limits: { raStart: 0, raEnd: 0, decStart: 0, decEnd: 0 },
    } as const;
    expect(cfpPropertiesInput(viewCall(details, { visible: true })).existence).toBe('PRESENT');
    expect(cfpPropertiesInput(viewCall(details, { visible: false })).existence).toBe('DELETED');
  });
});

describe(newCallInput, () => {
  it('seeds exactly one observatory block, with a Gemini call type and no others', () => {
    const gemini = newCallInput('GEMINI');
    expect(gemini.gemini).toEqual({ type: 'REGULAR_SEMESTER' });
    expect(gemini.keck).toBeUndefined();
    expect(gemini.subaru).toBeUndefined();

    const keck = newCallInput('KECK');
    expect(keck.keck).toEqual({});
    expect(keck.gemini).toBeUndefined();

    const subaru = newCallInput('SUBARU');
    expect(subaru.subaru).toEqual({});
    expect(subaru.gemini).toBeUndefined();
  });

  it('sets the create-required semester and active dates', () => {
    const input = newCallInput('KECK');
    expect(input.semester).toMatch(/^\d{4}[AB]$/);
    expect(input.activeStart).toBeDefined();
    expect(input.activeEnd).toBeDefined();
  });
});

describe(semesterDates, () => {
  it('spans Feb-Aug for A and Aug-Feb (of the next year) for B', () => {
    expect(semesterDates('2027A')).toEqual({ activeStart: '2027-02-01', activeEnd: '2027-08-01' });
    expect(semesterDates('2027B')).toEqual({ activeStart: '2027-08-01', activeEnd: '2028-02-01' });
  });
});

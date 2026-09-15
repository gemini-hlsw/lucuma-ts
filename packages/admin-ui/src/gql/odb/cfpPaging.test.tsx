import { describe, expect, it } from 'vitest';

import { fakeJwt, standardUser } from '@/test/factories';
import { type MockedResponseOf, renderWithContext } from '@/test/render';

import type { AdminCfpsResult } from './cfp';
import { CFPS_QUERY, useCfps } from './cfp';

const STAFF_TOKEN = fakeJwt(standardUser('staff'));

type RawCfp = AdminCfpsResult['callsForProposals']['matches'][number];

/** A minimal Gemini call match; only `id` matters for these paging tests. */
const cfp = (id: string): RawCfp => ({
  __typename: 'CallForProposals',
  id,
  existence: 'PRESENT',
  title: 'Call',
  semester: '2027A',
  observatory: 'GEMINI',
  active: { __typename: 'DateInterval', start: '2027-02-01', end: '2027-07-31' },
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
      north: {
        __typename: 'CoordinateLimits',
        raStart: { __typename: 'RightAscension', hours: 0 },
        raEnd: { __typename: 'RightAscension', hours: 24 },
        decStart: { __typename: 'Declination', degrees: -90 },
        decEnd: { __typename: 'Declination', degrees: 90 },
      },
      south: {
        __typename: 'CoordinateLimits',
        raStart: { __typename: 'RightAscension', hours: 0 },
        raEnd: { __typename: 'RightAscension', hours: 24 },
        decStart: { __typename: 'Declination', degrees: -90 },
        decEnd: { __typename: 'Declination', degrees: 90 },
      },
    },
  },
  keck: null,
  subaru: null,
});

const page = (offset: string | null, matches: RawCfp[], hasMore: boolean): MockedResponseOf<typeof CFPS_QUERY> => ({
  request: { query: CFPS_QUERY, variables: { offset } },
  result: { data: { callsForProposals: { __typename: 'CallsForProposalsSelectResult', matches, hasMore } } },
});

/** Renders the call ids the hook has loaded, plus its loading flag. */
function Harness() {
  const { data, loading } = useCfps();
  const ids = data?.callsForProposals.matches.map((m) => m.id).join(',') ?? '';
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="ids">{ids}</span>
    </div>
  );
}

describe(useCfps, () => {
  it('follows hasMore so a call past the first page is never dropped (sc-10136)', async () => {
    const screen = await renderWithContext(<Harness />, {
      token: STAFF_TOKEN,
      // A newly-created call lands after the first page; it must still be
      // fetched so it can be selected after New → Create.
      mocks: [page(null, [cfp('c-1'), cfp('c-2')], true), page('c-2', [cfp('c-3'), cfp('c-new')], false)],
    });
    await expect.element(screen.getByTestId('ids')).toHaveTextContent('c-1,c-2,c-3,c-new');
    await expect.element(screen.getByTestId('loading')).toHaveTextContent('false');
  });

  it('settles immediately when the first page is the last', async () => {
    const screen = await renderWithContext(<Harness />, {
      token: STAFF_TOKEN,
      mocks: [page(null, [cfp('c-1')], false)],
    });
    await expect.element(screen.getByTestId('ids')).toHaveTextContent('c-1');
    await expect.element(screen.getByTestId('loading')).toHaveTextContent('false');
  });
});

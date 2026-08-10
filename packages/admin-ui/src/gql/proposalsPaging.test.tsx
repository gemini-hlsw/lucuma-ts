import { describe, expect, it } from 'vitest';

import { fakeJwt, standardUser } from '@/test/factories';
import { type MockedResponseOf, renderWithContext } from '@/test/render';

import type { AdminProposalsResult } from './proposals';
import { PROPOSALS_QUERY, useProposals } from './proposals';

const STAFF_TOKEN = fakeJwt(standardUser('staff'));

type RawProgram = AdminProposalsResult['programs']['matches'][number];

/** A minimal Director's Time program match; only `id` matters for these tests. */
const dd = (id: string): RawProgram => ({
  __typename: 'Program',
  id,
  name: null,
  description: null,
  proposalStatus: 'SUBMITTED',
  pi: null,
  proposal: {
    __typename: 'Proposal',
    reference: null,
    gemini: { __typename: 'DirectorsTime', scienceSubtype: 'DIRECTORS_TIME' },
  },
  observations: { __typename: 'ObservationSelectResult', matches: [] },
  allGroupElements: [],
});

const page = (
  offset: string | null,
  matches: RawProgram[],
  hasMore: boolean,
): MockedResponseOf<typeof PROPOSALS_QUERY> => ({
  request: { query: PROPOSALS_QUERY, variables: { offset } },
  result: { data: { programs: { __typename: 'ProgramSelectResult', matches, hasMore } } },
});

/** Renders the proposal ids the hook has mapped, plus its loading flag. */
function Harness() {
  const { data, loading } = useProposals();
  const ids = data?.programs.matches.map((m) => m.id).join(',') ?? '';
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="ids">{ids}</span>
    </div>
  );
}

describe('useProposals', () => {
  it('follows hasMore so a special proposal past the first page is never dropped (sc-9589)', async () => {
    const screen = await renderWithContext(<Harness />, {
      token: STAFF_TOKEN,
      // The special-type filter runs client-side, so every program page must be
      // fetched — a Director's Time proposal on page 2 (p-new) must still appear.
      mocks: [page(null, [dd('p-1'), dd('p-2')], true), page('p-2', [dd('p-3'), dd('p-new')], false)],
    });
    await expect.element(screen.getByTestId('ids')).toHaveTextContent('p-1,p-2,p-3,p-new');
    await expect.element(screen.getByTestId('loading')).toHaveTextContent('false');
  });

  it('settles immediately when the first page is the last', async () => {
    const screen = await renderWithContext(<Harness />, {
      token: STAFF_TOKEN,
      mocks: [page(null, [dd('p-1')], false)],
    });
    await expect.element(screen.getByTestId('ids')).toHaveTextContent('p-1');
    await expect.element(screen.getByTestId('loading')).toHaveTextContent('false');
  });
});

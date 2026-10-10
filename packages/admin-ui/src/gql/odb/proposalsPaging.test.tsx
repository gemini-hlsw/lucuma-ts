import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';

import { fakeJwt, standardUser } from '@/test/factories';
import { type MockedResponseOf, renderWithContext } from '@/test/render';

import type { ProposalItemFragment } from './gen/graphql';
import { PROPOSALS_QUERY, useProposals } from './proposals';

const STAFF_TOKEN = fakeJwt(standardUser('staff'));

/** A minimal Director's Time program match; only `id` matters for these tests. */
const dd = (id: string): ProposalItemFragment => ({
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
  matches: ProposalItemFragment[],
  hasMore: boolean,
  errors?: readonly { message: string }[],
): MockedResponseOf<typeof PROPOSALS_QUERY> => ({
  request: { query: PROPOSALS_QUERY, variables: { offset } },
  result: { data: { programs: { __typename: 'ProgramSelectResult', matches, hasMore } }, errors },
});

/** Renders the proposal ids the hook has mapped, plus its loading and incomplete flags. */
function Harness() {
  const { data, loading, incomplete, refetch } = useProposals();
  const ids = data?.programs.matches.map((m) => m.id).join(',') ?? '';
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="incomplete">{String(incomplete)}</span>
      <span data-testid="ids">{ids}</span>
      <button type="button" onClick={() => void refetch()}>
        reload
      </button>
    </div>
  );
}

describe(useProposals, () => {
  it('follows hasMore so a special proposal past the first page is never dropped (sc-9589)', async () => {
    const screen = await renderWithContext(<Harness />, {
      token: STAFF_TOKEN,
      // A page past the first must still be fetched — a Director's Time
      // proposal on page 2 (p-new) must still appear (sc-9589).
      mocks: [page(null, [dd('p-1'), dd('p-2')], true), page('p-2', [dd('p-3'), dd('p-new')], false)],
    });
    await expect.element(screen.getByTestId('ids')).toHaveTextContent('p-1,p-2,p-3,p-new');
    await expect.element(screen.getByTestId('loading')).toHaveTextContent('false');
  });

  it('keeps one row per program when a page repeats the previous page’s last row', async () => {
    const screen = await renderWithContext(<Harness />, {
      token: STAFF_TOKEN,
      // The ODB's OFFSET is inclusive: the second page opens with p-2 again.
      mocks: [page(null, [dd('p-1'), dd('p-2')], true), page('p-2', [dd('p-2'), dd('p-3')], false)],
    });
    await expect.element(screen.getByTestId('ids')).toHaveTextContent('p-1,p-2,p-3');
    await expect.element(screen.getByTestId('loading')).toHaveTextContent('false');
  });

  it('settles when the last page only repeats the previous page’s last row', async () => {
    const screen = await renderWithContext(<Harness />, {
      token: STAFF_TOKEN,
      // A total that is one past a page boundary leaves a final page holding just
      // the inclusive cursor row.
      mocks: [page(null, [dd('p-1'), dd('p-2')], true), page('p-2', [dd('p-2')], false)],
    });
    await expect.element(screen.getByTestId('ids')).toHaveTextContent('p-1,p-2');
    await expect.element(screen.getByTestId('loading')).toHaveTextContent('false');
  });

  it('walks past a page that carries per-observation warnings (errorPolicy all)', async () => {
    // Every dev page carries ITC warnings. `fetchMore` rejects a page with errors
    // unless it is given the query's policy, so a walk that ignored it would stop
    // on the first page and show only part of the list.
    const warnings = [{ message: 'ITC returned errors: Target t-1' }];
    const screen = await renderWithContext(<Harness />, {
      token: STAFF_TOKEN,
      mocks: [page(null, [dd('p-1'), dd('p-2')], true, warnings), page('p-2', [dd('p-3')], false, warnings)],
    });
    await expect.element(screen.getByTestId('ids')).toHaveTextContent('p-1,p-2,p-3');
  });

  it('reports an incomplete list, not a loading one, when a page is rejected', async () => {
    const screen = await renderWithContext(<Harness />, {
      token: STAFF_TOKEN,
      mocks: [page(null, [dd('p-1'), dd('p-2')], true), { ...page('p-2', [], false), error: new Error('timed out') }],
    });
    await expect.element(screen.getByTestId('incomplete')).toHaveTextContent('true');
    await expect.element(screen.getByTestId('ids')).toHaveTextContent('p-1,p-2');
    await expect.element(screen.getByTestId('loading')).toHaveTextContent('false');
  });

  it('reports an incomplete list when a page claims more but adds nothing', async () => {
    // Measured on dev: with a LIMIT, a later page can repeat itself with hasMore
    // still true. Only one answer is mocked for p-2, so a second ask would fail.
    const screen = await renderWithContext(<Harness />, {
      token: STAFF_TOKEN,
      mocks: [page(null, [dd('p-1'), dd('p-2')], true), page('p-2', [dd('p-2')], true)],
    });
    await expect.element(screen.getByTestId('incomplete')).toHaveTextContent('true');
    await expect.element(screen.getByTestId('loading')).toHaveTextContent('false');
  });

  it('walks again when a refetch after an incomplete list brings back different data', async () => {
    const screen = await renderWithContext(<Harness />, {
      token: STAFF_TOKEN,
      mocks: [
        page(null, [dd('p-1'), dd('p-2')], true),
        { ...page('p-2', [], false), error: new Error('timed out') },
        page(null, [dd('p-1'), dd('p-9')], true),
        page('p-9', [dd('p-3')], false),
      ],
    });
    await expect.element(screen.getByTestId('incomplete')).toHaveTextContent('true');
    await userEvent.click(screen.getByRole('button', { name: 'reload' }));
    await expect.element(screen.getByTestId('ids')).toHaveTextContent('p-1,p-9,p-3');
    await expect.element(screen.getByTestId('incomplete')).toHaveTextContent('false');
  });

  it('reports an incomplete list for a first page that claims more but holds nothing', async () => {
    const screen = await renderWithContext(<Harness />, { token: STAFF_TOKEN, mocks: [page(null, [], true)] });
    await expect.element(screen.getByTestId('incomplete')).toHaveTextContent('true');
    await expect.element(screen.getByTestId('loading')).toHaveTextContent('false');
  });

  it('stays marked incomplete when a refetch brings back the same first page', async () => {
    // Nothing about the list changed, so there is nothing new to walk from.
    const screen = await renderWithContext(<Harness />, {
      token: STAFF_TOKEN,
      mocks: [
        page(null, [dd('p-1'), dd('p-2')], true),
        { ...page('p-2', [], false), error: new Error('timed out') },
        page(null, [dd('p-1'), dd('p-2')], true),
      ],
    });
    await expect.element(screen.getByTestId('incomplete')).toHaveTextContent('true');
    await userEvent.click(screen.getByRole('button', { name: 'reload' }));
    await expect.element(screen.getByTestId('loading')).toHaveTextContent('false');
    await expect.element(screen.getByTestId('incomplete')).toHaveTextContent('true');
  });

  it('settles immediately when the first page is the last', async () => {
    const screen = await renderWithContext(<Harness />, {
      token: STAFF_TOKEN,
      mocks: [page(null, [dd('p-1')], false)],
    });
    await expect.poll(() => screen.getByTestId('ids').element().textContent).toBe('p-1');
    await expect.element(screen.getByTestId('loading')).toHaveTextContent('false');
  });
});

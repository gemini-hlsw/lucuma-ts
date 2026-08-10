import { describe, expect, it } from 'vitest';

import { fakeJwt, standardUser } from '@/test/factories';
import { type MockedResponseOf, renderWithContext } from '@/test/render';

import type { AdminChangeRequestsResult } from './changeRequests';
import { CHANGE_REQUESTS_QUERY, useChangeRequests } from './changeRequests';

const STAFF_TOKEN = fakeJwt(standardUser('staff'));

type RawRequest = AdminChangeRequestsResult['configurationRequests']['matches'][number];

/** A minimal ConfigurationRequest match; only `id` and `program.id` matter here. */
const cr = (id: string, programId: string): RawRequest => ({
  __typename: 'ConfigurationRequest',
  id,
  status: 'REQUESTED',
  justification: null,
  applicableObservations: [],
  program: {
    __typename: 'Program',
    id: programId,
    name: null,
    reference: null,
    pi: null,
  },
  configuration: {
    __typename: 'Configuration',
    target: null,
    observingMode: { __typename: 'ConfigurationObservingMode', instrument: 'GMOS_SOUTH', mode: 'GMOS_SOUTH_LONG_SLIT' },
    conditions: {
      __typename: 'ConfigurationConditions',
      imageQuality: 'POINT_EIGHT',
      cloudExtinction: 'POINT_THREE',
      skyBackground: 'GRAY',
      waterVapor: 'WET',
    },
  },
});

const page = (
  offset: string | null,
  matches: RawRequest[],
  hasMore: boolean,
): MockedResponseOf<typeof CHANGE_REQUESTS_QUERY> => ({
  request: { query: CHANGE_REQUESTS_QUERY, variables: { offset } },
  result: { data: { configurationRequests: { __typename: 'ConfigurationRequestSelectResult', matches, hasMore } } },
});

/** Renders the request ids the hook has accumulated, plus its loading flag. */
function Harness() {
  const { data, loading } = useChangeRequests();
  const ids = data?.configurationRequests.matches.map((m) => m.id).join(',') ?? '';
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="ids">{ids}</span>
    </div>
  );
}

describe('useChangeRequests', () => {
  it('follows hasMore across pages so a request past the first page is never dropped (sc-9604)', async () => {
    const screen = await renderWithContext(<Harness />, {
      token: STAFF_TOKEN,
      // A program's older requests sit on page 1; a newly-submitted one (x-new)
      // lands at the tail on page 2 — it must still appear once paging completes.
      mocks: [
        page(null, [cr('x-1', 'p-1'), cr('x-2', 'p-1')], true),
        page('x-2', [cr('x-3', 'p-2'), cr('x-new', 'p-1')], false),
      ],
    });
    await expect.element(screen.getByTestId('ids')).toHaveTextContent('x-1,x-2,x-3,x-new');
    await expect.element(screen.getByTestId('loading')).toHaveTextContent('false');
  });

  it('settles immediately when the first page is the last', async () => {
    const screen = await renderWithContext(<Harness />, {
      token: STAFF_TOKEN,
      mocks: [page(null, [cr('x-1', 'p-1')], false)],
    });
    await expect.element(screen.getByTestId('ids')).toHaveTextContent('x-1');
    await expect.element(screen.getByTestId('loading')).toHaveTextContent('false');
  });
});

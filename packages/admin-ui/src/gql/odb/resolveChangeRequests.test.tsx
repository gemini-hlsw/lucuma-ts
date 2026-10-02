import { useEffect, useState } from 'react';
import { describe, expect, it } from 'vitest';

import { fakeJwt, standardUser } from '@/test/factories';
import { type MockedResponseOf, renderWithContext } from '@/test/render';

import {
  RESOLVE_KEEPING_FEEDBACK_MUTATION,
  RESOLVE_WITH_FEEDBACK_MUTATION,
  useResolveChangeRequests,
} from './changeRequests';

const STAFF_TOKEN = fakeJwt(standardUser('staff'));

/** Writes the response. The mock matches on exact variables, so a resolve that
 *  sent different feedback — or none — finds no mock and rejects. */
const writesFeedback = (feedback: string): MockedResponseOf<typeof RESOLVE_WITH_FEEDBACK_MUTATION> => ({
  request: {
    query: RESOLVE_WITH_FEEDBACK_MUTATION,
    variables: { ids: ['x-1'], status: 'DENIED', feedback },
  },
  result: {
    data: {
      updateConfigurationRequests: {
        __typename: 'UpdateConfigurationRequestsResult',
        requests: [{ __typename: 'ConfigurationRequest', id: 'x-1', status: 'DENIED', feedback }],
      },
    },
  },
});

/** Resolves without naming `feedback` at all. Matching this document rather
 *  than the one above is the assertion that the stored note is left alone. */
const keepsFeedback = (stored: string | null): MockedResponseOf<typeof RESOLVE_KEEPING_FEEDBACK_MUTATION> => ({
  request: { query: RESOLVE_KEEPING_FEEDBACK_MUTATION, variables: { ids: ['x-1'], status: 'DENIED' } },
  result: {
    data: {
      updateConfigurationRequests: {
        __typename: 'UpdateConfigurationRequestsResult',
        requests: [{ __typename: 'ConfigurationRequest', id: 'x-1', status: 'DENIED', feedback: stored }],
      },
    },
  },
});

/** Resolves on mount and reports the feedback the ODB echoes back, so a test
 *  can tell a preserved note from a cleared one. */
function Harness({ response }: { readonly response: string | null }) {
  const { resolve } = useResolveChangeRequests();
  const [outcome, setOutcome] = useState('pending');
  useEffect(() => {
    resolve(['x-1'], 'DENIED', response).then(
      (res) => setOutcome(res.data?.updateConfigurationRequests.requests[0]?.feedback ?? 'none'),
      () => setOutcome('rejected'),
    );
    // Run once on mount; `resolve` is recreated each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <span data-testid="outcome">{outcome}</span>;
}

describe(useResolveChangeRequests, () => {
  it('persists the reviewer response as the request feedback', async () => {
    const note = 'Denied: no dark time left this semester';
    const screen = await renderWithContext(<Harness response={note} />, {
      token: STAFF_TOKEN,
      mocks: [writesFeedback(note)],
    });
    await expect.element(screen.getByTestId('outcome')).toHaveTextContent(note);
  });

  it('leaves a note written earlier alone when this resolve carries no response', async () => {
    // `feedback` omitted from SET, never nulled: a null variable clears the
    // field, so re-resolving would otherwise discard someone else's note.
    const earlier = 'Approved earlier by another reviewer';
    const screen = await renderWithContext(<Harness response={null} />, {
      token: STAFF_TOKEN,
      mocks: [keepsFeedback(earlier)],
    });
    await expect.element(screen.getByTestId('outcome')).toHaveTextContent(earlier);
  });
});

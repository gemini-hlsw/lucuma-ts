import { useEffect, useState } from 'react';
import { describe, expect, it } from 'vitest';

import { fakeJwt, standardUser } from '@/test/factories';
import { type MockedResponseOf, renderWithContext } from '@/test/render';

import { SET_PROGRAM_RESOURCE_LIMIT_MUTATION, useSetProgramResourceLimit } from './programs';

const STAFF_TOKEN = fakeJwt(standardUser('staff'));

/** The ODB's answer when the new limit is below the current count: the updated
 *  program *and* a warning, which is what `errorPolicy: 'all'` preserves. */
const lowerBelowCount = (): MockedResponseOf<typeof SET_PROGRAM_RESOURCE_LIMIT_MUTATION> => ({
  request: { query: SET_PROGRAM_RESOURCE_LIMIT_MUTATION, variables: { programId: 'p-1', limit: 1 } },
  result: {
    data: {
      setProgramResourceLimit: {
        __typename: 'SetProgramResourceLimitResult',
        program: { __typename: 'Program', id: 'p-1', resourceCount: 84, resourceLimit: 1 },
      },
    },
    errors: [
      {
        message:
          'Program p-1 has 84 associated resources, which exceeds the new limit of 1. No new resources can be added until the count drops below the limit.',
      },
    ],
  },
});

/** Reports the limit the ODB echoed back, or `rejected` if the call threw —
 *  which is what the default errorPolicy would do to the warning above. */
function Harness() {
  const [setLimit] = useSetProgramResourceLimit();
  const [outcome, setOutcome] = useState('pending');
  useEffect(() => {
    setLimit({ variables: { programId: 'p-1', limit: 1 } }).then(
      (res) => setOutcome(String(res.data?.setProgramResourceLimit.program.resourceLimit ?? 'none')),
      () => setOutcome('rejected'),
    );
    // Run once on mount; `setLimit` is recreated each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <span data-testid="outcome">{outcome}</span>;
}

describe(useSetProgramResourceLimit, () => {
  it('keeps the result when the ODB warns that the limit is below the count', async () => {
    // Lowering the limit is a supported action that answers with a warning, so
    // the write must not be reported as a failure: the default errorPolicy
    // would discard the data and reject, and the rest of the save would be
    // abandoned for a write that landed.
    const screen = await renderWithContext(<Harness />, {
      token: STAFF_TOKEN,
      mocks: [lowerBelowCount()],
    });
    await expect.element(screen.getByTestId('outcome')).toHaveTextContent('1');
  });
});

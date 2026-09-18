import { useEffect, useState } from 'react';
import { describe, expect, it } from 'vitest';

import { fakeJwt, standardUser } from '@/test/factories';
import { type MockedResponseOf, renderWithContext } from '@/test/render';

import type { DocumentType } from './gen';
import { ADD_PROGRAM_USER_MUTATION, LINK_USER_MUTATION, useAssignContactScientists } from './programs';

const STAFF_TOKEN = fakeJwt(standardUser('staff'));

/** addProgramUser returning a slot id — the normal case. */
const addOk = (programUserId: string): MockedResponseOf<typeof ADD_PROGRAM_USER_MUTATION> => ({
  request: { query: ADD_PROGRAM_USER_MUTATION, variables: { programId: 'p-1' } },
  result: {
    data: {
      addProgramUser: {
        __typename: 'AddProgramUserResult',
        programUser: { __typename: 'ProgramUser', id: programUserId },
      },
    },
  },
});

/** addProgramUser answering successfully but with no program user in the
 *  payload. The old `if (programUserId)` guard skipped the link here and
 *  resolved, so the caller reported success for a contact it never assigned. */
const addWithoutId = (): MockedResponseOf<typeof ADD_PROGRAM_USER_MUTATION> => ({
  request: { query: ADD_PROGRAM_USER_MUTATION, variables: { programId: 'p-1' } },
  // No data and no error: `res.data?.…` yields undefined, which is precisely
  // what the old `if (programUserId)` guard swallowed. The schema types the
  // payload as non-null, so the absent case has to be cast in.
  result: { data: undefined as unknown as DocumentType<typeof ADD_PROGRAM_USER_MUTATION> },
});

const linkOk = (programUserId: string, userId: string): MockedResponseOf<typeof LINK_USER_MUTATION> => ({
  request: { query: LINK_USER_MUTATION, variables: { programUserId, userId } },
  result: { data: { linkUser: { __typename: 'LinkUserResult', user: { __typename: 'ProgramUser', id: userId } } } },
});

/** Runs the assignment on mount and reports how it settled, so a test can tell
 *  a silent success apart from a rejection. */
function Harness({ userIds }: { readonly userIds: readonly string[] }) {
  const { assign } = useAssignContactScientists();
  const [outcome, setOutcome] = useState('pending');
  useEffect(() => {
    assign('p-1', userIds).then(
      () => setOutcome('resolved'),
      () => setOutcome('rejected'),
    );
    // Run once on mount: `assign` is recreated each render, so depending on it
    // would re-fire the mutations forever.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <span data-testid="outcome">{outcome}</span>;
}

describe(useAssignContactScientists, () => {
  it('assigns each contact by adding a program user and linking it', async () => {
    const screen = await renderWithContext(<Harness userIds={['u-1', 'u-2']} />, {
      token: STAFF_TOKEN,
      mocks: [addOk('m-1'), addOk('m-2'), linkOk('m-1', 'u-1'), linkOk('m-2', 'u-2')],
    });
    await expect.element(screen.getByTestId('outcome')).toHaveTextContent('resolved');
  });

  it('rejects rather than silently skipping the link when no program user comes back', async () => {
    // The previous `if (programUserId)` guard resolved here, leaving the caller
    // to report success for a contact that was never assigned.
    const screen = await renderWithContext(<Harness userIds={['u-1']} />, {
      token: STAFF_TOKEN,
      mocks: [addWithoutId()],
    });
    await expect.element(screen.getByTestId('outcome')).toHaveTextContent('rejected');
  });
});

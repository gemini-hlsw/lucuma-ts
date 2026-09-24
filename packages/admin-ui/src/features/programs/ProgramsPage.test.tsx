import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';

import type { AdminProgramsResult } from '@/gql/odb/programs';
import {
  mapPrograms,
  programPropertiesInput,
  PROGRAMS_QUERY,
  proposalTypeInput,
  UPDATE_PROGRAM_MUTATION,
  UPDATE_PROPOSAL_TYPE_MUTATION,
} from '@/gql/odb/programs';
import { currentSemester } from '@/lib/semester';
import { fakeJwt, standardUser } from '@/test/factories';
import { type MockedResponseOf, renderWithContext } from '@/test/render';

import ProgramsPage from './ProgramsPage';

const STAFF_TOKEN = fakeJwt(standardUser('staff'));

// The table defaults to the current semester (sc-9582), so the fixture has to
// sit in it — derived, not hardcoded, so this can't rot at the semester turn.
const REFERENCE = `G-${currentSemester()}-0397-D`;

type RawProgram = AdminProgramsResult['programs']['matches'][number];

/** A Director's Time program — the shape sc-10439 was reported against. Its
 *  proposal carries no Queue fields, and the mapper collapses the subtype to
 *  QUEUE in `programClass`, which is what made every save send a Queue block. */
const directorsTimeProgram = (): RawProgram => ({
  __typename: 'Program',
  id: 'p-1532',
  name: '2026-Sep-03 DD',
  proposalStatus: 'ACCEPTED',
  reference: { __typename: 'ScienceProgramReference', label: REFERENCE },
  pi: {
    __typename: 'ProgramUser',
    id: 'm-pi',
    user: {
      __typename: 'User',
      id: 'u-pi',
      profile: { __typename: 'UserProfile', givenName: 'Grace', familyName: 'Hopper' },
    },
  },
  active: { __typename: 'DateInterval', start: '2026-08-01', end: '2027-01-31' },
  status: 'ACTIVE',
  explicitStatus: null,
  defaultStatus: 'ACTIVE',
  allocations: [],
  goa: { __typename: 'GoaProperties', proprietaryMonths: 12, privateHeader: false },
  proposal: {
    __typename: 'Proposal',
    gemini: { __typename: 'DirectorsTime', scienceSubtype: 'DIRECTORS_TIME' },
  },
  notes: [],
  users: [],
});

const programsMock = (): MockedResponseOf<typeof PROGRAMS_QUERY> => ({
  request: { query: PROGRAMS_QUERY },
  result: { data: { programs: { __typename: 'ProgramSelectResult', matches: [directorsTimeProgram()] } } },
  maxUsageCount: Number.POSITIVE_INFINITY,
});

/** Records whether the proposal-type mutation went out at all. Sending it on a
 *  Director's Time program is the bug: the input is a oneOf, so the block
 *  rewrites the proposal as Queue and the ODB rejects it against the DD call. */
function proposalTypeRecorder(): {
  readonly mock: MockedResponseOf<typeof UPDATE_PROPOSAL_TYPE_MUTATION>;
  sent: boolean;
} {
  const rec: { mock: MockedResponseOf<typeof UPDATE_PROPOSAL_TYPE_MUTATION>; sent: boolean } = {
    sent: false,
    mock: {
      // The variables it would be sent with if the guard were removed: the
      // editor collapses a Director's Time subtype to QUEUE, so this is the
      // Queue block that used to go out and be rejected.
      request: {
        query: UPDATE_PROPOSAL_TYPE_MUTATION,
        variables: { programId: 'p-1532', gemini: proposalTypeInput(mapped()) },
      },
      result: () => {
        rec.sent = true;
        return {
          data: {
            updateProposal: {
              __typename: 'UpdateProposalResult',
              proposal: { __typename: 'Proposal', category: null },
            },
          },
        };
      },
      maxUsageCount: Number.POSITIVE_INFINITY,
    },
  };
  return rec;
}

describe(ProgramsPage, () => {
  it('makes the proposal-type fields read-only on a Directors Time program', async () => {
    // The editor can only build the Queue and Classical arms of the oneOf, so
    // editing these on any other subtype would send the wrong arm and be
    // rejected. Read-only is the honest state until there is a type-aware input.
    const screen = await renderWithContext(<ProgramsPage />, { token: STAFF_TOKEN, mocks: [programsMock()] });
    await expect.element(screen.getByRole('spinbutton', { name: /Minimum Time/ })).toBeDisabled();
    await expect.element(screen.getByRole('checkbox', { name: /Consider for Band 3/ })).toBeDisabled();
    await expect.element(screen.getByRole('textbox', { name: /ToO Status/ })).toBeDisabled();
    // Class most of all: it selects which arm of the oneOf is sent.
    await expect.element(screen.getByRole('textbox', { name: 'Class', exact: true })).toBeDisabled();
  });

  it('leaves the proposal type alone when an unrelated field is edited (sc-10439)', async () => {
    // Editing anything on a Director's Time program used to send a Queue
    // proposal-type block and fail. Nothing here touches the type, so the
    // mutation must not go out at all.
    const rec = proposalTypeRecorder();
    const draft = { ...mapped(), proprietaryMonths: 13 };
    const screen = await renderWithContext(<ProgramsPage />, {
      token: STAFF_TOKEN,
      mocks: [
        programsMock(),
        {
          request: {
            query: UPDATE_PROGRAM_MUTATION,
            variables: { programId: 'p-1532', set: programPropertiesInput(draft) },
          },
          result: {
            data: {
              updatePrograms: {
                __typename: 'UpdateProgramsResult',
                programs: [{ __typename: 'Program', id: 'p-1532' }],
              },
            },
          },
        },
        rec.mock,
      ],
    });

    const months = screen.getByRole('spinbutton', { name: /Proprietary Period/ });
    await expect.element(months).toHaveValue('12');
    await userEvent.fill(months, '13');
    await userEvent.tab();
    await userEvent.click(screen.getByRole('button', { name: /Save/ }));
    await expect.element(screen.getByText(/Program saved/)).toBeInTheDocument();
    expect(rec.sent).toBe(false);
  });
});

/** The mapped program the fixture yields, so a save mock can be built from the
 *  same values the page will send. */
function mapped() {
  const [p] = mapPrograms({ programs: { __typename: 'ProgramSelectResult', matches: [directorsTimeProgram()] } });
  if (!p) throw new Error('fixture did not map');
  return p;
}

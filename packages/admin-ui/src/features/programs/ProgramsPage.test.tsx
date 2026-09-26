import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';

import type { AdminProgramsResult } from '@/gql/odb/programs';
import {
  mapPrograms,
  programPropertiesInput,
  PROGRAMS_QUERY,
  proposalTypeInput,
  SET_PROGRAM_RESOURCE_LIMIT_MUTATION,
  UPDATE_PROGRAM_MUTATION,
  UPDATE_PROPOSAL_TYPE_MUTATION,
} from '@/gql/odb/programs';
import type { Program } from '@/gql/types';
import { currentSemester } from '@/lib/semester';
import { fakeJwt, standardUser } from '@/test/factories';
import { type MockedResponseOf, renderWithContext } from '@/test/render';

import ProgramsPage from './ProgramsPage';

const STAFF_TOKEN = fakeJwt(standardUser('staff'));

// The table defaults to the current semester (sc-9582), so the fixture has to
// sit in it — derived, not hardcoded, so this can't rot at the semester turn.
const REFERENCE = `G-${currentSemester()}-1234-Q`;

type RawProgram = AdminProgramsResult['programs']['matches'][number];

const program = (resourceCount: number, resourceLimit: number): RawProgram => ({
  __typename: 'Program',
  id: 'p-1',
  name: 'Globular Cluster Abundances',
  resourceCount,
  resourceLimit,
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
  active: { __typename: 'DateInterval', start: '2027-08-01', end: '2028-02-28' },
  status: 'ACTIVE',
  explicitStatus: null,
  defaultStatus: 'ACTIVE',
  allocations: [],
  goa: { __typename: 'GoaProperties', proprietaryMonths: 12, privateHeader: true },
  proposal: {
    __typename: 'Proposal',
    gemini: {
      __typename: 'Queue',
      scienceSubtype: 'QUEUE',
      tooActivationCeiling: 'NONE',
      considerForBand3: 'DO_NOT_CONSIDER',
      minPercentTime: 80,
    },
  },
  notes: [],
  users: [],
});

const programsMock = (resourceCount: number, resourceLimit: number): MockedResponseOf<typeof PROGRAMS_QUERY> => ({
  request: { query: PROGRAMS_QUERY },
  result: {
    data: { programs: { __typename: 'ProgramSelectResult', matches: [program(resourceCount, resourceLimit)] } },
  },
  maxUsageCount: Number.POSITIVE_INFINITY,
});

/** The two mutations every save fires regardless of what changed. Matched on
 *  the document alone — this file is about the resource limit, not what those
 *  two are sent. */
const alwaysSaved = (draft: Program): readonly unknown[] => [
  {
    request: {
      query: UPDATE_PROGRAM_MUTATION,
      variables: { programId: 'p-1', set: programPropertiesInput(draft) },
    },
    result: {
      data: {
        updatePrograms: { __typename: 'UpdateProgramsResult', programs: [{ __typename: 'Program', id: 'p-1' }] },
      },
    },
  },
  {
    request: {
      query: UPDATE_PROPOSAL_TYPE_MUTATION,
      variables: { programId: 'p-1', gemini: proposalTypeInput(draft) },
    },
    result: {
      data: {
        updateProposal: { __typename: 'UpdateProposalResult', proposal: { __typename: 'Proposal', category: null } },
      },
    },
  },
];

/** The mapped program the fixture yields, so a save mock can be built from the
 *  same values the page will send. */
const mapped = (resourceCount: number, resourceLimit: number): Program => {
  const [p] = mapPrograms({
    programs: { __typename: 'ProgramSelectResult', matches: [program(resourceCount, resourceLimit)] },
  });
  if (!p) throw new Error('fixture did not map');
  return p;
};

/** Records the limit the page sent. An unused mock is silent in Apollo, and
 *  `ProgramEditor` keeps its draft in local state so a cache write is not
 *  visible either — so the call itself has to be observed. */
function limitRecorder(limit: number): {
  readonly mock: MockedResponseOf<typeof SET_PROGRAM_RESOURCE_LIMIT_MUTATION>;
  sent: number | undefined;
} {
  const rec: { mock: MockedResponseOf<typeof SET_PROGRAM_RESOURCE_LIMIT_MUTATION>; sent: number | undefined } = {
    sent: undefined,
    mock: {
      request: { query: SET_PROGRAM_RESOURCE_LIMIT_MUTATION, variables: { programId: 'p-1', limit } },
      result: (variables) => {
        rec.sent = variables.limit;
        return {
          data: {
            setProgramResourceLimit: {
              __typename: 'SetProgramResourceLimitResult',
              program: { __typename: 'Program', id: 'p-1', resourceCount: 84, resourceLimit: limit },
            },
          },
        };
      },
    },
  };
  return rec;
}

/** Renders the page on one program. The table selects the first row itself, so
 *  the editor is already open on it. */
async function openEditor(resourceCount: number, resourceLimit: number, extra: readonly unknown[] = []) {
  const screen = await renderWithContext(<ProgramsPage />, {
    token: STAFF_TOKEN,
    mocks: [programsMock(resourceCount, resourceLimit), ...(extra as never[])],
  });
  await expect.element(screen.getByText('Resources Used')).toBeInTheDocument();
  return screen;
}

describe(ProgramsPage, () => {
  it('shows the resources used and the editable limit (sc-9090)', async () => {
    const screen = await openEditor(84, 1000);
    // Distinct values, so showing the limit where the count belongs is caught.
    await expect.element(screen.getByText('84')).toBeInTheDocument();
    await expect.element(screen.getByRole('spinbutton', { name: 'Resource Limit', exact: true })).toHaveValue('1,000');
  });

  it('warns that a limit under the count freezes the program, before any save', async () => {
    // The ODB accepts this and answers with a warning, so the consequence has
    // to be visible before the save rather than only after it. `NumberInput`
    // commits on blur, so the warning appears when the field is left, not on
    // each keystroke.
    const screen = await openEditor(84, 1000);
    const limit = screen.getByRole('spinbutton', { name: 'Resource Limit', exact: true });
    await expect.element(limit).toHaveValue('1,000');
    expect(screen.getByLabelText(/Freezes the program/).elements()).toHaveLength(0);

    await userEvent.fill(limit, '50');
    await userEvent.tab(); // commit the edit
    // Pins the threshold itself, not just the opening words: the ODB allows an
    // insert while `count <= limit`, so the sentence must name the limit and
    // say "or fewer".
    await expect.element(screen.getByLabelText(/back to 50 or fewer/)).toBeInTheDocument();
  });

  it('keeps quiet when the limit stays at or above the count', async () => {
    const screen = await openEditor(84, 1000);
    const limit = screen.getByRole('spinbutton', { name: 'Resource Limit', exact: true });
    await expect.element(limit).toHaveValue('1,000');

    await userEvent.fill(limit, '84');
    await userEvent.tab(); // commit the edit
    await expect.element(limit).toHaveValue('84');
    expect(screen.getByLabelText(/Freezes the program/).elements()).toHaveLength(0);
  });

  it('sends the edited limit when the save runs', async () => {
    const draft = { ...mapped(84, 1000), resourceLimit: 50 };
    const rec = limitRecorder(50);
    const screen = await openEditor(84, 1000, [...alwaysSaved(draft), rec.mock]);
    const limit = screen.getByRole('spinbutton', { name: 'Resource Limit', exact: true });
    await userEvent.fill(limit, '50');
    await userEvent.tab();
    await userEvent.click(screen.getByRole('button', { name: /Save/ }));
    await expect.element(screen.getByText(/Program saved/)).toBeInTheDocument();
    expect(rec.sent).toBe(50);
  });

  it('leaves the limit alone when nothing changed it', async () => {
    // The recorder is supplied but must never fire: the limit did not change.
    const draft = { ...mapped(84, 1000), proprietaryMonths: 13 };
    const rec = limitRecorder(1000);
    const screen = await openEditor(84, 1000, [...alwaysSaved(draft), rec.mock]);
    await userEvent.fill(screen.getByRole('spinbutton', { name: /Proprietary Period/ }), '13');
    await userEvent.tab();
    await userEvent.click(screen.getByRole('button', { name: /Save/ }));
    await expect.element(screen.getByText(/Program saved/)).toBeInTheDocument();
    expect(rec.sent).toBeUndefined();
  });

  it('saves a below-count limit, warning and all, rather than reporting failure', async () => {
    // The story's headline case: the ODB accepts the write and answers with
    // the program AND a warning. `errorPolicy: 'all'` resolves it, and the
    // guard keys on data rather than on the error, so this must report a save.
    const draft = { ...mapped(84, 1000), resourceLimit: 5 };
    const warned: MockedResponseOf<typeof SET_PROGRAM_RESOURCE_LIMIT_MUTATION> = {
      request: { query: SET_PROGRAM_RESOURCE_LIMIT_MUTATION, variables: { programId: 'p-1', limit: 5 } },
      result: {
        data: {
          setProgramResourceLimit: {
            __typename: 'SetProgramResourceLimitResult',
            program: { __typename: 'Program', id: 'p-1', resourceCount: 84, resourceLimit: 5 },
          },
        },
        errors: [{ message: 'Program p-1 has 84 associated resources, which exceeds the new limit of 5.' }],
      },
    };
    const screen = await openEditor(84, 1000, [...alwaysSaved(draft), warned]);
    const limit = screen.getByRole('spinbutton', { name: 'Resource Limit', exact: true });
    await userEvent.fill(limit, '5');
    await userEvent.tab();
    await userEvent.click(screen.getByRole('button', { name: /Save/ }));
    await expect.element(screen.getByText(/Program saved/)).toBeInTheDocument();
  });

  it('reports a failed limit write rather than claiming the program saved', async () => {
    // `errorPolicy: 'all'` stops the ODB's below-count warning from throwing,
    // but it stops a real failure throwing too — a rejected write carries no
    // program, and must not be reported as a save.
    const draft = { ...mapped(84, 1000), resourceLimit: 50 };
    const rejected: MockedResponseOf<typeof SET_PROGRAM_RESOURCE_LIMIT_MUTATION> = {
      request: { query: SET_PROGRAM_RESOURCE_LIMIT_MUTATION, variables: { programId: 'p-1', limit: 50 } },
      result: { errors: [{ message: 'Not authorized to perform this action' }] },
    };
    const screen = await openEditor(84, 1000, [...alwaysSaved(draft), rejected]);
    const limit = screen.getByRole('spinbutton', { name: 'Resource Limit', exact: true });
    await userEvent.fill(limit, '50');
    await userEvent.tab();
    await userEvent.click(screen.getByRole('button', { name: /Save/ }));
    await expect.element(screen.getByText(/Save failed/)).toBeInTheDocument();
  });

  it('names the limit input unambiguously for assistive tech', async () => {
    // This row carries two labelled values in one grid row, which no other row
    // in the form does — so the input's accessible name has to be exactly its
    // own label, not a concatenation with the row's.
    const screen = await openEditor(84, 1000);
    const limit = screen.getByRole('spinbutton', { name: 'Resource Limit', exact: true });
    await expect.element(limit).toBeInTheDocument();
    // The count is read-only, so it is announced through aria-labelledby
    // rather than by a control's own label.
    await expect.element(screen.getByLabelText('Resources Used')).toHaveTextContent('84');
  });

  it('shows the warning for a program already over its limit', async () => {
    // Driven by the saved values, so whoever opens the program next sees it —
    // not only the person who lowered the limit.
    const screen = await openEditor(84, 1);
    await expect.element(screen.getByLabelText(/back to 1 or fewer/)).toBeInTheDocument();
  });
});

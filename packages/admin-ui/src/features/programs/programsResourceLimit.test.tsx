import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';

import type { AdminProgramsResult } from '@/gql/odb/programs';
import {
  mapPrograms,
  programPropertiesInput,
  PROGRAMS_QUERY,
  SET_PROGRAM_RESOURCE_LIMIT_MUTATION,
  UPDATE_PROGRAM_MUTATION,
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
  tooActivationCeiling: 'NONE',
  allocations: [],
  goa: { __typename: 'GoaProperties', proprietaryMonths: 12, privateHeader: true },
  proposal: {
    __typename: 'Proposal',
    gemini: {
      __typename: 'Queue',
      scienceSubtype: 'QUEUE',
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

/** The mutation every save fires regardless of what changed (the proposal type
 *  goes out only when it was edited, which these tests never do). Matched on
 *  the variables the page will send, so this file stays about the resource
 *  limit and not about what that mutation carries. */
const alwaysSaved = (draft: Program, original: Program): readonly unknown[] => [
  {
    request: {
      query: UPDATE_PROGRAM_MUTATION,
      variables: { programId: 'p-1', set: programPropertiesInput(draft, original) },
    },
    result: {
      data: {
        updatePrograms: { __typename: 'UpdateProgramsResult', programs: [{ __typename: 'Program', id: 'p-1' }] },
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
    expect(screen.getByRole('img', { name: /Freezes the program/ }).elements()).toHaveLength(0);

    await userEvent.fill(limit, '50');
    await userEvent.tab(); // commit the edit
    // Pins the whole sentence, not just the opening words. The ODB rejects an
    // insert that would take the count over the limit, so a program holding
    // exactly its limit is full and adding resumes only once the count is
    // *below* it: the sentence must name the limit and say "drops below".
    await expect
      .element(
        screen.getByRole('img', { name: 'Freezes the program: no new resources until the count drops below 50.' }),
      )
      .toBeInTheDocument();
    // The hover text is a separate string from the accessible name.
    await expect
      .element(screen.getByTitle('Freezes the program — no new resources until the count drops below 50.'))
      .toBeInTheDocument();
  });

  it('shows 0 when the field is emptied, rather than leaving it blank', async () => {
    // An emptied field becomes 0 (as the other numeric fields do), and 0 freezes
    // the program, so the value the next save would send has to be on screen.
    const screen = await openEditor(0, 1000);
    const limit = screen.getByRole('spinbutton', { name: 'Resource Limit', exact: true });
    await expect.element(limit).toHaveValue('1,000');
    await userEvent.fill(limit, '');
    await userEvent.tab(); // commit the edit
    await expect.element(limit).toHaveValue('0');
  });

  it('keeps quiet when the limit stays at or above the count', async () => {
    const screen = await openEditor(84, 1000);
    const limit = screen.getByRole('spinbutton', { name: 'Resource Limit', exact: true });
    await expect.element(limit).toHaveValue('1,000');

    await userEvent.fill(limit, '84');
    await userEvent.tab(); // commit the edit
    await expect.element(limit).toHaveValue('84');
    expect(screen.getByRole('img', { name: /Freezes the program/ }).elements()).toHaveLength(0);
  });

  it('sends the edited limit when the save runs', async () => {
    const draft = { ...mapped(84, 1000), resourceLimit: 50 };
    const rec = limitRecorder(50);
    const screen = await openEditor(84, 1000, [...alwaysSaved(draft, mapped(84, 1000)), rec.mock]);
    const limit = screen.getByRole('spinbutton', { name: 'Resource Limit', exact: true });
    await userEvent.fill(limit, '50');
    await userEvent.tab();
    await userEvent.click(screen.getByRole('button', { name: /Save/ }));
    await expect.element(screen.getByText(/Program saved/)).toBeInTheDocument();
    expect(rec.sent).toBe(50);
    // A clean write has nothing to warn about.
    expect(document.querySelector('.p-toast-message-warn')).toBeNull();
  });

  it('leaves the limit alone when nothing changed it', async () => {
    // The recorder is supplied but must never fire: the limit did not change.
    const draft = { ...mapped(84, 1000), proprietaryMonths: 13 };
    const rec = limitRecorder(1000);
    const screen = await openEditor(84, 1000, [...alwaysSaved(draft, mapped(84, 1000)), rec.mock]);
    await userEvent.fill(screen.getByRole('spinbutton', { name: /Proprietary Period/ }), '13');
    await userEvent.tab();
    await userEvent.click(screen.getByRole('button', { name: /Save/ }));
    await expect.element(screen.getByText(/Program saved/)).toBeInTheDocument();
    expect(rec.sent).toBeUndefined();
  });

  it('saves a below-count limit, warning and all, rather than reporting failure', async () => {
    // The story's headline case: the ODB accepts the write and answers with
    // the program AND a warning. `errorPolicy: 'all'` resolves it, and the
    // guard keys on data rather than on the error, so this must report a save
    // — and show the ODB's warning, worded as the ODB worded it, rather than
    // swallow it.
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
        errors: [
          {
            message:
              'Program p-1 has 84 associated resources, which exceeds the new limit of 5. No new resources can be added until the count drops below the limit.',
          },
        ],
      },
    };
    const screen = await openEditor(84, 1000, [...alwaysSaved(draft, mapped(84, 1000)), warned]);
    const limit = screen.getByRole('spinbutton', { name: 'Resource Limit', exact: true });
    await userEvent.fill(limit, '5');
    await userEvent.tab();
    await userEvent.click(screen.getByRole('button', { name: /Save/ }));
    await expect.element(screen.getByText(/Program saved/)).toBeInTheDocument();
    await expect.element(screen.getByText(/which exceeds the new limit of 5/)).toBeInTheDocument();
    await expect.element(screen.getByText('Saved with a warning')).toBeInTheDocument();
    // A warning, not an error and not a success: severity is the toast's own signal.
    expect(document.querySelector('.p-toast-message-warn')).not.toBeNull();
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
    const screen = await openEditor(84, 1000, [...alwaysSaved(draft, mapped(84, 1000)), rejected]);
    const limit = screen.getByRole('spinbutton', { name: 'Resource Limit', exact: true });
    await userEvent.fill(limit, '50');
    await userEvent.tab();
    await userEvent.click(screen.getByRole('button', { name: /Save/ }));
    await expect.element(screen.getByText(/Save failed/)).toBeInTheDocument();
    // A rejected write must not also claim the program saved.
    expect(screen.getByText(/Program saved/).elements()).toHaveLength(0);
  });

  it('names the limit input unambiguously for assistive tech', async () => {
    // This row carries two labelled values in one grid row, which no other row
    // in the form does — so the input's accessible name has to be exactly its
    // own label, not a concatenation with the row's.
    const screen = await openEditor(84, 1000);
    const limit = screen.getByRole('spinbutton', { name: 'Resource Limit', exact: true });
    await expect.element(limit).toBeInTheDocument();
    // The count is read-only, so it is named by its own `<label htmlFor>`
    // rather than by a control's label.
    await expect.element(screen.getByLabelText('Resources Used')).toHaveTextContent('84');
  });

  it('words the limit label the way the ODB enforces it', async () => {
    // An insert is rejected once it would take the count over the limit, so a
    // program holding exactly its limit is full: the cap is lifted only when
    // the count drops *below* it, not when it is back "at or under" it.
    const screen = await openEditor(84, 1000);
    await expect.element(screen.getByTitle(/until the count drops below the cap\./)).toBeInTheDocument();
  });

  it('shows the warning for a program already over its limit', async () => {
    // Driven by the saved values, so whoever opens the program next sees it —
    // not only the person who lowered the limit.
    const screen = await openEditor(84, 1);
    await expect
      .element(
        screen.getByRole('img', { name: 'Freezes the program: no new resources until the count drops below 1.' }),
      )
      .toBeInTheDocument();
  });
});

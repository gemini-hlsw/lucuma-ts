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
const SECOND_REFERENCE = `G-${currentSemester()}-0398-Q`;
const THIRD_REFERENCE = `G-${currentSemester()}-0499-Q`;

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
  tooActivationCeiling: 'NONE',
  resourceCount: 0,
  resourceLimit: 1000,
  allocations: [],
  goa: { __typename: 'GoaProperties', proprietaryMonths: 12, privateHeader: false },
  proposal: {
    __typename: 'Proposal',
    gemini: { __typename: 'DirectorsTime', scienceSubtype: 'DIRECTORS_TIME' },
  },
  notes: [],
  users: [],
});

/** A plain Queue program: the proposal-type fields are editable here, so the
 *  wrappers carry no title. Layout must hold in this case too -- it is the
 *  common one, and a width rule keyed on [title] would silently miss it. */
const queueProgram = (): RawProgram => ({
  ...directorsTimeProgram(),
  id: 'p-1533',
  proposal: {
    __typename: 'Proposal',
    gemini: {
      __typename: 'Queue',
      scienceSubtype: 'QUEUE',
      minPercentTime: 80,
      considerForBand3: 'CONSIDER',
    },
  },
});

const matchesMock = (...matches: RawProgram[]): MockedResponseOf<typeof PROGRAMS_QUERY> => ({
  request: { query: PROGRAMS_QUERY },
  result: { data: { programs: { __typename: 'ProgramSelectResult', matches } } },
  maxUsageCount: Number.POSITIVE_INFINITY,
});

const programsMock = (): MockedResponseOf<typeof PROGRAMS_QUERY> => matchesMock(directorsTimeProgram());
const queueMock = (): MockedResponseOf<typeof PROGRAMS_QUERY> => matchesMock(queueProgram());

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
    // The ToO ceiling belongs to the program, not the proposal type, so it stays
    // editable here.
    await expect.element(screen.getByRole('textbox', { name: /ToO Status/ })).not.toBeDisabled();
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
            variables: { programId: 'p-1532', set: programPropertiesInput(draft, mapped()) },
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

  it('still sends the proposal type when it was edited', async () => {
    // The other half of the guard: skipping an unchanged type must not swallow
    // a real edit. Minimum Time is a Queue field the editor can build.
    let sent = false;
    const original = mapped(queueProgram());
    const draft = { ...original, minPercentTime: 50 };
    const screen = await renderWithContext(<ProgramsPage />, {
      token: STAFF_TOKEN,
      mocks: [
        queueMock(),
        {
          request: {
            query: UPDATE_PROGRAM_MUTATION,
            variables: { programId: 'p-1533', set: programPropertiesInput(draft, original) },
          },
          result: {
            data: {
              updatePrograms: {
                __typename: 'UpdateProgramsResult',
                programs: [{ __typename: 'Program', id: 'p-1533' }],
              },
            },
          },
        },
        {
          request: {
            query: UPDATE_PROPOSAL_TYPE_MUTATION,
            variables: { programId: 'p-1533', gemini: proposalTypeInput(draft) },
          },
          result: () => {
            sent = true;
            return {
              data: {
                updateProposal: {
                  __typename: 'UpdateProposalResult',
                  proposal: { __typename: 'Proposal', category: null },
                },
              },
            };
          },
        },
      ],
    });

    const minimum = screen.getByRole('spinbutton', { name: /Minimum Time/ });
    await expect.element(minimum).toHaveValue('80');
    await userEvent.fill(minimum, '50');
    await userEvent.tab();
    await userEvent.click(screen.getByRole('button', { name: /Save/ }));
    await expect.element(screen.getByText(/Program saved/)).toBeInTheDocument();
    expect(sent).toBe(true);
  });

  // Wrapping a control in a <span> for its tooltip makes the span the grid
  // child, and the control inside falls back to its content width unless the
  // wrapper hands the column on -- ~56px against a ~569px column. Both cases
  // matter: the wrapper carries a title only while the fields are gated, so a
  // rule keyed on [title] holds here and collapses on an editable program.
  it.each([
    ['gated', programsMock, true],
    ['editable', queueMock, false],
  ])('keeps the wrapped controls flush with the rest of the form (%s)', async (_case, mock, gated) => {
    const screen = await renderWithContext(<ProgramsPage />, { token: STAFF_TOKEN, mocks: [mock()] });
    // Also pins the fixture: a Queue program that rendered gated would measure
    // the wrong case and quietly pass.
    const classField = screen.getByRole('textbox', { name: 'Class', exact: true });
    await expect.element(classField).toBeInTheDocument();
    expect((classField.element() as HTMLInputElement).disabled).toBe(gated);

    const width = (el: Element | null) => {
      if (!el) throw new Error('missing element for width measurement');
      return el.getBoundingClientRect().width;
    };
    const form = document.querySelector('.program-form');
    if (!form) throw new Error('form did not render');
    // The field column itself, not a sibling control: every grid child resolves
    // the same track, so this compares against the width the wrapper is meant
    // to hand on rather than against another element that could drift.
    const reference = width(form.querySelector('.p-autocomplete'));
    expect(reference).toBeGreaterThan(0);

    // Class is the only wrapped dropdown (the ToO ceiling is a program field and
    // needs no wrapper); the other wrapped controls are not dropdowns and the
    // rule does not reach them.
    const dropdowns = [...form.querySelectorAll(':scope > span > .p-dropdown')];
    expect(dropdowns).toHaveLength(1);
    for (const dropdown of dropdowns) {
      // Both read the same grid track, so these are bit-identical rather than
      // merely close; a collapsed dropdown misses by ~500px, not by a pixel.
      expect(width(dropdown.parentElement)).toBe(reference);
      expect(width(dropdown)).toBe(reference);
    }
  });

  it('leaves nothing selected when the selected program is deselected — sc-10137', async () => {
    const screen = await renderWithContext(<ProgramsPage />, { token: STAFF_TOKEN, mocks: [programsMock()] });

    // The first row auto-selects on load, so the editor is open on it.
    const editorField = screen.getByRole('textbox', { name: 'Class', exact: true });
    await expect.element(editorField).toBeInTheDocument();

    // Re-clicking the selected row deselects it; the editor must close rather
    // than snapping back to the first row.
    await userEvent.click(screen.getByRole('cell', { name: REFERENCE }));
    await expect.element(editorField).not.toBeInTheDocument();
  });

  it('falls back to the first shown program when a filter hides the selected one — sc-10137', async () => {
    const program = (id: string, label: string): RawProgram => ({
      ...queueProgram(),
      id,
      reference: { __typename: 'ScienceProgramReference', label },
    });
    const screen = await renderWithContext(<ProgramsPage />, {
      token: STAFF_TOKEN,
      mocks: [
        matchesMock(directorsTimeProgram(), program('p-1533', SECOND_REFERENCE), program('p-1534', THIRD_REFERENCE)),
      ],
    });

    await userEvent.click(screen.getByRole('cell', { name: THIRD_REFERENCE }));
    await expect.element(screen.getByText(`Selected Program · ${THIRD_REFERENCE}`)).toBeInTheDocument();

    // Filtering the selected program out, with two programs left, moves the
    // editor to the first of them — never to a row the user can't see, and not
    // to an empty panel (only an explicit deselect empties it).
    await userEvent.fill(screen.getByPlaceholder('Filter reference, PI, or title'), '-039');
    await expect.element(screen.getByRole('cell', { name: SECOND_REFERENCE })).toBeInTheDocument();
    await expect.element(screen.getByText(`Selected Program · ${REFERENCE}`)).toBeInTheDocument();
  });

  it('keeps nothing selected through a filter change after a deselect — sc-10137', async () => {
    const second: RawProgram = {
      ...queueProgram(),
      reference: { __typename: 'ScienceProgramReference', label: SECOND_REFERENCE },
    };
    const screen = await renderWithContext(<ProgramsPage />, {
      token: STAFF_TOKEN,
      mocks: [matchesMock(directorsTimeProgram(), second)],
    });
    const anyEditor = screen.getByText(/^Selected Program · /);
    await expect.element(anyEditor).toBeInTheDocument();

    await userEvent.click(screen.getByRole('cell', { name: REFERENCE }));
    await expect.element(anyEditor).not.toBeInTheDocument();

    // A deselect is the user's choice, not a missing selection: a filter that
    // changes the rows must not quietly reselect the first remaining one. The
    // deselected row disappearing proves the filter has applied before the
    // editor is checked.
    await userEvent.fill(screen.getByPlaceholder('Filter reference, PI, or title'), SECOND_REFERENCE);
    await expect.element(screen.getByRole('cell', { name: REFERENCE })).not.toBeInTheDocument();
    await expect.element(screen.getByRole('cell', { name: SECOND_REFERENCE })).toBeInTheDocument();
    await expect.element(anyEditor).not.toBeInTheDocument();
  });
});

/** The mapped program a fixture yields, so a save mock can be built from the
 *  same values the page will send. */
function mapped(raw: RawProgram = directorsTimeProgram()) {
  const [p] = mapPrograms({ programs: { __typename: 'ProgramSelectResult', matches: [raw] } });
  if (!p) throw new Error('fixture did not map');
  return p;
}

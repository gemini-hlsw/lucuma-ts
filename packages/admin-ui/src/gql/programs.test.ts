import { describe, expect, it } from 'vitest';

import { type AdminProgramsResult, mapPrograms, proposalTypeInput } from './programs';
import type { Program } from './types';

type RawProgram = AdminProgramsResult['programs']['matches'][number];
type RawProgramUser = RawProgram['users'][number];

function programUser(
  id: string,
  role: RawProgramUser['role'],
  thesis: boolean,
  given: string,
  family: string,
): RawProgramUser {
  return {
    __typename: 'ProgramUser',
    id,
    role,
    thesis,
    user: {
      __typename: 'User',
      id: `u-${id}`,
      profile: { __typename: 'UserProfile', givenName: given, familyName: family },
    },
  };
}

function program(overrides: Partial<RawProgram>): RawProgram {
  return {
    __typename: 'Program',
    id: 'p-1322',
    name: null,
    proposalStatus: 'ACCEPTED',
    reference: { __typename: 'ScienceProgramReference', label: 'G-2027B-1322-Q' },
    pi: {
      __typename: 'ProgramUser',
      id: 'm-pi',
      user: {
        __typename: 'User',
        id: 'u-pi',
        profile: { __typename: 'UserProfile', givenName: 'Grace', familyName: 'Hopper' },
      },
    },
    active: { __typename: 'DateInterval', start: '1901-01-01', end: '2099-12-31' },
    allocations: [],
    goa: { __typename: 'GoaProperties', proprietaryMonths: 6, privateHeader: true },
    proposal: {
      __typename: 'Proposal',
      gemini: {
        __typename: 'Queue',
        toOActivation: 'STANDARD',
        considerForBand3: 'CONSIDER',
        minPercentTime: 80,
      },
    },
    notes: [],
    users: [],
    ...overrides,
  };
}

const result = (matches: RawProgram[]): AdminProgramsResult => ({
  programs: { __typename: 'ProgramSelectResult', matches },
});

describe('mapPrograms', () => {
  it('returns an empty array when there are no matches', () => {
    expect(mapPrograms(result([]))).toEqual([]);
  });

  it('projects a Queue program, reading contact scientists from SUPPORT roles and thesis from ProgramUser', () => {
    const [p] = mapPrograms(
      result([
        program({
          allocations: [
            {
              __typename: 'Allocation',
              category: 'US',
              scienceBand: 'BAND1',
              duration: { __typename: 'TimeSpan', hours: 12.5 },
            },
          ],
          notes: [
            { __typename: 'ProgramNote', id: 'n-1', text: 'internal note', isPrivate: true },
            { __typename: 'ProgramNote', id: 'n-2', text: 'PI-visible note', isPrivate: false },
          ],
          users: [
            programUser('m-1', 'PI', false, 'Ada', 'Lovelace'),
            programUser('m-2', 'SUPPORT_PRIMARY', false, 'Bob', 'Contact'),
            programUser('m-3', 'COI', true, 'Cleo', 'Student'),
          ],
        }),
      ]),
    );
    expect(p?.id).toBe('p-1322');
    expect(p?.name).toBe('p-1322 (untitled)'); // name fallback
    expect(p?.reference).toBe('G-2027B-1322-Q');
    expect(p?.pi).toBe('Grace Hopper');
    expect(p?.programClass).toBe('QUEUE');
    expect(p?.tooStatus).toBe('STANDARD');
    expect(p?.considerForBand3).toBe(true);
    expect(p?.minPercentTime).toBe(80);
    // Only SUPPORT_PRIMARY/SUPPORT_SECONDARY are contact scientists — not the PI or a plain COI.
    expect(p?.contactScientists).toEqual([{ name: 'Bob Contact', userId: 'u-m-2', programUserId: 'm-2' }]);
    // Thesis is tracked per investigator (ProgramUser.thesis), not per program.
    expect(p?.thesisInvestigators).toEqual(['Cleo Student']);
    expect(p?.privateNote).toBe('internal note');
    expect(p?.privateNoteId).toBe('n-1');
    expect(p?.proprietaryMonths).toBe(6);
    expect(p?.privateHeader).toBe(true);
    expect(p?.allocations).toEqual([{ category: 'US', scienceBand: 'BAND1', hours: 12.5 }]);
  });

  it('treats Classical proposals as CLASSICAL with no ToO/Band-3 (those are Queue-only)', () => {
    const [p] = mapPrograms(
      result([
        program({
          proposal: { __typename: 'Proposal', gemini: { __typename: 'Classical', minPercentTime: 90 } },
          pi: null,
        }),
      ]),
    );
    expect(p?.programClass).toBe('CLASSICAL');
    expect(p?.tooStatus).toBe('NONE');
    expect(p?.considerForBand3).toBe(false);
    expect(p?.minPercentTime).toBe(90);
    expect(p?.pi).toBe('(unknown PI)');
  });

  it('shows the 1901–2099 sentinel bounds as blank dates, keeps a real range', () => {
    const [sentinel, custom] = mapPrograms(
      result([
        program({ id: 'p-1' }),
        program({ id: 'p-2', active: { __typename: 'DateInterval', start: '2027-08-01', end: '2028-02-28' } }),
      ]),
    );
    expect(sentinel?.activeStart).toBe('');
    expect(sentinel?.activeEnd).toBe('');
    expect(custom?.activeStart).toBe('2027-08-01');
    expect(custom?.activeEnd).toBe('2028-02-28');
  });
});

describe('proposalTypeInput', () => {
  const base: Program = {
    id: 'p-1',
    reference: 'R',
    name: 'N',
    pi: 'PI',
    programClass: 'QUEUE',
    tooStatus: 'RAPID',
    contactScientists: [],
    activeStart: '',
    activeEnd: '',
    proprietaryMonths: 6,
    considerForBand3: true,
    minPercentTime: 75,
    privateHeader: false,
    thesisInvestigators: [],
    allocations: [],
    privateNote: '',
    privateNoteId: null,
  };

  it('builds the queue arm of the oneOf for Queue programs', () => {
    expect(proposalTypeInput(base)).toEqual({
      queue: { toOActivation: 'RAPID', minPercentTime: 75, considerForBand3: 'CONSIDER' },
    });
  });

  it('builds the classical arm for Classical programs', () => {
    expect(proposalTypeInput({ ...base, programClass: 'CLASSICAL' })).toEqual({
      classical: { minPercentTime: 75 },
    });
  });
});

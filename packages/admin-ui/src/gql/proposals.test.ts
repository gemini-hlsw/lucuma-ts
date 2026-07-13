import { describe, expect, it } from 'vitest';

import type { ObservationRowFieldsFragment } from './odb/gen/graphql';
import { type AdminProposalsResult, mapProposals, semesterOfReference } from './proposals';

type RawProgram = AdminProposalsResult['programs']['matches'][number];

function observation(id: string, targetName: string, hours: number | null): ObservationRowFieldsFragment {
  return {
    __typename: 'Observation',
    id,
    observationDuration: hours === null ? null : { __typename: 'TimeSpan', hours },
    instrument: 'FLAMINGOS2',
    observingMode: null,
    constraintSet: {
      __typename: 'ConstraintSet',
      imageQuality: 'POINT_EIGHT',
      cloudExtinction: 'POINT_THREE',
      skyBackground: 'GRAY',
      waterVapor: 'WET',
    },
    targetEnvironment: {
      __typename: 'TargetEnvironment',
      firstScienceTarget: { __typename: 'Target', id: `t-${id}`, name: targetName, sidereal: null },
    },
  };
}

function specialProgram(overrides: Partial<RawProgram>): RawProgram {
  return {
    __typename: 'Program',
    id: 'p-110',
    name: 'F2 telluric test',
    description: 'This is for testing F2 telluric generation.',
    proposalStatus: 'SUBMITTED',
    pi: {
      __typename: 'ProgramUser',
      id: 'm-pi',
      user: {
        __typename: 'User',
        id: 'u-pi',
        profile: { __typename: 'UserProfile', givenName: 'Bryan', familyName: 'Miller' },
      },
    },
    proposal: {
      __typename: 'Proposal',
      reference: { __typename: 'ProposalReference', label: 'G-2027B-0042-DD' },
      gemini: { __typename: 'DirectorsTime', scienceSubtype: 'DIRECTORS_TIME' },
    },
    observations: { __typename: 'ObservationSelectResult', matches: [] },
    ...overrides,
  };
}

describe('mapProposals', () => {
  it('projects only special-subtype proposals, with abstract + observation rows', () => {
    const out = mapProposals({
      programs: {
        __typename: 'ProgramSelectResult',
        matches: [
          specialProgram({
            observations: {
              __typename: 'ObservationSelectResult',
              matches: [
                observation('o-1db', 'Gaia DR2 2342904698625661824', 0.4),
                observation('o-459a', 'HIP 3320', null),
              ],
            },
          }),
          // Not a special subtype (a regular Queue proposal) — excluded.
          specialProgram({
            id: 'p-999',
            proposal: {
              __typename: 'Proposal',
              reference: null,
              gemini: { __typename: 'Queue', scienceSubtype: 'QUEUE' },
            },
          }),
        ],
      },
    });
    expect(out.length).toBe(1);
    const p = out[0];
    expect(p?.id).toBe('p-110');
    expect(p?.reference).toBe('G-2027B-0042-DD');
    expect(p?.pi).toBe('Bryan Miller');
    expect(p?.abstract).toBe('This is for testing F2 telluric generation.');
    expect(p?.semester).toBe('2027B'); // parsed from the reference label
    // Rows carry the full shared shape; fields absent from the fixture (no
    // sidereal coordinates or mode) degrade to em-dashes.
    expect(p?.observations[0]).toMatchObject({
      id: 'o-1db',
      target: 'Gaia DR2 2342904698625661824',
      ra: '—',
      dec: '—',
      raDeg: null,
      modeType: null,
      instrument: 'Flamingos-2',
      config: 'Flamingos-2',
      hours: 0.4,
    });
    expect(p?.observations[1]).toMatchObject({ id: 'o-459a', target: 'HIP 3320', hours: 0 });
  });
});

describe('semesterOfReference', () => {
  it('parses the semester token, degrading to an em-dash', () => {
    expect(semesterOfReference('G-2027B-0042-DD')).toBe('2027B');
    expect(semesterOfReference('p-110')).toBe('—');
  });
});

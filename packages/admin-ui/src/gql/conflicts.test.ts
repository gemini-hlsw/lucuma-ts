import { describe, expect, it } from 'vitest';

import {
  type AdminConflictCheckResult,
  type ConflictCandidate,
  mapConflictCandidates,
  matchConflicts,
  similarModeTypes,
} from './conflicts';
import { formatModeType } from './shared';

describe('similarModeTypes', () => {
  it('pairs the sc-9243 similar instruments, same configuration style', () => {
    expect(similarModeTypes('GMOS_NORTH_LONG_SLIT')).toEqual(['GMOS_NORTH_LONG_SLIT', 'GMOS_SOUTH_LONG_SLIT']);
    expect(similarModeTypes('GNIRS_LONG_SLIT')).toEqual(['GNIRS_LONG_SLIT', 'FLAMINGOS_2_LONG_SLIT']);
    expect(similarModeTypes('ZORRO_SPECKLE')).toEqual(['ZORRO_SPECKLE', 'ALOPEKE_SPECKLE']);
    expect(similarModeTypes('MAROON_X')).toEqual(['MAROON_X', 'GHOST_IFU']);
  });

  it('is empty for mode-less sources', () => {
    expect(similarModeTypes(null)).toEqual([]);
  });
});

describe('formatModeType', () => {
  it('renders instrument + configuration style', () => {
    expect(formatModeType('GMOS_SOUTH_LONG_SLIT')).toBe('GMOS-S LongSlit');
    expect(formatModeType('FLAMINGOS_2_IMAGING')).toBe('Flamingos-2 Imaging');
    expect(formatModeType('MAROON_X')).toBe('MAROON-X');
    expect(formatModeType(null)).toBe('—');
  });
});

type RawObservation = AdminConflictCheckResult['observations']['matches'][number];

function tooObservation(
  id: string,
  toOActivation: 'RAPID' | 'NONE',
  target: RawObservation['targetEnvironment']['firstScienceTarget'],
  reference: string | null,
  workflow: RawObservation['workflow'],
): RawObservation {
  return {
    __typename: 'Observation',
    id,
    reference: reference === null ? null : { __typename: 'ObservationReference', label: reference },
    workflow,
    observingMode: { __typename: 'ObservingMode', mode: 'GMOS_NORTH_LONG_SLIT' },
    program: {
      __typename: 'Program',
      id: `p-${id}`,
      proposal: { __typename: 'Proposal', gemini: { __typename: 'Queue', toOActivation } },
    },
    targetEnvironment: { __typename: 'TargetEnvironment', firstScienceTarget: target },
  };
}

describe('mapConflictCandidates', () => {
  it('merges both pools, keeping only ToO-program observations from the second', () => {
    const candidates = mapConflictCandidates({
      configurationRequests: {
        __typename: 'ConfigurationRequestSelectResult',
        matches: [
          {
            __typename: 'ConfigurationRequest',
            id: 'x-42',
            status: 'APPROVED',
            program: {
              __typename: 'Program',
              id: 'p-2',
              reference: { __typename: 'ScienceProgramReference', label: 'G-2027B-0421-P' },
            },
            configuration: {
              __typename: 'Configuration',
              target: {
                __typename: 'ConfigurationTarget',
                coordinates: {
                  __typename: 'Coordinates',
                  ra: { __typename: 'RightAscension', degrees: 30 },
                  dec: { __typename: 'Declination', degrees: -30 },
                },
              },
              observingMode: { __typename: 'ConfigurationObservingMode', mode: 'GMOS_SOUTH_LONG_SLIT' },
            },
          },
        ],
      },
      observations: {
        __typename: 'ObservationSelectResult',
        matches: [
          tooObservation(
            'o-1',
            'RAPID',
            {
              __typename: 'Target',
              id: 't-1',
              name: 'NGC 1027',
              sidereal: {
                __typename: 'Sidereal',
                ra: { __typename: 'RightAscension', degrees: 30.001 },
                dec: { __typename: 'Declination', degrees: -30 },
              },
            },
            'G-2027B-0057-Q-0311',
            {
              __typename: 'CalculatedObservationWorkflow',
              value: { __typename: 'ObservationWorkflow', state: 'READY' },
            },
          ),
          tooObservation('o-2', 'NONE', null, null, null),
        ],
      },
    });
    expect(candidates).toHaveLength(2); // the NONE-activation observation is dropped
    expect(candidates[0]).toMatchObject({ label: 'G-2027B-0421-P x-42', status: 'Approved', requestId: 'x-42' });
    expect(candidates[1]).toMatchObject({ label: 'G-2027B-0057-Q-0311', status: 'Ready', target: 'NGC 1027' });
  });
});

function candidate(overrides: Partial<ConflictCandidate>): ConflictCandidate {
  return {
    label: 'G-2027B-0421-P x-42',
    programId: 'p-2',
    requestId: 'x-42',
    status: 'Approved',
    target: '—',
    raDeg: 30,
    decDeg: -30,
    modeType: 'GMOS_NORTH_LONG_SLIT',
    ...overrides,
  };
}

describe('matchConflicts', () => {
  const source = { id: 'x-125', programId: 'p-1', raDeg: 30, decDeg: -30, modeType: 'GMOS_SOUTH_LONG_SLIT' };

  it('matches a similar mode within the field-of-view distance', () => {
    // GMOS radius is 165″; 0.02° of dec is 72″.
    const rows = matchConflicts([source], [candidate({ decDeg: -30.02 })]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.sepArcsec).toBeCloseTo(72, 0);
  });

  it('excludes matches beyond the distance, in the same program, or of a dissimilar mode', () => {
    expect(matchConflicts([source], [candidate({ decDeg: -30.5 })])).toEqual([]); // 1800″ away
    expect(matchConflicts([source], [candidate({ programId: 'p-1' })])).toEqual([]); // own program
    expect(matchConflicts([source], [candidate({ modeType: 'GMOS_NORTH_IMAGING' })])).toEqual([]); // imaging ≠ long-slit
  });

  it('skips sources without coordinates (ToO configurations)', () => {
    expect(matchConflicts([{ ...source, raDeg: null }], [candidate({})])).toEqual([]);
  });

  it('gives each row a unique key when one candidate conflicts with several sources', () => {
    const rows = matchConflicts([source, { ...source, id: 'x-126' }], [candidate({})]);
    expect(rows.map((r) => r.key)).toEqual(['x-125:G-2027B-0421-P x-42', 'x-126:G-2027B-0421-P x-42']);
  });
});

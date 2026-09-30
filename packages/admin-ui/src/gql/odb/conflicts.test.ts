import { describe, expect, it } from 'vitest';

import {
  type AdminConflictCheckResult,
  type ConflictCandidate,
  type ConflictRow,
  conflictTargetLabel,
  mapConflictCandidates,
  matchConflicts,
  similarModeTypes,
} from './conflicts';
import type { TooActivation } from './gen/graphql';
import { formatModeType } from './shared';

describe(similarModeTypes, () => {
  it('pairs the sc-9243 similar instruments, same configuration style', () => {
    expect(similarModeTypes('GMOS_NORTH_LONG_SLIT')).toEqual(['GMOS_NORTH_LONG_SLIT', 'GMOS_SOUTH_LONG_SLIT']);
    expect(similarModeTypes('GNIRS_LONG_SLIT')).toEqual(['GNIRS_LONG_SLIT', 'FLAMINGOS_2_LONG_SLIT']);
    expect(similarModeTypes('ZORRO_SPECKLE')).toEqual(['ZORRO_SPECKLE', 'ALOPEKE_SPECKLE']);
    expect(similarModeTypes('MAROON_X')).toEqual(['MAROON_X', 'GHOST_IFU']);
  });

  it('is empty for mode-less sources', () => {
    expect(similarModeTypes(null)).toEqual([]);
    expect(similarModeTypes('FLAMINGOS_2_IMAGING')).toEqual(['FLAMINGOS_2_IMAGING']);
    expect(similarModeTypes('GMOS_SOUTH_IMAGING')).toEqual(['GMOS_SOUTH_IMAGING', 'GMOS_NORTH_IMAGING']);
    expect(similarModeTypes('ALOPEKE_WIDE_FIELD')).toEqual(['ALOPEKE_WIDE_FIELD', 'ZORRO_WIDE_FIELD']);
  });
});

describe(formatModeType, () => {
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
  tooActivationCeiling: TooActivation,
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
      // The program reference is the observation reference without its trailing
      // observation index, so the display can strip the shared prefix.
      reference:
        reference === null ? null : { __typename: 'ScienceProgramReference', label: reference.replace(/-\d+$/, '') },
      proposal: { __typename: 'Proposal', gemini: { __typename: 'Queue', tooActivationCeiling } },
    },
    targetEnvironment: { __typename: 'TargetEnvironment', firstScienceTarget: target },
  };
}

describe(mapConflictCandidates, () => {
  /** An observation whose reference and program label are set independently, to
   *  exercise the prefix strip's edges (the tooObservation helper derives one
   *  from the other, so it cannot express these). */
  function withLabels(reference: string | null, programLabel: string | null): RawObservation {
    const base = tooObservation('o-e', 'RAPID', null, reference, {
      __typename: 'CalculatedObservationWorkflow',
      value: { __typename: 'ObservationWorkflow', state: 'READY' },
    });
    return {
      ...base,
      program: {
        ...base.program,
        reference: programLabel === null ? null : { __typename: 'ScienceProgramReference', label: programLabel },
      },
    };
  }

  const detailLabelOf = (reference: string | null, programLabel: string | null): string =>
    mapConflictCandidates({
      configurationRequests: { __typename: 'ConfigurationRequestSelectResult', matches: [] },
      observations: { __typename: 'ObservationSelectResult', matches: [withLabels(reference, programLabel)] },
    })[0]!.detailLabel;

  it.each([
    // Normal case: the shared program prefix and its hyphen come off.
    ['G-2027B-0057-Q-0311', 'G-2027B-0057-Q', '0311'],
    // A reference that is all prefix would strip to nothing, leaving a bare
    // link; it keeps the full reference instead.
    ['G-2027B-0057-Q-', 'G-2027B-0057-Q', 'G-2027B-0057-Q-'],
    // The reference IS the program label — nothing to strip.
    ['G-2027B-0057-Q', 'G-2027B-0057-Q', 'G-2027B-0057-Q'],
    // A reference that doesn't carry the prefix is shown whole. Deliberately
    // longer than the program label: an equal-length one would slice to "" and
    // be rescued by the `|| obsRef` guard, hiding a missing prefix check.
    ['GS-2025B-FT-218-0007', 'G-2027B-0057-Q', 'GS-2025B-FT-218-0007'],
    // No program reference to strip: the observation id is the whole label.
    [null, null, 'o-e'],
  ])('derives the detail label for %s under %s', (reference, programLabel, expected) => {
    expect(detailLabelOf(reference, programLabel)).toBe(expected);
  });

  it('merges both pools, keeping only ToO-program observations from the second', () => {
    const candidates = mapConflictCandidates({
      configurationRequests: {
        __typename: 'ConfigurationRequestSelectResult',
        matches: [
          {
            __typename: 'ConfigurationRequest',
            id: 'x-42',
            status: 'APPROVED',
            applicableObservations: ['o-42a', 'o-42b'],
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
          tooObservation(
            'o-3',
            'INTERRUPTING',
            {
              __typename: 'Target',
              id: 't-3',
              name: 'SN 2027aa',
              sidereal: {
                __typename: 'Sidereal',
                ra: { __typename: 'RightAscension', degrees: 31 },
                dec: { __typename: 'Declination', degrees: -31 },
              },
            },
            'G-2027B-0058-Q-0001',
            {
              __typename: 'CalculatedObservationWorkflow',
              value: { __typename: 'ObservationWorkflow', state: 'READY' },
            },
          ),
        ],
      },
    });
    expect(candidates).toHaveLength(3); // the NONE-ceiling observation is dropped
    expect(candidates[0]).toMatchObject({
      programLabel: 'G-2027B-0421-P',
      detailLabel: 'x-42',
      status: 'Approved',
      requestId: 'x-42',
      applicableObservations: ['o-42a', 'o-42b'],
      ra: '02:00:00.00',
      dec: '-30:00:00.0',
    });
    expect(candidates[1]).toMatchObject({
      // The program-reference prefix is stripped from the observation reference.
      programLabel: 'G-2027B-0057-Q',
      detailLabel: '0311',
      status: 'Ready',
      target: 'NGC 1027',
      ra: '02:00:00.24',
    });
    expect(candidates[2]).toMatchObject({
      programLabel: 'G-2027B-0058-Q',
      detailLabel: '0001',
      status: 'Ready',
      target: 'SN 2027aa',
    });
  });
});

function candidate(overrides: Partial<ConflictCandidate>): ConflictCandidate {
  return {
    programLabel: 'G-2027B-0421-P',
    detailLabel: 'x-42',
    programId: 'p-2',
    requestId: 'x-42',
    status: 'Approved',
    target: '—',
    applicableObservations: [],
    ra: '02:00:00.00',
    dec: '-30:00:00.0',
    raDeg: 30,
    decDeg: -30,
    modeType: 'GMOS_NORTH_LONG_SLIT',
    ...overrides,
  };
}

describe(matchConflicts, () => {
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
    expect(rows.map((r) => r.key)).toEqual(['x-125:p-2:x-42', 'x-126:p-2:x-42']);
  });
});

describe(conflictTargetLabel, () => {
  const row = (overrides: Partial<ConflictRow>): ConflictRow => ({
    ...candidate({}),
    key: 'k',
    sourceId: 'x-1',
    sepArcsec: 0,
    ...overrides,
  });

  it("keeps a ToO observation's own name (no applicable observations to resolve)", () => {
    expect(conflictTargetLabel(row({ applicableObservations: [], target: 'SN 2027aa' }), new Map())).toBe('SN 2027aa');
  });

  it('resolves distinct names of a request from its applicable observations', () => {
    const names = new Map([
      ['o-1', 'NGC 300'],
      ['o-2', 'NGC 300'], // same target, two observations — de-duplicated
      ['o-3', 'M31'],
    ]);
    expect(conflictTargetLabel(row({ applicableObservations: ['o-1', 'o-2', 'o-3'] }), names)).toBe('NGC 300, M31');
  });

  it('dashes when a request has applicable observations but none resolved yet', () => {
    expect(conflictTargetLabel(row({ applicableObservations: ['o-9'] }), new Map())).toBe('—');
  });
});

describe('matchConflicts ordering', () => {
  const source = { id: 'x-125', programId: 'p-1', raDeg: 30, decDeg: -30, modeType: 'GMOS_SOUTH_LONG_SLIT' };

  it('sorts rows by source id, then by separation', () => {
    const near = candidate({ detailLabel: 'near', programId: 'p-near', decDeg: -30.005 });
    const far = candidate({ detailLabel: 'far', programId: 'p-far', decDeg: -30.02 });
    const rows = matchConflicts(
      [
        { ...source, id: 'x-2' },
        { ...source, id: 'x-1' },
      ],
      [far, near],
    );
    expect(rows.map((r) => `${r.sourceId}:${r.detailLabel}`)).toEqual(['x-1:near', 'x-1:far', 'x-2:near', 'x-2:far']);
  });
});

import { describe, expect, it } from 'vitest';

import { searchRadiusArcsec } from '@/lib/geminiArchive';

import {
  type ConflictCandidate,
  type ConflictRow,
  conflictRows,
  conflictTargetLabel,
  isCheckable,
  mapObservationCandidates,
  mapRequestCandidates,
  observationsVariables,
  requestsVariables,
  similarModeTypes,
  withoutRequestedObservations,
} from './conflicts';
import type { ConflictObservationCandidateFragment, ConflictRequestCandidateFragment } from './gen/graphql';
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
    expect(similarModeTypes('DAYTIME_CALIBRATION')).toEqual(['DAYTIME_CALIBRATION']);
    expect(similarModeTypes('GMOS_SOUTH_IMAGING')).toEqual(['GMOS_SOUTH_IMAGING', 'GMOS_NORTH_IMAGING']);
    expect(similarModeTypes('ALOPEKE_WIDE_FIELD')).toEqual(['ALOPEKE_WIDE_FIELD', 'ZORRO_WIDE_FIELD']);
  });
});

describe(formatModeType, () => {
  it('renders instrument + configuration style', () => {
    expect(formatModeType('GMOS_SOUTH_LONG_SLIT')).toBe('GMOS-S LongSlit');
    expect(formatModeType('FLAMINGOS_2_IMAGING')).toBe('Flamingos-2 Imaging');
    expect(formatModeType('MAROON_X')).toBe('MAROON-X');
    expect(formatModeType('DAYTIME_CALIBRATION')).toBe('Daytime calibration');
    expect(formatModeType(null)).toBe('—');
  });
});

type RawObservation = ConflictObservationCandidateFragment;
type RawBasePosition = RawObservation['targetEnvironment']['basePosition'];

/** A single sidereal target's base position — the ordinary case. */
function siderealBase(name: string, raDeg: number, decDeg: number): RawBasePosition {
  return {
    __typename: 'BasePosition',
    name,
    sidereal: {
      __typename: 'Sidereal',
      ra: { __typename: 'RightAscension', degrees: raDeg },
      dec: { __typename: 'Declination', degrees: decDeg },
    },
    coordinates: null,
  };
}

function observation(
  id: string,
  target: RawBasePosition,
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
    },
    targetEnvironment: { __typename: 'TargetEnvironment', basePosition: target },
  };
}

describe('mapping the candidates of a pool', () => {
  /** An observation whose reference and program label are set independently, to
   *  exercise the prefix strip's edges (the observation helper derives one
   *  from the other, so it cannot express these). */
  function withLabels(reference: string | null, programLabel: string | null): RawObservation {
    const base = observation('o-e', null, reference, {
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
    mapObservationCandidates([withLabels(reference, programLabel)])[0]!.detailLabel;

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

  it('reads a configuration request from its reference coordinates', () => {
    const requests: ConflictRequestCandidateFragment[] = [
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
    ];
    expect(mapRequestCandidates(requests)).toEqual([
      expect.objectContaining({
        programLabel: 'G-2027B-0421-P',
        detailLabel: 'x-42',
        status: 'Approved',
        applicableObservations: ['o-42a', 'o-42b'],
        raDeg: 30,
        ra: '02:00:00.00',
        dec: '-30:00:00.0',
      }),
    ]);
  });

  it('keeps every observation, whatever its program’s ToO status', () => {
    const observations: ConflictObservationCandidateFragment[] = [
      observation('o-1', siderealBase('NGC 1027', 30.001, -30), 'G-2027B-0057-Q-0311', {
        __typename: 'CalculatedObservationWorkflow',
        value: { __typename: 'ObservationWorkflow', state: 'READY' },
      }),
      observation('o-2', siderealBase('Vega', 31, -31), null, null),
      observation('o-3', siderealBase('SN 2027aa', 31, -31), 'G-2027B-0058-Q-0001', {
        __typename: 'CalculatedObservationWorkflow',
        value: { __typename: 'ObservationWorkflow', state: 'READY' },
      }),
    ];
    const candidates = mapObservationCandidates(observations);
    expect(candidates).toHaveLength(3);
    expect(candidates.map((c) => c.observationId)).toEqual(['o-1', 'o-2', 'o-3']);
    expect(candidates[0]).toMatchObject({
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

  it('reads the base position of the reporter’s observation (sc-9243)', () => {
    // o-62ca on dev: a single sidereal target, read from the base position the
    // story names (the position the telescope would slew to).
    const candidates = mapObservationCandidates([
      observation('o-62ca', siderealBase('YYG A', 39.66225, 16.615939), 'G-2026B-0134-Q-0276', {
        __typename: 'CalculatedObservationWorkflow',
        value: { __typename: 'ObservationWorkflow', state: 'READY' },
      }),
    ]);
    expect(candidates[0]).toMatchObject({ target: 'YYG A', raDeg: 39.66225, decDeg: 16.615939 });
  });

  it('reads an explicit base or asterism composite, which fills coordinates rather than sidereal', () => {
    // BasePosition fills exactly one of the two by type, so reading only
    // `sidereal` would lose every observation with an explicit base.
    const candidates = mapObservationCandidates([
      observation(
        'o-9',
        {
          __typename: 'BasePosition',
          name: 'M31, M32',
          sidereal: null,
          coordinates: {
            __typename: 'Coordinates',
            ra: { __typename: 'RightAscension', degrees: 10.7 },
            dec: { __typename: 'Declination', degrees: 41.3 },
          },
        },
        'G-2027B-0059-Q-0001',
        {
          __typename: 'CalculatedObservationWorkflow',
          value: { __typename: 'ObservationWorkflow', state: 'READY' },
        },
      ),
    ]);
    expect(candidates[0]).toMatchObject({ target: 'M31, M32', raDeg: 10.7, decDeg: 41.3 });
  });

  it('reads a positionless observation without failing', () => {
    // A non-sidereal target fills neither field. The cone should keep these out
    // of the pool entirely, so this is defence in depth rather than a case the
    // table is expected to show.
    const candidates = mapObservationCandidates([
      observation(
        'o-10',
        { __typename: 'BasePosition', name: 'Ceres', sidereal: null, coordinates: null },
        'G-2027B-0060-Q-0001',
        {
          __typename: 'CalculatedObservationWorkflow',
          value: { __typename: 'ObservationWorkflow', state: 'READY' },
        },
      ),
    ]);
    expect(candidates[0]).toMatchObject({ target: 'Ceres', raDeg: null, decDeg: null });
  });
});

function candidate(overrides: Partial<ConflictCandidate>): ConflictCandidate {
  return {
    programLabel: 'G-2027B-0421-P',
    detailLabel: 'x-42',
    programId: 'p-2',
    observationId: null,
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

describe(conflictRows, () => {
  const source = { id: 'x-125', programId: 'p-1', raDeg: 30, decDeg: -30, modeType: 'GMOS_SOUTH_LONG_SLIT' };

  it('reports each candidate’s separation from the source', () => {
    // 0.02° of dec is 72″. The separation is shown in the table; it is not a
    // test the candidate had to pass, the ODB's cone having already applied it.
    const rows = conflictRows(source, [candidate({ decDeg: -30.02 })]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.sepArcsec).toBeCloseTo(72, 0);
  });

  it('keeps a distant candidate, since the ODB is the only judge of proximity', () => {
    // 1800″ away, which the cone would never have returned. Trimming it here
    // would use the coordinates the ODB hands back — at the target's own
    // catalogue epoch — rather than the J2000 position it matched on, and the
    // narrower of two tests is the one that drops real conflicts.
    expect(conflictRows(source, [candidate({ decDeg: -30.5 })])).toHaveLength(1);
  });

  it('keeps a candidate whose position could not be read, with no separation to show', () => {
    const rows = conflictRows(source, [candidate({ raDeg: null, decDeg: null })]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.sepArcsec).toBeNull();
  });

  it('keys a row by its program and its trailing label', () => {
    expect(conflictRows(source, [candidate({})]).map((r) => r.key)).toEqual(['p-2:x-42']);
  });
});

describe(conflictTargetLabel, () => {
  const row = (overrides: Partial<ConflictRow>): ConflictRow => ({
    ...candidate({}),
    key: 'k',
    sepArcsec: 0,
    ...overrides,
  });

  it("keeps an observation's own name (no applicable observations to resolve)", () => {
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

describe('conflictRows ordering', () => {
  const source = { id: 'x-125', programId: 'p-1', raDeg: 30, decDeg: -30, modeType: 'GMOS_SOUTH_LONG_SLIT' };

  it('sorts rows nearest first, those with no separation last', () => {
    const rows = conflictRows(source, [
      candidate({ detailLabel: 'unknown', programId: 'p-unknown', raDeg: null, decDeg: null }),
      candidate({ detailLabel: 'far', programId: 'p-far', decDeg: -30.02 }),
      candidate({ detailLabel: 'near', programId: 'p-near', decDeg: -30.005 }),
    ]);
    expect(rows.map((r) => r.detailLabel)).toEqual(['near', 'far', 'unknown']);
  });

  it('orders rows with no separation by program label, then detail label', () => {
    const unknown = (programLabel: string, detailLabel: string) =>
      candidate({ programLabel, detailLabel, programId: `p-${programLabel}${detailLabel}`, raDeg: null, decDeg: null });
    const rows = conflictRows(source, [unknown('G-B', 'x-1'), unknown('G-A', 'x-2'), unknown('G-A', 'x-1')]);
    expect(rows.map((r) => `${r.programLabel}:${r.detailLabel}`)).toEqual(['G-A:x-1', 'G-A:x-2', 'G-B:x-1']);
  });

  it('breaks a separation tie by program label, then detail label', () => {
    const tied = (programLabel: string, detailLabel: string) =>
      candidate({ programLabel, detailLabel, programId: `p-${programLabel}${detailLabel}`, decDeg: -30.01 });
    const rows = conflictRows(source, [tied('G-B', 'x-2'), tied('G-A', 'x-9'), tied('G-B', 'x-1')]);
    expect(rows.map((r) => `${r.programLabel}:${r.detailLabel}`)).toEqual(['G-A:x-9', 'G-B:x-1', 'G-B:x-2']);
  });
});

describe(withoutRequestedObservations, () => {
  const request = (applicable: string[]) => candidate({ applicableObservations: applicable });
  const obs = (observationId: string) =>
    candidate({ observationId, detailLabel: observationId, programId: `p-${observationId}` });

  it('reports an observation once, through the request that carries it', () => {
    const kept = withoutRequestedObservations([request(['o-1']), obs('o-1'), obs('o-2')]);
    expect(kept.map((c) => c.observationId)).toEqual([null, 'o-2']);
  });

  it('keeps an observation whose request was denied, which is no plan to act on', () => {
    const denied = { ...request(['o-1']), status: 'Denied' };
    const kept = withoutRequestedObservations([denied, obs('o-1')]);
    expect(kept.map((c) => c.observationId)).toEqual([null, 'o-1']);
  });
});

describe(isCheckable, () => {
  const source = { id: 'x-1', programId: 'p-1', raDeg: 30, decDeg: -30, modeType: 'GMOS_SOUTH_LONG_SLIT' };

  it('accepts a source with a position and a similar mode', () => {
    expect(isCheckable(source)).toBe(true);
  });

  it.each([
    ['no right ascension', { raDeg: null }],
    ['no declination', { decDeg: null }],
    ['no observing mode', { modeType: null }],
    ['an observing mode with no known similar mode', { modeType: 'NOT_A_MODE' }],
  ])('rejects a source with %s, which could raise no cone', (_, override) => {
    expect(isCheckable({ ...source, ...override })).toBe(false);
  });
});

describe('the variables of a source', () => {
  const TODAY = '2027-01-15';
  const a = { id: 'x-1', programId: 'p-1', raDeg: 30, decDeg: -30, modeType: 'GMOS_SOUTH_LONG_SLIT' };
  const b = { id: 'x-2', programId: 'p-1', raDeg: 150, decDeg: 20, modeType: 'GNIRS_LONG_SLIT' };

  it.each([
    ['requests', requestsVariables],
    ['observations', observationsVariables],
  ])('puts the source’s own cone in the %s pool', (_, variables) => {
    expect(variables(a, TODAY).where.targetCoordinates).toEqual({
      center: { ra: { degrees: 30 }, dec: { degrees: -30 } },
      distance: { arcseconds: searchRadiusArcsec(a.modeType) },
    });
    expect(variables(b, TODAY).where.targetCoordinates?.center).toEqual({
      ra: { degrees: 150 },
      dec: { degrees: 20 },
    });
  });

  it('asks only for the source’s similar modes, in other active programs, without withdrawn requests', () => {
    const { where } = requestsVariables(b, TODAY);
    expect(where.observingModeType).toEqual({ IN: [...similarModeTypes(b.modeType)] });
    expect(where.program).toEqual({ activeEnd: { GT: TODAY }, id: { NEQ: b.programId } });
    expect(where.status).toEqual({ NEQ: 'WITHDRAWN' });
  });

  it('asks the observation pool for science observations only', () => {
    const { where } = observationsVariables(a, TODAY);
    expect(where.calibrationRole).toEqual({ IS_NULL: true });
    expect(where.observingModeType).toEqual({ IN: [...similarModeTypes(a.modeType)] });
    expect(where.program).toEqual({ activeEnd: { GT: TODAY }, id: { NEQ: a.programId } });
  });
});

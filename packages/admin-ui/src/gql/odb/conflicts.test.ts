import { describe, expect, it } from 'vitest';

import { searchRadiusArcsec } from '@/lib/geminiArchive';
import { environment, observationCandidate, requestCandidate, target } from '@/test/conflicts';

import {
  combinePools,
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
import type { ConflictObservationCandidateFragment } from './gen/graphql';
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
    expect(similarModeTypes('SCORPIO_LONG_SLIT')).toEqual(['SCORPIO_LONG_SLIT']);
    expect(similarModeTypes('DAYTIME_CALIBRATION')).toEqual(['DAYTIME_CALIBRATION']);
    expect(similarModeTypes('GMOS_SOUTH_IMAGING')).toEqual(['GMOS_SOUTH_IMAGING', 'GMOS_NORTH_IMAGING']);
    expect(similarModeTypes('ALOPEKE_WIDE_FIELD')).toEqual(['ALOPEKE_WIDE_FIELD', 'ZORRO_WIDE_FIELD']);
  });
});

describe(formatModeType, () => {
  it('renders instrument + configuration style', () => {
    expect(formatModeType('GMOS_SOUTH_LONG_SLIT')).toBe('GMOS-S LongSlit');
    expect(formatModeType('FLAMINGOS_2_IMAGING')).toBe('Flamingos-2 Imaging');
    expect(formatModeType('SCORPIO_LONG_SLIT')).toBe('SCORPIO LongSlit');
    expect(formatModeType('MAROON_X')).toBe('MAROON-X');
    expect(formatModeType('DAYTIME_CALIBRATION')).toBe('Daytime calibration');
    expect(formatModeType(null)).toBe('—');
  });
});

/** Overrides for an observation's reference and its program's, set independently. */
function labels(reference: string | null, programLabel: string | null): Partial<ConflictObservationCandidateFragment> {
  return {
    reference: reference === null ? null : { __typename: 'ObservationReference', label: reference },
    program: {
      ...observationCandidate().program,
      reference: programLabel === null ? null : { __typename: 'ScienceProgramReference', label: programLabel },
    },
  };
}

describe(mapRequestCandidates, () => {
  it('reads a configuration request from its reference coordinates', () => {
    const requests = [requestCandidate({ applicableObservations: ['o-42a', 'o-42b'] })];
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
});

describe(mapObservationCandidates, () => {
  const detailLabelOf = (reference: string | null, programLabel: string | null): string =>
    mapObservationCandidates([observationCandidate({ id: 'o-e', ...labels(reference, programLabel) })])[0]!.detailLabel;

  it.each([
    // Normal case: the shared program prefix and its hyphen come off.
    ['G-2027B-0057-Q-0311', 'G-2027B-0057-Q', '0311'],
    // All prefix: keeps the full reference rather than a bare link.
    ['G-2027B-0057-Q-', 'G-2027B-0057-Q', 'G-2027B-0057-Q-'],
    // The reference IS the program label — nothing to strip.
    ['G-2027B-0057-Q', 'G-2027B-0057-Q', 'G-2027B-0057-Q'],
    // No prefix: shown whole. Longer than the label, so the `|| obsRef` guard cannot mask it.
    ['GS-2025B-FT-218-0007', 'G-2027B-0057-Q', 'GS-2025B-FT-218-0007'],
    // No program reference to strip: the observation id is the whole label.
    [null, null, 'o-e'],
  ])('derives the detail label for %s under %s', (reference, programLabel, expected) => {
    expect(detailLabelOf(reference, programLabel)).toBe(expected);
  });

  it('maps every match it is given, in order, with its labels, status and target', () => {
    const at = (name: string, raDeg: number, decDeg: number) => environment([target(name, [raDeg, decDeg])]);
    const candidates = mapObservationCandidates([
      observationCandidate({
        id: 'o-1',
        targetEnvironment: at('NGC 1027', 30.001, -30),
        ...labels('G-2027B-0057-Q-0311', 'G-2027B-0057-Q'),
      }),
      observationCandidate({
        id: 'o-2',
        targetEnvironment: at('Vega', 31, -31),
        workflow: null,
        ...labels(null, null),
      }),
      observationCandidate({
        id: 'o-3',
        targetEnvironment: at('SN 2027aa', 31, -31),
        ...labels('G-2027B-0058-Q-0001', 'G-2027B-0058-Q'),
      }),
    ]);
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

  it.each([
    // o-62ca on dev: a single sidereal target.
    [
      'the reporter’s single sidereal target (sc-9243)',
      environment([target('YYG A', [39.66225, 16.615939])]),
      'YYG A',
      39.66225,
      16.615939,
    ],
    [
      'an explicit base',
      environment([target('M31', [10, 41]), target('M32', [10.6, 40.8])], [10.7, 41.3]),
      'M31, M32',
      10.7,
      41.3,
    ],
  ])('reads the base position of %s', (_, targetEnvironment, name, raDeg, decDeg) => {
    const [candidate] = mapObservationCandidates([observationCandidate({ targetEnvironment })]);
    expect(candidate).toMatchObject({ target: name, raDeg, decDeg });
  });

  it.each([
    // The ODB's cone matched them on its own base, so they stay listed with no position to show.
    ['a non-sidereal target', environment([target('Ceres', null)]), 'Ceres'],
    ['an asterism without an explicit base', environment([target('A', [10, 20]), target('B', [11, 21])]), 'A, B'],
  ])('lists %s without a position', (_, targetEnvironment, name) => {
    const [candidate] = mapObservationCandidates([observationCandidate({ targetEnvironment })]);
    expect(candidate).toMatchObject({ target: name, raDeg: null, decDeg: null, ra: '—', dec: '—' });
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
    // 0.02° of dec is 72″: shown, not tested; the ODB's cone already applied.
    const rows = conflictRows(source, [candidate({ decDeg: -30.02 })]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.sepArcsec).toBeCloseTo(72, 0);
  });

  it('keeps a distant candidate, since the ODB is the only judge of proximity', () => {
    // 1800″ away. Trimming here would use the catalogue-epoch coordinates, not the J2000 ones the ODB matched.
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

describe(combinePools, () => {
  const page = <T>(matches: readonly T[]) => ({ page: { hasMore: false, matches }, loading: false, error: undefined });
  const pending = { page: undefined, loading: true, error: undefined };

  it('lists nothing while one pool is still answering, since half an answer is not the whole', () => {
    const check = combinePools(page([requestCandidate()]), pending);
    expect(check).toEqual({ candidates: [], loading: true, error: null, truncated: false });
  });

  it('lists both pools once both have answered', () => {
    const check = combinePools(page([requestCandidate()]), page([observationCandidate()]));
    expect(check.candidates.map((c) => c.detailLabel)).toEqual(['x-42', '0001']);
  });

  it('lists nothing and reports the error when a pool failed, even if the other answered', () => {
    const error = new Error('ODB unavailable');
    const check = combinePools(page([requestCandidate()]), { page: undefined, loading: false, error });
    expect(check).toEqual({ candidates: [], loading: false, error, truncated: false });
  });

  it('reports a pool that finished without a page as a failure', () => {
    const check = combinePools(page([requestCandidate()]), { page: undefined, loading: false, error: undefined });
    expect(check.candidates).toEqual([]);
    expect(check.error?.message).toMatch(/no data/);
  });

  it('flags a pool cut at its limit as truncated, keeping what it listed', () => {
    const cut = { page: { hasMore: true, matches: [observationCandidate()] }, loading: false, error: undefined };
    const check = combinePools(page([]), cut);
    expect(check).toMatchObject({ truncated: true, error: null });
    expect(check.candidates).toHaveLength(1);
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

const TODAY = '2027-01-15';
const a = { id: 'x-1', programId: 'p-1', raDeg: 30, decDeg: -30, modeType: 'GMOS_SOUTH_LONG_SLIT' };
const b = { id: 'x-2', programId: 'p-1', raDeg: 150, decDeg: 20, modeType: 'GNIRS_LONG_SLIT' };

/** Each source's own cone, from either pool's variables. */
function expectOwnCone(variables: typeof requestsVariables | typeof observationsVariables) {
  expect(variables(a, TODAY).where.targetCoordinates).toEqual({
    center: { ra: { degrees: 30 }, dec: { degrees: -30 } },
    distance: { arcseconds: searchRadiusArcsec(a.modeType) },
  });
  expect(variables(b, TODAY).where.targetCoordinates?.center).toEqual({ ra: { degrees: 150 }, dec: { degrees: 20 } });
}

describe(requestsVariables, () => {
  it('puts the source’s own cone in the requests pool', () => {
    expectOwnCone(requestsVariables);
  });

  it('asks only for the source’s similar modes, in other active programs, without withdrawn requests', () => {
    const { where } = requestsVariables(b, TODAY);
    expect(where.observingModeType).toEqual({ IN: [...similarModeTypes(b.modeType)] });
    expect(where.program).toEqual({ activeEnd: { GT: TODAY }, id: { NEQ: b.programId } });
    expect(where.status).toEqual({ NEQ: 'WITHDRAWN' });
  });
});

describe(observationsVariables, () => {
  it('puts the source’s own cone in the observations pool', () => {
    expectOwnCone(observationsVariables);
  });

  it('asks the observation pool for live science observations of accepted programs only', () => {
    const { where } = observationsVariables(a, TODAY);
    expect(where.calibrationRole).toEqual({ IS_NULL: true });
    expect(where.observingModeType).toEqual({ IN: [...similarModeTypes(a.modeType)] });
    expect(where.program).toEqual({
      activeEnd: { GT: TODAY },
      id: { NEQ: a.programId },
      proposalStatus: { EQ: 'ACCEPTED' },
      type: { EQ: 'SCIENCE' },
    });
    expect(where.workflow).toEqual({ workflowState: { NEQ: 'INACTIVE' } });
  });
});

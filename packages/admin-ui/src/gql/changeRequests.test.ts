import { describe, expect, it } from 'vitest';

import {
  type AdminChangeRequestsResult,
  groupChangeRequestsByProgram,
  mapChangeRequests,
  mapObservationsById,
} from './changeRequests';
import type { ChangeRequest } from './types';

type RawRequest = AdminChangeRequestsResult['configurationRequests']['matches'][number];

function request(overrides: Partial<RawRequest>): RawRequest {
  return {
    __typename: 'ConfigurationRequest',
    id: 'x-357',
    status: 'REQUESTED',
    justification: 'Please adjust the conditions',
    applicableObservations: ['o-9c5', 'o-ca0'],
    program: {
      __typename: 'Program',
      id: 'p-172',
      name: 'Globular clusters',
      reference: { __typename: 'ScienceProgramReference', label: 'G-2027B-0172-Q' },
      pi: {
        __typename: 'ProgramUser',
        id: 'm-1',
        user: {
          __typename: 'User',
          id: 'u-1',
          profile: { __typename: 'UserProfile', givenName: 'Andrew', familyName: 'Stephens' },
        },
      },
    },
    configuration: {
      __typename: 'Configuration',
      target: {
        __typename: 'ConfigurationTarget',
        coordinates: {
          __typename: 'Coordinates',
          ra: { __typename: 'RightAscension', hms: '06:08:31.926560', degrees: 92.133027 },
          dec: { __typename: 'Declination', dms: '-59:32:27.190177', degrees: -59.540886 },
        },
      },
      observingMode: {
        __typename: 'ConfigurationObservingMode',
        instrument: 'GMOS_SOUTH',
        mode: 'GMOS_SOUTH_LONG_SLIT',
      },
      conditions: {
        __typename: 'ConfigurationConditions',
        imageQuality: 'TWO_POINT_ZERO',
        cloudExtinction: 'THREE_POINT_ZERO',
        skyBackground: 'BRIGHT',
        waterVapor: 'WET',
      },
    },
    ...overrides,
  };
}

const result = (matches: RawRequest[]): AdminChangeRequestsResult => ({
  configurationRequests: { __typename: 'ConfigurationRequestSelectResult', matches },
});

describe('mapChangeRequests', () => {
  it('projects coordinates, instrument/site, and a percentile-based conditions string', () => {
    const [c] = mapChangeRequests(result([request({})]));
    expect(c?.programId).toBe('p-172');
    expect(c?.programReference).toBe('G-2027B-0172-Q');
    expect(c?.pi).toBe('Andrew Stephens');
    expect(c?.site).toBe('SOUTH');
    expect(c?.instrument).toBe('GMOS-S');
    expect(c?.ra).toBe('06:08:31.926560');
    expect(c?.dec).toBe('-59:32:27.190177');
    expect(c?.raDeg).toBeCloseTo(92.133027);
    expect(c?.decDeg).toBeCloseTo(-59.540886);
    expect(c?.modeType).toBe('GMOS_SOUTH_LONG_SLIT');
    expect(c?.conditions).toBe('IQ<2.0″ / CC100 / SB100 / WV100');
    expect(c?.observationIds).toEqual(['o-9c5', 'o-ca0']);
    expect(c?.observations).toEqual([]); // joined later by the page via mapObservationsById
  });
});

describe('mapObservationsById', () => {
  it('keys observation rows by id, with coordinates, config, and conditions', () => {
    const out = mapObservationsById({
      observations: {
        __typename: 'ObservationSelectResult',
        matches: [
          {
            __typename: 'Observation',
            id: 'o-9c5',
            observationDuration: null,
            instrument: 'GMOS_NORTH',
            observingMode: { __typename: 'ObservingMode', mode: 'GMOS_NORTH_LONG_SLIT' },
            constraintSet: {
              __typename: 'ConstraintSet',
              imageQuality: 'POINT_EIGHT',
              cloudExtinction: 'POINT_THREE',
              skyBackground: 'GRAY',
              waterVapor: 'WET',
            },
            targetEnvironment: {
              __typename: 'TargetEnvironment',
              firstScienceTarget: {
                __typename: 'Target',
                id: 't-1',
                name: 'Bol 213',
                sidereal: {
                  __typename: 'Sidereal',
                  ra: { __typename: 'RightAscension', hms: '00:41:24', degrees: 10.35 },
                  dec: { __typename: 'Declination', dms: '+41:14:37', degrees: 41.243611 },
                },
              },
            },
          },
        ],
      },
    });
    expect(out.get('o-9c5')).toEqual({
      id: 'o-9c5',
      target: 'Bol 213',
      ra: '00:41:24',
      dec: '+41:14:37',
      raDeg: 10.35,
      decDeg: 41.243611,
      modeType: 'GMOS_NORTH_LONG_SLIT',
      instrument: 'GMOS-N',
      config: 'GMOS-N, LongSlit',
      conditions: 'IQ<0.8″ / CC70 / SB80 / WV100',
      hours: 0,
    });
    expect(out.get('missing')).toBeUndefined();
  });
});

describe('groupChangeRequestsByProgram', () => {
  const cr = (id: string, programId: string, status: ChangeRequest['status']): ChangeRequest => ({
    id,
    programId,
    programReference: programId,
    programTitle: 'T',
    pi: 'PI',
    status,
    justification: '',
    site: 'SOUTH',
    ra: '—',
    dec: '—',
    raDeg: null,
    decDeg: null,
    modeType: null,
    instrument: 'GMOS-S',
    conditions: '—',
    observationIds: [],
    observations: [],
  });

  it('synthesizes the per-program status per the sc-9094 mockup', () => {
    const groups = groupChangeRequestsByProgram([
      cr('x-1', 'p-1', 'APPROVED'),
      cr('x-2', 'p-1', 'APPROVED'),
      cr('x-3', 'p-2', 'APPROVED'),
      cr('x-4', 'p-2', 'DENIED'),
      cr('x-5', 'p-3', 'REQUESTED'),
      cr('x-6', 'p-3', 'APPROVED'),
      cr('x-7', 'p-4', 'DENIED'),
    ]);
    const byProgram = new Map(groups.map((g) => [g.programId, g.status]));
    expect(byProgram.get('p-1')).toBe('Approved');
    expect(byProgram.get('p-2')).toBe('Mixed');
    expect(byProgram.get('p-3')).toBe('Open');
    expect(byProgram.get('p-4')).toBe('Denied');
  });
});

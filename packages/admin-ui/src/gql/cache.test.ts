import type { ApolloCache } from '@apollo/client';
import { describe, expect, it } from 'vitest';

import { client } from './ApolloConfigs';
import { makeCache } from './cache';
import { CHANGE_REQUESTS_QUERY } from './odb/changeRequests';
import { CONFLICT_OBSERVATIONS_QUERY, CONFLICT_REQUESTS_QUERY, CONFLICT_TARGETS_QUERY } from './odb/conflicts';

const TARGETS = { query: CONFLICT_TARGETS_QUERY, variables: { ids: ['o-7'] } };
const OBSERVATIONS = { query: CONFLICT_OBSERVATIONS_QUERY, variables: { where: {} } };

/** The conflict check's target-name lookup: the observation's first science target. */
const writeTargets = (cache: ApolloCache): void => {
  cache.writeQuery({
    ...TARGETS,
    data: {
      observations: {
        __typename: 'ObservationSelectResult',
        matches: [
          {
            __typename: 'Observation',
            id: 'o-7',
            targetEnvironment: {
              __typename: 'TargetEnvironment',
              firstScienceTarget: { __typename: 'Target', id: 't-1', name: 'Vega' },
            },
          },
        ],
      },
    },
  });
};

/** The conflict check's observations pool: the same observation's base position. */
const writeObservations = (cache: ApolloCache): void => {
  cache.writeQuery({
    ...OBSERVATIONS,
    data: {
      observations: {
        __typename: 'ObservationSelectResult',
        hasMore: false,
        matches: [
          {
            __typename: 'Observation',
            id: 'o-7',
            reference: null,
            workflow: null,
            observingMode: null,
            program: { __typename: 'Program', id: 'p-2', reference: null },
            targetEnvironment: {
              __typename: 'TargetEnvironment',
              basePosition: { __typename: 'BasePosition', name: 'Vega', sidereal: null, coordinates: null },
            },
          },
        ],
      },
    },
  });
};

describe(makeCache, () => {
  // The app's own cache is held to the same rule, so its client cannot quietly go back to a default one.
  it.each([
    ['a cache from makeCache', () => makeCache()],
    ['the app’s client', () => client.cache],
  ])('keeps what both queries read of one observation’s target environment in %s', async (_, getCache) => {
    for (const writes of [
      [writeTargets, writeObservations],
      [writeObservations, writeTargets],
    ]) {
      const cache = getCache();
      await cache.reset();
      for (const write of writes) write(cache);
      // Whichever wrote last must not have emptied the other's answer.
      expect(cache.readQuery(TARGETS)).not.toBeNull();
      expect(cache.readQuery(OBSERVATIONS)).not.toBeNull();
    }
  });
});

describe('a configuration request read by the change requests page and by the conflict check', () => {
  const CHANGE_REQUESTS = { query: CHANGE_REQUESTS_QUERY, variables: {} };
  const CONFLICTS = { query: CONFLICT_REQUESTS_QUERY, variables: { where: {} } };
  const program = { __typename: 'Program' as const, id: 'p-2', reference: null };
  const coordinates = {
    __typename: 'Coordinates' as const,
    ra: { __typename: 'RightAscension' as const, degrees: 30 },
    dec: { __typename: 'Declination' as const, degrees: -30 },
  };

  const writeChangeRequests = (cache: ApolloCache): void => {
    cache.writeQuery({
      ...CHANGE_REQUESTS,
      data: {
        configurationRequests: {
          __typename: 'ConfigurationRequestSelectResult',
          hasMore: false,
          matches: [
            {
              __typename: 'ConfigurationRequest',
              id: 'x-42',
              status: 'REQUESTED',
              justification: 'j',
              feedback: null,
              createdAt: '2027-06-01T12:30:00Z',
              applicableObservations: [],
              program: { ...program, name: 'P', pi: null },
              configuration: {
                __typename: 'Configuration',
                target: { __typename: 'ConfigurationTarget', coordinates },
                observingMode: {
                  __typename: 'ConfigurationObservingMode',
                  instrument: 'GMOS_SOUTH',
                  mode: 'GMOS_SOUTH_LONG_SLIT',
                },
                conditions: {
                  __typename: 'ConfigurationConditions',
                  imageQuality: 'POINT_EIGHT',
                  cloudExtinction: 'POINT_THREE',
                  skyBackground: 'GRAY',
                  waterVapor: 'WET',
                },
              },
            },
          ],
        },
      },
    });
  };

  const writeConflicts = (cache: ApolloCache): void => {
    cache.writeQuery({
      ...CONFLICTS,
      data: {
        configurationRequests: {
          __typename: 'ConfigurationRequestSelectResult',
          hasMore: false,
          matches: [
            {
              __typename: 'ConfigurationRequest',
              id: 'x-42',
              status: 'REQUESTED',
              applicableObservations: [],
              program,
              configuration: {
                __typename: 'Configuration',
                target: { __typename: 'ConfigurationTarget', coordinates },
                observingMode: { __typename: 'ConfigurationObservingMode', mode: 'GMOS_SOUTH_LONG_SLIT' },
              },
            },
          ],
        },
      },
    });
  };

  it.each([
    ['a cache from makeCache', () => makeCache()],
    ['the app’s client', () => client.cache],
  ])('keeps what both read of its configuration in %s', async (_, getCache) => {
    for (const writes of [
      [writeChangeRequests, writeConflicts],
      [writeConflicts, writeChangeRequests],
    ]) {
      const cache = getCache();
      await cache.reset();
      for (const write of writes) write(cache);
      expect(cache.readQuery(CHANGE_REQUESTS)).not.toBeNull();
      expect(cache.readQuery(CONFLICTS)).not.toBeNull();
    }
  });
});

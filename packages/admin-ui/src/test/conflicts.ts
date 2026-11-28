import type { MockLink } from '@apollo/client/testing';
import type { MockedResponseOf } from '@gemini-hlsw/lucuma-common-ui/testing';
import { dateToLocalObservingNight } from '@gemini-hlsw/lucuma-core';

import {
  CONFLICT_BASE_QUERY,
  CONFLICT_OBSERVATIONS_QUERY,
  CONFLICT_REQUESTS_QUERY,
  observationsVariables,
  type PositionedSource,
  requestsVariables,
} from '@/gql/odb/conflicts';
import type { ConflictObservationCandidateFragment, ConflictRequestCandidateFragment } from '@/gql/odb/gen/graphql';

const MODE = 'GMOS_SOUTH_LONG_SLIT';

const program = {
  __typename: 'Program',
  id: 'p-2',
  reference: { __typename: 'ScienceProgramReference', label: 'G-2027B-0421-P' },
} as const;

export const coordinates = (raDeg: number, decDeg: number) =>
  ({
    __typename: 'Coordinates',
    ra: { __typename: 'RightAscension', degrees: raDeg },
    dec: { __typename: 'Declination', degrees: decDeg },
  }) as const;

type Environment = ConflictObservationCandidateFragment['targetEnvironment'];

/** A sidereal target; `null` coordinates make it non-sidereal. */
export const target = (name: string, at: readonly [number, number] | null) => ({
  __typename: 'Target' as const,
  id: `t-${name}`,
  name,
  sidereal: at && { ...coordinates(...at), __typename: 'Sidereal' as const },
});

/** A target environment: its asterism, and an explicit base if given. */
export const environment = (
  asterism: ReturnType<typeof target>[],
  explicitBase: readonly [number, number] | null = null,
): Environment => ({
  __typename: 'TargetEnvironment',
  explicitBase: explicitBase && coordinates(...explicitBase),
  asterism,
});

/** An approved GMOS-S request x-42 of program G-2027B-0421-P, at (30°, -30°). */
export const requestCandidate = (
  overrides: Partial<ConflictRequestCandidateFragment> = {},
): ConflictRequestCandidateFragment => ({
  __typename: 'ConfigurationRequest',
  id: 'x-42',
  status: 'APPROVED',
  applicableObservations: [],
  program,
  configuration: {
    __typename: 'Configuration',
    target: { __typename: 'ConfigurationTarget', coordinates: coordinates(30, -30) },
    observingMode: { __typename: 'ConfigurationObservingMode', mode: MODE },
  },
  ...overrides,
});

/** A ready GMOS-S observation o-1 of program G-2027B-0421-P, based at (30°, -30°). */
export const observationCandidate = (
  overrides: Partial<ConflictObservationCandidateFragment> = {},
): ConflictObservationCandidateFragment => ({
  __typename: 'Observation',
  id: 'o-1',
  reference: { __typename: 'ObservationReference', label: 'G-2027B-0421-P-0001' },
  workflow: {
    __typename: 'CalculatedObservationWorkflow',
    value: { __typename: 'ObservationWorkflow', state: 'READY' },
  },
  observingMode: { __typename: 'ObservingMode', mode: MODE },
  program,
  targetEnvironment: environment([target('Target', [30, -30])]),
  ...overrides,
});

/** The ODB's base position for an asterism under review: a centre, or none. */
export const baseMock = (
  id: string,
  at: readonly [number, number] | null,
): MockedResponseOf<typeof CONFLICT_BASE_QUERY> => ({
  request: { query: CONFLICT_BASE_QUERY, variables: { id } },
  result: {
    data: {
      observation: {
        __typename: 'Observation',
        id,
        targetEnvironment: {
          __typename: 'TargetEnvironment',
          basePosition: at && { __typename: 'BasePosition', coordinates: coordinates(...at) },
        },
      },
    },
  },
});

/** What a pool answers for one source: its matches, and whether it was cut at its limit. */
export interface PoolAnswer<T> {
  readonly matches?: readonly T[];
  readonly hasMore?: boolean;
}

/** The answers of both pools for one source. A mock answers only its source's exact
 *  variables, as built by `requestsVariables`/`observationsVariables`. */
export interface SourceAnswers {
  readonly requests?: PoolAnswer<ConflictRequestCandidateFragment>;
  readonly observations?: PoolAnswer<ConflictObservationCandidateFragment>;
}

const requestPage = (answer: PoolAnswer<ConflictRequestCandidateFragment>) => ({
  __typename: 'ConfigurationRequestSelectResult' as const,
  hasMore: answer.hasMore ?? false,
  matches: [...(answer.matches ?? [])],
});

const observationPage = (answer: PoolAnswer<ConflictObservationCandidateFragment>) => ({
  __typename: 'ObservationSelectResult' as const,
  hasMore: answer.hasMore ?? false,
  matches: [...(answer.matches ?? [])],
});

/** The two mocks that answer a source's operations. */
export function conflictMocks(
  source: PositionedSource,
  { requests = {}, observations = {} }: SourceAnswers = {},
): [MockedResponseOf<typeof CONFLICT_REQUESTS_QUERY>, MockedResponseOf<typeof CONFLICT_OBSERVATIONS_QUERY>] {
  const today = dateToLocalObservingNight(new Date());
  return [
    {
      request: { query: CONFLICT_REQUESTS_QUERY, variables: requestsVariables(source, today) },
      result: { data: { configurationRequests: requestPage(requests) } },
      maxUsageCount: Number.POSITIVE_INFINITY,
    },
    {
      request: { query: CONFLICT_OBSERVATIONS_QUERY, variables: observationsVariables(source, today) },
      result: { data: { observations: observationPage(observations) } },
      maxUsageCount: Number.POSITIVE_INFINITY,
    },
  ];
}

/** Empty answers to the conflict check of any source. */
export function emptyConflicts(): MockLink.MockedResponse[] {
  return [
    {
      request: { query: CONFLICT_REQUESTS_QUERY, variables: () => true },
      result: { data: { configurationRequests: requestPage({}) } },
      maxUsageCount: Number.POSITIVE_INFINITY,
    },
    {
      request: { query: CONFLICT_OBSERVATIONS_QUERY, variables: () => true },
      result: { data: { observations: observationPage({}) } },
      maxUsageCount: Number.POSITIVE_INFINITY,
    },
  ];
}

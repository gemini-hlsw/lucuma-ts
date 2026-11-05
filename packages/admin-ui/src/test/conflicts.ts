import type { MockLink } from '@apollo/client/testing';
import type { MockedResponseOf } from '@gemini-hlsw/lucuma-common-ui/testing';
import { dateToLocalObservingNight } from '@gemini-hlsw/lucuma-core';

import {
  CONFLICT_OBSERVATIONS_QUERY,
  CONFLICT_REQUESTS_QUERY,
  observationsVariables,
  type PositionedSource,
  requestsVariables,
} from '@/gql/odb/conflicts';
import type { ConflictObservationCandidateFragment, ConflictRequestCandidateFragment } from '@/gql/odb/gen/graphql';

/** What a pool answers for one source: its matches, and whether it was cut at its limit. */
export interface PoolAnswer<T> {
  readonly matches?: readonly T[];
  readonly hasMore?: boolean;
}

/** The answers of both pools for one source. A mock only answers the exact variables of its
 *  source, so a wrong cone or mode list never reaches the result. */
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

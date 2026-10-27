import type { MockedResponseOf } from '@gemini-hlsw/lucuma-common-ui/testing';

import type { ObservationItemFragment } from '@/gql/odb/gen/graphql';
import { USERS_QUERY } from '@/gql/sso/roster';

/** The `execution.digest` selection of an observation fixture: a settled digest
 *  reporting `hours` of program time, or null (calculation pending / failed). */
export function executionDigest(hours: number | null): ObservationItemFragment['execution'] {
  return {
    __typename: 'Execution',
    digest:
      hours === null
        ? null
        : {
            __typename: 'CalculatedExecutionDigest',
            value: {
              __typename: 'ExecutionDigest',
              estimate: {
                __typename: 'ObservationTimeEstimate',
                total: {
                  __typename: 'CategorizedTime',
                  program: { __typename: 'TimeSpan', hours },
                },
              },
            },
          },
  };
}

/** An empty SSO user roster, for pages that load it in tests about something else. */
export const emptyRoster = (): MockedResponseOf<typeof USERS_QUERY> => ({
  request: { query: USERS_QUERY },
  result: { data: { users: { __typename: 'UserSelectResult', hasMore: false, matches: [] } } },
  // The page may load it again, such as on each selection, so it answers every time.
  maxUsageCount: Number.POSITIVE_INFINITY,
});

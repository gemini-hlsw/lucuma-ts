import type { MockedResponseOf } from '@gemini-hlsw/lucuma-common-ui/testing';

import type {
  ConfigurationRequestItemFragment,
  ConfigurationRequestStatus,
  ObservationItemFragment,
} from '@/gql/odb/gen/graphql';
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

/** A configuration request of program p-1 as the ODB returns it, GMOS-N long slit, no coordinates. */
export const configurationRequest = (
  id: string,
  status: ConfigurationRequestStatus = 'REQUESTED',
  justification = 'Please observe.',
): ConfigurationRequestItemFragment => ({
  __typename: 'ConfigurationRequest',
  id,
  status,
  justification,
  feedback: null,
  createdAt: '2027-06-01T12:30:00Z',
  applicableObservations: [],
  program: {
    __typename: 'Program',
    id: 'p-1',
    name: 'A proposal',
    reference: { __typename: 'ScienceProgramReference', label: 'G-2027B-0042-DD' },
    pi: null,
  },
  configuration: {
    __typename: 'Configuration',
    target: null,
    observingMode: { __typename: 'ConfigurationObservingMode', instrument: 'GMOS_NORTH', mode: 'GMOS_NORTH_LONG_SLIT' },
    conditions: {
      __typename: 'ConfigurationConditions',
      imageQuality: 'POINT_EIGHT',
      cloudExtinction: 'POINT_THREE',
      skyBackground: 'GRAY',
      waterVapor: 'WET',
    },
  },
});

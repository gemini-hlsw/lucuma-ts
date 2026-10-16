import type { StandardUser, User } from '@/auth/user';
import type { ObservationItemFragment } from '@/gql/odb/gen/graphql';
import { USERS_QUERY } from '@/gql/sso/roster';

import type { MockedResponseOf } from './render';

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

/** A standard user with the given active role, for auth-dependent tests. */
export function standardUser(roleType: 'pi' | 'ngo' | 'staff' | 'admin'): StandardUser {
  return {
    type: 'standard',
    id: 'u-1',
    role: { type: roleType, id: 'r-1' },
    otherRoles: [],
    profile: { orcidId: '0000-0001', profile: { givenName: 'Ada', familyName: 'Lovelace' } },
  };
}

/**
 * An unsigned JWT carrying the SSO payload shape the auth atoms decode
 * (`lucuma-user` + `exp`). Signature verification is the backend's job — the
 * client only decodes — so a fixed dummy signature segment is fine for tests.
 */
export function fakeJwt(user: User, expiresInSeconds = 600): string {
  const encode = (obj: unknown): string => btoa(JSON.stringify(obj));
  const header = encode({ alg: 'none', typ: 'JWT' });
  const payload = encode({ 'lucuma-user': user, exp: Math.floor(Date.now() / 1000) + expiresInSeconds });
  return `${header}.${payload}.signature`;
}

/** An answer for the user roster that pages load for their contact-scientist pickers, for tests that do
 *  not look at it: without one the query has no mocked response (see unansweredQueries.ts). */
export const emptyRosterMock = (): MockedResponseOf<typeof USERS_QUERY> => ({
  request: { query: USERS_QUERY },
  result: { data: { users: { __typename: 'UserSelectResult', hasMore: false, matches: [] } } },
  maxUsageCount: Number.POSITIVE_INFINITY,
});

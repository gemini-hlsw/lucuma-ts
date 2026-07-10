/*
 * SSO GraphQL operations for the Users view (sc-9096): the admin roster and
 * the role mutations. These are hand-written `fetch` calls, not codegen: the
 * SSO schema isn't published in @gemini-hlsw/lucuma-schemas (see
 * tasks/codegen.ts). All operations are named and pass identifiers as GraphQL
 * variables. Every one of them requires the Admin role server-side.
 *
 * The `users` roster query is not yet deployed to SSO — it is in development
 * upstream as sc-9059. Until it ships, fetchAllUsers surfaces the server's
 * error verbatim and the view shows it rather than an empty table.
 */
import { odbTokenAtom } from '@/components/atoms/auth';
import { store } from '@/components/atoms/store';

import { CURRENT_ENV } from './environments';

export type Partner = 'AR' | 'BR' | 'CA' | 'CL' | 'KR' | 'UH' | 'US';

export const PARTNERS: readonly Partner[] = ['AR', 'BR', 'CA', 'CL', 'KR', 'UH', 'US'];

/** Full partner names, for labels and tooltips. */
export const PARTNER_NAME: Record<Partner, string> = {
  AR: 'Argentina',
  BR: 'Brazil',
  CA: 'Canada',
  CL: 'Chile',
  KR: 'Korea',
  UH: 'University of Hawaii',
  US: 'United States',
};

export type RoleType = 'PI' | 'NGO' | 'STAFF' | 'ADMIN';

/** A role row from the SSO roster (uppercase enum) — distinct from
 *  auth/user.ts's StandardRole, the signed-in user's own role decoded from
 *  the JWT (lowercase). `id` is the RoleId that deleteRole revokes (sc-8978). */
export interface RosterRole {
  readonly id: string;
  readonly type: RoleType;
  readonly partner?: Partner;
}

export interface RosterUser {
  readonly id: string;
  readonly givenName: string;
  readonly familyName: string;
  readonly email: string;
  readonly orcidId: string;
  readonly roles: readonly RosterRole[];
}

interface GraphqlError {
  message: string;
}

interface GraphqlResponse {
  data?: unknown;
  errors?: GraphqlError[];
}

/** POST one GraphQL operation to SSO with the signed-in bearer. Returns the
 *  parsed body (callers narrow `data` to their operation's shape), or an
 *  error string when SSO is unreachable. */
async function ssoGraphql(query: string, variables: Record<string, unknown>): Promise<GraphqlResponse | string> {
  const token = store.get(odbTokenAtom);
  let res: Response;
  try {
    res = await fetch(CURRENT_ENV.ssoGraphqlUri, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ query, variables }),
    });
  } catch {
    return 'Couldn’t reach SSO.';
  }
  if (!res.ok) return `SSO returned ${String(res.status)}.`;
  return (await res.json()) as GraphqlResponse;
}

const USERS_QUERY = `query AdminUserRoster {
  users {
    id
    orcidId
    profile { givenName familyName email }
    roles { id type partner }
  }
}`;

interface UsersResult {
  users: readonly {
    id: string;
    orcidId: string;
    profile: { givenName: string | null; familyName: string | null; email: string | null };
    roles: readonly { id: string; type: RoleType; partner: Partner | null }[];
  }[];
}

/**
 * Fetch every user + their current roles for the Users view. Returns the list
 * on success, or a human-readable error string (most commonly: the signed-in
 * token doesn't hold the Admin role, or SSO doesn't serve `users` yet).
 */
export async function fetchAllUsers(): Promise<RosterUser[] | string> {
  const body = await ssoGraphql(USERS_QUERY, {});
  if (typeof body === 'string') return body;
  if (body.errors?.length || !body.data) {
    return body.errors?.[0]?.message ?? 'SSO couldn’t list users.';
  }
  const data = body.data as UsersResult;
  return data.users.map((u) => ({
    id: u.id,
    givenName: u.profile.givenName ?? '',
    familyName: u.profile.familyName ?? '',
    email: u.profile.email ?? '',
    orcidId: u.orcidId,
    roles: u.roles.map((r) => ({ id: r.id, type: r.type, ...(r.partner ? { partner: r.partner } : {}) })),
  }));
}

const ADD_ROLE_MUTATION = `mutation AdminAddRole($userId: UserId!, $roleType: RoleType!, $partner: Partner) {
  addRole(userId: $userId, roleType: $roleType, partner: $partner)
}`;

/**
 * Grant a role via SSO's `addRole` mutation. Returns the granted RoleId on
 * success (so the same checkbox can immediately revoke it without a refetch),
 * or a human-readable error string.
 */
export async function addRole(
  userId: string,
  roleType: RoleType,
  partner?: Partner,
): Promise<{ roleId: string } | { error: string }> {
  const body = await ssoGraphql(ADD_ROLE_MUTATION, {
    userId,
    roleType,
    partner: partner ?? null,
  });
  if (typeof body === 'string') return { error: body };
  if (body.errors?.length || !body.data) {
    return { error: body.errors?.[0]?.message ?? 'SSO couldn’t grant that role.' };
  }
  return { roleId: (body.data as { addRole: string }).addRole };
}

const DELETE_ROLE_MUTATION = `mutation AdminDeleteRole($roleId: RoleId!) {
  deleteRole(roleId: $roleId)
}`;

/**
 * Revoke a role via SSO's `deleteRole` mutation (sc-8978) — sessions held
 * under the role are deleted server-side and will fail to renew; PI roles
 * can't be deleted. Returns null on success, or an error string.
 */
export async function deleteRole(roleId: string): Promise<string | null> {
  const body = await ssoGraphql(DELETE_ROLE_MUTATION, { roleId });
  if (typeof body === 'string') return body;
  return body.errors?.[0]?.message ?? null;
}

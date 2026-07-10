/*
 * SSO GraphQL operations: the admin user roster (sc-9096) and the role
 * mutations (sc-8978). Documents are validated and typed against the
 * checked-in SSO schema (Sso.graphql — see its header for provenance) and
 * routed to the SSO endpoint by their `clientName: 'sso'` context
 * (gql/ApolloConfigs.ts). Every operation requires the Admin role
 * server-side.
 *
 * The `users` roster query is not yet deployed to SSO — it is in development
 * upstream as sc-9059. Until it ships, the Users view surfaces SSO's error
 * rather than an empty table.
 */
import { useMutation, useQuery } from '@apollo/client/react';

import type { DocumentType } from './gen';
import { graphql } from './gen';

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

/** Routes an operation to the SSO endpoint (gql/ApolloConfigs.ts). */
const SSO_CONTEXT = { context: { clientName: 'sso' } } as const;

export const USERS_QUERY = graphql(`
  query AdminUserRoster {
    users {
      id
      orcidId
      profile {
        givenName
        familyName
        email
      }
      roles {
        id
        type
        partner
      }
    }
  }
`);

export type AdminUserRosterResult = DocumentType<typeof USERS_QUERY>;

/** Every user + their current roles, for the Users view and the
 *  contact-scientist type-ahead. */
export function useUsers() {
  return useQuery(USERS_QUERY, { ...SSO_CONTEXT, fetchPolicy: 'cache-and-network' });
}

export function mapRosterUsers(raw: AdminUserRosterResult): RosterUser[] {
  return raw.users.map((u) => ({
    id: u.id,
    givenName: u.profile.givenName ?? '',
    familyName: u.profile.familyName ?? '',
    email: u.profile.email ?? '',
    orcidId: u.orcidId,
    roles: u.roles.map((r) => ({ id: r.id, type: r.type, ...(r.partner ? { partner: r.partner } : {}) })),
  }));
}

export const ADD_ROLE_MUTATION = graphql(`
  mutation AdminAddRole($userId: UserId!, $roleType: RoleType!, $partner: Partner) {
    addRole(userId: $userId, roleType: $roleType, partner: $partner)
  }
`);

/** Grant a role. Refetches the roster so the new role (and its revocable
 *  RoleId) is on screen before the call resolves. */
export function useAddRole() {
  return useMutation(ADD_ROLE_MUTATION, { ...SSO_CONTEXT, refetchQueries: [USERS_QUERY], awaitRefetchQueries: true });
}

export const DELETE_ROLE_MUTATION = graphql(`
  mutation AdminDeleteRole($roleId: RoleId!) {
    deleteRole(roleId: $roleId)
  }
`);

/** Revoke a role (sc-8978) — SSO deletes the role's sessions server-side, so
 *  a signed-in holder loses it on their next token renewal. PI roles can't
 *  be deleted. */
export function useDeleteRole() {
  return useMutation(DELETE_ROLE_MUTATION, {
    ...SSO_CONTEXT,
    refetchQueries: [USERS_QUERY],
    awaitRefetchQueries: true,
  });
}

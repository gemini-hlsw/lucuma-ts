/*
 * The signed-in user, decoded from the SSO JWT — the same shape as
 * packages/ui/src/auth/user.ts, extended with the role-comparison helpers the
 * Admin app gates on (mirroring lucuma-core's Access ordering).
 *
 * Role hierarchy (increasing power): guest < pi < ngo < staff < admin < service.
 * The Admin app requires staff or better; the Users view's role mutations
 * additionally require admin server-side.
 */

export type RoleAccess = 'guest' | 'pi' | 'ngo' | 'staff' | 'admin' | 'service';

const ACCESS_ORDER: Record<RoleAccess, number> = {
  guest: 0,
  pi: 1,
  ngo: 2,
  staff: 3,
  admin: 4,
  service: 5,
};

export interface StandardRole {
  readonly type: 'pi' | 'ngo' | 'staff' | 'admin';
  readonly id: string;
  /** Present only for NGO roles. */
  readonly partner?: string;
}

export interface OrcidProfile {
  readonly orcidId: string;
  readonly profile: {
    readonly givenName?: string;
    readonly familyName?: string;
    readonly creditName?: string;
    readonly primaryEmail?: string | null;
  };
}

export interface StandardUser {
  readonly type: 'standard';
  readonly id: string;
  readonly role: StandardRole;
  readonly otherRoles: readonly StandardRole[];
  readonly profile: OrcidProfile;
}

export interface GuestUser {
  readonly type: 'guest';
  readonly id: string;
}

export interface ServiceUser {
  readonly type: 'service';
  readonly id: string;
  readonly name: string;
}

export type User = StandardUser | GuestUser | ServiceUser;

/** The access level of the user's currently active role. */
export function currentAccess(user: User | null): RoleAccess {
  if (!user) return 'guest';
  switch (user.type) {
    case 'standard':
      return user.role.type;
    case 'service':
      return 'service';
    case 'guest':
      return 'guest';
  }
}

export function accessAtLeast(user: User | null, min: RoleAccess): boolean {
  return ACCESS_ORDER[currentAccess(user)] >= ACCESS_ORDER[min];
}

/** Whether the user may enter the Admin app at all (staff or better). */
export const canAccessAdmin = (u: User | null): boolean => accessAtLeast(u, 'staff');

/** Human-readable display name, matching packages/ui's displayName(). */
export function displayName(user: User | null): string {
  if (!user) return 'Not signed in';
  if (user.type === 'guest') return 'Guest User';
  if (user.type === 'service') return `Service User (${user.name})`;
  const p = user.profile.profile;
  if (p.creditName) return p.creditName;
  if (p.givenName && p.familyName) return `${p.givenName} ${p.familyName}`;
  if (p.familyName) return p.familyName;
  if (p.givenName) return p.givenName;
  return user.profile.orcidId;
}

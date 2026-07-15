/*
 * The signed-in user, decoded from the SSO JWT, shared by every app that talks
 * to SSO. Navigate and admin-ui each had their own copy of this model; this is
 * the reconciled shape (all fields readonly, `primaryEmail` nullable to match
 * what the JWT can carry).
 *
 * Role hierarchy (increasing power): guest < pi < ngo < staff < admin < service.
 * The ordering helpers below are generic; app-specific policy (e.g. "may enter
 * the Admin app") lives in the app that owns it.
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

/** Whether the user's active role is at least `min` in the hierarchy. */
export function accessAtLeast(user: User | null, min: RoleAccess): boolean {
  return ACCESS_ORDER[currentAccess(user)] >= ACCESS_ORDER[min];
}

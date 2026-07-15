/*
 * The signed-in user model and role hierarchy now live in common-ui so all apps
 * share one definition (see @gemini-hlsw/lucuma-common-ui). This module keeps the
 * Admin-specific policy on top of it: the staff-or-better gate and the display
 * name. Re-exported here so existing `@/auth/user` imports keep working.
 */
import { accessAtLeast, type User } from '@gemini-hlsw/lucuma-common-ui';

export type {
  GuestUser,
  OrcidProfile,
  RoleAccess,
  ServiceUser,
  StandardRole,
  StandardUser,
  User,
} from '@gemini-hlsw/lucuma-common-ui';
export { accessAtLeast, currentAccess } from '@gemini-hlsw/lucuma-common-ui';

/** Whether the user may enter the Admin app at all (staff or better). */
export const canAccessAdmin = (u: User | null): boolean => accessAtLeast(u, 'staff');

/** Human-readable display name for the signed-in user (or "Not signed in").
 *  Navigate has its own near-identical displayName; unifying the two is a
 *  follow-up (they differ only in the service-user label's capitalisation). */
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

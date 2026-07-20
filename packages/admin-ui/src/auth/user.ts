/*
 * The signed-in user model, role hierarchy, and display name now live in
 * common-ui so all apps share one definition (see @gemini-hlsw/lucuma-common-ui).
 * This module keeps the Admin-specific policy on top of it: the staff-or-better
 * gate. Re-exported here so existing `@/auth/user` imports keep working.
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
export { accessAtLeast, currentAccess, displayName } from '@gemini-hlsw/lucuma-common-ui';

/** Whether the user may enter the Admin app at all (staff or better). */
export const canAccessAdmin = (u: User | null): boolean => accessAtLeast(u, 'staff');

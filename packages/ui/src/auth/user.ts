/* eslint-disable @typescript-eslint/prefer-nullish-coalescing */
/*
 * The user model and role hierarchy now live in common-ui so every app shares
 * one definition. Re-exported here so existing `@/auth/user` imports keep
 * working; only navigate's own `displayName` stays local.
 */
import type { User } from '@gemini-hlsw/lucuma-common-ui';

export type {
  GuestUser,
  OrcidProfile,
  ServiceUser,
  StandardRole,
  StandardUser,
  User,
} from '@gemini-hlsw/lucuma-common-ui';

export function displayName(user: User) {
  if (user.type === 'guest') {
    return 'Guest User';
  } else if (user.type === 'service') {
    return `Service user (${user.name})`;
  } else if (user.type === 'standard') {
    const p = user.profile.profile;

    return (
      p.creditName ||
      (p.givenName && p.familyName && `${p.givenName} ${p.familyName}`) ||
      p.familyName ||
      p.givenName ||
      user.profile.orcidId
    );
  } else {
    return undefined;
  }
}

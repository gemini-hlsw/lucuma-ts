import { type Session, sessionPerStore, type StandardRole } from '@gemini-hlsw/lucuma-common-ui';
import { useStore } from 'jotai';

import { CURRENT_ENV } from './environments';

/*
 * Admin's binding of the shared SSO session keeper (common-ui session.ts).
 * Its own channel keeps sign-out broadcasts inside Admin. Only staff and admin
 * can use Admin, so a user on another role switches to one they hold, if any.
 */

const ADMIN_ROLES = ['staff', 'admin'] as const satisfies readonly StandardRole['type'][];

const sessionFor = sessionPerStore(() => ({
  ssoUri: CURRENT_ENV.ssoUri,
  channelName: 'admin-session',
  preferRoles: ADMIN_ROLES,
}));

/** The keeper for the Jotai store in context. */
export const useSession = (): Session => sessionFor(useStore());

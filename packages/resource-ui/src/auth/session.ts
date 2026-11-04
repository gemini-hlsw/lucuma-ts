import { createSession } from '@gemini-hlsw/lucuma-common-ui';

import { CURRENT_ENV } from '@/app/environment';
import { store } from '@/components/atoms/store';

/*
 * Resource's binding of the shared SSO session keeper (common-ui session.ts).
 * Its own channel keeps sign-out broadcasts inside Resource. No role policy: any role may read.
 */

export const SESSION_CHANNEL = 'resource-session';

export const session = createSession({ store, ssoUri: CURRENT_ENV.ssoUri, channelName: SESSION_CHANNEL });

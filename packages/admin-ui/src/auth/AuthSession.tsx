import { useSessionKeeper, useToastApi } from '@gemini-hlsw/lucuma-common-ui';

import { useSession } from './session';

/**
 * Keeps the SSO session alive through the shared keeper (./session.ts).
 * Signs in from the SSO cookie, renews the token, and switches to a staff or admin role.
 *
 * Renders nothing. Mount it once, inside the Jotai and toast providers.
 */
export function AuthSession(): null {
  const toast = useToastApi();

  useSessionKeeper(useSession(), {
    onRoleSwitch: (outcome) => {
      if (outcome.kind === 'failed') toast.error('Role switch failed', outcome.error.message);
    },
  });

  return null;
}

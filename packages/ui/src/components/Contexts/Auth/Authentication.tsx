import { planRoleSwitch, useSessionKeeper, useToastApi } from '@gemini-hlsw/lucuma-common-ui';
import { useEffect } from 'react';

import { NAVIGATE_ROLES, useSession } from '@/auth/session';
import { useUser } from '@/components/atoms/auth';

/**
 * Keeps the SSO session alive through the shared keeper (auth/session.ts).
 * Switches a user to the staff role. Warns a user who has no staff role.
 */
export function Authentication() {
  const user = useUser();
  const toast = useToastApi();

  useSessionKeeper(useSession(), {
    onRoleSwitch: (outcome) => {
      if (outcome.kind !== 'failed') return;
      toast.error('Error', `Error while switching to role ${outcome.role.type}.\n${outcome.error.message}`);
    },
  });

  useEffect(() => {
    const plan = planRoleSwitch(user, NAVIGATE_ROLES);
    if (plan.kind !== 'unavailable') return;

    return toast.warn(
      'Warning',
      `You are not a staff user (${plan.active.type}). Some functionality might be unavailable.`,
    );
  }, [user, toast]);

  return <></>;
}

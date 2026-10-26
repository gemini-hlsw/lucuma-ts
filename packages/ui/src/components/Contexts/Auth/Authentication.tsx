import { useToastApi } from '@gemini-hlsw/lucuma-common-ui';
import { subSeconds } from 'date-fns';
import { useInterval, useMountEffect } from 'primereact/hooks';
import { useEffect } from 'react';

import { useRefreshToken, useSetRole } from '@/auth/hooks';
import { useTokenExp, useUser } from '@/components/atoms/auth';

const expirationAnticipationSeconds = 30;

/**
 * Authentication component that handles token expiration and refresh.
 */
export function Authentication() {
  const exp = useTokenExp();
  const user = useUser();
  const toast = useToastApi();

  const refreshToken = useRefreshToken();
  const setRole = useSetRole();

  // On mount, check if the token is expired and refresh it if necessary
  useMountEffect(() => {
    if (!exp) {
      console.log('No token on mount, refreshing');
      void refreshToken();
    }
  });

  // Afterwards, check every second if the token is about to expire
  useInterval(async () => {
    if (exp) {
      const expDate = subSeconds(exp, expirationAnticipationSeconds);
      if (expDate < new Date()) {
        console.log('Refreshing token');
        await refreshToken();
      }
    }
  }, 1000);

  // If the user has staff role available, switch to it
  useEffect(() => {
    if (user?.type === 'standard' && user.role.type !== 'staff') {
      const staffRole = user.otherRoles.find((role) => role.type === 'staff');
      if (staffRole) {
        console.log('Switching to staff role');
        void setRole(staffRole);
      } else {
        return toast.warn(
          'Warning',
          `You are not a staff user (${user.role.type}). Some functionality might be unavailable.`,
        );
      }
    }
    return;
  }, [user, setRole, toast]);

  return <></>;
}

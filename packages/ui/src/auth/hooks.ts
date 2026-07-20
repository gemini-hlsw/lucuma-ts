import * as sso from '@gemini-hlsw/lucuma-common-ui/sso';
import { useServerConfigValue } from '@gql/server/ServerConfiguration';
import { useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { useSetOdbToken } from '@/components/atoms/auth';
import { useToast } from '@/Helpers/toast';

import type { StandardRole } from './user';

/**
 * Hook to get the SSO login page URL
 */
export function useSignInURL() {
  const location = useLocation();
  const { ssoUri } = useServerConfigValue();
  const signinURL = useMemo(() => {
    const from = (location.state as LocationInterface)?.from?.pathname ?? '/';
    const state = new URL(from, window.location.origin);
    return sso.signInUrl(ssoUri, state.toString());
  }, [location.state, ssoUri]);

  return signinURL;
}

/**
 * Hook to sign out the user. Clearing the token and logging out from the SSO.
 */
export function useSignout() {
  const setToken = useSetOdbToken();
  const { ssoUri } = useServerConfigValue();

  const signout = useCallback(async () => {
    setToken(null);
    try {
      await sso.logout(ssoUri);
    } catch (error) {
      console.error('Error logging out', error);
    }
  }, [setToken, ssoUri]);

  return signout;
}

/**
 * Hook to refresh the token. It fetches a new token from the SSO and sets it in the state.
 */
export function useRefreshToken() {
  const setToken = useSetOdbToken();
  const { ssoUri } = useServerConfigValue();

  const refreshToken = useCallback(async () => {
    // A failed refresh means there's no valid session — the normal signed-out
    // state — so leave the token as-is rather than treating it as an error.
    const token = await sso.refreshToken(ssoUri);
    if (token) setToken(token);
  }, [setToken, ssoUri]);
  return refreshToken;
}

export function useSetRole() {
  const refreshToken = useRefreshToken();
  const toast = useToast();
  const { ssoUri } = useServerConfigValue();

  const setRole = useCallback(
    async (role: StandardRole) => {
      try {
        await sso.setActiveRole(ssoUri, role.id);
        // Pull the new role's JWT through navigate's own refresh, which writes
        // the token atom the rest of the app reads.
        await refreshToken();
      } catch (error) {
        toast?.show({
          severity: 'error',
          summary: 'Error',
          detail: `Error while switching to role ${role.type}.\n${error instanceof Error ? error.message : String(error)}`,
        });
      }
    },
    [refreshToken, toast, ssoUri],
  );

  return setRole;
}

interface LocationInterface {
  from?: {
    pathname?: string;
  };
}

/**
 * Hook to login as a guest.
 */
export function useGuestLogin() {
  const toast = useToast();
  const setToken = useSetOdbToken();
  const { state: locationState } = useLocation() as { state: LocationInterface };

  const { ssoUri } = useServerConfigValue();

  const navigate = useNavigate();
  const guestLogin = useCallback(async () => {
    const token = await sso.guestLogin(ssoUri);

    if (!token) {
      toast?.show({
        severity: 'error',
        summary: 'Login Error',
        detail: 'Error while logging in as guest',
      });
      return;
    }
    setToken(token);

    const from = locationState?.from?.pathname ?? '/';
    toast?.show({
      severity: 'success',
      summary: 'Login Success',
      detail: 'Logged in as guest',
    });
    await navigate(from, { replace: true });
  }, [locationState, navigate, setToken, ssoUri, toast]);

  return guestLogin;
}

/**
 * Hook to navigate to the login page. Sets the `from` location in the state.
 */
export function useNavigateToLogin() {
  const location = useLocation();
  const navigate = useNavigate();

  const navigateToSignIn = useCallback(() => {
    return navigate('/login', { state: { from: { pathname: location.pathname } } });
  }, [location.pathname, navigate]);

  return navigateToSignIn;
}

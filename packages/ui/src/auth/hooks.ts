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
    const redirectURL = new URL('/auth/v1/stage1', ssoUri);
    const from = (location.state as LocationInterface)?.from?.pathname ?? '/';
    const state = new URL(from, window.location.origin);
    redirectURL.searchParams.set('state', state.toString());

    return redirectURL.toString();
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
    const logoutURL = new URL('/api/v1/logout', ssoUri);
    const res = await fetch(logoutURL, { method: 'POST', credentials: 'include' });
    if (res.ok) {
      const data = await res.text();
      console.log(data);
    } else {
      console.error('Error logging out', res.status, res.statusText);
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
    const refreshURL = new URL('/api/v1/refresh-token', ssoUri);
    const res = await fetch(refreshURL, { method: 'POST', credentials: 'include' });
    if (res.ok) {
      const data = await res.text();
      if (data) setToken(data);
    } else {
      console.error('Error refreshing token', res.status, res.statusText);
    }
  }, [setToken, ssoUri]);
  return refreshToken;
}

export function useSetRole() {
  const refreshToken = useRefreshToken();
  const toast = useToast();
  const { ssoUri } = useServerConfigValue();

  const setRole = useCallback(
    async (role: StandardRole) => {
      const setRoleURL = new URL('/auth/v1/set-role', ssoUri);
      setRoleURL.searchParams.set('role', role.id);
      const res = await fetch(setRoleURL, { method: 'GET', credentials: 'include' });
      if (res.ok) {
        const data = await res.text();
        if (data) await refreshToken();
      } else {
        toast?.show({
          severity: 'error',
          summary: 'Error',
          detail: `Error while switching to role ${role.type}.\n${await res.text()}`,
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
    const guestTokenURL = new URL('/api/v1/auth-as-guest', ssoUri);
    const response = await fetch(guestTokenURL, { method: 'POST', credentials: 'include' });

    if (!response.ok) {
      toast?.show({
        severity: 'error',
        summary: 'Login Error',
        detail: 'Error while logging in as guest',
      });
      return;
    }
    const token = await response.text();
    if (token) setToken(token);

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

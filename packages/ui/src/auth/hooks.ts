import { useToastApi } from '@gemini-hlsw/lucuma-common-ui';
import * as sso from '@gemini-hlsw/lucuma-common-ui/sso';
import { useServerConfigValue } from '@gql/server/ServerConfiguration';
import { useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { useSession } from './session';

/**
 * Hook to get the SSO login page URL. SSO returns to the page that sent the user
 * to sign in, or to the root when there is none.
 */
export function useSignInURL() {
  const location = useLocation();
  const { ssoUri } = useServerConfigValue();
  const signinURL = useMemo(() => {
    const from = (location.state as LocationInterface)?.from?.pathname ?? '/';
    return sso.signInUrl(ssoUri, from);
  }, [location.state, ssoUri]);

  return signinURL;
}

/**
 * Hook to sign out. Every tab drops its token, then the SSO session ends.
 */
export function useSignout() {
  const session = useSession();

  const signout = useCallback(async () => {
    const { reachedSso } = await session.signOut();
    if (!reachedSso) console.error('Error logging out: SSO could not end the session.');
  }, [session]);

  return signout;
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
  const toast = useToastApi();
  const session = useSession();
  const { state: locationState } = useLocation() as { state: LocationInterface };

  const { ssoUri } = useServerConfigValue();

  const navigate = useNavigate();
  const guestLogin = useCallback(async () => {
    const token = await sso.guestLogin(ssoUri);

    if (!token) {
      toast.error('Login Error', 'Error while logging in as guest');
      return;
    }
    // Through the keeper, so the guest token renews even after an earlier sign-out.
    session.signIn(token);

    const from = locationState?.from?.pathname ?? '/';
    toast.success('Login Success', 'Logged in as guest');
    await navigate(from, { replace: true });
  }, [locationState, navigate, session, ssoUri, toast]);

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

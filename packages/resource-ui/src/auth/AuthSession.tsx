import { useSetAtom } from 'jotai';
import { useEffect } from 'react';

import { odbTokenAtom, useIsLoggedIn, useTokenExp } from '@/components/atoms/auth';

import { EXPIRATION_ANTICIPATION_SECONDS } from './environments';
import * as sso from './ssoClient';

/**
 * Keeps the SSO session alive: a silent cookie refresh signs a returning user in
 * without clicking anything, and a proactive refresh runs shortly before each
 * token expires. Mount once inside the Jotai provider.
 */
export function AuthSession(): null {
  const isLoggedIn = useIsLoggedIn();
  const exp = useTokenExp();
  const setToken = useSetAtom(odbTokenAtom);

  // Silent bootstrap: exchange the refresh-token cookie for a session. A
  // signed-out visitor has no cookie, so this resolves null and the app stays
  // public.
  useEffect(() => {
    if (isLoggedIn) return;
    const controller = new AbortController();
    void sso.refreshToken(controller.signal).then((fresh) => {
      if (fresh && !controller.signal.aborted) setToken(fresh);
    });
    return () => {
      controller.abort();
    };
  }, [isLoggedIn, setToken]);

  // The in-flight guard and the backoff keep a refresh that cannot succeed from
  // retrying once per second for the rest of the session.
  const expMs = exp?.getTime();
  useEffect(() => {
    if (expMs === undefined) return;
    const controller = new AbortController();
    let inFlight = false;
    let nextAttempt = 0;
    const id = window.setInterval(() => {
      const now = Date.now();
      if (inFlight || now < nextAttempt) return;
      if (expMs - EXPIRATION_ANTICIPATION_SECONDS * 1000 >= now) return;
      inFlight = true;
      void sso
        .refreshToken(controller.signal)
        .then((fresh) => {
          if (fresh && !controller.signal.aborted) setToken(fresh);
          else nextAttempt = Date.now() + 30_000;
        })
        .finally(() => {
          inFlight = false;
        });
    }, 1000);
    return () => {
      window.clearInterval(id);
      controller.abort();
    };
  }, [expMs, setToken]);

  return null;
}

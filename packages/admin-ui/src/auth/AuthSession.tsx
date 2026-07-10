import { useSetAtom } from 'jotai';
import { useEffect, useRef } from 'react';

import { odbTokenAtom, useOdbTokenValue, useTokenExp, useUser } from '@/components/atoms/auth';

import { EXPIRATION_ANTICIPATION_SECONDS } from './environments';
import * as sso from './ssoClient';

/**
 * Keeps the SSO session alive, following packages/ui's Authentication
 * component: a silent cookie refresh on mount (so a returning user is signed
 * in without clicking), a proactive refresh shortly before each token expires,
 * and a one-time auto-switch to the user's staff/admin role — the only roles
 * that can use this app, so landing on `pi` first would just show a denial.
 *
 * Renders nothing; mount once inside the Jotai provider.
 */
export function AuthSession(): null {
  const token = useOdbTokenValue();
  const user = useUser();
  const exp = useTokenExp();
  const setToken = useSetAtom(odbTokenAtom);
  // Guard so the role auto-switch happens once per token, not per render.
  const switchedFor = useRef<string | null>(null);

  // Silent bootstrap: with no live session, try the refresh-token cookie once.
  const isLoggedIn = user !== null && exp !== null && exp > new Date();
  useEffect(() => {
    if (isLoggedIn) return;
    let cancelled = false;
    void sso.refreshToken().then((fresh) => {
      if (!cancelled && fresh) setToken(fresh);
    });
    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, setToken]);

  // Proactive refresh: check every second; refresh shortly before expiry.
  // Guard against overlapping attempts and back off after a failure so a
  // refresh that cannot succeed doesn't retry once per second.
  const expMs = exp?.getTime();
  useEffect(() => {
    if (expMs === undefined) return;
    let inFlight = false;
    let nextAttempt = 0;
    const id = window.setInterval(() => {
      const now = Date.now();
      if (inFlight || now < nextAttempt) return;
      if (expMs - EXPIRATION_ANTICIPATION_SECONDS * 1000 >= now) return;
      inFlight = true;
      void sso
        .refreshToken()
        .then((fresh) => {
          if (fresh) setToken(fresh);
          else nextAttempt = Date.now() + 30_000;
        })
        .finally(() => {
          inFlight = false;
        });
    }, 1000);
    return () => window.clearInterval(id);
  }, [expMs, setToken]);

  // Auto-switch to a staff/admin role when the active role is lower.
  useEffect(() => {
    if (!token || user?.type !== 'standard') return;
    if (switchedFor.current === token) return;
    if (user.role.type === 'staff' || user.role.type === 'admin') return;
    const staffRole = user.otherRoles.find((r) => r.type === 'staff' || r.type === 'admin');
    if (staffRole) {
      switchedFor.current = token;
      void sso.setRole(staffRole.id).then((fresh) => fresh && setToken(fresh));
    }
  }, [token, user, setToken]);

  return null;
}

/*
 * SSO endpoint operations — the same flows packages/ui implements in
 * auth/hooks.ts, as plain async functions over the environment's SSO origin:
 *
 *   POST /api/v1/refresh-token   → fresh JWT (text body) from the session cookie
 *   POST /api/v1/auth-as-guest   → guest JWT
 *   GET  /auth/v1/stage1?state=  → ORCID login redirect
 *   GET  /auth/v1/set-role?role= → switch active role (then refresh)
 *   POST /api/v1/logout          → clear the session
 *
 * All cookie-based, so every call sends credentials. SSO scopes its session
 * cookie to its own domain — these flows complete on the deployed hosts and on
 * any *.lucuma.xyz dev alias, but not from bare localhost (see the README).
 */
import { CURRENT_ENV } from './environments';

/** Exchange the SSO session cookie for a fresh JWT. Returns the token, or
 *  null when there is no session (or SSO is unreachable). */
export async function refreshToken(): Promise<string | null> {
  try {
    const res = await fetch(new URL('/api/v1/refresh-token', CURRENT_ENV.ssoUri), {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) return null;
    const token = (await res.text()).trim();
    return token || null;
  } catch {
    return null;
  }
}

/** Guest token (no ORCID). A guest cannot pass the Admin role gate — offered
 *  so the gate can demonstrate the denial honestly rather than erroring. */
export async function guestLogin(): Promise<string | null> {
  try {
    const res = await fetch(new URL('/api/v1/auth-as-guest', CURRENT_ENV.ssoUri), {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) return null;
    const token = (await res.text()).trim();
    return token || null;
  } catch {
    return null;
  }
}

/** The ORCID sign-in URL; navigating here begins the login redirect. `state`
 *  is where SSO returns the browser after the round-trip. */
export function signInUrl(returnTo: string = window.location.href): string {
  const url = new URL('/auth/v1/stage1', CURRENT_ENV.ssoUri);
  url.searchParams.set('state', returnTo);
  return url.toString();
}

/** Switch to one of the user's other roles, then refresh for the new token. */
export async function setRole(roleId: string): Promise<string | null> {
  try {
    const url = new URL('/auth/v1/set-role', CURRENT_ENV.ssoUri);
    url.searchParams.set('role', roleId);
    const res = await fetch(url, { method: 'GET', credentials: 'include' });
    if (!res.ok) return null;
    return await refreshToken();
  } catch {
    return null;
  }
}

/** Clear the SSO session. Best-effort — the caller drops the token regardless. */
export async function logout(): Promise<void> {
  try {
    await fetch(new URL('/api/v1/logout', CURRENT_ENV.ssoUri), { method: 'POST', credentials: 'include' });
  } catch {
    // The local token is cleared either way; a failed logout only leaves the
    // SSO cookie behind, where it expires on its own.
  }
}

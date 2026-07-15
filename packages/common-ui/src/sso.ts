/*
 * SSO endpoint transport, shared by every app that signs in through SSO. These
 * are the raw HTTP calls against an app-provided `ssoUri`, with no UI concerns
 * (no toasts, atoms or navigation) — each app wraps them with its own token
 * storage and user feedback.
 *
 *   POST /api/v1/refresh-token   → fresh JWT (text body) from the session cookie
 *   POST /api/v1/auth-as-guest   → guest JWT
 *   GET  /auth/v1/stage1?state=  → ORCID login redirect
 *   GET  /auth/v1/set-role?role= → switch active role (then refresh)
 *   POST /api/v1/logout          → clear the session
 *
 * All are cookie-based, so every call sends credentials. `refreshToken` and
 * `guestLogin` resolve null on failure (a missing session is the normal
 * signed-out state, not an error); `setRole`/`logout` throw so callers can
 * surface the failure.
 */

/** Exchange the SSO session cookie for a fresh JWT. Returns the token, or null
 *  when there is no session (or SSO is unreachable). */
export async function refreshToken(ssoUri: string, signal?: AbortSignal): Promise<string | null> {
  try {
    const res = await fetch(new URL('/api/v1/refresh-token', ssoUri), {
      method: 'POST',
      credentials: 'include',
      signal: signal ?? null,
    });
    if (!res.ok) return null;
    const token = (await res.text()).trim();
    return token || null;
  } catch {
    return null;
  }
}

/** Guest token (no ORCID). Returns the token, or null on failure. */
export async function guestLogin(ssoUri: string): Promise<string | null> {
  try {
    const res = await fetch(new URL('/api/v1/auth-as-guest', ssoUri), {
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

/** The ORCID sign-in URL; navigating here begins the login redirect. `state` is
 *  where SSO returns the browser after the round-trip. */
export function signInUrl(ssoUri: string, state: string): string {
  const url = new URL('/auth/v1/stage1', ssoUri);
  url.searchParams.set('state', state);
  return url.toString();
}

/** Switch the session's active role. Throws when SSO rejects the switch or is
 *  unreachable. The switch takes effect on the session cookie; call
 *  `refreshToken` afterwards to obtain the JWT that reflects the new role. */
export async function setActiveRole(ssoUri: string, roleId: string): Promise<void> {
  const url = new URL('/auth/v1/set-role', ssoUri);
  url.searchParams.set('role', roleId);
  const res = await fetch(url, { method: 'GET', credentials: 'include' });
  if (!res.ok) throw new Error(`SSO rejected the role switch (${String(res.status)}).`);
}

/** Switch the active role and return the fresh token in one step, for callers
 *  that just want the resulting JWT. Throws when the switch fails or SSO returns
 *  no fresh token. */
export async function setRole(ssoUri: string, roleId: string): Promise<string> {
  await setActiveRole(ssoUri, roleId);
  const fresh = await refreshToken(ssoUri);
  if (!fresh) throw new Error('SSO accepted the role switch but returned no fresh token.');
  return fresh;
}

/** End the SSO session. Throws when SSO rejects the call or is unreachable. */
export async function logout(ssoUri: string): Promise<void> {
  const res = await fetch(new URL('/api/v1/logout', ssoUri), { method: 'POST', credentials: 'include' });
  if (!res.ok) throw new Error(`SSO logout failed (${String(res.status)}).`);
}

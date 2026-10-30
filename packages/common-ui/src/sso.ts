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
 * All are cookie-based, so every call sends credentials. `refreshSession`
 * never rejects. `refreshToken` and
 * `guestLogin` resolve null on failure (a missing session is the normal
 * signed-out state, not an error); `setRole`/`logout` throw so callers can
 * surface the failure.
 */

/** Outcome of a refresh: a fresh token, `rejected` (no session: 401, 403 or an empty body), or
 *  `unreachable` (SSO did not answer, so the app keeps its token). */
export type RefreshResult =
  { readonly kind: 'token'; readonly token: string } | { readonly kind: 'rejected' } | { readonly kind: 'unreachable' };

/** How long `refreshSession` waits for SSO before it reports `unreachable`. */
export const REFRESH_TIMEOUT_MS = 10_000;

const UNREACHABLE: RefreshResult = { kind: 'unreachable' };

async function exchange(ssoUri: string, signal: AbortSignal): Promise<RefreshResult> {
  try {
    const response = await fetch(new URL('/api/v1/refresh-token', ssoUri), {
      method: 'POST',
      credentials: 'include',
      signal,
    });
    if (response.status === 401 || response.status === 403) return { kind: 'rejected' };
    if (!response.ok) return UNREACHABLE;
    const token = (await response.text()).trim();
    return token === '' ? { kind: 'rejected' } : { kind: 'token', token };
  } catch {
    return UNREACHABLE;
  }
}

/** Exchange the SSO cookie for a fresh JWT. Never rejects. The request aborts when
 *  `signal` aborts, or after `timeoutMs`. */
export async function refreshSession(
  ssoUri: string,
  signal?: AbortSignal,
  timeoutMs = REFRESH_TIMEOUT_MS,
): Promise<RefreshResult> {
  const deadline = new AbortController();
  const followCaller = (): void => {
    deadline.abort(signal?.reason);
  };
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    // Linked by hand, since AbortSignal.any is newer than the browsers the builds target.
    if (signal?.aborted) followCaller();
    else signal?.addEventListener('abort', followCaller, { once: true });
    // A setTimeout, not AbortSignal.timeout, so fake timers can drive it.
    const timedOut = new Promise<RefreshResult>((resolve) => {
      timer = setTimeout(() => {
        deadline.abort(new DOMException('SSO did not answer the refresh in time.', 'TimeoutError'));
        resolve(UNREACHABLE);
      }, timeoutMs);
    });
    return await Promise.race([exchange(ssoUri, deadline.signal), timedOut]);
  } catch {
    return UNREACHABLE;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', followCaller);
  }
}

/** Exchange the SSO session cookie for a fresh JWT. Returns the token, or null
 *  when there is no session (or SSO is unreachable). */
export async function refreshToken(ssoUri: string, signal?: AbortSignal): Promise<string | null> {
  const result = await refreshSession(ssoUri, signal);
  return result.kind === 'token' ? result.token : null;
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

/** The status and body of a failed response, for error messages — SSO puts the
 *  human-readable reason in the body (e.g. "User does not own role."). */
async function failureDetail(res: Response): Promise<string> {
  const body = (await res.text().catch(() => '')).trim();
  return body ? `${String(res.status)}: ${body}` : String(res.status);
}

/** The ORCID sign-in URL; navigating here begins the login redirect. SSO returns
 *  to `returnTo` only when it is on `origin`, else to the app root. This stops
 *  sign-in from sending the user to another site. */
export function signInUrl(ssoUri: string, returnTo: string, origin: string = window.location.origin): string {
  const root = new URL('/', origin);
  const url = new URL('/auth/v1/stage1', ssoUri);
  url.searchParams.set('state', sameOriginOr(root, returnTo).toString());
  return url.toString();
}

/** `returnTo` resolved against `root`, or `root` when it leaves that origin or
 *  does not parse. Avoids `URL.parse`, which is newer than the target browsers. */
function sameOriginOr(root: URL, returnTo: string): URL {
  try {
    const target = new URL(returnTo, root);
    return target.origin === root.origin ? target : root;
  } catch {
    return root;
  }
}

/** Switch the session's active role. Throws when SSO rejects the switch or is
 *  unreachable, or once `signal` aborts. Call `refreshToken` afterwards for a JWT with the new role. */
export async function setActiveRole(ssoUri: string, roleId: string, signal?: AbortSignal): Promise<void> {
  const url = new URL('/auth/v1/set-role', ssoUri);
  url.searchParams.set('role', roleId);
  const res = await fetch(url, { method: 'GET', credentials: 'include', signal: signal ?? null });
  if (!res.ok) throw new Error(`SSO rejected the role switch (${await failureDetail(res)}).`);
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
  if (!res.ok) throw new Error(`SSO logout failed (${await failureDetail(res)}).`);
}

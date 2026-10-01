import * as sso from '@gemini-hlsw/lucuma-common-ui/sso';

import { CURRENT_ENV } from '@/app/environment';

export type RefreshResult =
  { readonly kind: 'token'; readonly token: string } | { readonly kind: 'rejected' } | { readonly kind: 'unreachable' };

export const REFRESH_TIMEOUT_MS = 10_000;

const UNREACHABLE: RefreshResult = { kind: 'unreachable' };

async function exchange(signal: AbortSignal): Promise<RefreshResult> {
  try {
    const response = await fetch(new URL('/api/v1/refresh-token', CURRENT_ENV.ssoUri), {
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

export async function refreshSession(signal?: AbortSignal, timeoutMs = REFRESH_TIMEOUT_MS): Promise<RefreshResult> {
  const deadline = new AbortController();
  const followCaller = (): void => {
    deadline.abort(signal?.reason);
  };
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    // Linked by hand, since AbortSignal.any is newer than the browsers the build targets.
    if (signal?.aborted) followCaller();
    else signal?.addEventListener('abort', followCaller, { once: true });
    // Unlike AbortSignal.timeout, a setTimeout runs on a clock fake timers can drive.
    const timedOut = new Promise<RefreshResult>((resolve) => {
      timer = setTimeout(() => {
        deadline.abort(new DOMException('SSO did not answer the refresh in time.', 'TimeoutError'));
        resolve(UNREACHABLE);
      }, timeoutMs);
    });
    return await Promise.race([exchange(deadline.signal), timedOut]);
  } catch {
    return UNREACHABLE;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', followCaller);
  }
}

export function signInUrl(returnTo: string = window.location.href): string {
  const target = new URL(returnTo, window.location.origin);
  const state = target.origin === window.location.origin ? target : new URL('/', window.location.origin);
  return sso.signInUrl(CURRENT_ENV.ssoUri, state.toString());
}

export const logout = (): Promise<void> => sso.logout(CURRENT_ENV.ssoUri);

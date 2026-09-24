import * as sso from '@gemini-hlsw/lucuma-common-ui/sso';

import { CURRENT_ENV } from '@/app/environment';

export type RefreshResult =
  { readonly kind: 'token'; readonly token: string } | { readonly kind: 'rejected' } | { readonly kind: 'unreachable' };

export async function refreshSession(signal?: AbortSignal): Promise<RefreshResult> {
  try {
    const response = await fetch(new URL('/api/v1/refresh-token', CURRENT_ENV.ssoUri), {
      method: 'POST',
      credentials: 'include',
      signal: signal ?? null,
    });
    if (response.status === 401 || response.status === 403) return { kind: 'rejected' };
    if (!response.ok) return { kind: 'unreachable' };
    const token = (await response.text()).trim();
    return token === '' ? { kind: 'rejected' } : { kind: 'token', token };
  } catch {
    return { kind: 'unreachable' };
  }
}

export function signInUrl(returnTo: string = window.location.href): string {
  const target = new URL(returnTo, window.location.origin);
  const state = target.origin === window.location.origin ? target : new URL('/', window.location.origin);
  return sso.signInUrl(CURRENT_ENV.ssoUri, state.toString());
}

export const logout = (): Promise<void> => sso.logout(CURRENT_ENV.ssoUri);

import { vi } from 'vitest';

import type { StandardRole, StandardUser, User } from '../auth.ts';

/*
 * A fetch stub that holds SSO requests open until the test answers them.
 * Import it from `@gemini-hlsw/lucuma-common-ui/testing/sso.ts`, not the barrel:
 * it replaces the global fetch.
 */

export interface PendingSsoCall {
  readonly url: string;
  readonly signal: AbortSignal | null;
  readonly answer: (response: { status?: number; body?: string }) => void;
  readonly fail: () => void;
}

let calls: PendingSsoCall[] = [];

export function stubSso(): void {
  calls = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(
      (input: URL | string, init?: RequestInit) =>
        new Promise((resolve, reject) => {
          calls.push({
            url: String(input),
            signal: init?.signal ?? null,
            answer: ({ status = 200, body = '' }) =>
              resolve({ ok: status >= 200 && status < 300, status, text: () => Promise.resolve(body) }),
            fail: () => {
              reject(new Error('network'));
            },
          });
        }),
    ),
  );
}

export const ssoCalls = (): readonly PendingSsoCall[] => calls;

export function ssoCall(index: number): PendingSsoCall {
  const pending = calls[index];
  if (!pending) throw new Error(`no SSO request #${index} was made`);
  return pending;
}

const callsTo = (path: string): readonly PendingSsoCall[] => calls.filter((made) => made.url.includes(path));

export const ssoRefreshes = (): readonly PendingSsoCall[] => callsTo('/api/v1/refresh-token');

export const ssoRoleSwitches = (): readonly PendingSsoCall[] => callsTo('/auth/v1/set-role');

/** Role id that the `index`th role switch asked for, or null if there is none. */
export const ssoRoleRequested = (index = 0): string | null =>
  new URL(ssoRoleSwitches()[index]?.url ?? 'about:blank').searchParams.get('role');

export function ssoLogout(): PendingSsoCall {
  const [pending] = callsTo('/api/v1/logout');
  if (!pending) throw new Error('no SSO logout request was made');
  return pending;
}

/** A standard user whose active role is `roleType`, holding `otherRoles` besides. */
export function ssoUser(roleType: StandardRole['type'], otherRoles: readonly StandardRole[] = []): StandardUser {
  return {
    type: 'standard',
    id: 'u-1',
    role: { type: roleType, id: `r-${roleType}` },
    otherRoles,
    profile: { orcidId: '0000-0001', profile: { givenName: 'Ada', familyName: 'Lovelace' } },
  };
}

/** An unsigned JWT for `user`, expiring `expiresInSeconds` from now. */
export function ssoJwt(user: User, expiresInSeconds = 3600): string {
  // Standard base64, not base64url: decodedTokenPayloadAtom decodes with plain atob.
  const encode = (value: unknown): string =>
    btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(value)))).replace(/=+$/, '');
  const header = encode({ alg: 'none', typ: 'JWT' });
  const payload = encode({ 'lucuma-user': user, exp: Date.now() / 1000 + expiresInSeconds });
  return `${header}.${payload}.signature`;
}

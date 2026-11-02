import { vi } from 'vitest';

import { pendingRefresh } from '@/auth/session';

export interface SsoAnswer {
  readonly status?: number;
  readonly body?: string;
}

export interface PendingSsoCall {
  readonly url: string;
  readonly signal: AbortSignal | null;
  readonly answer: (response: SsoAnswer) => void;
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

/** Resolves once the session has taken the answer in, not merely once fetch has. */
export async function answerRefresh(index: number, response: SsoAnswer): Promise<void> {
  const settled = pendingRefresh();
  ssoCall(index).answer(response);
  await settled;
}

const callsTo = (path: string): readonly PendingSsoCall[] => calls.filter((made) => made.url.includes(path));

export const ssoRefreshes = (): readonly PendingSsoCall[] => callsTo('/api/v1/refresh-token');

export function ssoLogout(): PendingSsoCall {
  const [pending] = callsTo('/api/v1/logout');
  if (!pending) throw new Error('no SSO logout request was made');
  return pending;
}

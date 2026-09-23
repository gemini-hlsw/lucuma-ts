import { afterEach, describe, expect, it, vi } from 'vitest';

import { CURRENT_ENV } from '@/app/environment';

import { refreshSession, signInUrl } from './ssoClient';

const answer = (response: { ok: boolean; status?: number; body?: string }) => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: response.ok,
    status: response.status ?? (response.ok ? 200 : 400),
    text: () => Promise.resolve(response.body ?? ''),
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe(refreshSession, () => {
  it('reads the trimmed token out of a successful exchange', async () => {
    answer({ ok: true, body: '  a.b.c\n' });

    expect(await refreshSession()).toEqual({ kind: 'token', token: 'a.b.c' });
  });

  it.each([401, 403])('reads %i as the ordinary signed-out answer', async (status) => {
    answer({ ok: false, status });

    expect(await refreshSession()).toEqual({ kind: 'rejected' });
  });

  it('reads an empty body as signed out, whatever the status says', async () => {
    answer({ ok: true, body: '   ' });

    expect(await refreshSession()).toEqual({ kind: 'rejected' });
  });

  it.each([500, 502, 404])('keeps the session when SSO answers %i', async (status) => {
    answer({ ok: false, status });

    expect(await refreshSession()).toEqual({ kind: 'unreachable' });
  });

  it('keeps the session when the request never lands', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('network'))),
    );

    expect(await refreshSession()).toEqual({ kind: 'unreachable' });
  });

  it('posts to the environment SSO with the session cookie', async () => {
    const fetchMock = answer({ ok: true, body: 'a.b.c' });
    const signal = new AbortController().signal;

    await refreshSession(signal);

    const [url, init] = fetchMock.mock.lastCall as [URL, RequestInit];
    expect(url.toString()).toBe(`${CURRENT_ENV.ssoUri}/api/v1/refresh-token`);
    expect(init).toMatchObject({ method: 'POST', credentials: 'include', signal });
  });
});

describe(signInUrl, () => {
  it('sends SSO back to where the reader was, as an absolute URL', () => {
    const url = new URL(signInUrl('/night?site=GN'));

    expect(url.origin).toBe(new URL(CURRENT_ENV.ssoUri).origin);
    expect(url.pathname).toBe('/auth/v1/stage1');
    expect(url.searchParams.get('state')).toBe(`${window.location.origin}/night?site=GN`);
  });

  it('falls back to the app root rather than returning to another origin', () => {
    const url = new URL(signInUrl('https://phish.example/steal'));

    expect(url.searchParams.get('state')).toBe(`${window.location.origin}/`);
  });
});

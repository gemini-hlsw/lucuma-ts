import { afterEach, describe, expect, it, vi } from 'vitest';

import { CURRENT_ENV } from '@/app/environment';

import { SESSION_TIMINGS } from './session';
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

const hang = () => {
  const fetchMock = vi.fn((_url: URL, init: RequestInit) => {
    const signal = init.signal;
    return new Promise<never>((_resolve, reject) => {
      signal?.addEventListener('abort', () => {
        reject(signal.reason as Error);
      });
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

const answerAfter = (ms: number, text: () => Promise<string>) => {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve({ ok: true, status: 200, text }), ms);
        }),
    ),
  );
};

const sentSignal = (fetchMock: ReturnType<typeof vi.fn>): AbortSignal | null | undefined =>
  (fetchMock.mock.lastCall as [URL, RequestInit] | undefined)?.[1].signal;

const settling = (pending: Promise<unknown>) => {
  const state = { settled: false };
  void pending.then(() => {
    state.settled = true;
  });
  return state;
};

afterEach(() => {
  vi.useRealTimers();
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

    await refreshSession(new AbortController().signal);

    const [url, init] = fetchMock.mock.lastCall as [URL, RequestInit];
    expect(url.toString()).toBe(`${CURRENT_ENV.ssoUri}/api/v1/refresh-token`);
    expect(init).toMatchObject({ method: 'POST', credentials: 'include' });
    expect(init.signal?.aborted).toBe(false);
  });

  it('gives up as unreachable when SSO has not answered in time, leaving the caller signal untouched', async () => {
    const fetchMock = hang();
    const caller = new AbortController();

    expect(await refreshSession(caller.signal, 10)).toEqual({ kind: 'unreachable' });
    expect((sentSignal(fetchMock)?.reason as DOMException).name).toBe('TimeoutError');
    expect(caller.signal.aborted).toBe(false);
  });

  it('gives SSO the full 10 s by default', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const fetchMock = hang();

    const state = settling(refreshSession(new AbortController().signal));
    await vi.advanceTimersByTimeAsync(9_999);

    expect(state.settled).toBe(false);
    expect(sentSignal(fetchMock)?.aborted).toBe(false);
    expect(SESSION_TIMINGS.refreshTimeoutMs).toBe(10_000);
  });

  it('counts the bound from the request, not from the headers, and gives up though the body ignores the abort', async () => {
    answerAfter(50, () => new Promise<never>(() => undefined));
    const countedFromHeaders = new Promise((resolve) => {
      setTimeout(() => resolve('counted from the headers'), 75);
    });

    expect(await Promise.race([refreshSession(undefined, 50), countedFromHeaders])).toEqual({ kind: 'unreachable' });
  });

  it('takes a token that arrives inside the bound', async () => {
    answerAfter(20, () => Promise.resolve('a.b.c'));

    expect(await refreshSession(undefined, 40)).toEqual({ kind: 'token', token: 'a.b.c' });
  });

  it('never rejects where the browser has no AbortSignal.any', async () => {
    const any = Object.getOwnPropertyDescriptor(AbortSignal, 'any');
    Reflect.deleteProperty(AbortSignal, 'any');
    try {
      const fetchMock = hang();
      const caller = new AbortController();

      expect(await refreshSession(new AbortController().signal, 10)).toEqual({ kind: 'unreachable' });

      const aborted = refreshSession(caller.signal);
      caller.abort();
      expect(await aborted).toEqual({ kind: 'unreachable' });
      expect(sentSignal(fetchMock)?.reason).toBe(caller.signal.reason);
    } finally {
      if (any !== undefined) Object.defineProperty(AbortSignal, 'any', any);
    }
  });

  it('hands the caller abort to the request at once, with its reason rather than a timeout', async () => {
    const fetchMock = hang();
    const caller = new AbortController();

    const result = refreshSession(caller.signal);
    caller.abort();

    expect(await result).toEqual({ kind: 'unreachable' });
    expect(sentSignal(fetchMock)?.aborted).toBe(true);
    expect(sentSignal(fetchMock)?.reason).toBe(caller.signal.reason);
    expect((sentSignal(fetchMock)?.reason as DOMException).name).toBe('AbortError');
  });

  it('sends the request already aborted, with the caller reason, when the caller aborted before calling', async () => {
    const seen = { aborted: false, reason: undefined as unknown };
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: URL, init: RequestInit) => {
        seen.aborted = init.signal?.aborted ?? false;
        seen.reason = init.signal?.reason;
        return seen.aborted
          ? Promise.reject(init.signal?.reason as Error)
          : Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve('a.b.c') });
      }),
    );
    const caller = new AbortController();
    const reason = new DOMException('left the page', 'AbortError');
    caller.abort(reason);

    expect(await refreshSession(caller.signal)).toEqual({ kind: 'unreachable' });
    expect(seen.aborted).toBe(true);
    expect(seen.reason).toBe(reason);
  });

  it('leaves a settled request alone when the caller aborts afterwards', async () => {
    const fetchMock = answer({ ok: true, body: 'a.b.c' });
    const caller = new AbortController();

    expect(await refreshSession(caller.signal)).toEqual({ kind: 'token', token: 'a.b.c' });
    caller.abort();

    expect(sentSignal(fetchMock)?.aborted).toBe(false);
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

import { afterEach, vi } from 'vitest';

import {
  guestLogin,
  logout,
  REFRESH_TIMEOUT_MS,
  refreshSession,
  refreshToken,
  setActiveRole,
  setRole,
  signInUrl,
} from './sso.ts';

const SSO = 'https://sso.example.test';

function mockFetch(...responses: { ok: boolean; body?: string; status?: number }[]) {
  const fn = vi.fn();
  for (const r of responses) {
    fn.mockResolvedValueOnce({
      ok: r.ok,
      status: r.status ?? (r.ok ? 200 : 400),
      text: () => Promise.resolve(r.body ?? ''),
    });
  }
  vi.stubGlobal('fetch', fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe(refreshToken, () => {
  it('returns the trimmed token on success', async () => {
    mockFetch({ ok: true, body: '  a.b.c\n' });
    expect(await refreshToken(SSO)).toBe('a.b.c');
  });

  it('returns null on a non-ok response', async () => {
    mockFetch({ ok: false });
    expect(await refreshToken(SSO)).toBeNull();
  });

  it('returns null when SSO is unreachable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('network'))),
    );
    expect(await refreshToken(SSO)).toBeNull();
  });
});

describe(guestLogin, () => {
  it('returns the token on success, null otherwise', async () => {
    mockFetch({ ok: true, body: 'guest.jwt' });
    expect(await guestLogin(SSO)).toBe('guest.jwt');
    mockFetch({ ok: false });
    expect(await guestLogin(SSO)).toBeNull();
  });
});

describe(signInUrl, () => {
  const APP = 'https://app.example.test';
  const stateOf = (returnTo: string, origin = APP) =>
    new URL(signInUrl(SSO, returnTo, origin)).searchParams.get('state');

  it('sends SSO back to a same-origin page, as an absolute URL', () => {
    const url = new URL(signInUrl(SSO, '/night?site=GN', APP));

    expect(url.origin).toBe(SSO);
    expect(url.pathname).toBe('/auth/v1/stage1');
    expect(url.searchParams.get('state')).toBe(`${APP}/night?site=GN`);
  });

  it('keeps an absolute return URL on the same origin', () => {
    expect(stateOf(`${APP}/programs#p1`)).toBe(`${APP}/programs#p1`);
  });

  it.each(['https://phish.example/steal', '//phish.example/steal', 'http://app.example.test/page'])(
    'falls back to the app root rather than returning to %s',
    (returnTo) => {
      expect(stateOf(returnTo)).toBe(`${APP}/`);
    },
  );

  it('falls back to the app root when the return URL does not parse', () => {
    expect(stateOf('http://[bad')).toBe(`${APP}/`);
  });

  it('guards against the current page origin by default', () => {
    const url = new URL(signInUrl(SSO, '//phish.example/steal'));

    expect(url.searchParams.get('state')).toBe(`${window.location.origin}/`);
  });

  it('compares origins, not the path the origin argument may carry', () => {
    expect(stateOf('/login', `${APP}/`)).toBe(`${APP}/login`);
  });
});

describe(setActiveRole, () => {
  it('resolves when SSO accepts the switch', async () => {
    mockFetch({ ok: true });
    await expect(setActiveRole(SSO, 'r-1')).resolves.toBeUndefined();
  });

  it('throws with the status and response body when SSO rejects the switch', async () => {
    mockFetch({ ok: false, status: 403, body: 'User does not own role.' });
    await expect(setActiveRole(SSO, 'r-1')).rejects.toThrow(
      'SSO rejected the role switch (403: User does not own role.).',
    );
  });

  it('throws with just the status when the response body is empty', async () => {
    mockFetch({ ok: false, status: 403 });
    await expect(setActiveRole(SSO, 'r-1')).rejects.toThrow('SSO rejected the role switch (403).');
  });
});

describe(setRole, () => {
  it('returns the refreshed token after a successful switch', async () => {
    // First call: set-role (ok); second call: refresh-token (ok, returns token).
    mockFetch({ ok: true }, { ok: true, body: 'fresh.jwt' });
    expect(await setRole(SSO, 'r-1')).toBe('fresh.jwt');
  });

  it('throws when the switch succeeds but no fresh token comes back', async () => {
    mockFetch({ ok: true }, { ok: false });
    await expect(setRole(SSO, 'r-1')).rejects.toThrow(/no fresh token/);
  });
});

describe(logout, () => {
  it('resolves on success and throws on failure', async () => {
    mockFetch({ ok: true });
    await expect(logout(SSO)).resolves.toBeUndefined();
    mockFetch({ ok: false, status: 500, body: 'session store unavailable' });
    await expect(logout(SSO)).rejects.toThrow('SSO logout failed (500: session store unavailable).');
  });
});

/** A fetch that never answers. It rejects once its signal aborts. */
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

describe(refreshSession, () => {
  it('reads the trimmed token out of a successful exchange', async () => {
    mockFetch({ ok: true, body: '  a.b.c\n' });

    expect(await refreshSession(SSO)).toEqual({ kind: 'token', token: 'a.b.c' });
  });

  it.each([401, 403])('reads %i as the ordinary signed-out answer', async (status) => {
    mockFetch({ ok: false, status });

    expect(await refreshSession(SSO)).toEqual({ kind: 'rejected' });
  });

  it('reads an empty body as signed out, whatever the status says', async () => {
    mockFetch({ ok: true, body: '   ' });

    expect(await refreshSession(SSO)).toEqual({ kind: 'rejected' });
  });

  it.each([500, 502, 404])('keeps the session when SSO answers %i', async (status) => {
    mockFetch({ ok: false, status });

    expect(await refreshSession(SSO)).toEqual({ kind: 'unreachable' });
  });

  it('keeps the session when the request never lands', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('network'))),
    );

    expect(await refreshSession(SSO)).toEqual({ kind: 'unreachable' });
  });

  it('posts to the given SSO with the session cookie', async () => {
    const fetchMock = mockFetch({ ok: true, body: 'a.b.c' });

    await refreshSession(SSO, new AbortController().signal);

    const [url, init] = fetchMock.mock.lastCall as [URL, RequestInit];
    expect(url.toString()).toBe(`${SSO}/api/v1/refresh-token`);
    expect(init).toMatchObject({ method: 'POST', credentials: 'include' });
    expect(init.signal?.aborted).toBe(false);
  });

  it('gives up as unreachable when SSO has not answered in time, leaving the caller signal untouched', async () => {
    const fetchMock = hang();
    const caller = new AbortController();

    expect(await refreshSession(SSO, caller.signal, 10)).toEqual({ kind: 'unreachable' });
    expect((sentSignal(fetchMock)?.reason as DOMException).name).toBe('TimeoutError');
    expect(caller.signal.aborted).toBe(false);
  });

  it('gives SSO the full 10 s by default', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const fetchMock = hang();

    const state = settling(refreshSession(SSO, new AbortController().signal));
    await vi.advanceTimersByTimeAsync(9_999);

    expect(state.settled).toBe(false);
    expect(sentSignal(fetchMock)?.aborted).toBe(false);
    expect(REFRESH_TIMEOUT_MS).toBe(10_000);
  });

  it('counts the bound from the request, not from the headers, and gives up though the body ignores the abort', async () => {
    answerAfter(50, () => new Promise<never>(() => undefined));
    const countedFromHeaders = new Promise((resolve) => {
      setTimeout(() => resolve('counted from the headers'), 75);
    });

    expect(await Promise.race([refreshSession(SSO, undefined, 50), countedFromHeaders])).toEqual({
      kind: 'unreachable',
    });
  });

  it('takes a token that arrives inside the bound', async () => {
    answerAfter(20, () => Promise.resolve('a.b.c'));

    expect(await refreshSession(SSO, undefined, 40)).toEqual({ kind: 'token', token: 'a.b.c' });
  });

  it('never rejects where the browser has no AbortSignal.any', async () => {
    const any = Object.getOwnPropertyDescriptor(AbortSignal, 'any');
    Reflect.deleteProperty(AbortSignal, 'any');
    try {
      const fetchMock = hang();
      const caller = new AbortController();

      expect(await refreshSession(SSO, new AbortController().signal, 10)).toEqual({ kind: 'unreachable' });

      const aborted = refreshSession(SSO, caller.signal);
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

    const result = refreshSession(SSO, caller.signal);
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

    expect(await refreshSession(SSO, caller.signal)).toEqual({ kind: 'unreachable' });
    expect(seen.aborted).toBe(true);
    expect(seen.reason).toBe(reason);
  });

  it('leaves a settled request alone when the caller aborts afterwards', async () => {
    const fetchMock = mockFetch({ ok: true, body: 'a.b.c' });
    const caller = new AbortController();

    expect(await refreshSession(SSO, caller.signal)).toEqual({ kind: 'token', token: 'a.b.c' });
    caller.abort();

    expect(sentSignal(fetchMock)?.aborted).toBe(false);
  });
});

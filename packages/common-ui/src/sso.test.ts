import { afterEach, vi } from 'vitest';

import { guestLogin, logout, refreshToken, setActiveRole, setRole, signInUrl } from './sso.ts';

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

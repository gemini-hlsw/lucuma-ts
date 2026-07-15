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

describe(refreshToken.name, () => {
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

describe(guestLogin.name, () => {
  it('returns the token on success, null otherwise', async () => {
    mockFetch({ ok: true, body: 'guest.jwt' });
    expect(await guestLogin(SSO)).toBe('guest.jwt');
    mockFetch({ ok: false });
    expect(await guestLogin(SSO)).toBeNull();
  });
});

describe(signInUrl.name, () => {
  it('builds the stage1 URL with the state parameter', () => {
    const url = new URL(signInUrl(SSO, 'https://app.example.test/page'));
    expect(url.pathname).toBe('/auth/v1/stage1');
    expect(url.searchParams.get('state')).toBe('https://app.example.test/page');
  });
});

describe(setActiveRole.name, () => {
  it('resolves when SSO accepts the switch', async () => {
    mockFetch({ ok: true });
    await expect(setActiveRole(SSO, 'r-1')).resolves.toBeUndefined();
  });

  it('throws when SSO rejects the switch', async () => {
    mockFetch({ ok: false, status: 403 });
    await expect(setActiveRole(SSO, 'r-1')).rejects.toThrow(/rejected the role switch/);
  });
});

describe(setRole.name, () => {
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

describe(logout.name, () => {
  it('resolves on success and throws on failure', async () => {
    mockFetch({ ok: true });
    await expect(logout(SSO)).resolves.toBeUndefined();
    mockFetch({ ok: false, status: 500 });
    await expect(logout(SSO)).rejects.toThrow(/logout failed/);
  });
});

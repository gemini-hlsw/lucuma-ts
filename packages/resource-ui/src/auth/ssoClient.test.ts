import { afterEach, describe, expect, it, vi } from 'vitest';

import { refreshToken, signInUrl } from './ssoClient';

// Browser tests run on localhost, which resolves to the development environment.
const EXPECTED_SSO_ORIGIN = 'https://sso-dev.gpp.lucuma.xyz';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe(refreshToken, () => {
  it("sends the refresh to the current environment with the caller's abort signal", async () => {
    const fetchMock = vi.fn<typeof fetch>(() => Promise.resolve(new Response('a.b.c')));
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();

    await expect(refreshToken(controller.signal)).resolves.toBe('a.b.c');

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBeInstanceOf(URL);
    expect((url as URL).href).toBe(`${EXPECTED_SSO_ORIGIN}/api/v1/refresh-token`);
    expect(init?.signal).toBe(controller.signal);
    expect(init?.credentials).toBe('include');
  });
});

describe(signInUrl, () => {
  it('targets the current environment and returns the browser to the current page', () => {
    const url = new URL(signInUrl());
    expect(url.origin).toBe(EXPECTED_SSO_ORIGIN);
    expect(url.pathname).toBe('/auth/v1/stage1');
    expect(url.searchParams.get('state')).toBe(window.location.href);
  });
});

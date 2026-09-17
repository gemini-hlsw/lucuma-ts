import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchDeployedVersion, isNewerBuild, parseDeployedVersion } from './version';

describe(parseDeployedVersion, () => {
  it('reads the version from a well-formed payload', () => {
    expect(parseDeployedVersion({ version: '20260916-ad0c26f' })).toBe('20260916-ad0c26f');
  });

  it('ignores extra fields', () => {
    expect(parseDeployedVersion({ version: '20260916-ad0c26f', builtAt: 'today' })).toBe('20260916-ad0c26f');
  });

  it.each([
    ['a missing version field', { notVersion: 'x' }],
    ['a non-string version', { version: 42 }],
    ['a null version', { version: null }],
    ['an empty version', { version: '' }],
    ['a non-object payload', 'v1'],
    ['null', null],
  ])('returns undefined for %s', (_case, payload) => {
    expect(parseDeployedVersion(payload)).toBeUndefined();
  });
});

describe(fetchDeployedVersion, () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reads the deployed version, bypassing the HTTP cache', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ version: '20260916-ad0c26f' })));
    vi.stubGlobal('fetch', fetchMock);

    expect(await fetchDeployedVersion()).toBe('20260916-ad0c26f');
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ cache: 'no-store' });
  });

  it('stays quiet when the host answers with the index page instead of the file', async () => {
    // Firebase rewrites unmatched paths to index.html, so a version.json that
    // isn't deployed comes back as 200 HTML rather than 404 (sc-10422).
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(new Response('<!doctype html><html></html>', { headers: { 'content-type': 'text/html' } })),
    );

    expect(await fetchDeployedVersion()).toBeUndefined();
  });

  it('stays quiet on an error status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 500 })));

    expect(await fetchDeployedVersion()).toBeUndefined();
  });

  it('stays quiet when the request fails outright', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));

    expect(await fetchDeployedVersion()).toBeUndefined();
  });
});

describe(isNewerBuild, () => {
  it('reports a different deployed build', () => {
    expect(isNewerBuild('20260916-ad0c26f', '20260917-1f781f2')).toBe(true);
  });

  it('stays quiet while the deployed build is the running one', () => {
    expect(isNewerBuild('20260916-ad0c26f', '20260916-ad0c26f')).toBe(false);
  });

  it('stays quiet when the deployed build could not be read', () => {
    expect(isNewerBuild('20260916-ad0c26f', undefined)).toBe(false);
  });
});

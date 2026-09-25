import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchDeployedVersion, isNewerVersion, parseDeployedVersion } from './version.ts';

describe(parseDeployedVersion, () => {
  it('reads the version from a well-formed payload', () => {
    expect(parseDeployedVersion({ version: '20260916-ad0c26f' })).toBe('20260916-ad0c26f');
  });

  it('ignores extra fields', () => {
    expect(parseDeployedVersion({ version: '20260916-ad0c26f', builtAt: 'today' })).toBe('20260916-ad0c26f');
  });

  it('reads the formats every app builds, not just one', () => {
    // admin stamps `YYYYMMDD-commit` (Explore's scheme); navigate and resource
    // stamp `<ref>+YYYYMMDD.commit`. The payload is opaque to this module.
    expect(parseDeployedVersion({ version: 'v0.1.0+20260625.eb4d348' })).toBe('v0.1.0+20260625.eb4d348');
  });

  it.each([
    ['a missing version field', { notVersion: 'x' }],
    ['a non-string version', { version: 42 }],
    ['a null version', { version: null }],
    ['an empty version', { version: '' }],
    ['a non-object payload', 'v1'],
    ['null', null],
    ['undefined', undefined],
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
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('version.json'),
      expect.objectContaining({ cache: 'no-store' }),
    );
  });

  it('passes the abort signal through, so an unmount cancels the read', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ version: '20260916-ad0c26f' })));
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();

    await fetchDeployedVersion(controller.signal);

    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ signal: controller.signal });
  });

  it('stays quiet when the host answers with the index page instead of the file', async () => {
    // Firebase rewrites unmatched paths to index.html, so a version.json that
    // isn't deployed comes back as 200 HTML rather than 404 (sc-10422). Both
    // admin-ui and resource-ui are hosted this way.
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(new Response('<!doctype html><html></html>', { headers: { 'content-type': 'text/html' } })),
    );

    expect(await fetchDeployedVersion()).toBeUndefined();
  });

  it('stays quiet on an error status', async () => {
    // The body is deliberately a well-formed payload: an error page that failed
    // to parse would be rejected by the catch below whether or not the status is
    // checked at all, leaving the status check itself unproven.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ version: '20260917-1f781f2' }), { status: 500 })),
    );

    expect(await fetchDeployedVersion()).toBeUndefined();
  });

  it('stays quiet when the request fails outright', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));

    expect(await fetchDeployedVersion()).toBeUndefined();
  });
});

describe(isNewerVersion, () => {
  it('reports a build other than the baseline', () => {
    expect(isNewerVersion('20260916-ad0c26f', '20260917-1f781f2')).toBe(true);
  });

  it('stays quiet while the deployed build is the baseline', () => {
    expect(isNewerVersion('20260916-ad0c26f', '20260916-ad0c26f')).toBe(false);
  });

  it.each([
    ['the deployed version could not be read', '20260916-ad0c26f', undefined],
    ['the deployed version is absent', '20260916-ad0c26f', null],
    // A caller comparing against the previous poll has no baseline on the first
    // one; that is not an upgrade to announce.
    ['there is no baseline yet', undefined, '20260917-1f781f2'],
    ['neither side is known', undefined, undefined],
  ])('stays quiet when %s', (_case, baseline, deployed) => {
    expect(isNewerVersion(baseline, deployed)).toBe(false);
  });
});

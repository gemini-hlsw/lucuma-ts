import { fetchDeployedUiVersion, parseUiVersion } from './version';

describe(parseUiVersion.name, () => {
  it('returns the version from a well-formed payload', () => {
    expect(parseUiVersion({ version: 'v0.1.0+20260625.eb4d348' })).toBe('v0.1.0+20260625.eb4d348');
  });

  it('ignores extra fields', () => {
    expect(parseUiVersion({ version: 'v0.1.0', commit: 'eb4d348' })).toBe('v0.1.0');
  });

  it('returns undefined when the version field is missing', () => {
    expect(parseUiVersion({ notVersion: 'v0.1.0' })).toBeUndefined();
  });

  it('returns undefined when the version field is not a string', () => {
    expect(parseUiVersion({ version: 42 })).toBeUndefined();
    expect(parseUiVersion({ version: null })).toBeUndefined();
  });

  it('returns undefined when the version field is an empty string', () => {
    expect(parseUiVersion({ version: '' })).toBeUndefined();
  });

  it('returns undefined for non-object payloads', () => {
    expect(parseUiVersion(null)).toBeUndefined();
    expect(parseUiVersion(undefined)).toBeUndefined();
    expect(parseUiVersion('v0.1.0')).toBeUndefined();
    expect(parseUiVersion(42)).toBeUndefined();
  });
});

describe(fetchDeployedUiVersion.name, () => {
  it('requests version.json without using the HTTP cache', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ version: 'v0.2.0' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const version = await fetchDeployedUiVersion();

    expect(version).toBe('v0.2.0');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('version.json'),
      expect.objectContaining({ cache: 'no-store' }),
    );
  });

  it('returns undefined when the response is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Not found', { status: 404 })));

    expect(await fetchDeployedUiVersion()).toBeUndefined();
  });

  it('returns undefined when the response body is malformed', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ nope: true }), { status: 200 })));

    expect(await fetchDeployedUiVersion()).toBeUndefined();
  });

  it('returns undefined when fetch rejects', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    expect(await fetchDeployedUiVersion()).toBeUndefined();
  });
});

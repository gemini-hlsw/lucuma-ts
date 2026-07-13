import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  aggregateDuplicates,
  type ArchiveFile,
  archiveQueryUrl,
  archiveSearchSpec,
  findDuplicates,
  separationArcsec,
} from './geminiArchive';

describe('archiveSearchSpec', () => {
  it('searches both GMOS sites with a single GMOS query', () => {
    const spec = archiveSearchSpec('GMOS_SOUTH_LONG_SLIT');
    expect(spec?.instruments).toEqual(['GMOS']);
    expect(spec?.mode).toBe('LS');
    expect(spec?.radiusArcsec).toBe(165); // half the 5.5′ GMOS field
  });

  it('pairs similar instruments with one query each (GNIRS ~ Flamingos-2)', () => {
    expect(archiveSearchSpec('GNIRS_LONG_SLIT')?.instruments).toEqual(['GNIRS', 'F2']);
    expect(archiveSearchSpec('FLAMINGOS_2_IMAGING')?.instruments).toEqual(['F2', 'GNIRS']);
    expect(archiveSearchSpec('ALOPEKE_SPECKLE')?.instruments).toEqual(['Alopeke', 'Zorro']);
    expect(archiveSearchSpec('GHOST_IFU')?.instruments).toEqual(['GHOST', 'MAROON-X']);
  });

  it('floors the search radius at 60″ for small-aperture configurations', () => {
    expect(archiveSearchSpec('GHOST_IFU')?.radiusArcsec).toBe(60);
    expect(archiveSearchSpec('ALOPEKE_SPECKLE')?.radiusArcsec).toBe(60);
  });

  it('returns null for unsearchable modes', () => {
    expect(archiveSearchSpec('VISITOR_NORTH')).toBeNull();
    expect(archiveSearchSpec(null)).toBeNull();
  });
});

describe('archiveQueryUrl', () => {
  it('builds the proxied jsonsummary cone-search URL', () => {
    expect(archiveQueryUrl('GMOS', 'IMAGING', 327.79593, 28.86399, 165)).toBe(
      '/archive/jsonsummary/CANONICAL/SCIENCE/RAW/OBJECT/notengineering/NotFail/GMOS/IMAGING/ra=327.79593/dec=28.86399/SR=165',
    );
  });
});

describe('separationArcsec', () => {
  it('is zero for identical coordinates', () => {
    expect(separationArcsec(30, -30, 30, -30)).toBe(0);
  });

  it('scales RA offsets by cos(dec)', () => {
    // 1″ of RA at dec=60° is 0.5″ on the sky.
    expect(separationArcsec(30, 60, 30 + 1 / 3600, 60)).toBeCloseTo(0.5, 3);
  });

  it('measures pure declination offsets exactly', () => {
    expect(separationArcsec(30, -30, 30, -30 + 10 / 3600)).toBeCloseTo(10, 6);
  });
});

function file(overrides: Partial<ArchiveFile>): ArchiveFile {
  return {
    observation_id: 'GS-2025B-Q-1-1',
    instrument: 'GMOS-S',
    object: 'NGC 1025',
    ra: 30.0,
    dec: -30.0,
    filter_name: 'open',
    exposure_time: 60,
    disperser: 'B480',
    central_wavelength: 0.52,
    focal_plane_mask: '1.0arcsec',
    qa_state: 'Pass',
    ...overrides,
  };
}

describe('aggregateDuplicates', () => {
  it('produces one row per observation_id with file and QA-Pass counts', () => {
    const rows = aggregateDuplicates('x-125', 30.0, -30.001, [
      file({}),
      file({ qa_state: 'Usable' }),
      file({ qa_state: 'Pass' }),
      file({ observation_id: 'GS-2025B-Q-2-1', qa_state: null }),
    ]);
    expect(rows).toHaveLength(2);
    const [first, second] = rows;
    expect(first?.observationId).toBe('GS-2025B-Q-1-1');
    expect(first?.fileCount).toBe(3);
    expect(first?.passCount).toBe(2);
    // Keys are source-scoped: the same archive observation matched by another
    // source must not collide with this one in the table.
    expect(first?.key).toBe('x-125:GS-2025B-Q-1-1');
    expect(first?.sepArcsec).toBeCloseTo(3.6, 1); // 0.001° of dec
    expect(second?.passCount).toBe(0);
  });

  it('skips files without an observation id and tolerates missing coordinates', () => {
    const rows = aggregateDuplicates('x-1', 30, -30, [file({ observation_id: null }), file({ ra: null, dec: null })]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.sepArcsec).toBeNull();
  });
});

describe('findDuplicates', () => {
  const gmosSource = { id: 'x-1', raDeg: 30, decDeg: -30, modeType: 'GMOS_SOUTH_LONG_SLIT' };
  const file = { observation_id: 'GS-2025B-Q-1-1', instrument: 'GMOS-S', object: 'T', ra: 30, dec: -30 };
  const okResponse = () => new Response(JSON.stringify([file]), { status: 200 });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('queries the archive once per instrument and aggregates rows', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse());
    const rows = await findDuplicates([gmosSource], new AbortController().signal);
    // GMOS covers both sites in a single query.
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.observationId).toBe('GS-2025B-Q-1-1');
  });

  it('serves a repeated query from the response cache', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse());
    await findDuplicates([gmosSource], new AbortController().signal);
    const calls = fetchSpy.mock.calls.length;
    await findDuplicates([gmosSource], new AbortController().signal);
    expect(fetchSpy).toHaveBeenCalledTimes(calls);
  });

  it('skips sources without coordinates or a searchable mode', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse());
    const rows = await findDuplicates(
      [
        { ...gmosSource, raDeg: null },
        { ...gmosSource, id: 'x-2', modeType: 'VISITOR_NORTH' },
      ],
      new AbortController().signal,
    );
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(rows).toEqual([]);
  });

  it('rejects on an archive error status', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('nope', { status: 503 }));
    // A distinct URL (different coordinates) so the cache can't answer.
    await expect(findDuplicates([{ ...gmosSource, raDeg: 99 }], new AbortController().signal)).rejects.toThrow(
      /HTTP 503/,
    );
  });
});

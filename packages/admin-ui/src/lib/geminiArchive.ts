/*
 * Observation Duplication Check (sc-9244): query the Gemini Observatory
 * Archive for existing data that would duplicate a requested observation, to
 * preserve proprietary periods and avoid wasting telescope time.
 *
 * The archive's jsonsummary REST API (https://archive.gemini.edu/help/api.html)
 * is searched per requested configuration by similar instrument + high-level
 * mode + cone around the target. The browser reaches it through the dev
 * server's /archive proxy (the archive sends no CORS headers).
 */
import type { ObservingModeType } from '@/gql/odb/gen/graphql';

/** The high-level archive "Mode" search facet — exact slits/gratings are
 *  deliberately ignored per sc-9244. */
export type ArchiveMode = 'IMAGING' | 'LS' | 'MOS' | 'IFS';

/** What to ask the archive for one requested configuration. */
export interface ArchiveSearchSpec {
  /** Archive instrument path segments. "GMOS" covers both GMOS-N and GMOS-S
   *  in one query; other similar pairs (GNIRS ~ Flamingos-2, Alopeke ~ Zorro,
   *  GHOST ~ MAROON-X) need one query each. */
  readonly instruments: readonly string[];
  readonly mode: ArchiveMode;
  /** Cone search radius: half the largest field-of-view dimension of the
   *  requested configuration, floored at 60″ (the radius in sc-9244's example
   *  query) so tiny-aperture instruments still tolerate pointing differences. */
  readonly radiusArcsec: number;
}

const MIN_RADIUS_ARCSEC = 60;

function spec(instruments: readonly string[], mode: ArchiveMode, largestFovArcsec: number): ArchiveSearchSpec {
  return { instruments, mode, radiusArcsec: Math.max(largestFovArcsec / 2, MIN_RADIUS_ARCSEC) };
}

/** ODB ObservingModeType → archive search, encoding sc-9244's similar-
 *  instrument pairs and each configuration's largest field-of-view dimension
 *  (GMOS 5.5′ field, F2 6.1′ circle, GNIRS 99″ slit, Alopeke/Zorro 60″
 *  wide-field, fibre-fed GHOST/MAROON-X well under the 60″ floor).
 *  VISITOR_* modes have no archive instrument name and can't be searched. */
const SEARCH_SPEC: Partial<Record<ObservingModeType, ArchiveSearchSpec>> = {
  GMOS_NORTH_IMAGING: spec(['GMOS'], 'IMAGING', 330),
  GMOS_SOUTH_IMAGING: spec(['GMOS'], 'IMAGING', 330),
  GMOS_NORTH_LONG_SLIT: spec(['GMOS'], 'LS', 330),
  GMOS_SOUTH_LONG_SLIT: spec(['GMOS'], 'LS', 330),
  FLAMINGOS_2_IMAGING: spec(['F2', 'GNIRS'], 'IMAGING', 366),
  FLAMINGOS_2_LONG_SLIT: spec(['F2', 'GNIRS'], 'LS', 366),
  GNIRS_LONG_SLIT: spec(['GNIRS', 'F2'], 'LS', 99),
  IGRINS_2_LONG_SLIT: spec(['IGRINS-2'], 'LS', 60),
  ALOPEKE_SPECKLE: spec(['Alopeke', 'Zorro'], 'IMAGING', 7),
  ALOPEKE_WIDE_FIELD: spec(['Alopeke', 'Zorro'], 'IMAGING', 60),
  ZORRO_SPECKLE: spec(['Zorro', 'Alopeke'], 'IMAGING', 7),
  ZORRO_WIDE_FIELD: spec(['Zorro', 'Alopeke'], 'IMAGING', 60),
  GHOST_IFU: spec(['GHOST', 'MAROON-X'], 'IFS', 2),
  MAROON_X: spec(['MAROON-X', 'GHOST'], 'IFS', 1),
};

/** The wire types carry `string` for observing modes; only keys of
 *  SEARCH_SPEC (a subset of ObservingModeType) are searchable. */
export function archiveSearchSpec(modeType: string | null): ArchiveSearchSpec | null {
  if (modeType === null || !Object.hasOwn(SEARCH_SPEC, modeType)) return null;
  return SEARCH_SPEC[modeType as ObservingModeType] ?? null;
}

/** The shared DISTANCE rule of sc-9243/sc-9244: half the configuration's
 *  largest field-of-view dimension, floored at 60″. Also used by the ODB
 *  conflict check (conflicts.ts), which applies it to modes the archive
 *  can't search (VISITOR_*). */
export function searchRadiusArcsec(modeType: string | null): number {
  return archiveSearchSpec(modeType)?.radiusArcsec ?? MIN_RADIUS_ARCSEC;
}

/** One jsonsummary URL (proxied). CANONICAL = latest file versions only;
 *  SCIENCE/RAW/OBJECT/notengineering/NotFail = on-sky raw science data. */
export function archiveQueryUrl(
  instrument: string,
  mode: ArchiveMode,
  raDeg: number,
  decDeg: number,
  radiusArcsec: number,
): string {
  return `/archive/jsonsummary/CANONICAL/SCIENCE/RAW/OBJECT/notengineering/NotFail/${instrument}/${mode}/ra=${raDeg}/dec=${decDeg}/SR=${radiusArcsec}`;
}

/** The jsonsummary fields we read (one entry per file). */
export interface ArchiveFile {
  readonly observation_id: string | null;
  readonly instrument: string | null;
  readonly object: string | null;
  readonly ra: number | null;
  readonly dec: number | null;
  readonly filter_name: string | null;
  readonly exposure_time: number | null;
  readonly disperser: string | null;
  readonly central_wavelength: number | null;
  readonly focal_plane_mask: string | null;
  readonly qa_state: string | null;
}

/** One row of the "Potential Duplicate Observations" table: one archive
 *  observation, aggregated over its files. */
export interface DuplicateRow {
  /** Row identity for the table: one archive observation can duplicate
   *  several selected sources, so the observation id alone is not unique. */
  readonly key: string;
  /** The requested observation / change request this duplicate matched. */
  readonly sourceId: string;
  readonly observationId: string;
  /** Files in this observation with QA = Pass. Visitor instruments may not
   *  set QA, so a low P over a high # is not by itself disqualifying. */
  readonly passCount: number;
  readonly fileCount: number;
  readonly target: string;
  readonly raDeg: number | null;
  readonly decDeg: number | null;
  /** Separation from the requested coordinates, arcsec. */
  readonly sepArcsec: number | null;
  readonly instrument: string;
  readonly fpu: string;
  readonly disperser: string;
  readonly wavelengthUm: number | null;
  readonly filter: string;
}

/** Angular separation between two sky positions, arcsec (haversine — exact at
 *  the arcsecond scales these cone searches produce). */
export function separationArcsec(ra1Deg: number, dec1Deg: number, ra2Deg: number, dec2Deg: number): number {
  const rad = Math.PI / 180;
  const dRa = (ra2Deg - ra1Deg) * rad;
  const dDec = (dec2Deg - dec1Deg) * rad;
  const a = Math.sin(dDec / 2) ** 2 + Math.cos(dec1Deg * rad) * Math.cos(dec2Deg * rad) * Math.sin(dRa / 2) ** 2;
  return 2 * Math.asin(Math.min(1, Math.sqrt(a))) * (1 / rad) * 3600;
}

/** Aggregate jsonsummary files into one row per observation_id, with file (#)
 *  and QA-Pass (P) counts and the first file's representative configuration. */
export function aggregateDuplicates(
  sourceId: string,
  raDeg: number,
  decDeg: number,
  files: readonly ArchiveFile[],
): DuplicateRow[] {
  const byObservation = new Map<string, ArchiveFile[]>();
  for (const f of files) {
    if (!f.observation_id) continue;
    const group = byObservation.get(f.observation_id);
    if (group) group.push(f);
    else byObservation.set(f.observation_id, [f]);
  }
  return Array.from(byObservation.entries()).map(([observationId, group]) => {
    const first = group[0]!;
    return {
      key: `${sourceId}:${observationId}`,
      sourceId,
      observationId,
      passCount: group.filter((f) => f.qa_state === 'Pass').length,
      fileCount: group.length,
      target: first.object ?? '—',
      raDeg: first.ra,
      decDeg: first.dec,
      sepArcsec: first.ra !== null && first.dec !== null ? separationArcsec(raDeg, decDeg, first.ra, first.dec) : null,
      instrument: first.instrument ?? '—',
      fpu: first.focal_plane_mask ?? '—',
      disperser: first.disperser ?? '—',
      wavelengthUm: first.central_wavelength,
      filter: first.filter_name ?? '—',
    };
  });
}

/** A requested observation / change request to check for duplicates. */
export interface DuplicateSource {
  readonly id: string;
  readonly raDeg: number | null;
  readonly decDeg: number | null;
  /** ODB ObservingModeType, e.g. GMOS_SOUTH_LONG_SLIT. */
  readonly modeType: string | null;
}

// jsonsummary responses are immutable for a given URL within a session;
// cache them so re-selecting a row doesn't refetch.
const responseCache = new Map<string, readonly ArchiveFile[]>();

async function fetchArchive(url: string, signal: AbortSignal): Promise<readonly ArchiveFile[]> {
  const cached = responseCache.get(url);
  if (cached) return cached;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Archive query failed: HTTP ${res.status}`);
  const files = (await res.json()) as ArchiveFile[];
  responseCache.set(url, files);
  return files;
}

/** Run the duplication check for the given sources. Sources without sidereal
 *  coordinates or a searchable mode are skipped (ToO configurations carry no
 *  coordinates; VISITOR modes have no archive instrument). */
export async function findDuplicates(
  sources: readonly DuplicateSource[],
  signal: AbortSignal,
): Promise<DuplicateRow[]> {
  const searches = sources.flatMap((s) => {
    const sp = archiveSearchSpec(s.modeType);
    if (!sp || s.raDeg === null || s.decDeg === null) return [];
    const { raDeg, decDeg } = s;
    return sp.instruments.map(async (instrument) => {
      const files = await fetchArchive(archiveQueryUrl(instrument, sp.mode, raDeg, decDeg, sp.radiusArcsec), signal);
      return aggregateDuplicates(s.id, raDeg, decDeg, files);
    });
  });
  const rows = (await Promise.all(searches)).flat();
  return rows.sort(
    (a, b) => a.sourceId.localeCompare(b.sourceId) || (a.sepArcsec ?? Infinity) - (b.sepArcsec ?? Infinity),
  );
}

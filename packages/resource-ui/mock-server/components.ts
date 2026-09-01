import type { ImportedBlock, ImportedSchedule, ImportSite, Instrument } from './records.ts';

export type ComponentType = 'FILTER' | 'DISPERSER' | 'FPU' | 'WFS' | 'OTHER';
export type ComponentLocation = 'INSTALLED' | 'FLOOR' | 'LAB' | 'BASE' | 'UNKNOWN';
export type ComponentUsage = 'SCIENCE' | 'ENGINEERING' | 'UNAVAILABLE';

/** Declared per piece rather than derived from a hash, so a piece is the same example every time. */
export type ComponentPattern =
  | 'RIDES_WITH_INSTRUMENT'
  | 'SPARE_IN_LAB'
  | 'STORED_AT_BASE'
  /** Installed for a campaign partway through the first mounting. */
  | 'MASK_CAMPAIGN'
  /** Fails partway through the first mounting and comes off for repair. */
  | 'FAILS_MID_SEMESTER';

export interface CatalogComponent {
  /** Stable id, `k-<site>-<code>`, unique because codes are unique per site set. */
  readonly id: string;
  readonly instrument: Instrument;
  /** Mock-only: the API's identity record carries no site, but the generator needs one to anchor to. */
  readonly site: ImportSite;
  readonly componentType: ComponentType;
  readonly code: string;
  readonly name: string;
  readonly barcode: string | null;
  readonly aliases: readonly string[];
  readonly pattern: ComponentPattern;
  /** Soft delete: a DELETED piece keeps its history but stops being offered. */
  readonly existence: 'PRESENT' | 'DELETED';
}

interface Entry {
  readonly instrument: Instrument;
  readonly componentType: ComponentType;
  readonly code: string;
  readonly name: string;
  readonly barcode?: string;
  readonly aliases?: readonly string[];
  readonly pattern?: ComponentPattern;
  readonly existence?: 'PRESENT' | 'DELETED';
}

const catalog = (site: ImportSite, entries: readonly Entry[]): readonly CatalogComponent[] =>
  entries.map((entry) => ({
    id: `k-${site.toLowerCase()}-${entry.code}`,
    instrument: entry.instrument,
    site,
    componentType: entry.componentType,
    code: entry.code,
    name: entry.name,
    barcode: entry.barcode ?? null,
    aliases: entry.aliases ?? [],
    pattern: entry.pattern ?? 'RIDES_WITH_INSTRUMENT',
    existence: entry.existence ?? 'PRESENT',
  }));

/** GMOS-S and F2 carry the [REQ] v1 depth; the rest hold a real handful each. */
const GS_CATALOG = catalog('GS', [
  // B600_G5323 is the retired grating the B480 replaced, boxed at the base facility.
  { instrument: 'GMOS', componentType: 'DISPERSER', code: 'B1200_G5321', name: 'B1200' },
  { instrument: 'GMOS', componentType: 'DISPERSER', code: 'R831_G5322', name: 'R831', pattern: 'SPARE_IN_LAB' },
  { instrument: 'GMOS', componentType: 'DISPERSER', code: 'R600_G5324', name: 'R600', pattern: 'SPARE_IN_LAB' },
  // Soft-deleted: the catalog remembers it, the finder does not offer it.
  {
    instrument: 'GMOS',
    componentType: 'FPU',
    code: '11009901',
    name: 'Mask GS2024A-001',
    barcode: '11009901',
    pattern: 'SPARE_IN_LAB',
    existence: 'DELETED',
  },
  {
    instrument: 'GMOS',
    componentType: 'DISPERSER',
    code: 'R400_G5325',
    name: 'R400',
    aliases: ['R400'],
    pattern: 'FAILS_MID_SEMESTER',
  },
  { instrument: 'GMOS', componentType: 'DISPERSER', code: 'R150_G5326', name: 'R150', pattern: 'STORED_AT_BASE' },
  { instrument: 'GMOS', componentType: 'DISPERSER', code: 'B480_G5327', name: 'B480' },
  { instrument: 'GMOS', componentType: 'DISPERSER', code: 'B600_G5323', name: 'B600', pattern: 'STORED_AT_BASE' },
  // GMOS-S filters (GmosSouthFilter).
  { instrument: 'GMOS', componentType: 'FILTER', code: 'u_G0332', name: "u'", pattern: 'SPARE_IN_LAB' },
  { instrument: 'GMOS', componentType: 'FILTER', code: 'g_G0325', name: "g'" },
  { instrument: 'GMOS', componentType: 'FILTER', code: 'r_G0326', name: "r'" },
  { instrument: 'GMOS', componentType: 'FILTER', code: 'i_G0327', name: "i'" },
  { instrument: 'GMOS', componentType: 'FILTER', code: 'z_G0328', name: "z'" },
  { instrument: 'GMOS', componentType: 'FILTER', code: 'Z_G0343', name: 'Z' },
  { instrument: 'GMOS', componentType: 'FILTER', code: 'Y_G0344', name: 'Y' },
  { instrument: 'GMOS', componentType: 'FILTER', code: 'GG455_G0329', name: 'GG455', aliases: ['GG455'] },
  { instrument: 'GMOS', componentType: 'FILTER', code: 'OG515_G0330', name: 'OG515', pattern: 'STORED_AT_BASE' },
  { instrument: 'GMOS', componentType: 'FILTER', code: 'RG610_G0331', name: 'RG610' },
  { instrument: 'GMOS', componentType: 'FILTER', code: 'Ha_G0336', name: 'H-alpha' },
  { instrument: 'GMOS', componentType: 'FILTER', code: 'SII_G0335', name: 'SII' },
  { instrument: 'GMOS', componentType: 'FILTER', code: 'OIII_G0338', name: 'OIII' },
  { instrument: 'GMOS', componentType: 'FILTER', code: 'HeII_G0340', name: 'HeII', pattern: 'SPARE_IN_LAB' },
  // GMOS-S FPUs (GmosSouthFpu): longslits, the nod-and-shuffle slit, the IFU trio, and MOS masks.
  { instrument: 'GMOS', componentType: 'FPU', code: 'LongSlit_0_25', name: '0.25" longslit' },
  { instrument: 'GMOS', componentType: 'FPU', code: 'LongSlit_0_50', name: '0.5" longslit' },
  { instrument: 'GMOS', componentType: 'FPU', code: 'LongSlit_0_75', name: '0.75" longslit' },
  { instrument: 'GMOS', componentType: 'FPU', code: 'LongSlit_1_00', name: '1.0" longslit' },
  { instrument: 'GMOS', componentType: 'FPU', code: 'LongSlit_1_50', name: '1.5" longslit' },
  { instrument: 'GMOS', componentType: 'FPU', code: 'LongSlit_2_00', name: '2.0" longslit' },
  { instrument: 'GMOS', componentType: 'FPU', code: 'LongSlit_5_00', name: '5.0" longslit', pattern: 'SPARE_IN_LAB' },
  { instrument: 'GMOS', componentType: 'FPU', code: 'Ns2', name: 'N&S 0.75" slit' },
  { instrument: 'GMOS', componentType: 'FPU', code: 'Ifu2Slits', name: 'IFU 2 slits', aliases: ['IFU-2'] },
  { instrument: 'GMOS', componentType: 'FPU', code: 'IfuBlue', name: 'IFU left slit (blue)', aliases: ['IFU-B'] },
  { instrument: 'GMOS', componentType: 'FPU', code: 'IfuRed', name: 'IFU right slit (red)', aliases: ['IFU-R'] },
  {
    instrument: 'GMOS',
    componentType: 'FPU',
    code: '11002801',
    name: 'Mask GS2026B-011',
    barcode: '11002801',
    pattern: 'MASK_CAMPAIGN',
  },
  {
    instrument: 'GMOS',
    componentType: 'FPU',
    code: '11002802',
    name: 'Mask GS2026B-012',
    barcode: '11002802',
    aliases: ['the long mask'],
    pattern: 'MASK_CAMPAIGN',
  },
  {
    instrument: 'GMOS',
    componentType: 'FPU',
    code: '11013304',
    name: 'Mask GS2025B-044',
    barcode: '11013304',
    pattern: 'SPARE_IN_LAB',
  },
  { instrument: 'GMOS', componentType: 'WFS', code: 'GMOS_S_OIWFS', name: 'GMOS-S OIWFS' },
  // Flamingos-2: grisms, filters, pixel-width longslits, and the f/16 Lyot stop.
  { instrument: 'F2', componentType: 'DISPERSER', code: 'R1200JH', name: 'R1200 JH grism' },
  { instrument: 'F2', componentType: 'DISPERSER', code: 'R1200HK', name: 'R1200 HK grism' },
  { instrument: 'F2', componentType: 'DISPERSER', code: 'R3000', name: 'R3000 grism', pattern: 'SPARE_IN_LAB' },
  { instrument: 'F2', componentType: 'FILTER', code: 'Y', name: 'Y' },
  { instrument: 'F2', componentType: 'FILTER', code: 'J', name: 'J' },
  { instrument: 'F2', componentType: 'FILTER', code: 'JLow', name: 'J-low' },
  { instrument: 'F2', componentType: 'FILTER', code: 'H', name: 'H' },
  { instrument: 'F2', componentType: 'FILTER', code: 'K_SHORT', name: 'K-short', aliases: ['Ks'] },
  { instrument: 'F2', componentType: 'FILTER', code: 'KBlue', name: 'K-blue' },
  { instrument: 'F2', componentType: 'FILTER', code: 'KRed', name: 'K-red', pattern: 'STORED_AT_BASE' },
  { instrument: 'F2', componentType: 'FILTER', code: 'JH', name: 'JH', pattern: 'SPARE_IN_LAB' },
  { instrument: 'F2', componentType: 'FILTER', code: 'HK', name: 'HK' },
  { instrument: 'F2', componentType: 'FPU', code: 'LongSlit1', name: '1-pixel longslit' },
  { instrument: 'F2', componentType: 'FPU', code: 'LongSlit2', name: '2-pixel longslit' },
  { instrument: 'F2', componentType: 'FPU', code: 'LongSlit3', name: '3-pixel longslit' },
  { instrument: 'F2', componentType: 'FPU', code: 'LongSlit4', name: '4-pixel longslit' },
  { instrument: 'F2', componentType: 'FPU', code: 'LongSlit6', name: '6-pixel longslit', pattern: 'SPARE_IN_LAB' },
  { instrument: 'F2', componentType: 'FPU', code: 'LongSlit8', name: '8-pixel longslit' },
  { instrument: 'F2', componentType: 'FPU', code: 'Pinhole', name: 'Pinhole grid', pattern: 'SPARE_IN_LAB' },
  { instrument: 'F2', componentType: 'OTHER', code: 'F2_LYOT_F16', name: 'f/16 Lyot stop' },
  { instrument: 'F2', componentType: 'WFS', code: 'F2_OIWFS', name: 'F2 OIWFS' },
  // GHOST is fibre-fed: the IFU positioners at the focal station, the spectrograph in the pier lab.
  { instrument: 'GHOST', componentType: 'FPU', code: 'GHOST_IFU1', name: 'Standard-resolution IFU (IFU-1)' },
  { instrument: 'GHOST', componentType: 'FPU', code: 'GHOST_IFU2', name: 'High-resolution IFU (IFU-2)' },
  { instrument: 'GHOST', componentType: 'OTHER', code: 'GHOST_CAM_BLUE', name: 'Blue spectrograph camera' },
  { instrument: 'GHOST', componentType: 'OTHER', code: 'GHOST_CAM_RED', name: 'Red spectrograph camera' },
  { instrument: 'GHOST', componentType: 'OTHER', code: 'GHOST_SVC', name: 'Slit-viewing camera' },
  {
    instrument: 'GHOST',
    componentType: 'OTHER',
    code: 'GHOST_THXE',
    name: 'Th-Xe calibration lamp',
    pattern: 'SPARE_IN_LAB',
  },
  // Cal/ZORRO: dual-channel speckle imager - one EMCCD per arm of the dichroic.
  { instrument: 'CAL_ZORRO', componentType: 'OTHER', code: 'ZORRO_EMCCD_B', name: 'Blue EMCCD camera (562 nm)' },
  { instrument: 'CAL_ZORRO', componentType: 'OTHER', code: 'ZORRO_EMCCD_R', name: 'Red EMCCD camera (832 nm)' },
  { instrument: 'CAL_ZORRO', componentType: 'OTHER', code: 'ZORRO_DICHROIC', name: 'Dichroic beamsplitter' },
  // GSAOI and IQUEYE are mounted by no sheet; Canopus rides Port 4.
  { instrument: 'GSAOI', componentType: 'FILTER', code: 'Z_G1101', name: 'Z' },
  { instrument: 'GSAOI', componentType: 'FILTER', code: 'J_G1102', name: 'J' },
  { instrument: 'GSAOI', componentType: 'FILTER', code: 'H_G1103', name: 'H' },
  { instrument: 'GSAOI', componentType: 'FILTER', code: 'Kprime_G1104', name: "K'" },
  { instrument: 'GSAOI', componentType: 'FILTER', code: 'Kshort_G1105', name: 'K-short' },
  { instrument: 'GSAOI', componentType: 'FILTER', code: 'BrG_G1116', name: 'Br-gamma', pattern: 'SPARE_IN_LAB' },
  { instrument: 'CANOPUS', componentType: 'OTHER', code: 'CANOPUS_DM0', name: 'Deformable mirror DM0' },
  { instrument: 'CANOPUS', componentType: 'WFS', code: 'CANOPUS_NGS_WFS', name: 'NGS wavefront sensor' },
  { instrument: 'IQUEYE', componentType: 'OTHER', code: 'IQUEYE_HEAD', name: 'Photon-counting detector head' },
]);

/** GMOS-N mirrors the south set with its own G-numbers. */
const GN_CATALOG = catalog('GN', [
  // GMOS-N gratings (GmosNorthGrating).
  { instrument: 'GMOS', componentType: 'DISPERSER', code: 'B1200_G5301', name: 'B1200' },
  { instrument: 'GMOS', componentType: 'DISPERSER', code: 'R831_G5302', name: 'R831' },
  { instrument: 'GMOS', componentType: 'DISPERSER', code: 'R600_G5304', name: 'R600', pattern: 'SPARE_IN_LAB' },
  { instrument: 'GMOS', componentType: 'DISPERSER', code: 'B480_G5309', name: 'B480' },
  {
    instrument: 'GMOS',
    componentType: 'DISPERSER',
    code: 'R400_G5310',
    name: 'R400',
    aliases: ['R400'],
    pattern: 'SPARE_IN_LAB',
  },
  { instrument: 'GMOS', componentType: 'DISPERSER', code: 'R150_G5308', name: 'R150', pattern: 'STORED_AT_BASE' },
  // GMOS-N filters (GmosNorthFilter).
  { instrument: 'GMOS', componentType: 'FILTER', code: 'g_G0301', name: "g'" },
  { instrument: 'GMOS', componentType: 'FILTER', code: 'r_G0303', name: "r'" },
  { instrument: 'GMOS', componentType: 'FILTER', code: 'i_G0302', name: "i'" },
  { instrument: 'GMOS', componentType: 'FILTER', code: 'z_G0304', name: "z'" },
  { instrument: 'GMOS', componentType: 'FILTER', code: 'Z_G0322', name: 'Z' },
  { instrument: 'GMOS', componentType: 'FILTER', code: 'Y_G0323', name: 'Y' },
  { instrument: 'GMOS', componentType: 'FILTER', code: 'ri_G0349', name: 'r+i' },
  { instrument: 'GMOS', componentType: 'FILTER', code: 'GG455_G0305', name: 'GG455', pattern: 'STORED_AT_BASE' },
  { instrument: 'GMOS', componentType: 'FILTER', code: 'OG515_G0306', name: 'OG515' },
  { instrument: 'GMOS', componentType: 'FILTER', code: 'RG610_G0307', name: 'RG610' },
  { instrument: 'GMOS', componentType: 'FILTER', code: 'Ha_G0310', name: 'H-alpha', pattern: 'FAILS_MID_SEMESTER' },
  { instrument: 'GMOS', componentType: 'FILTER', code: 'DS920_G0312', name: 'DS920', pattern: 'SPARE_IN_LAB' },
  { instrument: 'GMOS', componentType: 'FILTER', code: 'HeII_G0320', name: 'HeII' },
  // GMOS-N FPUs (GmosNorthFpu) and MOS masks.
  { instrument: 'GMOS', componentType: 'FPU', code: 'LongSlit_0_50', name: '0.5" longslit' },
  { instrument: 'GMOS', componentType: 'FPU', code: 'LongSlit_0_75', name: '0.75" longslit' },
  { instrument: 'GMOS', componentType: 'FPU', code: 'LongSlit_1_00', name: '1.0" longslit' },
  { instrument: 'GMOS', componentType: 'FPU', code: 'LongSlit_1_50', name: '1.5" longslit' },
  { instrument: 'GMOS', componentType: 'FPU', code: 'LongSlit_2_00', name: '2.0" longslit' },
  { instrument: 'GMOS', componentType: 'FPU', code: 'Ns1', name: 'N&S 0.5" slit', pattern: 'SPARE_IN_LAB' },
  { instrument: 'GMOS', componentType: 'FPU', code: 'Ifu2Slits', name: 'IFU 2 slits', aliases: ['IFU-2'] },
  { instrument: 'GMOS', componentType: 'FPU', code: 'IfuBlue', name: 'IFU left slit (blue)', aliases: ['IFU-B'] },
  { instrument: 'GMOS', componentType: 'FPU', code: 'IfuRed', name: 'IFU right slit (red)', aliases: ['IFU-R'] },
  {
    instrument: 'GMOS',
    componentType: 'FPU',
    code: '10005401',
    name: 'Mask GN2026B-003',
    barcode: '10005401',
    pattern: 'MASK_CAMPAIGN',
  },
  {
    instrument: 'GMOS',
    componentType: 'FPU',
    code: '10005402',
    name: 'Mask GN2026B-007',
    barcode: '10005402',
    pattern: 'MASK_CAMPAIGN',
  },
  {
    instrument: 'GMOS',
    componentType: 'FPU',
    code: '10011210',
    name: 'Mask GN2025B-018',
    barcode: '10011210',
    pattern: 'SPARE_IN_LAB',
  },
  { instrument: 'GMOS', componentType: 'WFS', code: 'GMOS_N_OIWFS', name: 'GMOS-N OIWFS' },
  // GNIRS slit widths are curated to ones GMOS does not share, so codes stay unique per site.
  { instrument: 'GNIRS', componentType: 'DISPERSER', code: 'D10', name: '10 l/mm grating' },
  { instrument: 'GNIRS', componentType: 'DISPERSER', code: 'D32', name: '32 l/mm grating' },
  { instrument: 'GNIRS', componentType: 'DISPERSER', code: 'D111', name: '111 l/mm grating', pattern: 'SPARE_IN_LAB' },
  { instrument: 'GNIRS', componentType: 'OTHER', code: 'Sxd', name: 'Short cross-dispersing prism' },
  { instrument: 'GNIRS', componentType: 'OTHER', code: 'Lxd', name: 'Long cross-dispersing prism' },
  { instrument: 'GNIRS', componentType: 'OTHER', code: 'ShortBlue', name: 'Short blue camera' },
  { instrument: 'GNIRS', componentType: 'OTHER', code: 'LongBlue', name: 'Long blue camera' },
  { instrument: 'GNIRS', componentType: 'OTHER', code: 'ShortRed', name: 'Short red camera', pattern: 'SPARE_IN_LAB' },
  { instrument: 'GNIRS', componentType: 'OTHER', code: 'LongRed', name: 'Long red camera', pattern: 'SPARE_IN_LAB' },
  { instrument: 'GNIRS', componentType: 'FILTER', code: 'Y_GNIRS', name: 'Y' },
  { instrument: 'GNIRS', componentType: 'FILTER', code: 'J_GNIRS', name: 'J' },
  { instrument: 'GNIRS', componentType: 'FILTER', code: 'K_GNIRS', name: 'K' },
  { instrument: 'GNIRS', componentType: 'FILTER', code: 'H2_GNIRS', name: 'H2' },
  { instrument: 'GNIRS', componentType: 'FILTER', code: 'PAH_GNIRS', name: 'PAH', pattern: 'SPARE_IN_LAB' },
  { instrument: 'GNIRS', componentType: 'FPU', code: 'LongSlit_0_10', name: '0.10" slit' },
  { instrument: 'GNIRS', componentType: 'FPU', code: 'LongSlit_0_30', name: '0.30" slit' },
  { instrument: 'GNIRS', componentType: 'FPU', code: 'LongSlit_0_45', name: '0.45" slit' },
  { instrument: 'GNIRS', componentType: 'FPU', code: 'LongSlit_0_675', name: '0.675" slit' },
  // Altair: the AO bench's swappable optics.
  { instrument: 'ALTAIR', componentType: 'OTHER', code: 'ALTAIR_BS_NGS', name: 'NGS beamsplitter' },
  { instrument: 'ALTAIR', componentType: 'OTHER', code: 'ALTAIR_BS_LGS', name: 'LGS dichroic' },
  { instrument: 'ALTAIR', componentType: 'OTHER', code: 'ALTAIR_FL', name: 'Field lens', pattern: 'SPARE_IN_LAB' },
  // IGRINS-2: fixed-format - the immersion grating and its two detectors.
  { instrument: 'IGRINS2', componentType: 'DISPERSER', code: 'IGRINS2_IMM', name: 'Silicon immersion grating' },
  { instrument: 'IGRINS2', componentType: 'OTHER', code: 'IGRINS2_DET_H', name: 'H-band detector' },
  { instrument: 'IGRINS2', componentType: 'OTHER', code: 'IGRINS2_DET_K', name: 'K-band detector' },
  // Visitors: MAROON-X rides the Visiting row; 'Alopeke is the twin of ZORRO.
  { instrument: 'MAROON_X', componentType: 'OTHER', code: 'MAROONX_FIU', name: 'Fiber injection unit' },
  { instrument: 'MAROON_X', componentType: 'OTHER', code: 'MAROONX_ETALON', name: 'Etalon calibrator' },
  { instrument: 'ALOPEKE', componentType: 'OTHER', code: 'ALOPEKE_EMCCD_B', name: 'Blue EMCCD camera (562 nm)' },
  { instrument: 'ALOPEKE', componentType: 'OTHER', code: 'ALOPEKE_EMCCD_R', name: 'Red EMCCD camera (832 nm)' },
]);

export const COMPONENT_CATALOG: readonly CatalogComponent[] = [...GS_CATALOG, ...GN_CATALOG];

export interface SynthesizedComponentBlock {
  readonly id: string;
  readonly site: ImportSite;
  readonly componentId: string;
  readonly usage: ComponentUsage;
  readonly location: ComponentLocation;
  /** Half-open [start, end), ISO instants, like every other block. */
  readonly start: string;
  readonly end: string;
  readonly note: string | null;
}

interface Span {
  readonly start: number;
  readonly end: number;
}

const iso = (millis: number): string => new Date(millis).toISOString();

/** Rounded to the hour, so a synthetic boundary reads as a time someone could have written down. */
const within = (span: Span, fraction: number): number =>
  Math.round((span.start + (span.end - span.start) * fraction) / 3_600_000) * 3_600_000;

/** The mounted intervals of one instrument in one schedule, in order. */
const mountingsOf = (schedule: ImportedSchedule, instrument: Instrument): readonly Span[] =>
  schedule.blocks
    .filter((block): block is ImportedBlock => block.kind === 'MOUNTED' && block.instrument === instrument)
    .map((block) => ({ start: Date.parse(block.start), end: Date.parse(block.end) }))
    .sort((a, b) => a.start - b.start);

/** The whole span a schedule covers, from its own records. */
const scheduleSpan = (schedule: ImportedSchedule): Span | null => {
  const edges = [...schedule.blocks, ...schedule.closures].flatMap((record) => [
    Date.parse(record.start),
    Date.parse(record.end),
  ]);
  if (edges.length === 0) {
    return null;
  }
  return { start: Math.min(...edges), end: Math.max(...edges) };
};

interface Piece {
  readonly usage: ComponentUsage;
  readonly location: ComponentLocation;
  readonly span: Span;
  readonly note: string | null;
}

const stored = (span: Span, location: ComponentLocation): Piece => ({
  usage: 'UNAVAILABLE',
  location,
  span,
  note: null,
});
const installed = (span: Span, note: string | null = null): Piece => ({
  usage: 'SCIENCE',
  location: 'INSTALLED',
  span,
  note,
});

/** One semester's pieces for one component, per its declared pattern. */
const piecesFor = (component: CatalogComponent, semester: Span, mountings: readonly Span[]): readonly Piece[] => {
  switch (component.pattern) {
    case 'SPARE_IN_LAB':
      return [stored(semester, 'LAB')];
    case 'STORED_AT_BASE':
      return [stored(semester, 'BASE')];
    case 'MASK_CAMPAIGN': {
      const mounting = mountings[0];
      if (mounting === undefined) {
        return [stored(semester, 'LAB')];
      }
      const from = within(mounting, 0.4);
      const to = within(mounting, 0.7);
      return [
        stored({ start: semester.start, end: from }, 'LAB'),
        installed({ start: from, end: to }, 'Installed for the campaign'),
        stored({ start: to, end: semester.end }, 'LAB'),
      ];
    }
    case 'FAILS_MID_SEMESTER': {
      const mounting = mountings[0];
      if (mounting === undefined) {
        return [stored(semester, 'LAB')];
      }
      const failsAt = within(mounting, 0.6);
      return [
        ...(semester.start < mounting.start ? [stored({ start: semester.start, end: mounting.start }, 'LAB')] : []),
        installed({ start: mounting.start, end: failsAt }),
        {
          usage: 'UNAVAILABLE' as const,
          location: 'LAB' as const,
          span: { start: failsAt, end: semester.end },
          note: 'Failed; removed for repair',
        },
      ];
    }
    default: {
      // The anchoring rule: the piece moves exactly when the published sheet moves the instrument.
      const pieces: Piece[] = [];
      let cursor = semester.start;
      for (const mounting of mountings) {
        if (cursor < mounting.start) {
          pieces.push(stored({ start: cursor, end: mounting.start }, 'LAB'));
        }
        pieces.push(installed(mounting));
        cursor = Math.max(cursor, mounting.end);
      }
      if (cursor < semester.end) {
        pieces.push(stored({ start: cursor, end: semester.end }, 'LAB'));
      }
      return pieces;
    }
  }
};

/** Adjacent equal blocks merge across semester boundaries, so a two-year spare is one block. */
export const synthesizeComponentBlocks = (
  schedules: readonly ImportedSchedule[],
): readonly SynthesizedComponentBlock[] => {
  const blocks: SynthesizedComponentBlock[] = [];

  for (const component of COMPONENT_CATALOG) {
    // The synthetic layer has nothing historical to say about a retired piece.
    if (component.existence === 'DELETED') {
      continue;
    }
    const pieces: Piece[] = [];
    for (const schedule of schedules) {
      if (schedule.site !== component.site) {
        continue;
      }
      const semester = scheduleSpan(schedule);
      if (semester === null) {
        continue;
      }
      pieces.push(...piecesFor(component, semester, mountingsOf(schedule, component.instrument)));
    }

    pieces.sort((a, b) => a.span.start - b.span.start);
    const merged: Piece[] = [];
    for (const piece of pieces) {
      const previous = merged.at(-1);
      if (
        previous?.span.end === piece.span.start &&
        previous.location === piece.location &&
        previous.usage === piece.usage &&
        previous.note === piece.note
      ) {
        merged[merged.length - 1] = { ...previous, span: { start: previous.span.start, end: piece.span.end } };
      } else {
        merged.push(piece);
      }
    }

    blocks.push(
      ...merged.map((piece, index) => ({
        id: `${component.id}-b-${String(index)}`,
        site: component.site,
        componentId: component.id,
        usage: piece.usage,
        location: piece.location,
        start: iso(piece.span.start),
        end: iso(piece.span.end),
        note: piece.note,
      })),
    );
  }
  return blocks;
};

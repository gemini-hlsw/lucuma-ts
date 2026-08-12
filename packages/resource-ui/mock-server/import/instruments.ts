/**
 * Workbook instrument names -> the Resource `Instrument` enum.
 *
 * Every name the operations workbook's port columns use, across both sites.
 * Some of these are not instruments in the lucuma-core sense - Altair and
 * Canopus are AO subsystems, GCAL is the facility calibration unit - but
 * Resource models everything the schedule mounts as an instrument for now
 * (Dan, 2026-08-07); mapping onto lucuma-core - and whether the AO subsystems
 * belong elsewhere - is still open with operations.
 *
 * A name the workbook introduces later resolves to null and surfaces as an
 * UNKNOWN block plus a warning, so a new instrument shows up as a row to add
 * here rather than being dropped.
 */

/** The enum values, in the SDL's order. */
export const INSTRUMENTS = [
  'ACQ_CAM',
  'ALOPEKE',
  'ALTAIR',
  'CAL_ZORRO',
  'CANOPUS',
  'ENGINEERING',
  'F2',
  'GCAL',
  'GHOST',
  'GMOS',
  'GNIRS',
  'GPI',
  'GSAOI',
  'IGRINS2',
  'IQUEYE',
  'MAROON_X',
  'NIRI',
  'SCORPIO',
] as const;

export type Instrument = (typeof INSTRUMENTS)[number];

/**
 * Workbook spelling -> enum value, exactly as the port columns print them.
 *
 * The workbook splits what the published sheets folded together: GCAL (the
 * calibration unit, on Port 2 most nights) and Zorro (the speckle imager that
 * displaces it for visitor runs) are separate names. GCAL got its own enum
 * value for that reason (Dan, 2026-08-11); plain "Zorro" keeps CAL_ZORRO,
 * whose tag preserves the sheets' joint spelling.
 */
const BY_WORKBOOK_NAME: Readonly<Record<string, Instrument>> = {
  '`Alopeke': 'ALOPEKE',
  Altair: 'ALTAIR',
  Canopus: 'CANOPUS',
  Flamingos2: 'F2',
  GCAL: 'GCAL',
  GHOST: 'GHOST',
  'GMOS-N': 'GMOS',
  'GMOS-S': 'GMOS',
  GNIRS: 'GNIRS',
  GSAOI: 'GSAOI',
  'IGRINS-2': 'IGRINS2',
  IQUEYE: 'IQUEYE',
  'MAROON-X': 'MAROON_X',
  Zorro: 'CAL_ZORRO',
} as const;

/** The instrument a workbook port cell names, or null when unrecognised. */
export const instrumentOf = (workbookName: string): Instrument | null => BY_WORKBOOK_NAME[workbookName.trim()] ?? null;

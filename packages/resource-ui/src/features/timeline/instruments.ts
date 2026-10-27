import type { ResourceInstrument } from '@/domain/types';

/** Keyed by the enum, so a new instrument fails to compile until it has a colour. */
const INSTRUMENT_COLOR = {
  ACQ_CAM: 'var(--instrument-acq-cam)',
  ALOPEKE: 'var(--instrument-alopeke)',
  ALTAIR: 'var(--instrument-altair)',
  CAL_ZORRO: 'var(--instrument-cal-zorro)',
  CANOPUS: 'var(--instrument-canopus)',
  ENGINEERING: 'var(--instrument-engineering)',
  F2: 'var(--instrument-f2)',
  GCAL: 'var(--instrument-gcal)',
  GHOST: 'var(--instrument-ghost)',
  GMOS: 'var(--instrument-gmos)',
  GNIRS: 'var(--instrument-gnirs)',
  GPI: 'var(--instrument-gpi)',
  GSAOI: 'var(--instrument-gsaoi)',
  IGRINS2: 'var(--instrument-igrins2)',
  IQUEYE: 'var(--instrument-iqueye)',
  MAROON_X: 'var(--instrument-maroon-x)',
  NIRI: 'var(--instrument-niri)',
  SCORPIO: 'var(--instrument-scorpio)',
  UNKNOWN: 'var(--instrument-unknown)',
} satisfies Record<ResourceInstrument, string>;

export const INSTRUMENT_INK_LIGHT = 'var(--instrument-ink-light)';

/** Legible only on the bright instrument fill it was chosen for; light ink reads on every chrome fill. */
export const INSTRUMENT_INK_DARK = 'var(--instrument-ink-dark)';

const INSTRUMENT_INK = {
  ACQ_CAM: INSTRUMENT_INK_DARK,
  ALOPEKE: INSTRUMENT_INK_DARK,
  ALTAIR: INSTRUMENT_INK_LIGHT,
  CAL_ZORRO: INSTRUMENT_INK_DARK,
  CANOPUS: INSTRUMENT_INK_LIGHT,
  ENGINEERING: INSTRUMENT_INK_DARK,
  F2: INSTRUMENT_INK_DARK,
  GCAL: INSTRUMENT_INK_DARK,
  GHOST: INSTRUMENT_INK_DARK,
  GMOS: INSTRUMENT_INK_DARK,
  GNIRS: INSTRUMENT_INK_DARK,
  GPI: INSTRUMENT_INK_DARK,
  GSAOI: INSTRUMENT_INK_DARK,
  IGRINS2: INSTRUMENT_INK_DARK,
  IQUEYE: INSTRUMENT_INK_DARK,
  MAROON_X: INSTRUMENT_INK_LIGHT,
  NIRI: INSTRUMENT_INK_DARK,
  SCORPIO: INSTRUMENT_INK_DARK,
  UNKNOWN: INSTRUMENT_INK_DARK,
} satisfies Record<ResourceInstrument, string>;

/** Published spellings, so a legend reads as the sheet does, not as the enum. */
export const INSTRUMENT_LABEL = {
  ACQ_CAM: 'AcqCam',
  ALOPEKE: "'Alopeke",
  ALTAIR: 'Altair',
  CAL_ZORRO: 'Zorro',
  CANOPUS: 'Canopus',
  ENGINEERING: 'Engineering',
  F2: 'F2',
  GCAL: 'GCAL',
  GHOST: 'GHOST',
  GMOS: 'GMOS',
  GNIRS: 'GNIRS',
  GPI: 'GPI',
  GSAOI: 'GSAOI',
  IGRINS2: 'IGRINS2',
  IQUEYE: 'IQUEYE',
  MAROON_X: 'Maroon-X',
  NIRI: 'NIRI',
  SCORPIO: 'SCORPIO',
  UNKNOWN: 'Unknown',
} satisfies Record<ResourceInstrument, string>;

export const instrumentColor = (instrument: ResourceInstrument): string => INSTRUMENT_COLOR[instrument];

export const instrumentInk = (instrument: ResourceInstrument): string => INSTRUMENT_INK[instrument];

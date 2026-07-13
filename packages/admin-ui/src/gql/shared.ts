/** Selections and mapping helpers shared by more than one view. */
import { graphql } from './odb/gen';
import type {
  CloudExtinctionPreset,
  ImageQualityPreset,
  ObservationRowFieldsFragment,
  ObservingModeType,
  SkyBackground,
  WaterVapor,
} from './odb/gen/graphql';
import { type Instrument, INSTRUMENT_LABEL, type ObservationRow } from './types';

/** ODB instrument enum (e.g. `GMOS_NORTH`) → the display label used across
 *  Programs/CfP/Proposals/Change Requests. Unknown values (a future enum
 *  addition) pass through unchanged rather than rendering blank. */
export function normalizeInstrument(name: string): string {
  return INSTRUMENT_LABEL[name as Instrument] ?? name;
}

/** ImageQuality.Preset has no fixed percentile in the model (lucuma-core
 *  computes it dynamically from wavelength + airmass) — show its arcsecond
 *  bound instead of fabricating one. Source: lucuma-core ImageQuality.scala. */
const IMAGE_QUALITY_ARCSEC: Record<ImageQualityPreset, string> = {
  POINT_ONE: '0.1',
  POINT_TWO: '0.2',
  POINT_THREE: '0.3',
  POINT_FOUR: '0.4',
  POINT_SIX: '0.6',
  POINT_EIGHT: '0.8',
  ONE_POINT_ZERO: '1.0',
  ONE_POINT_TWO: '1.2',
  ONE_POINT_FIVE: '1.5',
  TWO_POINT_ZERO: '2.0',
};

/** CloudExtinction.Preset's fixed percentile (lucuma-core CloudExtinction.scala). */
const CLOUD_EXTINCTION_PERCENT: Record<CloudExtinctionPreset, string> = {
  ZERO: '50',
  POINT_ONE: '55',
  POINT_THREE: '70',
  POINT_FIVE: '75',
  ONE_POINT_ZERO: '80',
  TWO_POINT_ZERO: '95',
  THREE_POINT_ZERO: '100',
};

/** SkyBackground's fixed percentile (lucuma-core SkyBackground.scala). */
const SKY_BACKGROUND_PERCENT: Record<SkyBackground, string> = {
  DARKEST: '20',
  DARK: '50',
  GRAY: '80',
  BRIGHT: '100',
};

/** WaterVapor's fixed percentile (lucuma-core WaterVapor.scala). */
const WATER_VAPOR_PERCENT: Record<WaterVapor, string> = {
  VERY_DRY: '20',
  DRY: '50',
  MEDIAN: '80',
  WET: '100',
};

function lookup<K extends string>(map: Record<K, string>, preset: K | null | undefined): string {
  return preset ? map[preset] : '—';
}

export interface RawConditions {
  imageQuality: ImageQualityPreset | null;
  cloudExtinction: CloudExtinctionPreset | null;
  skyBackground: SkyBackground | null;
  waterVapor: WaterVapor | null;
}

/** Observing-conditions presets → the compact "IQ<0.8″ / CC70 / SB80 / WV80"
 *  form reviewers read in the observation tables. */
export function formatConditions(cond: RawConditions | null | undefined): string {
  if (!cond) return '—';
  return `IQ<${lookup(IMAGE_QUALITY_ARCSEC, cond.imageQuality)}″ / CC${lookup(CLOUD_EXTINCTION_PERCENT, cond.cloudExtinction)} / SB${lookup(SKY_BACKGROUND_PERCENT, cond.skyBackground)} / WV${lookup(WATER_VAPOR_PERCENT, cond.waterVapor)}`;
}

/** ObservingModeType → its display parts: the instrument label and a short
 *  mode suffix ("LongSlit"). The complete enum (enforced by the Record) so a
 *  new mode is a compile error here, not a silently wrong Config cell. */
export const MODE_TYPE_FORMAT: Record<ObservingModeType, { readonly instrument: string; readonly mode: string }> = {
  ALOPEKE_SPECKLE: { instrument: 'Alopeke', mode: 'Speckle' },
  ALOPEKE_WIDE_FIELD: { instrument: 'Alopeke', mode: 'WideField' },
  EXCHANGE_KECK: { instrument: 'Keck', mode: '' },
  EXCHANGE_SUBARU: { instrument: 'Subaru', mode: '' },
  FLAMINGOS_2_IMAGING: { instrument: 'Flamingos-2', mode: 'Imaging' },
  FLAMINGOS_2_LONG_SLIT: { instrument: 'Flamingos-2', mode: 'LongSlit' },
  GHOST_IFU: { instrument: 'GHOST', mode: 'Ifu' },
  GMOS_NORTH_IMAGING: { instrument: 'GMOS-N', mode: 'Imaging' },
  GMOS_NORTH_LONG_SLIT: { instrument: 'GMOS-N', mode: 'LongSlit' },
  GMOS_SOUTH_IMAGING: { instrument: 'GMOS-S', mode: 'Imaging' },
  GMOS_SOUTH_LONG_SLIT: { instrument: 'GMOS-S', mode: 'LongSlit' },
  GNIRS_IFU: { instrument: 'GNIRS', mode: 'Ifu' },
  GNIRS_IMAGING: { instrument: 'GNIRS', mode: 'Imaging' },
  GNIRS_LONG_SLIT: { instrument: 'GNIRS', mode: 'LongSlit' },
  IGRINS_2_LONG_SLIT: { instrument: 'IGRINS-2', mode: 'LongSlit' },
  MAROON_X: { instrument: 'MAROON-X', mode: '' },
  VISITOR_NORTH: { instrument: 'Visitor North', mode: '' },
  VISITOR_SOUTH: { instrument: 'Visitor South', mode: '' },
  ZORRO_SPECKLE: { instrument: 'Zorro', mode: 'Speckle' },
  ZORRO_WIDE_FIELD: { instrument: 'Zorro', mode: 'WideField' },
};

/** Narrow a wire value (the fragment types carry `string` for
 *  observingMode.mode) into the enum, or null when it isn't one. */
export function asObservingModeType(mode: string | null): ObservingModeType | null {
  return mode !== null && Object.hasOwn(MODE_TYPE_FORMAT, mode) ? (mode as ObservingModeType) : null;
}

/** ObservingModeType → "GMOS-S LongSlit" for the check tables' Config column. */
export function formatModeType(modeType: string | null): string {
  const mode = asObservingModeType(modeType);
  if (!mode) return modeType ?? '—';
  const format = MODE_TYPE_FORMAT[mode];
  return format.mode ? `${format.instrument} ${format.mode}` : format.instrument;
}

/** The Config-column suffix ("LongSlit"), with the instrument stated
 *  separately (mapObservationRow prefixes its own instrument label). */
function observingModeSuffix(mode: string | null): string {
  const modeType = asObservingModeType(mode);
  return modeType ? MODE_TYPE_FORMAT[modeType].mode : '';
}

/** Selection for one observation row — shared by the Proposals query and the
 *  Change Requests id-batch query so both views show identical columns
 *  (target, RA/Dec, time, config, conditions). */
export const OBSERVATION_ROW_FRAGMENT = graphql(`
  fragment ObservationRowFields on Observation {
    id
    observationDuration {
      hours
    }
    instrument
    observingMode {
      mode
    }
    constraintSet {
      imageQuality
      cloudExtinction
      skyBackground
      waterVapor
    }
    targetEnvironment {
      firstScienceTarget {
        id
        name
        sidereal {
          ra {
            hms
            degrees
          }
          dec {
            dms
            degrees
          }
        }
      }
    }
  }
`);

/** Map one observation (selected via ObservationRowFields) to the shared
 *  table row. Non-sidereal targets have no fixed RA/Dec — shown as "—". */
export function mapObservationRow(o: ObservationRowFieldsFragment): ObservationRow {
  const target = o.targetEnvironment?.firstScienceTarget;
  const instrument = o.instrument ? normalizeInstrument(o.instrument) : '—';
  const modeSuffix = observingModeSuffix(o.observingMode?.mode ?? null);
  return {
    id: o.id,
    target: target?.name ?? '(no target)',
    ra: target?.sidereal?.ra.hms ?? '—',
    dec: target?.sidereal?.dec.dms ?? '—',
    raDeg: target?.sidereal ? Number(target.sidereal.ra.degrees) : null,
    decDeg: target?.sidereal ? Number(target.sidereal.dec.degrees) : null,
    modeType: o.observingMode?.mode ?? null,
    instrument,
    config: modeSuffix ? `${instrument}, ${modeSuffix}` : instrument,
    conditions: formatConditions(o.constraintSet),
    hours: Math.round(Number(o.observationDuration?.hours ?? 0) * 10) / 10,
  };
}

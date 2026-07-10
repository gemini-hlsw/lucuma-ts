/** Selections and mapping helpers shared by more than one view. */
import { graphql } from './gen';
import type { ObservationRowFieldsFragment } from './gen/graphql';
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
const IMAGE_QUALITY_ARCSEC: Record<string, string> = {
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
const CLOUD_EXTINCTION_PERCENT: Record<string, string> = {
  ZERO: '50',
  POINT_ONE: '55',
  POINT_THREE: '70',
  POINT_FIVE: '75',
  ONE_POINT_ZERO: '80',
  TWO_POINT_ZERO: '95',
  THREE_POINT_ZERO: '100',
};

/** SkyBackground's fixed percentile (lucuma-core SkyBackground.scala). */
const SKY_BACKGROUND_PERCENT: Record<string, string> = {
  DARKEST: '20',
  DARK: '50',
  GRAY: '80',
  BRIGHT: '100',
};

/** WaterVapor's fixed percentile (lucuma-core WaterVapor.scala). */
const WATER_VAPOR_PERCENT: Record<string, string> = {
  VERY_DRY: '20',
  DRY: '50',
  MEDIAN: '80',
  WET: '100',
};

function lookup(map: Record<string, string>, preset: string | null | undefined): string {
  return preset ? (map[preset] ?? preset) : '—';
}

export interface RawConditions {
  imageQuality: string | null;
  cloudExtinction: string | null;
  skyBackground: string | null;
  waterVapor: string | null;
}

/** Observing-conditions presets → the compact "IQ<0.8″ / CC70 / SB80 / WV80"
 *  form reviewers read in the observation tables. */
export function formatConditions(cond: RawConditions | null | undefined): string {
  if (!cond) return '—';
  return `IQ<${lookup(IMAGE_QUALITY_ARCSEC, cond.imageQuality)}″ / CC${lookup(CLOUD_EXTINCTION_PERCENT, cond.cloudExtinction)} / SB${lookup(SKY_BACKGROUND_PERCENT, cond.skyBackground)} / WV${lookup(WATER_VAPOR_PERCENT, cond.waterVapor)}`;
}

/** ObservingMode.mode enum ("GMOS_SOUTH_LONG_SLIT") → a short suffix for the
 *  Config column ("LongSlit"), with the instrument stated separately. */
function observingModeSuffix(mode: string | null): string {
  if (!mode) return '';
  const suffix = mode
    .replace(/^(GMOS_NORTH|GMOS_SOUTH|FLAMINGOS2|GHOST|GNIRS|IGRINS2)_?/, '')
    .toLowerCase()
    .replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
  return suffix ? suffix.charAt(0).toUpperCase() + suffix.slice(1) : '';
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

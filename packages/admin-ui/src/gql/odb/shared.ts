/** Selections and mapping helpers shared by more than one view. */
import { isNotNullish, parseNumber } from '@gemini-hlsw/lucuma-common-ui';
import { deg2dms, deg2hms } from '@gemini-hlsw/lucuma-core';

import { type Instrument, INSTRUMENT_LABEL, type ObservationRow, type TimingWindowRow } from '../types';
import { graphql } from './gen';
import type {
  CloudExtinctionPreset,
  GroupElementItemFragment,
  ImageQualityPreset,
  ObservationItemFragment,
  ObservingModeType,
  SkyBackground,
  WaterVapor,
} from './gen/graphql';

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
  FLAMINGOS_2_MOS: { instrument: 'Flamingos-2', mode: 'MOS' },
  GHOST_IFU: { instrument: 'GHOST', mode: 'Ifu' },
  GMOS_NORTH_IFU: { instrument: 'GMOS-N', mode: 'Ifu' },
  GMOS_NORTH_IMAGING: { instrument: 'GMOS-N', mode: 'Imaging' },
  GMOS_NORTH_LONG_SLIT: { instrument: 'GMOS-N', mode: 'LongSlit' },
  GMOS_NORTH_MOS: { instrument: 'GMOS-N', mode: 'MOS' },
  GMOS_SOUTH_IFU: { instrument: 'GMOS-S', mode: 'Ifu' },
  GMOS_SOUTH_IMAGING: { instrument: 'GMOS-S', mode: 'Imaging' },
  GMOS_SOUTH_LONG_SLIT: { instrument: 'GMOS-S', mode: 'LongSlit' },
  GMOS_SOUTH_MOS: { instrument: 'GMOS-S', mode: 'MOS' },
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
  fragment ObservationItem on Observation {
    id
    calibrationRole
    # Enclosing group id — when the science observation sits in a system
    # telluric-standard group, its "Time" is that group's combined estimate
    # (science + telluric), looked up in telluricGroupHours (sc-9598).
    groupId
    # observationDuration is unset until an observation is executed; the "Time"
    # column shows the estimated program time from the execution digest instead
    # (matching Explore). The digest is calculated asynchronously, so it may be
    # absent (PENDING) or fail per observation — mapped to 0 / "—" (sc-9598).
    execution {
      digest {
        value {
          estimate {
            total {
              program {
                hours
              }
            }
          }
        }
      }
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
    # Scheduling windows during which the observation may execute (sc-9621).
    # Empty = no timing constraints. The end is a union: an absolute close time
    # (At), a duration (After), or null (the window never closes).
    schedulingConstraints {
      timingWindows {
        inclusion
        startUtc
        end {
          __typename
          ... on TimingWindowEndAt {
            atUtc
          }
          ... on TimingWindowEndAfter {
            after {
              hours
            }
          }
        }
      }
    }
    targetEnvironment {
      firstScienceTarget {
        id
        name
        sidereal {
          ra {
            degrees
          }
          dec {
            degrees
          }
        }
      }
    }
  }
`);

/** A science observation, as opposed to an automatically-generated calibration
 *  ("system") observation (sc-9591). Calibrations carry a calibrationRole;
 *  science observations leave it null. The admin views show and check only
 *  science observations, so callers filter with this before mapping rows. */
export function isScienceObservation(o: Pick<ObservationItemFragment, 'calibrationRole'>): boolean {
  return o.calibrationRole === null;
}

/** Estimated program time (hours) from the execution digest, or null when the
 *  digest isn't available — it's calculated asynchronously and can be PENDING
 *  or fail for a single observation (e.g. an over-long sequence). */
export function observationDigestHours(o: ObservationItemFragment): number | null {
  const hours = o.execution.digest?.value?.estimate.total.program.hours;
  return parseNumber(hours) ?? null;
}

/** Built once and reused: constructing an Intl.DateTimeFormat is expensive
 *  relative to formatting, and this runs per timing window per observation.
 *  Read through formatToParts rather than format, so the "yyyy-MM-dd HH:mm"
 *  layout is ours rather than a locale's incidental ordering. */
const UTC_MINUTE_FORMAT = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/** Stands in for an observation whose target has no name, so a row always reads
 *  as something. Exported because callers that aggregate names (the Change
 *  Requests Target column) must drop it rather than list it as a target. */
export const NO_TARGET = '(no target)';

/** Join the distinct target names of a row's observations for display, e.g.
 *  "NGC 300, M31". Both the Change Requests table and the conflict rows resolve
 *  a name per observation and show the set: "—" when none of them names a
 *  target, since a configuration carries coordinates rather than a name.
 *  Entries that named nothing arrive here as undefined or as NO_TARGET and are
 *  dropped rather than listed as if they were names. */
export function joinTargetNames(names: readonly (string | undefined)[]): string {
  const named = Array.from(new Set(names)).filter((n) => isNotNullish(n) && n !== NO_TARGET);
  return named.length > 0 ? named.join(', ') : '—';
}

/** The coordinate precisions the story names (sc-10159 item 7): RA as
 *  HH:MM:SS.ss, Dec as DD:MM:SS.s. */
const RA_DECIMALS = 2;
const DEC_DECIMALS = 1;

/** Round `degrees` to `1 / step` of the unit `format` prints, format it, and
 *  cut the result back to `decimals` places.
 *
 *  The three steps belong together: the cut is only lossless because the
 *  rounding just put zeros in the digits it removes, so neither half is safe
 *  to call alone. The two precisions nest — a hundredth of a second of time is
 *  an exact multiple of the millisecond `deg2hms` rounds to, and a tenth of an
 *  arcsecond of the 10 mas `deg2dms` rounds to — so formatting cannot shift a
 *  value the rounding here already settled.
 *
 *  `deg2hms`/`deg2dms` wrap lucuma-core's `truncatedRA`/`truncatedDec`, which
 *  round (despite the name) to a millisecond of time and 10 mas — three and
 *  two decimals, the precision Explore's observation table shows. They are the
 *  only sexagesimal formatters lucuma-core exports to JS and neither takes a
 *  precision, so the one coarser step this story asks for is taken here. Both
 *  emit their decimals for whole values too ("02:00:00.000", "+30:00:00.00"),
 *  so the no-fraction branch is a guard, not a reachable path. */
function roundAndFormat(degrees: number, step: number, decimals: number, format: (degrees: number) => string): string {
  const angle = format(Math.round(degrees * step) / step);
  const dot = angle.indexOf('.');
  return dot === -1 ? angle : angle.slice(0, dot + 1 + decimals);
}

/** Right ascension in degrees as "HH:MM:SS.ss" (sc-10159 item 7).
 *
 *  Rounds to the nearest hundredth of a second of time. The ODB's own
 *  sexagesimal strings carry six decimals, far finer than a review needs, but
 *  they are not what gets rounded: rounding a seconds field in isolation
 *  cannot carry, so 23:59:59.9999 would reach the invalid "23:59:60.00".
 *  Rounding in degrees and reformatting lets the carry run through minutes and
 *  the 24h wrap on its own, giving "00:00:00.00". */
export function formatRa(degrees: number): string {
  // 240 = degrees to seconds of time; the 100 takes it to hundredths.
  return roundAndFormat(degrees, 240 * 100, RA_DECIMALS, deg2hms);
}

/** Declination in degrees as "DD:MM:SS.s" (sc-10159 item 7).
 *
 *  Rounds to the nearest tenth of an arcsecond before formatting, so a rounded
 *  second carries into the minutes: +20:55:59.999 becomes +20:56:00.0. The
 *  carry happens in degrees — `deg2dms` itself reflects rather than carries
 *  past the pole, giving +89:59:59.96 for both 89.99999 and 90.00001.
 *
 *  Rounding the magnitude keeps a southern declination rounding away from zero
 *  exactly as a northern one does.
 *
 *  `toAngle` is deliberately not used here: it is unsigned, so a declination of
 *  -07:57:07.4 would render as 352:02:52.6.
 *
 *  A declination less than 0.05" south of the equator rounds to zero and
 *  renders "+00:00:00.0" — the rounded value is zero, which carries no sign.
 *  lucuma-core's `truncatedDec` normalises the same way at its own precision. */
export function formatDec(degrees: number): string {
  // Round the magnitude and restore the sign, so south rounds away from zero
  // as north does. 3600 = degrees to arcseconds; the 10 takes it to tenths.
  const sign = degrees < 0 ? -1 : 1;
  return roundAndFormat(Math.abs(degrees), 3600 * 10, DEC_DECIMALS, (d) => deg2dms(sign * d));
}

/** Render an ODB Timestamp to minute precision in UTC, e.g.
 *  "2024-01-30 14:55 UTC". Scheduling windows and submission times are
 *  inherently UTC (Explore shows them "… UTC"); common-ui's formatDateTime
 *  renders in the browser's zone and would silently shift each one by the
 *  viewer's offset — the same instant reads 04:55 in Hawaii and 23:55 in Tokyo. */
export function formatUtcMinute(iso: string): string {
  const parts = new Map(UTC_MINUTE_FORMAT.formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
  // Every part requested above is always emitted; the "" can only be reached if
  // that option list and these lookups disagree.
  const at = (type: Intl.DateTimeFormatPartTypes): string => parts.get(type) ?? '';
  return `${at('year')}-${at('month')}-${at('day')} ${at('hour')}:${at('minute')} UTC`;
}

/** Format an observation's scheduling windows for display (sc-9621), mirroring
 *  Explore's wording: "Include <start> through <end>" (absolute end), "… for N h"
 *  (a duration), or "… forever" (no end). Times are UTC. */
function mapTimingWindows(
  windows: ObservationItemFragment['schedulingConstraints']['timingWindows'],
): TimingWindowRow[] {
  return windows.map((w) => {
    const verb = w.inclusion === 'INCLUDE' ? 'Include' : 'Exclude';
    const start = formatUtcMinute(w.startUtc);
    let end: string;
    if (w.end === null) {
      end = 'forever';
    } else if (w.end.__typename === 'TimingWindowEndAt') {
      end = `through ${formatUtcMinute(w.end.atUtc)}`;
    } else {
      // Written out rather than via Intl.NumberFormat's `unit: 'hour'`, which
      // renders "3 hr"/"3 hours"; Explore writes durations "N h" and these
      // windows are read alongside it.
      // TimeSpan.hours is a schema-non-null number (string|number scalar);
      // normalize it, but fall back to the raw value rather than a misleading
      // "0 h" in the can't-happen case where it doesn't parse.
      end = `for ${parseNumber(w.end.after.hours) ?? w.end.after.hours} h`;
    }
    return { inclusion: w.inclusion, label: `${verb} ${start} ${end}` };
  });
}

/** Map one observation (selected via ObservationItem) to the shared table row.
 *  Non-sidereal targets have no fixed RA/Dec — shown as "—". `telluricHoursByGroup`
 *  (from telluricGroupHours) maps a group id to its combined science+telluric
 *  estimate (sc-9598): when the observation belongs to such a group, that total
 *  is its "Time"; otherwise the observation's own digest estimate is used. */
export function mapObservationRow(
  o: ObservationItemFragment,
  telluricHoursByGroup?: ReadonlyMap<string, number>,
): ObservationRow {
  const target = o.targetEnvironment?.firstScienceTarget;
  const instrument = o.instrument ? normalizeInstrument(o.instrument) : '—';
  const modeSuffix = observingModeSuffix(o.observingMode?.mode ?? null);
  // A null/absent group simply misses the telluric-group map.
  const groupHours = o.groupId === null ? undefined : telluricHoursByGroup?.get(o.groupId);
  const hours = groupHours ?? observationDigestHours(o) ?? 0;
  const raDeg = parseNumber(target?.sidereal?.ra.degrees) ?? null;
  const decDeg = parseNumber(target?.sidereal?.dec.degrees) ?? null;
  return {
    id: o.id,
    target: target?.name ?? NO_TARGET,
    ra: raDeg === null ? '—' : formatRa(raDeg),
    dec: decDeg === null ? '—' : formatDec(decDeg),
    raDeg,
    decDeg,
    modeType: o.observingMode?.mode ?? null,
    instrument,
    config: modeSuffix ? `${instrument}, ${modeSuffix}` : instrument,
    conditions: formatConditions(o.constraintSet),
    hours: Math.round(hours * 10) / 10,
    windows: mapTimingWindows(o.schedulingConstraints.timingWindows),
  };
}

/** Selection for a program's group elements, used to find the system telluric
 *  groups whose combined time rolls into their science observation's row
 *  (sc-9598). Only the id and the fields telluricGroupHours reads are taken. */
export const GROUP_ELEMENT_FRAGMENT = graphql(`
  fragment GroupElementItem on GroupElement {
    group {
      id
      system
      calibrationRoles
      timeEstimateRange {
        value {
          maximum {
            program {
              hours
            }
          }
        }
      }
    }
  }
`);

/** Map each system telluric-standard group's id to its combined science+telluric
 *  program-time estimate (sc-9598). A science observation in one of these groups
 *  shows this total as its "Time"; observations elsewhere use their own digest.
 *  Groups without a settled estimate (calculation pending) are omitted, so those
 *  rows fall back to the observation's own estimate. */
export function telluricGroupHours(elements: readonly GroupElementItemFragment[]): ReadonlyMap<string, number> {
  const byGroup = new Map<string, number>();
  for (const { group } of elements) {
    if (group === null || !group.system || !group.calibrationRoles.includes('TELLURIC')) continue;
    const hours = group.timeEstimateRange?.value?.maximum.program.hours;
    if (hours !== undefined) byGroup.set(group.id, parseNumber(hours));
  }
  return byGroup;
}

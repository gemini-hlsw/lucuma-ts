import { dms2deg, hms2deg } from '@gemini-hlsw/lucuma-core';
import { describe, expect, it } from 'vitest';

import { executionDigest } from '@/test/factories';

import type { GroupElementItemFragment, ObservationItemFragment } from './gen/graphql';
import {
  formatConditions,
  formatDec,
  formatRa,
  isScienceObservation,
  joinTargetNames,
  mapObservationRow,
  NO_TARGET,
  telluricGroupHours,
} from './shared';

function observation(overrides: Partial<ObservationItemFragment>): ObservationItemFragment {
  return {
    __typename: 'Observation',
    id: 'o-1',
    calibrationRole: null,
    groupId: null,
    execution: executionDigest(1.25),
    instrument: 'GMOS_SOUTH',
    observingMode: { __typename: 'ObservingMode', mode: 'GMOS_SOUTH_LONG_SLIT' },
    constraintSet: {
      __typename: 'ConstraintSet',
      imageQuality: 'POINT_EIGHT',
      cloudExtinction: 'POINT_THREE',
      skyBackground: 'GRAY',
      waterVapor: 'WET',
    },
    schedulingConstraints: { __typename: 'SchedulingConstraints', timingWindows: [] },
    targetEnvironment: {
      __typename: 'TargetEnvironment',
      firstScienceTarget: {
        __typename: 'Target',
        id: 't-1',
        name: 'NGC 300',
        sidereal: {
          __typename: 'Sidereal',
          ra: { __typename: 'RightAscension', degrees: 13.723 },
          dec: { __typename: 'Declination', degrees: -37.684 },
        },
      },
    },
    ...overrides,
  };
}

describe(mapObservationRow, () => {
  it('states the instrument once, with the observing mode as a short suffix', () => {
    expect(mapObservationRow(observation({})).config).toBe('GMOS-S, LongSlit');
  });

  it('strips instrument prefixes whose enum form has an underscore before the digit', () => {
    // Regression: FLAMINGOS_2_* / IGRINS_2_* were matched as FLAMINGOS2/IGRINS2
    // and never stripped, rendering "Flamingos-2, Flamingos_2LongSlit".
    const f2 = observation({
      instrument: 'FLAMINGOS2',
      observingMode: { __typename: 'ObservingMode', mode: 'FLAMINGOS_2_LONG_SLIT' },
    });
    expect(mapObservationRow(f2).config).toBe('Flamingos-2, LongSlit');
  });

  it('shows the target coordinates at the display precision, not the ODB\u2019s six decimals', () => {
    // The Observations table sits directly under the trimmed coordinate columns
    // on the Change Requests page, so it must not show a finer value (sc-10159
    // item 7).
    const row = mapObservationRow(
      observation({
        targetEnvironment: {
          __typename: 'TargetEnvironment',
          firstScienceTarget: {
            __typename: 'Target',
            id: 't-3',
            name: 'NGC 300',
            sidereal: {
              __typename: 'Sidereal',
              ra: { __typename: 'RightAscension', degrees: 13.721347733333333 },
              dec: { __typename: 'Declination', degrees: -37.68471879277778 },
            },
          },
        },
      }),
    );
    expect(row.ra).toBe('00:54:53.12');
    expect(row.dec).toBe('-37:41:05.0');
  });

  it('shows non-sidereal targets without coordinates', () => {
    const row = mapObservationRow(
      observation({
        targetEnvironment: {
          __typename: 'TargetEnvironment',
          firstScienceTarget: { __typename: 'Target', id: 't-2', name: 'Ceres', sidereal: null },
        },
      }),
    );
    expect(row.ra).toBe('—');
    expect(row.raDeg).toBeNull();
  });

  it('takes its Time from the execution digest, rounded to a tenth of an hour (sc-9598)', () => {
    expect(mapObservationRow(observation({ execution: executionDigest(1.23456) })).hours).toBe(1.2);
  });

  it('shows 0 hours when the digest is unavailable (calculation pending or failed) (sc-9598)', () => {
    expect(mapObservationRow(observation({ execution: executionDigest(null) })).hours).toBe(0);
  });

  it('renders each scheduling window as an inclusion verb, start, and end (sc-9621)', () => {
    const row = mapObservationRow(
      observation({
        schedulingConstraints: {
          __typename: 'SchedulingConstraints',
          timingWindows: [
            {
              __typename: 'TimingWindow',
              inclusion: 'INCLUDE',
              startUtc: '2024-01-30T14:55:00Z',
              end: null,
            },
            {
              __typename: 'TimingWindow',
              inclusion: 'EXCLUDE',
              startUtc: '2024-01-31T14:31:27.866Z',
              end: { __typename: 'TimingWindowEndAt', atUtc: '2024-01-31T15:31:27.866Z' },
            },
            {
              __typename: 'TimingWindow',
              inclusion: 'INCLUDE',
              startUtc: '2024-01-31T14:31:53.643Z',
              end: { __typename: 'TimingWindowEndAfter', after: { __typename: 'TimeSpan', hours: 48 } },
            },
          ],
        },
      }),
    );
    // Windows are rendered in UTC to the minute (never the viewer's local zone).
    expect(row.windows.map((w) => w.label)).toEqual([
      'Include 2024-01-30 14:55 UTC forever',
      'Exclude 2024-01-31 14:31 UTC through 2024-01-31 15:31 UTC',
      'Include 2024-01-31 14:31 UTC for 48 h',
    ]);
    expect(row.windows.map((w) => w.inclusion)).toEqual(['INCLUDE', 'EXCLUDE', 'INCLUDE']);
  });

  it('uses the telluric group total for an observation in a system telluric group (sc-9598)', () => {
    // The science observation's own digest is 0.27h, but its telluric group's
    // combined estimate is 0.53h (science + telluric) — that total is its Time.
    const row = mapObservationRow(
      observation({ groupId: 'g-1', execution: executionDigest(0.27) }),
      new Map([['g-1', 0.53]]),
    );
    expect(row.hours).toBe(0.5);
  });
});

describe(telluricGroupHours, () => {
  const groupElement = (
    id: string,
    system: boolean,
    roles: readonly ('TELLURIC' | 'TWILIGHT')[],
    hours: number | null,
  ): GroupElementItemFragment => ({
    __typename: 'GroupElement',
    group: {
      __typename: 'Group',
      id,
      system,
      calibrationRoles: [...roles],
      timeEstimateRange:
        hours === null
          ? null
          : {
              __typename: 'CalculatedCategorizedTimeRange',
              value: {
                __typename: 'CategorizedTimeRange',
                maximum: { __typename: 'CategorizedTime', program: { __typename: 'TimeSpan', hours } },
              },
            },
    },
  });

  it('maps only settled system telluric groups to their combined program hours', () => {
    const map = telluricGroupHours([
      groupElement('g-tel', true, ['TELLURIC'], 0.53),
      groupElement('g-user', false, ['TELLURIC'], 0.9), // user group — ignored
      groupElement('g-twi', true, ['TWILIGHT'], 0.1), // not telluric — ignored
      groupElement('g-pending', true, ['TELLURIC'], null), // no estimate yet — omitted
      { __typename: 'GroupElement', group: null }, // an observation element — skipped
    ]);
    expect(map).toEqual(new Map([['g-tel', 0.53]]));
  });
});

describe(formatConditions, () => {
  it('renders each condition from its preset map', () => {
    expect(
      formatConditions({
        imageQuality: 'POINT_EIGHT',
        cloudExtinction: 'POINT_THREE',
        skyBackground: 'GRAY',
        waterVapor: 'WET',
      }),
    ).toBe('IQ<0.8″ / CC70 / SB80 / WV100');
    expect(
      formatConditions({
        imageQuality: 'TWO_POINT_ZERO',
        cloudExtinction: 'THREE_POINT_ZERO',
        skyBackground: 'DARKEST',
        waterVapor: 'VERY_DRY',
      }),
    ).toBe('IQ<2.0″ / CC100 / SB20 / WV20');
  });

  it('dashes missing presets and missing constraint sets', () => {
    expect(formatConditions({ imageQuality: null, cloudExtinction: null, skyBackground: null, waterVapor: null })).toBe(
      'IQ<—″ / CC— / SB— / WV—',
    );
    expect(formatConditions(null)).toBe('—');
  });
});

describe(isScienceObservation, () => {
  it('accepts science observations (no calibration role) and rejects calibrations', () => {
    expect(isScienceObservation({ calibrationRole: null })).toBe(true);
    expect(isScienceObservation({ calibrationRole: 'TWILIGHT' })).toBe(false);
    expect(isScienceObservation({ calibrationRole: 'SPECTROPHOTOMETRIC' })).toBe(false);
  });
});

describe(joinTargetNames, () => {
  it('lists distinct names in order, comma-separated', () => {
    expect(joinTargetNames(['M31', 'M32'])).toBe('M31, M32');
  });

  it('collapses repeats of the same target to one entry', () => {
    expect(joinTargetNames(['NGC 300', 'NGC 300'])).toBe('NGC 300');
  });

  it.each([
    ['an observation that resolved to nothing', [undefined]],
    ['an observation whose target has no name', [NO_TARGET]],
    ['nothing at all', []],
  ])('reads as a dash when every entry is %s', (_case, names) => {
    expect(joinTargetNames(names)).toBe('—');
  });

  it('keeps the real names alongside unusable entries rather than listing those', () => {
    // The placeholder and the unresolved id must not appear as if they were
    // targets — this is the whole reason NO_TARGET is exported.
    expect(joinTargetNames(['M31', NO_TARGET, undefined, 'M32'])).toBe('M31, M32');
  });
});

describe('coordinate formatting', () => {
  it('shows RA to hundredths and Dec to tenths of a second (sc-10159 item 7)', () => {
    expect(formatRa(hms2deg('01:01:45.034320'))).toBe('01:01:45.03');
    expect(formatDec(dms2deg('+20:55:43.744800'))).toBe('+20:55:43.7');
  });

  it('rounds rather than truncates', () => {
    // Cutting the formatted string instead would bias every value low: these
    // four each sit above the halfway mark and would lose that digit.
    expect(formatDec(dms2deg('+17:33:56.39'))).toBe('+17:33:56.4');
    expect(formatDec(dms2deg('-17:33:56.39'))).toBe('-17:33:56.4');
    expect(formatRa(hms2deg('03:47:31.866'))).toBe('03:47:31.87');
    expect(formatRa(hms2deg('01:01:45.036'))).toBe('01:01:45.04');
  });

  it('carries a rounded second into the minutes rather than showing 60', () => {
    // The reason the first attempt truncated: rounding the seconds field in
    // isolation would produce the invalid "+20:55:60.0". Rounding in degrees
    // and reformatting carries properly.
    expect(formatDec(dms2deg('+20:55:59.999000'))).toBe('+20:56:00.0');
    expect(formatRa(hms2deg('01:01:59.999'))).toBe('01:02:00.00');
  });

  it('wraps a rounded RA at 24h, and rounds a Dec up to the pole itself', () => {
    expect(formatRa(hms2deg('23:59:59.999999'))).toBe('00:00:00.00');
    // Reaching +90 is this function's own rounding, not a carry inside
    // `deg2dms` — that reflects past the pole rather than carrying.
    expect(formatDec(dms2deg('+89:59:59.999'))).toBe('+90:00:00.0');
    expect(formatDec(dms2deg('-89:59:59.999'))).toBe('-90:00:00.0');
  });

  it('keeps the sign of a southern declination, rounding away from zero', () => {
    expect(formatDec(dms2deg('-00:00:00.499'))).toBe('-00:00:00.5');
    expect(formatDec(dms2deg('-89:59:59.999'))).toBe('-90:00:00.0');
  });

  it('drops the sign only where the declination rounds to zero', () => {
    // The rounded value is zero, which carries no sign. Just past the
    // boundary the sign survives, so this is the whole extent of it.
    expect(formatDec(-0.0499 / 3600)).toBe('+00:00:00.0');
    expect(formatDec(-0.05 / 3600)).toBe('-00:00:00.1');
  });

  it('renders an exact value with the full requested precision', () => {
    expect(formatRa(hms2deg('02:00:00'))).toBe('02:00:00.00');
    expect(formatDec(dms2deg('+00:00:00'))).toBe('+00:00:00.0');
  });
});

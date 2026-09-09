import { describe, expect, it } from 'vitest';

import { executionDigest } from '@/test/factories';

import type { GroupElementItemFragment, ObservationItemFragment } from './gen/graphql';
import {
  DEC_DECIMALS,
  formatConditions,
  isScienceObservation,
  joinTargetNames,
  mapObservationRow,
  NO_TARGET,
  RA_DECIMALS,
  telluricGroupHours,
  trimSexagesimal,
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
          ra: { __typename: 'RightAscension', hms: '00:54:53', degrees: 13.723 },
          dec: { __typename: 'Declination', dms: '-37:41:04', degrees: -37.684 },
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
              ra: { __typename: 'RightAscension', hms: '00:54:53.123456', degrees: 13.723 },
              dec: { __typename: 'Declination', dms: '-37:41:04.987654', degrees: -37.684 },
            },
          },
        },
      }),
    );
    expect(row.ra).toBe('00:54:53.12');
    expect(row.dec).toBe('-37:41:04.9');
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

describe(trimSexagesimal, () => {
  it('shows RA to hundredths and Dec to tenths of a second (sc-10159 item 7)', () => {
    expect(trimSexagesimal('01:01:45.034320', RA_DECIMALS)).toBe('01:01:45.03');
    expect(trimSexagesimal('+20:55:43.744800', DEC_DECIMALS)).toBe('+20:55:43.7');
  });

  it('truncates rather than rounds, so seconds can never reach 60', () => {
    // Rounding the seconds field alone cannot carry into the minutes, so
    // "+20:55:59.999" would become the invalid "+20:55:60.0".
    expect(trimSexagesimal('+20:55:59.999000', DEC_DECIMALS)).toBe('+20:55:59.9');
  });

  it('leaves a value with no fractional part, and a placeholder, alone', () => {
    expect(trimSexagesimal('02:00:00', RA_DECIMALS)).toBe('02:00:00');
    expect(trimSexagesimal('—', RA_DECIMALS)).toBe('—');
  });

  it('keeps the sign of a southern declination', () => {
    expect(trimSexagesimal('-07:57:07.397999', DEC_DECIMALS)).toBe('-07:57:07.3');
  });
});

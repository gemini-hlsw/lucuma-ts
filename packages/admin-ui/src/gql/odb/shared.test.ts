import { describe, expect, it } from 'vitest';

import { executionDigest } from '@/test/factories';

import type { GroupElementItemFragment, ObservationItemFragment } from './gen/graphql';
import { formatConditions, isScienceObservation, mapObservationRow, telluricGroupHours } from './shared';

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

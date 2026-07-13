import { describe, expect, it } from 'vitest';

import type { ObservationItemFragment } from './odb/gen/graphql';
import { formatConditions, mapObservationRow } from './shared';

function observation(overrides: Partial<ObservationItemFragment>): ObservationItemFragment {
  return {
    __typename: 'Observation',
    id: 'o-1',
    observationDuration: { __typename: 'TimeSpan', hours: 1.25 },
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

describe('mapObservationRow', () => {
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
});

describe('formatConditions', () => {
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

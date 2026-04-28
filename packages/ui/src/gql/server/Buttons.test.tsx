import { CAL_PARAMS } from '@gql/configs/CalParams';
import { GET_CONFIGURATION } from '@gql/configs/Configuration';
import { GET_INSTRUMENT } from '@gql/configs/Instrument';
import { GET_ROTATOR } from '@gql/configs/Rotator';
import { GET_TARGETS } from '@gql/configs/Target';
import type { MockedResponseOf } from '@gql/util';
import type { VariablesOf } from '@graphql-typed-document-node/core';
import { userEvent } from 'vitest/browser';

import {
  createCalParams,
  createConfiguration,
  createInstrumentConfig,
  createProperMotion,
  createRA,
  createRotator,
  createSidereal,
  createTarget,
} from '@/test/create';
import { operationOutcome } from '@/test/helpers';
import { renderWithContext } from '@/test/render';

import { OIWFS, Slew } from './Buttons';
import { OIWFS_FOLLOW_MUTATION } from './follow';
import { GET_INSTRUMENT_PORT } from './Instrument';
import { SLEW_MUTATION } from './Slew';

describe(Slew.name, () => {
  it('should call slew mutation when pressed', async () => {
    const sut = await renderWithContext(<Slew label="Slew Telescope" />, {
      mocks: [
        configurationMock,
        instrumentPortMock,
        rotatorMock,
        instrumentMock,
        getTargetsMock,
        slewMutationMock,
        calParamsMock,
      ],
    });
    await userEvent.click(sut.getByRole('button'));

    expect(slewMutationMock.request.variables).toHaveBeenCalledOnce();
    const variables = slewMutationMock.request.variables.mock.calls[0]?.[0] as VariablesOf<typeof SLEW_MUTATION>;
    expect(variables).toMatchInlineSnapshot(`
      {
        "config": {
          "baffles": {
            "autoConfig": {
              "nearirLimit": {
                "micrometers": 3,
              },
              "visibleLimit": {
                "micrometers": 1.05,
              },
            },
          },
          "instParams": {
            "agName": "ACQ_CAM",
            "focusOffset": {
              "millimeters": 0,
            },
            "iaa": {
              "degrees": 0,
            },
            "origin": {
              "x": {
                "arcseconds": 0,
              },
              "y": {
                "arcseconds": 0,
              },
            },
          },
          "instrument": "ACQ_CAM",
          "oiwfs": undefined,
          "pwfs1": undefined,
          "pwfs2": undefined,
          "rotator": {
            "ipa": {
              "degrees": 0,
            },
            "mode": "TRACKING",
          },
          "sourceATarget": {
            "azel": undefined,
            "id": "t-4e16",
            "name": "WG  22",
            "nonsidereal": undefined,
            "sidereal": {
              "dec": {
                "dms": "-49:48:00.219525",
              },
              "epoch": "J2000.000",
              "parallax": {
                "microarcseconds": 789.123,
              },
              "properMotion": {
                "dec": {
                  "microarcsecondsPerYear": 654321,
                },
                "ra": {
                  "microarcsecondsPerYear": 123456,
                },
              },
              "ra": {
                "hms": "12:38:49.781122",
              },
              "radialVelocity": {
                "centimetersPerSecond": 321.654,
              },
            },
            "wavelength": {
              "nanometers": 630,
            },
          },
        },
        "obsId": "o-3580",
        "slewOptions": {
          "autoparkAowfs": false,
          "autoparkGems": true,
          "autoparkOiwfs": false,
          "autoparkPwfs1": false,
          "autoparkPwfs2": true,
          "resetPointing": true,
          "shortcircuitMountFilter": true,
          "shortcircuitTargetFilter": false,
          "stopGuide": true,
          "zeroChopThrow": true,
          "zeroGuideOffset": false,
          "zeroInstrumentOffset": true,
          "zeroMountDiffTrack": true,
          "zeroMountOffset": true,
          "zeroSourceDiffTrack": true,
          "zeroSourceOffset": true,
        },
      }
    `);
  });
});

describe(OIWFS.name, () => {
  it('should render OIWFS follow state', async () => {
    const sut = await renderWithContext(
      <OIWFS state={{ __typename: 'MechSystemState', follow: 'FOLLOWING', parked: 'NOT_PARKED' }} inUse={true} />,
      {},
    );

    const button = sut.getByRole('button');
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('title', 'Following, Not parked, Used subsystem');
  });

  it('calls mutation on click', async () => {
    const sut = await renderWithContext(
      <OIWFS state={{ __typename: 'MechSystemState', follow: 'NOT_FOLLOWING', parked: 'PARKED' }} inUse={false} />,
      {
        mocks: [oiwfsFollowMutationMock],
      },
    );
    const button = sut.getByRole('button');
    await userEvent.click(button);

    expect(oiwfsFollowMutationMock.request.variables).toHaveBeenCalledExactlyOnceWith({
      enable: true,
    });
  });

  it('calls disable when already following', async () => {
    const sut = await renderWithContext(
      <OIWFS state={{ __typename: 'MechSystemState', follow: 'FOLLOWING', parked: 'PARKED' }} inUse={false} />,
      {
        mocks: [oiwfsFollowMutationMock],
      },
    );
    const button = sut.getByRole('button');
    await userEvent.click(button);

    expect(oiwfsFollowMutationMock.request.variables).toHaveBeenCalledExactlyOnceWith({
      enable: false,
    });
  });
});

const configurationMock = {
  request: {
    query: GET_CONFIGURATION,
    variables: () => true,
  },
  result: {
    data: {
      configuration: createConfiguration({
        selectedTarget: 8,
        obsId: 'o-3580',
      }),
    },
  },
} satisfies MockedResponseOf<typeof GET_CONFIGURATION>;

const instrumentPortMock = {
  request: {
    query: GET_INSTRUMENT_PORT,
    variables: () => true,
  },
  maxUsageCount: Infinity,
  result: {
    data: {
      instrumentPort: 3,
    },
  },
} satisfies MockedResponseOf<typeof GET_INSTRUMENT_PORT>;

const rotatorMock = {
  request: {
    query: GET_ROTATOR,
    variables: {},
  },
  result: {
    data: {
      rotator: createRotator(),
    },
  },
} satisfies MockedResponseOf<typeof GET_ROTATOR>;

const instrumentMock = {
  request: {
    query: GET_INSTRUMENT,
    variables: () => true,
  },
  maxUsageCount: Infinity,
  result: {
    data: {
      instrument: createInstrumentConfig({
        name: 'ACQ_CAM',
        iaa: 0,
        issPort: 1,
      }),
    },
  },
} satisfies MockedResponseOf<typeof GET_INSTRUMENT>;

const getTargetsMock = {
  request: {
    query: GET_TARGETS,
  },
  result: {
    data: {
      targets: [
        createTarget({
          pk: 8,
          id: 't-4e16',
          name: 'WG  22',
          sidereal: createSidereal({
            ra: createRA({ degrees: 189.7074213416667, hms: '12:38:49.781122' }),
            properMotion: createProperMotion({
              ra: 123456,
              dec: 654321,
            }),
            parallax: 789.123,
            radialVelocity: 321.654,
          }),
          wavelength: 630,
        }),
      ],
    },
  },
} satisfies MockedResponseOf<typeof GET_TARGETS>;

const slewMutationMock = {
  request: {
    query: SLEW_MUTATION,
    variables: vi.fn().mockReturnValue(true),
  },
  result: {
    data: { slew: operationOutcome },
  },
} satisfies MockedResponseOf<typeof SLEW_MUTATION>;

const calParamsMock = {
  request: {
    query: CAL_PARAMS,
    variables: () => true,
  },
  result: {
    data: {
      calParams: createCalParams(),
    },
  },
} satisfies MockedResponseOf<typeof CAL_PARAMS>;

const oiwfsFollowMutationMock = {
  request: {
    query: OIWFS_FOLLOW_MUTATION,
    variables: vi.fn().mockReturnValue(true),
  },
  result: {
    data: {
      oiwfsFollow: operationOutcome,
    },
  },
} satisfies MockedResponseOf<typeof OIWFS_FOLLOW_MUTATION>;

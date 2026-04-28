import { CAL_PARAMS } from '@gql/configs/CalParams';
import { GET_CONFIGURATION } from '@gql/configs/Configuration';
import { GET_INSTRUMENT } from '@gql/configs/Instrument';
import { GET_ROTATOR } from '@gql/configs/Rotator';
import { GET_TARGETS } from '@gql/configs/Target';
import { GET_INSTRUMENT_PORT } from '@gql/server/Instrument';
import { NAVIGATE_STATE, NAVIGATE_STATE_SUBSCRIPTION } from '@gql/server/NavigateState';
import { RESTORE_TARGET_MUTATION, SWAP_TARGET_MUTATION } from '@gql/server/TargetSwap';
import type { MockedResponseOf } from '@gql/util';
import { userEvent } from 'vitest/browser';
import type { RenderResult } from 'vitest-browser-react';

import {
  createCalParams,
  createConfiguration,
  createDec,
  createInstrumentConfig,
  createRA,
  createRotator,
  createSidereal,
  createTarget,
} from '@/test/create';
import { operationOutcome } from '@/test/helpers';
import { renderWithContext } from '@/test/render';

import { TargetSwapButton } from './TargetSwapButton';

describe(TargetSwapButton.name, () => {
  let sut: RenderResult;

  describe('onSwappedTarget is false', () => {
    beforeEach(async () => {
      sut = await renderWithContext(
        <TargetSwapButton
          configurationPk={1}
          guiderTargets={[selectedOi]}
          selectedGuider={selectedOi}
          loading={false}
        />,
        {
          mocks: [...mocks, ...navigateStatesMock(false)],
        },
      );
      // wait for state to load
      await expect.element(sut.getByRole('button')).toBeEnabled();
    });

    it('should render', async () => {
      await expect.element(sut.getByRole('button')).toHaveTextContent('Point to Guide Star');
      await expect.element(sut.getByRole('button')).not.toHaveClass('p-button-danger');
    });

    it('should swap target when onSwappedTarget is false', async () => {
      await userEvent.click(sut.getByRole('button'));

      expect(swapTargetMock.request.variables).toHaveBeenCalledExactlyOnceWith({
        swapConfig: {
          acParams: {
            iaa: { degrees: 359.856 },
            focusOffset: { millimeters: 0 },
            agName: 'GMOS_NORTH',
            origin: { x: { arcseconds: 0 }, y: { arcseconds: 0 } },
          },
          rotator: { ipa: { degrees: 0 }, mode: 'TRACKING' },
          guideTarget: {
            id: selectedOi.id,
            name: selectedOi.name,
            sidereal: {
              ra: { hms: selectedOi.sidereal!.ra!.hms },
              dec: { dms: selectedOi.sidereal!.dec!.dms },
              epoch: selectedOi.sidereal!.epoch,
              properMotion: {
                ra: {
                  microarcsecondsPerYear: selectedOi.sidereal?.properMotion?.ra,
                },
                dec: {
                  microarcsecondsPerYear: selectedOi.sidereal?.properMotion?.dec,
                },
              },
              radialVelocity: {
                centimetersPerSecond: selectedOi.sidereal?.radialVelocity,
              },
              parallax: {
                microarcseconds: selectedOi.sidereal?.parallax,
              },
            },
          },
        },
      });
    });
  });

  describe('onSwappedTarget is true', () => {
    beforeEach(async () => {
      sut = await renderWithContext(
        <TargetSwapButton
          configurationPk={1}
          guiderTargets={[selectedOi]}
          selectedGuider={selectedOi}
          loading={false}
        />,
        {
          mocks: [...mocks, ...navigateStatesMock(true)],
        },
      );
      // wait for state to load
      await expect.element(sut.getByRole('button')).toBeEnabled();
    });

    it('should restore target', async () => {
      await expect.element(sut.getByRole('button')).toHaveTextContent('Point to Base');
      await expect.element(sut.getByRole('button')).toHaveClass('p-button-danger');

      await userEvent.click(sut.getByRole('button'));

      expect(restoreTargetMock.request.variables).toHaveBeenCalledExactlyOnceWith({
        config: {
          baffles: {
            autoConfig: {
              nearirLimit: {
                micrometers: 3,
              },
              visibleLimit: {
                micrometers: 1.05,
              },
            },
          },
          instParams: {
            agName: 'GMOS_NORTH',
            focusOffset: {
              millimeters: 0,
            },
            iaa: {
              degrees: 359.856,
            },
            origin: {
              x: {
                arcseconds: 0,
              },
              y: {
                arcseconds: 0,
              },
            },
          },
          instrument: 'GMOS_NORTH',
          oiwfs: undefined,
          pwfs1: undefined,
          pwfs2: undefined,
          rotator: {
            ipa: {
              degrees: 0,
            },
            mode: 'TRACKING',
          },
          sourceATarget: {
            azel: undefined,
            id: 't-19e',
            name: 'TYC 4517-185-1',
            sidereal: {
              dec: {
                dms: '+80:04:21.618990',
              },
              epoch: 'J2000.000',
              parallax: {
                microarcseconds: 0,
              },
              properMotion: {
                dec: {
                  microarcsecondsPerYear: 0,
                },
                ra: {
                  microarcsecondsPerYear: 0,
                },
              },
              ra: {
                hms: '03:46:46.901006',
              },
              radialVelocity: {
                centimetersPerSecond: 0,
              },
            },
            wavelength: {
              nanometers: 100,
            },
          },
        },
      });
    });
  });
});

const selectedTarget = createTarget({
  sidereal: createSidereal({
    ra: createRA({
      degrees: 56.69542085833334,
      hms: '03:46:46.901006',
    }),
    dec: createDec({ degrees: 80.07267194527778, dms: '+80:04:21.618990' }),
  }),
});

const selectedOi = createTarget({
  pk: 10,
  id: 't-000',
  name: 'OI Target',
  type: 'OIWFS',
  wavelength: null,
});

const restoreTargetMock = {
  request: {
    query: RESTORE_TARGET_MUTATION,
    variables: vi.fn().mockReturnValue(true),
  },
  result: {
    data: { restoreTarget: operationOutcome },
  },
} satisfies MockedResponseOf<typeof RESTORE_TARGET_MUTATION>;

const swapTargetMock = {
  request: {
    query: SWAP_TARGET_MUTATION,
    variables: vi.fn().mockReturnValue(true),
  },
  result: {
    data: { swapTarget: operationOutcome },
  },
} satisfies MockedResponseOf<typeof SWAP_TARGET_MUTATION>;

const mocks = [
  {
    request: {
      query: GET_ROTATOR,
      variables: {},
    },
    result: {
      data: {
        rotator: createRotator(),
      },
    },
  } satisfies MockedResponseOf<typeof GET_ROTATOR>,
  {
    request: {
      query: GET_INSTRUMENT,
      variables: () => true,
    },
    maxUsageCount: Infinity,
    result: {
      data: {
        instrument: createInstrumentConfig({
          wfs: 'OIWFS',
        }),
      },
    },
  } satisfies MockedResponseOf<typeof GET_INSTRUMENT>,
  swapTargetMock,
  restoreTargetMock,
  {
    request: {
      query: GET_CONFIGURATION,
      variables: () => true,
    },
    result: {
      data: {
        configuration: createConfiguration({
          selectedTarget: 3,
          selectedOiTarget: 8,
        }),
      },
    },
  } satisfies MockedResponseOf<typeof GET_CONFIGURATION>,
  {
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
  } satisfies MockedResponseOf<typeof GET_INSTRUMENT_PORT>,
  {
    request: {
      query: CAL_PARAMS,
      variables: () => true,
    },
    result: {
      data: {
        calParams: createCalParams(),
      },
    },
  } satisfies MockedResponseOf<typeof CAL_PARAMS>,
  {
    request: {
      query: GET_TARGETS,
      variables: {},
    },
    result: {
      data: {
        targets: [selectedTarget, selectedOi],
      },
    },
  } satisfies MockedResponseOf<typeof GET_TARGETS>,
];

const navigateStatesMock = (onSwappedTarget: boolean) => [
  {
    request: {
      query: NAVIGATE_STATE,
      variables: {},
    },
    result: {
      data: {
        navigateState: {
          __typename: 'NavigateState',
          onSwappedTarget,
        },
      },
    },
  } satisfies MockedResponseOf<typeof NAVIGATE_STATE>,
  {
    delay: 300,
    request: {
      query: NAVIGATE_STATE_SUBSCRIPTION,
      variables: {},
    },
    maxUsageCount: Infinity,
    result: {
      data: {
        navigateState: {
          __typename: 'NavigateState',
          onSwappedTarget,
        },
      },
    },
  } satisfies MockedResponseOf<typeof NAVIGATE_STATE_SUBSCRIPTION>,
];

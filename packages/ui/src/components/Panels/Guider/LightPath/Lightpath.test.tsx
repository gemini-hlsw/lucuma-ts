import { GET_CONFIGURATION } from '@gql/configs/Configuration';
import { GET_GUIDE_LOOP, UPDATE_GUIDE_LOOP } from '@gql/configs/GuideLoop';
import type { Instrument, LightSinkVariant } from '@gql/server/gen/graphql';
import { LIGHTPATH_CONFIG_MUTATION } from '@gql/server/Lightpath';
import type { MockedResponseOf } from '@gql/util';
import { userEvent } from 'vitest/browser';

import { createConfiguration, createGuideLoop } from '@/test/create';
import { operationOutcome } from '@/test/helpers';
import { renderWithContext } from '@/test/render';
import type { Fpu, GuideLoop } from '@/types';

import { LightPath } from './LightPath';

describe(LightPath.name, () => {
  it('should render', async () => {
    const sut = await renderWithContext(<LightPath />, {
      mocks: [getGuideLoopMock, getConfigurationMock('GMOS_NORTH', null)],
    });

    await expect.element(sut.getByText('Sky → Instrument')).toBeVisible();
  });

  // TODO: only send IFU for ifu targets
  it.each([
    ['FLAMINGOS2', null, undefined],
    ['GMOS_NORTH', null, undefined],
    ['GMOS_SOUTH', null, undefined],
    ['GHOST', null, undefined],
    ['IGRINS2', null, undefined],
    ['VISITOR_NORTH', null, undefined],
    ['VISITOR_SOUTH', null, undefined],
    ['FLAMINGOS2', 'IFU2_SLITS', undefined],
    ['GMOS_NORTH', 'LONG_SLIT_3', undefined],
    ['GMOS_NORTH', 'IFU_BLUE', 'GMOS_IFU'],
    ['GMOS_SOUTH', 'IFU2_SLITS', 'GMOS_IFU'],
  ] satisfies [Instrument, Fpu | null, LightSinkVariant | undefined][])(
    'sends correct light sink for instrument %s with fpu %s',
    async (instrument, fpu, lightSinkVariant) => {
      const sut = await renderWithContext(<LightPath />, {
        mocks: [getGuideLoopMock, getConfigurationMock(instrument, fpu), lightpathConfigMock, updateGuideLoopMock],
      });

      const button = sut.getByRole('button', { name: 'Sky → Instrument' });
      await userEvent.click(button);

      expect(lightpathConfigMock.request.variables).toHaveBeenCalledExactlyOnceWith({
        from: 'SKY',
        instrument,
        lightSinkVariant,
      });
      expect(updateGuideLoopMock.request.variables).toHaveBeenCalledExactlyOnceWith({
        pk: 1,
        lightPath: 'Sky → Instrument',
      });
    },
  );

  it('sends AO to correct sink for instrument', async () => {
    const sut = await renderWithContext(<LightPath />, {
      mocks: [getGuideLoopMock, getConfigurationMock('FLAMINGOS2', null), lightpathConfigMock, updateGuideLoopMock],
    });

    const button = sut.getByRole('button', { name: 'Sky → AO → AC' });
    await userEvent.click(button);

    expect(lightpathConfigMock.request.variables).toHaveBeenCalledExactlyOnceWith({
      from: 'AO',
      instrument: 'ACQ_CAM_NORTH',
    });
    expect(updateGuideLoopMock.request.variables).toHaveBeenCalledExactlyOnceWith({
      pk: 1,
      lightPath: 'Sky → AO → AC',
    });
  });
});

const getGuideLoopMock = {
  request: {
    query: GET_GUIDE_LOOP,
    variables: () => true,
  },
  result: {
    data: {
      guideLoop: createGuideLoop(),
    },
  },
} satisfies MockedResponseOf<typeof GET_GUIDE_LOOP>;

const getConfigurationMock = (instrument: Instrument, fpu: Fpu | null) =>
  ({
    request: {
      query: GET_CONFIGURATION,
      variables: {},
    },
    result: {
      data: {
        configuration: createConfiguration({ obsInstrument: instrument, fpu }),
      },
    },
  }) satisfies MockedResponseOf<typeof GET_CONFIGURATION>;

const lightpathConfigMock = {
  request: {
    query: LIGHTPATH_CONFIG_MUTATION,
    variables: vi.fn().mockReturnValue(true),
  },
  result: {
    data: {
      lightpathConfig: operationOutcome,
    },
  },
} satisfies MockedResponseOf<typeof LIGHTPATH_CONFIG_MUTATION>;

const updateGuideLoopMock = {
  request: {
    query: UPDATE_GUIDE_LOOP,
    variables: vi.fn().mockReturnValue(true),
  },
  result: (arg) => ({
    data: {
      updateGuideLoop: {
        ...createGuideLoop(),
        ...arg,
      } as GuideLoop,
    },
  }),
} satisfies MockedResponseOf<typeof UPDATE_GUIDE_LOOP>;

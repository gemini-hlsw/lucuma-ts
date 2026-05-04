import { GET_CONFIGURATION } from '@gql/configs/Configuration';
import type { GuideLoopItemFragment } from '@gql/configs/gen/graphql';
import { GET_GUIDE_LOOP, UPDATE_GUIDE_LOOP } from '@gql/configs/GuideLoop';
import type { Instrument } from '@gql/server/gen/graphql';
import { LIGHTPATH_CONFIG_MUTATION } from '@gql/server/Lightpath';
import type { MockedResponseOf } from '@gql/util';
import { userEvent } from 'vitest/browser';

import { createConfiguration, createGuideLoop } from '@/test/create';
import { operationOutcome } from '@/test/helpers';
import { renderWithContext } from '@/test/render';

import { LightPath } from './LightPath';

describe(LightPath.name, () => {
  it('should render', async () => {
    const sut = await renderWithContext(<LightPath />, {
      mocks: [getGuideLoopMock, getConfigurationMock('GMOS_NORTH')],
    });

    await expect.element(sut.getByText('Sky → Instrument')).toBeVisible();
  });

  it.each([
    ['FLAMINGOS2', 'F2'],
    ['GMOS_NORTH', 'GMOS'],
    ['GMOS_SOUTH', 'GMOS'],
    ['GHOST', 'GHOST'],
    ['IGRINS2', 'IGRINS2'],
    ['VISITOR', 'VISITOR'],
  ] satisfies [Instrument, string][])(
    'sends correct light sink for instrument %s',
    async (instrument, expectedSink) => {
      const sut = await renderWithContext(<LightPath />, {
        mocks: [getGuideLoopMock, getConfigurationMock(instrument), lightpathConfigMock, updateGuideLoopMock],
      });

      const button = sut.getByRole('button', { name: 'Sky → Instrument' });
      await userEvent.click(button);

      expect(lightpathConfigMock.request.variables).toHaveBeenCalledWith({
        from: 'SKY',
        to: expectedSink,
      });
      expect(updateGuideLoopMock.request.variables).toHaveBeenCalledWith({ pk: 1, lightPath: 'Sky → Instrument' });
    },
  );

  it('sends AO to correct sink for instrument', async () => {
    const sut = await renderWithContext(<LightPath />, {
      mocks: [getGuideLoopMock, getConfigurationMock('FLAMINGOS2'), lightpathConfigMock, updateGuideLoopMock],
    });

    const button = sut.getByRole('button', { name: 'Sky → AO → AC' });
    await userEvent.click(button);

    expect(lightpathConfigMock.request.variables).toHaveBeenCalledWith({
      from: 'AO',
      to: 'AC',
    });
    expect(updateGuideLoopMock.request.variables).toHaveBeenCalledWith({ pk: 1, lightPath: 'Sky → AO → AC' });
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

const getConfigurationMock = (instrument: Instrument) =>
  ({
    request: {
      query: GET_CONFIGURATION,
      variables: {},
    },
    result: {
      data: {
        configuration: createConfiguration({ obsInstrument: instrument }),
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
      } as GuideLoopItemFragment,
    },
  }),
} satisfies MockedResponseOf<typeof UPDATE_GUIDE_LOOP>;

import { CAL_PARAMS } from '@gql/configs/CalParams';
import { GET_CONFIGURATION, UPDATE_CONFIGURATION } from '@gql/configs/Configuration';
import { GET_INSTRUMENT } from '@gql/configs/Instrument';
import { GET_ROTATOR } from '@gql/configs/Rotator';
import { GET_TARGETS } from '@gql/configs/Target';
import { GET_INSTRUMENT_PORT } from '@gql/server/Instrument';
import { NAVIGATE_STATE, NAVIGATE_STATE_SUBSCRIPTION } from '@gql/server/NavigateState';
import type { MockedResponseOf } from '@gql/util';

import {
  createCalParams,
  createConfiguration,
  createInstrumentConfig,
  createRotator,
  createTarget,
} from '@/test/create';
import { selectDropdownOption } from '@/test/helpers';
import { type RenderResultWithStore, renderWithContext } from '@/test/render';
import type { Configuration } from '@/types';

import { GuiderTargets } from './GuiderTargets';

describe(GuiderTargets, () => {
  let sut: RenderResultWithStore;
  beforeEach(async () => {
    updateConfigurationMock.request.variables.mockClear();
    sut = await renderWithContext(<GuiderTargets />, {
      mocks: [getConfigurationMock, getTargetsMock, updateConfigurationMock, ...targetSwapButtonMocks],
    });
  });

  const guidingValue = () => sut.getByTestId('p1GuidingType').getByRole('textbox');

  it('should show Normal Guiding by default', async () => {
    await expect.element(guidingValue()).toHaveValue('Normal Guiding');
  });

  it('should save Guiding Off for the selected WFS', async () => {
    await selectDropdownOption(sut, 'PWFS1 guiding', 'Guiding Off');

    expect(updateConfigurationMock.request.variables).toHaveBeenCalledExactlyOnceWith({
      pk: 1,
      p1GuidingType: 'OFF',
    });
    await expect.element(guidingValue()).toHaveValue('Guiding Off');
  });
});

const getConfigurationMock = {
  request: {
    query: GET_CONFIGURATION,
    variables: () => true,
  },
  result: {
    data: {
      configuration: createConfiguration({ selectedP1Target: 10 }),
    },
  },
} satisfies MockedResponseOf<typeof GET_CONFIGURATION>;

const getTargetsMock = {
  request: {
    query: GET_TARGETS,
    variables: {},
  },
  result: {
    data: {
      targets: [createTarget({ pk: 10, id: 't-010', name: 'P1 Target', type: 'PWFS1' })],
    },
  },
} satisfies MockedResponseOf<typeof GET_TARGETS>;

const updateConfigurationMock = {
  request: {
    query: UPDATE_CONFIGURATION,
    variables: vi.fn().mockReturnValue(true),
  },
  result: (arg) => ({
    data: {
      updateConfiguration: {
        ...getConfigurationMock.result.data.configuration,
        ...(arg as Configuration),
      },
    },
  }),
} satisfies MockedResponseOf<typeof UPDATE_CONFIGURATION>;

const targetSwapButtonMocks = [
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
    result: {
      data: {
        instrument: createInstrumentConfig({ wfs: 'PWFS1' }),
      },
    },
  } satisfies MockedResponseOf<typeof GET_INSTRUMENT>,
  {
    request: {
      query: GET_INSTRUMENT_PORT,
      variables: () => true,
    },
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
      query: NAVIGATE_STATE,
      variables: {},
    },
    result: {
      data: {
        navigateState: {
          __typename: 'NavigateState',
          onSwappedTarget: false,
        },
      },
    },
  } satisfies MockedResponseOf<typeof NAVIGATE_STATE>,
  {
    request: {
      query: NAVIGATE_STATE_SUBSCRIPTION,
      variables: {},
    },
    result: {
      data: {
        navigateState: {
          __typename: 'NavigateState',
          onSwappedTarget: false,
        },
      },
    },
  } satisfies MockedResponseOf<typeof NAVIGATE_STATE_SUBSCRIPTION>,
];

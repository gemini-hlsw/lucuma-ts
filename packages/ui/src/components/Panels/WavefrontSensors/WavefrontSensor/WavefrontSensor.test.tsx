import { GET_CONFIGURATION } from '@gql/configs/Configuration';
import { GUIDE_STATE_QUERY, GUIDE_STATE_SUBSCRIPTION } from '@gql/server/GuideState';
import {
  OIWFS_CONFIG_STATE,
  OIWFS_CONFIG_STATE_SUBSCRIPTION,
  PWFS1_CONFIG_STATE,
  PWFS1_CONFIG_STATE_SUBSCRIPTION,
  PWFS2_CIRCULAR_BUFFER,
  PWFS2_CONFIG_STATE,
  PWFS2_CONFIG_STATE_SUBSCRIPTION,
} from '@gql/server/NavigateState';
import { PWFS1_OBSERVE, TAKE_SKY } from '@gql/server/WavefrontSensors';
import type { MockedResponseOf } from '@gql/util';
import { userEvent } from 'vitest/browser';

import { createConfiguration, createGuideState, createWfsConfigState } from '@/test/create';
import { operationOutcome, selectDropdownOption } from '@/test/helpers';
import { renderWithContext } from '@/test/render';

import WavefrontSensor from './WavefrontSensor';

describe(WavefrontSensor.name, () => {
  it('should render', async () => {
    const sut = await renderWithContext(<WavefrontSensor canEdit={true} wfs="OIWFS" />, { mocks });

    expect(sut.getByTestId('oiwfs-controls')).toBeVisible();
  });

  it('should send observe with correct frequency', async () => {
    const sut = await renderWithContext(<WavefrontSensor canEdit={true} wfs="PWFS1" />, { mocks });
    const freq = 100;

    await selectDropdownOption(sut, 'Select frequency', freq.toString());
    await userEvent.click(sut.getByRole('button', { name: 'Start' }));

    expect(pwfs1ObserveMock.request.variables).toHaveBeenCalledExactlyOnceWith({
      period: { milliseconds: (1 / freq) * 1000 },
    });
  });

  it('should send sky with correct frequency', async () => {
    const sut = await renderWithContext(<WavefrontSensor canEdit={true} wfs="OIWFS" />, { mocks });
    const freq = 50;

    await selectDropdownOption(sut, 'Select frequency', freq.toString());
    await userEvent.click(sut.getByRole('button', { name: 'Sky' }));

    expect(takeSkyMock.request.variables).toHaveBeenCalledExactlyOnceWith({
      period: { milliseconds: (1 / freq) * 1000 },
      wfs: 'GMOS_OIWFS',
    });
  });

  it('should send save when checkbox is clicked', async () => {
    const sut = await renderWithContext(<WavefrontSensor canEdit={true} wfs="PWFS2" />, { mocks });
    const saveCheckbox = sut.getByLabelText('Save CB');
    await userEvent.click(saveCheckbox);

    expect(pwfs2CircularBufferMock.request.variables).toHaveBeenCalledExactlyOnceWith({
      enabled: true,
    });
  });
});

const getConfigurationMock = {
  request: {
    query: GET_CONFIGURATION,
    variables: {},
  },
  result: {
    data: {
      configuration: createConfiguration(),
    },
  },
} satisfies MockedResponseOf<typeof GET_CONFIGURATION>;

const getGuideStateMock = {
  request: {
    query: GUIDE_STATE_QUERY,
    variables: {},
  },
  result: {
    data: {
      guideState: createGuideState(),
    },
  },
} satisfies MockedResponseOf<typeof GUIDE_STATE_QUERY>;

const guideStateSubMock = {
  request: {
    query: GUIDE_STATE_SUBSCRIPTION,
    variables: {},
  },
  maxUsageCount: Infinity,
  result: {
    data: {
      guideState: createGuideState(),
    },
  },
} satisfies MockedResponseOf<typeof GUIDE_STATE_SUBSCRIPTION>;

const pwfs1ConfigStateMock = {
  request: {
    query: PWFS1_CONFIG_STATE,
    variables: {},
  },
  result: {
    data: {
      pwfs1ConfigState: createWfsConfigState(),
    },
  },
} satisfies MockedResponseOf<typeof PWFS1_CONFIG_STATE>;

const pwfs1ConfigStateSubMock = {
  request: {
    query: PWFS1_CONFIG_STATE_SUBSCRIPTION,
    variables: {},
  },
  result: {
    data: {
      pwfs1ConfigState: createWfsConfigState(),
    },
  },
} satisfies MockedResponseOf<typeof PWFS1_CONFIG_STATE_SUBSCRIPTION>;

const pwfs2ConfigStateMock = {
  request: {
    query: PWFS2_CONFIG_STATE,
    variables: {},
  },
  result: {
    data: {
      pwfs2ConfigState: createWfsConfigState(),
    },
  },
} satisfies MockedResponseOf<typeof PWFS2_CONFIG_STATE>;

const pwfs2ConfigStateSubMock = {
  request: {
    query: PWFS2_CONFIG_STATE_SUBSCRIPTION,
    variables: {},
  },
  result: {
    data: {
      pwfs2ConfigState: createWfsConfigState(),
    },
  },
} satisfies MockedResponseOf<typeof PWFS2_CONFIG_STATE_SUBSCRIPTION>;

const oiwfsConfigStateMock = {
  request: {
    query: OIWFS_CONFIG_STATE,
    variables: {},
  },
  result: {
    data: {
      oiwfsConfigState: createWfsConfigState(),
    },
  },
} satisfies MockedResponseOf<typeof OIWFS_CONFIG_STATE>;

const oiwfsConfigStateSubMock = {
  request: {
    query: OIWFS_CONFIG_STATE_SUBSCRIPTION,
    variables: {},
  },
  result: {
    data: {
      oiwfsConfigState: createWfsConfigState(),
    },
  },
} satisfies MockedResponseOf<typeof OIWFS_CONFIG_STATE_SUBSCRIPTION>;

const takeSkyMock = {
  request: {
    query: TAKE_SKY,
    variables: vi.fn().mockReturnValue(true),
  },
  result: {
    data: {
      wfsSky: operationOutcome,
    },
  },
} satisfies MockedResponseOf<typeof TAKE_SKY>;

const pwfs1ObserveMock = {
  request: {
    query: PWFS1_OBSERVE,
    variables: vi.fn().mockReturnValue(true),
  },
  result: {
    data: {
      pwfs1Observe: operationOutcome,
    },
  },
} satisfies MockedResponseOf<typeof PWFS1_OBSERVE>;

const pwfs2CircularBufferMock = {
  request: {
    query: PWFS2_CIRCULAR_BUFFER,
    variables: vi.fn().mockReturnValue(true),
  },
  result: {
    data: {
      pwfs2CircularBuffer: operationOutcome,
    },
  },
} satisfies MockedResponseOf<typeof PWFS2_CIRCULAR_BUFFER>;

const mocks = [
  pwfs1ObserveMock,
  takeSkyMock,
  getConfigurationMock,
  pwfs1ConfigStateMock,
  pwfs1ConfigStateSubMock,
  pwfs2ConfigStateMock,
  pwfs2ConfigStateSubMock,
  oiwfsConfigStateMock,
  oiwfsConfigStateSubMock,
  getGuideStateMock,
  guideStateSubMock,
  pwfs2CircularBufferMock,
];

import {
  PWFS1_FIELD_STOP,
  PWFS1_FILTER,
  PWFS1_MECHS_STATE,
  PWFS1_MECHS_STATE_SUB,
  PWFS2_FIELD_STOP,
  PWFS2_FILTER,
  PWFS2_MECHS_STATE,
  PWFS2_MECHS_STATE_SUB,
} from '@gql/server/MechsState';
import type { MockedResponseOf } from '@gql/util';

import { createPwfsMechState } from '@/test/create';
import { operationOutcome, selectDropdownOption } from '@/test/helpers';
import { renderWithContext } from '@/test/render';

import { PWFS1, PWFS2 } from './PWFS';

describe(PWFS1.name, () => {
  it('should render', async () => {
    await renderWithContext(<PWFS1 disabled={false} />, { mocks });
  });

  it('should render disabled', async () => {
    const sut = await renderWithContext(<PWFS1 disabled={true} />, { mocks });
    await expect.element(sut.getByLabelText('Filter', { exact: true })).toBeDisabled();
    await expect.element(sut.getByLabelText('Field Stop')).toBeDisabled();
  });

  it('should call pwfs1Filter when changing filter', async () => {
    const sut = await renderWithContext(<PWFS1 disabled={false} />, { mocks });

    await selectDropdownOption(sut, 'Select filter', 'Red');

    expect(pwfs1FilterMock.request.variables).toHaveBeenCalledWith({ filter: 'RED' });
  });

  it('should call pwfs1FieldStop when changing field stop', async () => {
    const sut = await renderWithContext(<PWFS1 disabled={false} />, { mocks });

    await selectDropdownOption(sut, 'Select stop', 'open1');

    expect(pwfs1FieldStopMock.request.variables).toHaveBeenCalledWith({ fieldStop: 'OPEN1' });
  });
});

describe(PWFS2.name, () => {
  it('should render', async () => {
    await renderWithContext(<PWFS2 disabled={false} />, { mocks });
  });

  it('should render disabled', async () => {
    const sut = await renderWithContext(<PWFS2 disabled={true} />, { mocks });
    await expect.element(sut.getByLabelText('Filter', { exact: true })).toBeDisabled();
    await expect.element(sut.getByLabelText('Field Stop')).toBeDisabled();
  });

  it('should call pwfs2Filter when changing filter', async () => {
    const sut = await renderWithContext(<PWFS2 disabled={false} />, { mocks });

    await selectDropdownOption(sut, 'Select filter', 'Red');

    expect(pwfs2FilterMock.request.variables).toHaveBeenCalledWith({ filter: 'RED' });
  });

  it('should call pwfs2FieldStop when changing field stop', async () => {
    const sut = await renderWithContext(<PWFS2 disabled={false} />, { mocks });

    await selectDropdownOption(sut, 'Select stop', 'open2');

    expect(pwfs2FieldStopMock.request.variables).toHaveBeenCalledWith({ fieldStop: 'OPEN2' });
  });
});

const pwfs1MechsStateMock = {
  request: {
    query: PWFS1_MECHS_STATE,
  },
  maxUsageCount: Infinity,
  result: {
    data: {
      pwfs1MechsState: createPwfsMechState(),
    },
  },
} satisfies MockedResponseOf<typeof PWFS1_MECHS_STATE>;

const pwfs1MechStateSubMock = {
  request: {
    query: PWFS1_MECHS_STATE_SUB,
  },
  maxUsageCount: Infinity,
  result: {
    data: {
      pwfs1MechsState: createPwfsMechState(),
    },
  },
} satisfies MockedResponseOf<typeof PWFS1_MECHS_STATE_SUB>;

const pwfs2MechsStateMock = {
  request: {
    query: PWFS2_MECHS_STATE,
  },
  maxUsageCount: Infinity,
  result: {
    data: {
      pwfs2MechsState: createPwfsMechState(),
    },
  },
} satisfies MockedResponseOf<typeof PWFS2_MECHS_STATE>;

const pwfs2MechStateSubMock = {
  request: {
    query: PWFS2_MECHS_STATE_SUB,
  },
  maxUsageCount: Infinity,
  result: {
    data: {
      pwfs2MechsState: createPwfsMechState(),
    },
  },
} satisfies MockedResponseOf<typeof PWFS2_MECHS_STATE_SUB>;

const pwfs1FilterMock = {
  request: {
    query: PWFS1_FILTER,
    variables: vi.fn().mockReturnValue(true),
  },
  result: {
    data: { pwfs1Filter: operationOutcome },
  },
} satisfies MockedResponseOf<typeof PWFS1_FILTER>;

const pwfs2FilterMock = {
  request: {
    query: PWFS2_FILTER,
    variables: vi.fn().mockReturnValue(true),
  },
  result: {
    data: { pwfs2Filter: operationOutcome },
  },
} satisfies MockedResponseOf<typeof PWFS2_FILTER>;

const pwfs1FieldStopMock = {
  request: {
    query: PWFS1_FIELD_STOP,
    variables: vi.fn().mockReturnValue(true),
  },
  result: {
    data: { pwfs1FieldStop: operationOutcome },
  },
} satisfies MockedResponseOf<typeof PWFS1_FIELD_STOP>;

const pwfs2FieldStopMock = {
  request: {
    query: PWFS2_FIELD_STOP,
    variables: vi.fn().mockReturnValue(true),
  },
  result: {
    data: { pwfs2FieldStop: operationOutcome },
  },
} satisfies MockedResponseOf<typeof PWFS2_FIELD_STOP>;

const mocks = [
  pwfs1MechsStateMock,
  pwfs1MechStateSubMock,
  pwfs2MechsStateMock,
  pwfs2MechStateSubMock,
  pwfs1FilterMock,
  pwfs2FilterMock,
  pwfs1FieldStopMock,
  pwfs2FieldStopMock,
];

import { CAL_PARAMS } from '@gql/configs/CalParams';
import { AC_MECHS_STATE, AC_MECHS_STATE_SUB } from '@gql/server/MechsState';
import type { MockedResponseOf } from '@gql/util';

import { createAcMechs, createCalParams } from '@/test/create';
import { renderWithContext } from '@/test/render';

import { ACHR } from './ACHR';

describe(ACHR.name, () => {
  it('should render', async () => {
    const sut = await renderWithContext(<ACHR disabled={false} />, { mocks });
    await expect.element(sut.getByLabelText('Lens', { exact: true })).toHaveValue('AC');
    expect(sut.getByLabelText('Filter', { exact: true })).toHaveValue('B-blue');
    expect(sut.getByLabelText('Neutral density', { exact: true })).toHaveValue('nd100');
  });
});

const mechsStateMock = {
  request: {
    query: AC_MECHS_STATE,
  },
  maxUsageCount: Infinity,
  result: {
    data: {
      acMechsState: createAcMechs(),
    },
  },
} satisfies MockedResponseOf<typeof AC_MECHS_STATE>;

const mechsStateSubMock = {
  request: {
    query: AC_MECHS_STATE_SUB,
  },
  maxUsageCount: Infinity,
  result: {
    data: {
      acMechsState: createAcMechs(),
    },
  },
} satisfies MockedResponseOf<typeof AC_MECHS_STATE_SUB>;

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

const mocks = [mechsStateMock, mechsStateSubMock, calParamsMock];

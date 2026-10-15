import { CAL_PARAMS_HISTORY } from '@gql/configs/CalParams';
import type { MockedResponseOf } from '@gql/util';
import { page } from 'vitest/browser';

import { renderWithContext } from '@/test/render';

import { CalParamsHistoryContent } from './CalParamsHistoryContent';

describe(CalParamsHistoryContent, () => {
  const rowWithComment = (comment: string) => page.getByRole('row').filter({ hasText: comment });

  it('should mark the latest entry as current', async () => {
    await renderWithContext(
      <CalParamsHistoryContent canEdit selection={null} setSelection={vi.fn()} loading={false} />,
      { mocks: [calParamsHistoryMock] },
    );

    await expect.element(rowWithComment('Latest entry').getByText('Current', { exact: true })).toBeVisible();
    await expect.element(rowWithComment('Older entry')).toBeVisible();
    await expect.element(rowWithComment('Older entry').getByText('Current', { exact: true })).not.toBeInTheDocument();
  });
});

const calParamsHistoryMock = {
  request: {
    query: CAL_PARAMS_HISTORY,
    variables: () => true,
  },
  result: {
    data: {
      calParamsHistory: [
        { __typename: 'CalParamsHistory', pk: 2, comment: 'Latest entry', createdAt: '2026-09-30T12:00:00.000Z' },
        { __typename: 'CalParamsHistory', pk: 1, comment: 'Older entry', createdAt: '2026-09-01T12:00:00.000Z' },
      ],
    },
  },
} satisfies MockedResponseOf<typeof CAL_PARAMS_HISTORY>;

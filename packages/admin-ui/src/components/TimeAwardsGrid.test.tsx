import { type JSX, useState } from 'react';
import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';

import type { Allocation } from '@/gql/types';
import { renderWithContext } from '@/test/render';

import { TimeAwardsGrid } from './TimeAwardsGrid';

/** The grid as its pages use it: controlled by allocation state. */
function Harness({ initial }: { readonly initial: readonly Allocation[] }): JSX.Element {
  const [allocations, setAllocations] = useState(initial);
  return <TimeAwardsGrid allocations={allocations} onChange={setAllocations} />;
}

describe('TimeAwardsGrid', () => {
  it('keeps a partner row visible when its only allocation is zeroed', async () => {
    // Regression: zeroing the last non-zero cell dropped the allocation and
    // with it the whole partner row, losing the reviewer's place mid-edit.
    const screen = await renderWithContext(<Harness initial={[{ category: 'US', scienceBand: 'BAND1', hours: 3 }]} />);
    const cell = screen.getByRole('spinbutton').first();
    await userEvent.fill(cell, '0');
    await userEvent.tab();
    await expect.element(screen.getByText('United States')).toBeInTheDocument();
  });
});

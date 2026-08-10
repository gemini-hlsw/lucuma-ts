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
  it('keeps a category row visible when its only allocation is zeroed', async () => {
    // Regression: zeroing the last non-zero cell dropped the allocation and
    // with it the whole category row, losing the reviewer's place mid-edit.
    const screen = await renderWithContext(<Harness initial={[{ category: 'US', scienceBand: 'BAND1', hours: 3 }]} />);
    const cell = screen.getByRole('spinbutton').first();
    await userEvent.fill(cell, '0');
    await userEvent.tab();
    await expect.element(screen.getByText('United States')).toBeInTheDocument();
  });

  it('offers the non-partner categories and adds a Calibration row (sc-9670)', async () => {
    const screen = await renderWithContext(<Harness initial={[]} />);
    // Calibration is a time-accounting category, not an SSO partner — it must
    // now be selectable so staff can allocate observatory calibration time.
    // Open the PrimeReact dropdown via its trigger, then pick Calibration.
    await userEvent.click(screen.container.querySelector('.p-dropdown-trigger')!);
    await userEvent.click(screen.getByText('CAL — Calibration'));
    await userEvent.click(screen.getByRole('button', { name: 'Add', exact: true }));
    // The new row renders with the category's abbreviation and description.
    await expect.element(screen.getByText('Calibration')).toBeInTheDocument();
  });
});

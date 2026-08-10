import { type JSX, useState } from 'react';
import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';

import { renderWithContext } from '@/test/render';

import { SearchInput } from './SearchInput';

/** The box as its pages use it: controlled by query state. */
function Harness(): JSX.Element {
  const [value, setValue] = useState('');
  return <SearchInput value={value} onChange={setValue} placeholder="Filter reference, PI, or title" title="Search" />;
}

describe('SearchInput', () => {
  it('shows the placeholder and reflects what the user types', async () => {
    const screen = await renderWithContext(<Harness />);
    const box = screen.getByPlaceholder('Filter reference, PI, or title');
    await expect.element(box).toBeInTheDocument();

    await userEvent.fill(box, 'lovelace');
    await expect.element(box).toHaveValue('lovelace');
  });
});

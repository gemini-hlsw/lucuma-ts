import { describe, expect, it } from 'vitest';

import { renderWithContext } from '@/test/render';

import Navbar from './Navbar';

describe('Navbar', () => {
  it('renders the Resource brand label', async () => {
    const { getByText } = await renderWithContext(<Navbar />);

    await expect.element(getByText('Resource')).toBeInTheDocument();
  });
});

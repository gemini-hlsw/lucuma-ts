import { describe, expect, it } from 'vitest';

import { renderWithContext } from 'lucuma-common-ui/testing';

import Navbar from './Navbar';

describe(Navbar.name, () => {
  it('renders the Resource brand label', async () => {
    const { getByText } = await renderWithContext(<Navbar />);

    await expect.element(getByText('Resource')).toBeInTheDocument();
  });
});

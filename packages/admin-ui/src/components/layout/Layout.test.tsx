import { describe, expect, it } from 'vitest';

import { fakeJwt, standardUser } from '@/test/factories';
import { renderWithContext } from '@/test/render';

import Layout from './Layout';

describe('Layout', () => {
  it('shows the wordmark, environment pill, and signed-in user', async () => {
    const screen = await renderWithContext(<Layout />, { token: fakeJwt(standardUser('staff')) });
    await expect.element(screen.getByText('ADMIN')).toBeInTheDocument();
    await expect.element(screen.getByText('development')).toBeInTheDocument();
    await expect.element(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    await expect.element(screen.getByText('STAFF')).toBeInTheDocument();
  });
});

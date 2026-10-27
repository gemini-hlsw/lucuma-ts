import { fakeJwt, standardUser } from '@gemini-hlsw/lucuma-common-ui/testing';
import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';

import { renderWithContext } from '@/test/render';

import Layout from './Layout';

describe(Layout, () => {
  it('shows the wordmark, environment pill, and signed-in user', async () => {
    const screen = await renderWithContext(<Layout />, { token: fakeJwt(standardUser('staff')) });
    await expect.element(screen.getByText('ADMIN')).toBeInTheDocument();
    await expect.element(screen.getByText('development')).toBeInTheDocument();
    // The name shares its element with the role badge, so match on part of the text.
    await expect.element(screen.getByText('Ada Lovelace', { exact: false })).toBeInTheDocument();
    await expect.element(screen.getByText('STAFF')).toBeInTheDocument();
  });

  it('reveals the build version from the About dialog (sc-9615)', async () => {
    const screen = await renderWithContext(<Layout />, { token: fakeJwt(standardUser('staff')) });
    await userEvent.click(screen.getByRole('button', { name: 'About this build' }));
    // Explore's DATE-COMMIT-ENV form, e.g. "20260806-3cdabad-DEV".
    await expect.element(screen.getByText(/Version: \d{8}-[0-9a-f]+-[A-Z]+/)).toBeInTheDocument();
  });
});

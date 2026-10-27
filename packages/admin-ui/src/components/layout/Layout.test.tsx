import { afterEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';

import { AuthSession } from '@/auth/AuthSession';
import { fakeJwt, standardUser } from '@/test/factories';
import { stubSso } from '@/test/fakeSso';
import { renderWithContext } from '@/test/render';

import Layout from './Layout';

describe(Layout, () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

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

  it('signs out with one click, however long SSO takes to clear the cookie (sc-10853)', async () => {
    const sso = stubSso();
    const screen = await renderWithContext(
      <>
        <AuthSession />
        <Layout />
      </>,
      { token: fakeJwt(standardUser('staff')) },
    );

    await userEvent.click(screen.getByRole('button', { name: /sign out/i }));
    await expect.element(screen.getByText('Ada Lovelace', { exact: false })).not.toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 250));
    // SSO has not answered yet; a silent sign-in now would carry the cookie and bring the user straight back.
    expect(sso.refreshes).toBe(0);

    sso.answerLogout();
    await expect.poll(() => sso.refreshes).toBe(1);
    await expect.element(screen.getByText('Ada Lovelace', { exact: false })).not.toBeInTheDocument();
  });

  it('tells the user when SSO could not complete the sign-out', async () => {
    const sso = stubSso();
    sso.failLogout = true;
    const screen = await renderWithContext(<Layout />, { token: fakeJwt(standardUser('staff')) });

    await userEvent.click(screen.getByRole('button', { name: /sign out/i }));
    sso.answerLogout();

    await expect.element(screen.getByText('Sign-out incomplete')).toBeInTheDocument();
    await expect.element(screen.getByText('SSO unreachable')).toBeInTheDocument();
  });
});

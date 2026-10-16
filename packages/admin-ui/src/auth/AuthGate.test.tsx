import { afterEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';

import { fakeJwt, standardUser } from '@/test/factories';
import { stubSso } from '@/test/fakeSso';
import { renderWithContext } from '@/test/render';

import { AuthGate } from './AuthGate';
import { AuthSession } from './AuthSession';

const CHILD = <div>ADMIN CONTENT</div>;

describe(AuthGate, () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('blocks when not signed in, and does not show admin content', async () => {
    const screen = await renderWithContext(<AuthGate>{CHILD}</AuthGate>);
    await expect.element(screen.getByRole('button', { name: /sign in with orcid/i })).toBeInTheDocument();
    await expect.element(screen.getByText('ADMIN CONTENT')).not.toBeInTheDocument();
  });

  it('denies a signed-in PI, showing their actual role', async () => {
    const screen = await renderWithContext(<AuthGate>{CHILD}</AuthGate>, { token: fakeJwt(standardUser('pi')) });
    await expect.element(screen.getByText('Access denied')).toBeInTheDocument();
    await expect.element(screen.getByText('PI')).toBeInTheDocument();
    await expect.element(screen.getByText('ADMIN CONTENT')).not.toBeInTheDocument();
  });

  it('treats an expired staff token as signed out', async () => {
    const screen = await renderWithContext(<AuthGate>{CHILD}</AuthGate>, {
      token: fakeJwt(standardUser('staff'), -60),
    });
    await expect.element(screen.getByRole('button', { name: /sign in with orcid/i })).toBeInTheDocument();
    await expect.element(screen.getByText('ADMIN CONTENT')).not.toBeInTheDocument();
  });

  it('renders the app for staff', async () => {
    const screen = await renderWithContext(<AuthGate>{CHILD}</AuthGate>, { token: fakeJwt(standardUser('staff')) });
    await expect.element(screen.getByText('ADMIN CONTENT')).toBeInTheDocument();
  });

  it('stays signed out after Sign out on the denied screen, however long SSO takes to clear the cookie (sc-10853)', async () => {
    const sso = stubSso();
    const screen = await renderWithContext(
      <>
        <AuthSession />
        <AuthGate>{CHILD}</AuthGate>
      </>,
      { token: fakeJwt(standardUser('pi')) },
    );

    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    await expect.element(screen.getByRole('button', { name: /sign in with orcid/i })).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 250));
    // SSO has not answered yet; a silent sign-in now would be given a staff token and open the app.
    expect(sso.refreshes).toBe(0);

    sso.answerLogout();
    await expect.poll(() => sso.refreshes).toBe(1);
    await expect.element(screen.getByRole('button', { name: /sign in with orcid/i })).toBeInTheDocument();
    await expect.element(screen.getByText('ADMIN CONTENT')).not.toBeInTheDocument();
  });

  it('tells the user when SSO could not complete the sign-out', async () => {
    const sso = stubSso();
    sso.failLogout = true;
    const screen = await renderWithContext(<AuthGate>{CHILD}</AuthGate>, { token: fakeJwt(standardUser('pi')) });

    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    sso.answerLogout();

    await expect.element(screen.getByText('Sign-out incomplete')).toBeInTheDocument();
  });
});

import { describe, expect, it } from 'vitest';

import { fakeJwt, standardUser } from '@/test/factories';
import { renderWithContext } from '@/test/render';

import { AuthGate } from './AuthGate';

const CHILD = <div>ADMIN CONTENT</div>;

describe('AuthGate', () => {
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
});

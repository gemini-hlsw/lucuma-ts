import { afterEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';

import { useIsLoggedIn } from '@/components/atoms/auth';
import { fakeJwt, standardUser } from '@/test/factories';
import { stubSso } from '@/test/fakeSso';
import { renderWithContext } from '@/test/render';

import { AuthSession } from './AuthSession';
import { useSignOut } from './useSignOut';

const failures: string[] = [];

function Harness() {
  const signOut = useSignOut((error) => failures.push(error.message));
  const signedIn = useIsLoggedIn();
  return (
    <>
      <AuthSession />
      <span data-testid="state">{signedIn ? 'signed in' : 'signed out'}</span>
      <button type="button" onClick={() => void signOut()}>
        Sign out
      </button>
    </>
  );
}

const render = () => renderWithContext(<Harness />, { token: fakeJwt(standardUser('staff')) });
const settle = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms));

describe(useSignOut, () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    failures.length = 0;
  });

  it('signs out at once and does not sign back in while SSO has not yet cleared the cookie (sc-10853)', async () => {
    const sso = stubSso();
    const screen = await render();

    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    await expect.element(screen.getByTestId('state')).toHaveTextContent('signed out');
    await settle();
    // Still waiting for SSO: a silent sign-in now would carry the cookie and be answered with a fresh token.
    expect(sso.refreshes).toBe(0);
    await expect.element(screen.getByTestId('state')).toHaveTextContent('signed out');

    sso.answerLogout();
    // The silent sign-in resumes once the cookie is gone, and finds no session.
    await expect.poll(() => sso.refreshes).toBe(1);
    await settle();
    await expect.element(screen.getByTestId('state')).toHaveTextContent('signed out');
  });

  it('ignores a second click while a sign-out is pending', async () => {
    const sso = stubSso();
    const screen = await render();

    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    sso.answerLogout();
    await settle();

    expect(sso.logouts).toBe(1);
  });

  it('reports a logout SSO could not complete, and the still-valid cookie then signs the user back in', async () => {
    const sso = stubSso();
    sso.failLogout = true;
    const screen = await render();

    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    await expect.element(screen.getByTestId('state')).toHaveTextContent('signed out');
    sso.answerLogout();

    await expect.poll(() => failures).toEqual(['SSO unreachable']);
    await expect.poll(() => sso.refreshes).toBe(1);
    await expect.element(screen.getByTestId('state')).toHaveTextContent('signed in');
  });
});

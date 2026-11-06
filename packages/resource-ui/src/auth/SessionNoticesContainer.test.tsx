import { createStore, type Store } from 'jotai';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { sessionCheckedAtom, setToken } from '@/components/atoms/auth';
import { ToastOutlet } from '@/components/ui/ToastOutlet';
import { afterPendingWork, fakeTimeouts, toastNamed, toastsShowing } from '@/test/helpers';
import { renderWithContext } from '@/test/render';
import { announceFromOtherTab, staffToken } from '@/test/session';
import { ssoLogout, stubSso } from '@/test/sso';

import { AuthSession } from './AuthSession';
import { signOut } from './session';
import { SessionNoticesContainer } from './SessionNoticesContainer';

let store: Store;

/** The real session keeper above the notices, so a logout, SSO's answers and other tabs' messages all reach them. */
const renderNotices = ({ token = staffToken(), checked = true }: { token?: string | null; checked?: boolean } = {}) => {
  setToken(store, token);
  store.set(sessionCheckedAtom, checked);
  return renderWithContext(
    <AuthSession>
      <ToastOutlet />
    </AuthSession>,
    { store },
  );
};

const TEN_MINUTES = 10 * 60 * 1000;

/** A closing toast stays in the DOM through PrimeReact's exit transition, marked by this class. */
async function expectShowing(summary: string): Promise<void> {
  await expect.element(toastNamed(summary)).toBeVisible();
  await expect.element(toastNamed(summary)).not.toHaveClass('p-toast-message-exit');
}

beforeEach(() => {
  store = createStore();
  stubSso();
});

afterEach(() => {
  vi.useRealTimers();
});

describe(SessionNoticesContainer, () => {
  it('should warn in a toast until the next sign-in when the logout never reached SSO', async () => {
    const screen = await renderNotices();
    void signOut(store);
    await expect.element(screen.getByRole('status')).toHaveTextContent('Logged out');

    ssoLogout().fail();

    await expectShowing('Logout did not reach SSO');
    await expect
      .element(toastNamed('Logout did not reach SSO').getByText('Close the browser to end the session.'))
      .toBeVisible();
    expect(screen.getByRole('status').element().textContent).toBe('Logged out');

    setToken(store, staffToken());

    await expect.element(toastNamed('Logout did not reach SSO')).not.toBeInTheDocument();
  });

  it('should announce the logout before SSO answers, and again after a fresh sign-in, when the reader logs out', async () => {
    const screen = await renderNotices();
    void signOut(store);
    await expect.element(screen.getByRole('status')).toHaveTextContent('Logged out');

    setToken(store, staffToken());
    await expect.element(screen.getByRole('status')).toHaveTextContent('');

    void signOut(store);

    await expect.element(screen.getByRole('status')).toHaveTextContent('Logged out');
  });

  it.each([
    ['from the first render', true],
    ['once the first check settles', false],
  ])('should show no session-ended notice when a visitor is signed out %s', async (_when, checked) => {
    await renderNotices({ token: null, checked });

    store.set(sessionCheckedAtom, true);
    await afterPendingWork(store);

    expect(toastsShowing()).toEqual([]);
  });

  it.each<[string, () => Promise<void> | void]>([
    ['Your session ended', () => setToken(store, null)],
    ['You signed out in another tab', () => announceFromOtherTab()],
    [
      'Logout did not reach SSO',
      async () => {
        void signOut(store);
        ssoLogout().fail();
        await vi.advanceTimersByTimeAsync(0);
      },
    ],
  ])('should keep "%s" on screen when ten minutes pass', async (summary, end) => {
    fakeTimeouts();
    await renderNotices();

    await end();
    await expect.poll(toastsShowing).toContainEqual(expect.stringContaining(summary));
    await vi.advanceTimersByTimeAsync(TEN_MINUTES);

    await expect.poll(toastsShowing).toContainEqual(expect.stringContaining(summary));
  });

  it.each([
    ['SSO confirms it', 'Logged out', () => ssoLogout().answer({ status: 200 })],
    [
      'SSO fails only after the reader signed in again',
      '',
      () => {
        setToken(store, staffToken());
        ssoLogout().fail();
      },
    ],
  ])('should show no notice when the reader logs out and %s', async (_when, announcement, settle) => {
    fakeTimeouts();
    const screen = await renderNotices();

    void signOut(store);
    settle();
    await vi.advanceTimersByTimeAsync(0);

    await expect.element(screen.getByRole('status')).toHaveTextContent(announcement);
    expect(toastsShowing()).toEqual([]);
  });

  it.each<[string, () => Promise<void> | void]>([['Your session ended', () => setToken(store, null)]])(
    'should take "%s" down once the reader signs in, and show it once when the next session ends that way',
    async (summary, end) => {
      await renderNotices();
      await end();
      await expectShowing(summary);

      setToken(store, staffToken());
      await expect.element(toastNamed(summary)).not.toBeInTheDocument();

      await end();
      await expectShowing(summary);
      await afterPendingWork(store);

      expect(toastsShowing().filter((text) => text.startsWith(summary))).toHaveLength(1);
    },
  );
});

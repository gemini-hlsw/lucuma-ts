import { fakeJwt, standardUser } from '@gemini-hlsw/lucuma-common-ui/testing';
import { createStore, type Store } from 'jotai';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';

import { sessionCheckedAtom, setToken } from '@/components/atoms/auth';
import { Navbar } from '@/components/layout/Navbar';
import { ToastOutlet } from '@/components/ui/ToastOutlet';
import { afterPendingWork, fakeTimeouts, openAppMenu, toastNamed, toastsShowing } from '@/test/helpers';
import { renderWithContext, renderWithRoute } from '@/test/render';
import { ssoLogout, ssoRefreshes, stubSso } from '@/test/sso';

import { AuthSession } from './AuthSession';
import {
  SESSION_CHANNEL,
  SESSION_TIMINGS,
  type SessionTimings,
  SIGNED_OUT_MESSAGE,
  signOut,
  startSession,
} from './session';
import { SessionNoticesContainer } from './SessionNoticesContainer';

let store: Store;

/** A function, so each token's `exp` counts from the moment the test asks for it. */
const staffToken = () => fakeJwt(standardUser('staff'));

const announceFromOtherTab = async (): Promise<void> => {
  const otherTab = new BroadcastChannel(SESSION_CHANNEL);
  const witness = new BroadcastChannel(SESSION_CHANNEL);
  const delivered = new Promise<void>((resolve) => {
    witness.addEventListener('message', () => resolve(), { once: true });
  });
  otherTab.postMessage(SIGNED_OUT_MESSAGE);
  await delivered;
  witness.close();
  otherTab.close();
};

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

/** The masthead beside the notices, for the tests that reach them through it or through the keeper's timings. */
const renderMasthead = async (token: string | null = staffToken(), timings?: SessionTimings) => {
  setToken(store, token);
  store.set(sessionCheckedAtom, true);
  return renderWithRoute(
    <AuthSession {...(timings ? { timings } : {})}>
      <Navbar />
      <ToastOutlet />
    </AuthSession>,
    { route: '/', store },
  );
};

const TEN_MINUTES = 10 * 60 * 1000;
/** Renews a sixty-second token at once, so the refusal and not the token's own expiry ends the session. */
const RENEW_AT_ONCE = { ...SESSION_TIMINGS, refreshAheadMs: 60_000 } as const satisfies SessionTimings;

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

  it('should show a notice when SSO refuses to renew the session', async () => {
    await renderMasthead(fakeJwt(standardUser('staff'), 60), RENEW_AT_ONCE);

    await expect.poll(() => ssoRefreshes()).toHaveLength(1);
    ssoRefreshes()[0]?.answer({ status: 403 });

    await expectShowing('Your session ended');
    await expect
      .element(
        toastNamed('Your session ended').getByText('Choose "Login with ORCID" from the menu to sign in again.', {
          exact: true,
        }),
      )
      .toBeVisible();
  });

  it('should say the reader signed out in another tab, and after a fresh sign-in that the session ended, when each ends the session in turn', async () => {
    await renderMasthead();
    const otherTab = new BroadcastChannel(SESSION_CHANNEL);

    try {
      otherTab.postMessage(SIGNED_OUT_MESSAGE);
      await expectShowing('You signed out in another tab');
    } finally {
      otherTab.close();
    }

    expect(toastsShowing()).toEqual([expect.stringContaining('You signed out in another tab')]);

    setToken(store, fakeJwt(standardUser('staff'), 60));
    await expect.element(toastNamed('You signed out in another tab')).not.toBeInTheDocument();

    const stop = startSession(store, RENEW_AT_ONCE);
    try {
      await expect.poll(() => ssoRefreshes()).toHaveLength(1);
      ssoRefreshes()[0]?.answer({ status: 403 });
      await expectShowing('Your session ended');
    } finally {
      stop();
    }
    expect(toastsShowing()).toEqual([expect.stringContaining('Your session ended')]);
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

  it('should show the session-ended notice above the open About dialog, without taking focus from it, when the session ends under it', async () => {
    const screen = await renderMasthead();
    await openAppMenu(screen);
    await page.getByRole('menuitem', { name: 'About Resource' }).click();
    const dialog = page.getByTestId('about-resource');
    await expect.element(dialog).toBeVisible();
    const copy = dialog.getByRole('button', { name: 'Copy version' }).element() as HTMLElement;
    copy.focus();

    setToken(store, null);
    await expectShowing('Your session ended');

    expect(document.activeElement).toBe(copy);
    await toastNamed('Your session ended').getByRole('button', { name: 'Close' }).click();
    await expect.element(toastNamed('Your session ended')).not.toBeInTheDocument();
    await expect.element(dialog).toBeVisible();
  });
});

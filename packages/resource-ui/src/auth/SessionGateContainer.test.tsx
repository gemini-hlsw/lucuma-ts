import { ApolloLink } from '@apollo/client';
import { ApolloProvider } from '@apollo/client/react';
import type { MockLink } from '@apollo/client/testing';
import { Observable } from '@apollo/client/utilities';
import { fakeJwt, standardUser } from '@gemini-hlsw/lucuma-common-ui/testing';
import { createStore } from 'jotai';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';

import NightPage from '@/app/pages/NightPage';
import { odbTokenAtom, sessionCheckedAtom } from '@/components/atoms/auth';
import { Layout } from '@/components/layout/Layout';
import { ToastOutlet } from '@/components/ui/ToastOutlet';
import { liveLink } from '@/gql/ApolloConfigs';
import { nightSchedule } from '@/test/fixtures/night';
import { fakeTimeouts, openAppMenu, toastNamed } from '@/test/helpers';
import { captureOperations, createLinkClient } from '@/test/linkClient';
import { renderInShell } from '@/test/render';
import { announceFromOtherTab, refuseRefresh, RENEW_AT_ONCE, staffToken } from '@/test/session';
import { ssoCalls, ssoLogout, ssoRefreshes, stubSso } from '@/test/sso';

import { AuthSession } from './AuthSession';
import { SESSION_CHANNEL, SESSION_TIMINGS, type SessionTimings, SIGNED_OUT_MESSAGE } from './session';
import { SessionGateContainer } from './SessionGateContainer';
import { LOGOUT_UNREACHABLE, SESSION_ENDED, SIGNED_OUT_ELSEWHERE } from './SessionNoticesContainer';
import { REFRESH_TIMEOUT_MS } from './ssoClient';

const ROUTE = '/night?site=GS&night=2025-11-14';
const PAGE_HEADING = { level: 1, name: 'Night of 2025-11-14' };
const SPLASH_HEADING = { level: 1, name: 'Sign in to read the schedule' };

const GUEST_PATH = '/api/v1/auth-as-guest';
const guestCalls = () => ssoCalls().filter((made) => made.url.includes(GUEST_PATH));

const NIGHT = nightSchedule({ site: 'GS', night: '2025-11-14' });

/** Each answer serves once, so a request the test did not expect fails as "No more mocked responses". */
const openGate = async ({
  token = null,
  checked = token !== null,
  timings = SESSION_TIMINGS,
  mocks = [NIGHT],
  after,
}: {
  token?: string | null;
  checked?: boolean;
  timings?: SessionTimings;
  mocks?: MockLink.MockedResponse[];
  after?: ApolloLink;
} = {}) => {
  const store = createStore();
  store.set(odbTokenAtom, token);
  store.set(sessionCheckedAtom, checked);
  const { link, names: operations } = captureOperations();
  const client = createLinkClient(
    liveLink(store, after === undefined ? link : ApolloLink.from([link, after])),
    mocks.map((mock) => ({ maxUsageCount: 1, ...mock })),
  );
  const screen = await renderInShell(<NightPage />, {
    route: ROUTE,
    store,
    shell: (
      <ApolloProvider client={client}>
        <AuthSession timings={timings}>
          <SessionGateContainer>
            <Layout />
          </SessionGateContainer>
          <ToastOutlet />
        </AuthSession>
      </ApolloProvider>
    ),
  });
  return Object.assign(screen, { operations });
};

const toastTexts = (): string[] =>
  page
    .getByRole('alert')
    .elements()
    .map((toast) => toast.textContent ?? '');

const pressLogout = async (screen: Awaited<ReturnType<typeof openGate>>): Promise<void> => {
  await openAppMenu(screen);
  await page.getByRole('menuitem', { name: 'Logout' }).click();
};

beforeEach(() => {
  stubSso();
});

afterEach(() => {
  vi.useRealTimers();
});

describe(SessionGateContainer, () => {
  it('should show only the loading mark under the banner when the first check is still running', async () => {
    const screen = await openGate();

    await expect.element(screen.getByText('Loading Resource…')).toBeVisible();
    await expect.element(screen.getByTestId('env-banner')).toBeVisible();
    expect(screen.getByRole('heading', SPLASH_HEADING).query()).toBeNull();
    expect(screen.getByRole('heading', PAGE_HEADING).query()).toBeNull();
    expect(screen.getByRole('navigation').query()).toBeNull();
    expect(screen.getByRole('banner').query()).toBeNull();
  });

  it('should show the splash when an unanswered check passes the refresh timeout', async () => {
    fakeTimeouts();
    const screen = await openGate();

    await vi.advanceTimersByTimeAsync(REFRESH_TIMEOUT_MS - 1);
    expect(screen.getByRole('heading', SPLASH_HEADING).query()).toBeNull();
    expect(screen.getByText('Loading Resource…').element()).toBeVisible();

    await vi.advanceTimersByTimeAsync(1);

    await expect.element(screen.getByRole('heading', SPLASH_HEADING)).toBeVisible();
    expect(screen.getByText('Loading Resource…').query()).toBeNull();
  });

  it('should show the splash and not the page when the reader is checked and signed out', async () => {
    const screen = await openGate({ checked: true });

    await expect.element(screen.getByRole('heading', SPLASH_HEADING)).toBeVisible();
    expect(screen.getByRole('heading', PAGE_HEADING).query()).toBeNull();
    expect(screen.router.location.pathname + screen.router.location.search).toBe(ROUTE);
  });

  it('should show the page at the URL it was opened at when a guest signs in', async () => {
    const screen = await openGate({ checked: true });

    await screen.getByRole('button', { name: 'Continue as Guest' }).click();

    await expect.poll(guestCalls).toHaveLength(1);
    guestCalls()[0]?.answer({ body: fakeJwt({ type: 'guest', id: 'u-guest' }) });

    await expect.element(screen.getByRole('heading', PAGE_HEADING)).toBeVisible();
    await expect.element(screen.getByText('Loading the night…')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', SPLASH_HEADING).query()).toBeNull();
    expect(screen.router.location.pathname + screen.router.location.search).toBe(ROUTE);
    expect(guestCalls()).toHaveLength(1);
  });

  it.each([
    [
      'a sign-out in another tab',
      SIGNED_OUT_ELSEWHERE,
      'p-toast-message-info',
      3600,
      SESSION_TIMINGS,
      announceFromOtherTab,
    ],
    ['expiry', SESSION_ENDED, 'p-toast-message-warn', 1.5, SESSION_TIMINGS, () => Promise.resolve()],
    ['a refused refresh', SESSION_ENDED, 'p-toast-message-warn', 60, RENEW_AT_ONCE, refuseRefresh],
  ])(
    'should return to the splash with focus on its landmark when %s ends the session, saying "%s" and nothing about a menu',
    async (_, summary, severity, expiresInSeconds, timings, end) => {
      const screen = await openGate({ token: fakeJwt(standardUser('staff'), expiresInSeconds), timings });
      await expect.element(screen.getByRole('heading', PAGE_HEADING)).toBeVisible();

      await end();

      await expect.element(screen.getByRole('heading', SPLASH_HEADING), { timeout: 3_000 }).toBeVisible();
      expect(screen.getByRole('heading', PAGE_HEADING).query()).toBeNull();
      await expect.element(screen.getByRole('main', { name: SPLASH_HEADING.name })).toHaveFocus();
      await expect.element(toastNamed(summary)).toBeVisible();
      await expect.element(toastNamed(summary)).toHaveClass(severity);
      expect(toastNamed(summary).element().querySelector('.p-toast-detail')?.textContent ?? '').toBe('');
      expect(toastTexts().filter((text) => /menu/iu.test(text))).toEqual([]);
      expect(screen.router.location.pathname + screen.router.location.search).toBe(ROUTE);
    },
  );

  it.each([
    ['SSO confirms', () => ssoLogout().answer({ status: 200 }), []],
    ['SSO is unreachable', () => ssoLogout().fail(), [expect.stringContaining(LOGOUT_UNREACHABLE)]],
  ])('should return to the splash, announced once, when Logout is pressed and %s', async (_, settle, toasts) => {
    const screen = await openGate({ token: staffToken() });
    await expect.element(screen.getByRole('heading', PAGE_HEADING)).toBeVisible();

    await pressLogout(screen);
    settle();

    await expect.element(screen.getByRole('heading', SPLASH_HEADING)).toBeVisible();
    await expect.element(screen.getByRole('status')).toHaveTextContent('Logged out');
    expect(
      screen
        .getByRole('status')
        .elements()
        .map((status) => status.textContent),
    ).toEqual(['Logged out']);
    await expect.poll(toastTexts).toEqual(toasts);
    expect(toastTexts().filter((text) => /menu/iu.test(text))).toEqual([]);
  });

  it.each([
    [
      'a pressed Logout',
      async (screen: Awaited<ReturnType<typeof openGate>>) => {
        await pressLogout(screen);
        ssoLogout().answer({ status: 200 });
      },
    ],
    ['a sign-out in another tab', () => announceFromOtherTab()],
  ])('should send nothing, so no request leaves without the bearer, when %s ends the session', async (_, end) => {
    const screen = await openGate({ token: staffToken() });
    await expect.element(screen.getByRole('heading', PAGE_HEADING)).toBeVisible();

    await end(screen);

    await expect.element(screen.getByRole('heading', SPLASH_HEADING)).toBeVisible();
    await expect.element(screen.getByRole('button', { name: 'Continue as Guest' })).toBeEnabled();
    expect(screen.operations).toEqual(['NightSchedule']);
  });

  it('should show the reader no error when the session ends while the page is still loading', async () => {
    let held = 0;
    const holdFirst = new ApolloLink((operation, forward) => {
      held += 1;
      return held === 1 ? new Observable<ApolloLink.Result>(() => undefined) : forward(operation);
    });
    const drawn: string[] = [];
    const observer = new MutationObserver((records) => {
      for (const record of records) record.addedNodes.forEach((node) => drawn.push(node.textContent ?? ''));
    });
    observer.observe(document.body, { subtree: true, childList: true });
    try {
      const screen = await openGate({ token: staffToken(), after: holdFirst });
      await expect.element(screen.getByText('Loading the night…')).toBeVisible();

      await pressLogout(screen);
      ssoLogout().answer({ status: 200 });

      await expect.element(screen.getByRole('heading', SPLASH_HEADING)).toBeVisible();
      await expect.element(screen.getByRole('status')).toHaveTextContent('Logged out');
      expect(toastTexts()).toEqual([]);
      expect(screen.operations).toEqual(['NightSchedule']);
    } finally {
      observer.disconnect();
    }
    expect(drawn.filter((text) => text.includes('Could not load'))).toEqual([]);
  });

  it('should take a standing session toast down and fetch the page afresh when a guest signs in again', async () => {
    const screen = await openGate({ token: staffToken(), mocks: [NIGHT, NIGHT] });
    await expect.element(screen.getByRole('heading', PAGE_HEADING)).toBeVisible();
    await announceFromOtherTab();
    await expect.element(toastNamed(SIGNED_OUT_ELSEWHERE)).toBeVisible();

    await screen.getByRole('button', { name: 'Continue as Guest' }).click();
    await expect.poll(guestCalls).toHaveLength(1);
    guestCalls()[0]?.answer({ body: fakeJwt({ type: 'guest', id: 'u-guest' }) });

    await expect.element(screen.getByRole('heading', PAGE_HEADING)).toBeVisible();
    await expect.element(toastNamed(SIGNED_OUT_ELSEWHERE)).not.toBeInTheDocument();
    await expect.element(screen.getByText('Loading the night…')).not.toBeInTheDocument();
    expect(screen.operations).toEqual(['NightSchedule', 'NightSchedule']);
  });

  describe('a tab that pressed Logout and then continued as guest', () => {
    const logOutThenContinueAsGuest = async (
      screen: Awaited<ReturnType<typeof openGate>>,
      guestToken: string,
    ): Promise<void> => {
      await expect.element(screen.getByRole('heading', PAGE_HEADING)).toBeVisible();
      await pressLogout(screen);
      ssoLogout().answer({ status: 200 });
      await expect.element(screen.getByRole('heading', SPLASH_HEADING)).toBeVisible();

      await screen.getByRole('button', { name: 'Continue as Guest' }).click();
      await expect.poll(guestCalls).toHaveLength(1);
      guestCalls()[0]?.answer({ body: guestToken });
      await expect.element(screen.getByRole('heading', PAGE_HEADING)).toBeVisible();
    };

    it('should still return to the splash when another tab signs out', async () => {
      const screen = await openGate({ token: staffToken(), mocks: [NIGHT, NIGHT] });
      await logOutThenContinueAsGuest(screen, fakeJwt({ type: 'guest', id: 'u-guest' }));

      await announceFromOtherTab();

      await expect.element(screen.getByRole('heading', SPLASH_HEADING)).toBeVisible();
      expect(screen.getByRole('heading', PAGE_HEADING).query()).toBeNull();
      await expect.element(toastNamed(SIGNED_OUT_ELSEWHERE)).toBeVisible();
    });

    it('should still refresh the guest token when it reaches the refresh-ahead mark', async () => {
      fakeTimeouts();
      const screen = await openGate({ token: staffToken(), mocks: [NIGHT, NIGHT] });
      await logOutThenContinueAsGuest(screen, fakeJwt({ type: 'guest', id: 'u-guest' }, 120));

      await vi.advanceTimersByTimeAsync(89_000);
      expect(ssoRefreshes()).toHaveLength(0);

      await vi.advanceTimersByTimeAsync(1_000);
      expect(ssoRefreshes()).toHaveLength(1);
    });

    it('should still tell the other tabs when it presses Logout again', async () => {
      const screen = await openGate({ token: staffToken(), mocks: [NIGHT, NIGHT] });
      await logOutThenContinueAsGuest(screen, fakeJwt({ type: 'guest', id: 'u-guest' }));
      const otherTab = new BroadcastChannel(SESSION_CHANNEL);
      const heard: unknown[] = [];
      otherTab.addEventListener('message', (event) => heard.push(event.data));

      try {
        await pressLogout(screen);
        await expect.poll(() => heard).toEqual([SIGNED_OUT_MESSAGE]);
        ssoLogout().answer({ status: 200 });
        await expect.element(screen.getByRole('heading', SPLASH_HEADING)).toBeVisible();
      } finally {
        otherTab.close();
      }
    });
  });

  it('should show the page at its URL, never drawing the splash or the loading mark on the way, when the reader holds a token', async () => {
    const drawn: string[] = [];
    const observer = new MutationObserver((records) => {
      for (const record of records) record.addedNodes.forEach((node) => drawn.push(node.textContent ?? ''));
    });
    observer.observe(document.body, { subtree: true, childList: true });
    try {
      const screen = await openGate({ token: staffToken() });

      await expect.element(screen.getByRole('heading', PAGE_HEADING)).toBeVisible();
      expect(screen.getByRole('heading', SPLASH_HEADING).query()).toBeNull();
      expect(screen.router.location.pathname + screen.router.location.search).toBe(ROUTE);
    } finally {
      observer.disconnect();
    }
    expect(drawn.some((text) => text.includes(PAGE_HEADING.name))).toBe(true);
    expect(drawn.filter((text) => text.includes(SPLASH_HEADING.name))).toEqual([]);
    expect(drawn.filter((text) => text.includes('Loading Resource'))).toEqual([]);
  });
});

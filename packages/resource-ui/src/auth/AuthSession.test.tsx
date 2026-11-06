import { type ApolloClient, ApolloLink, gql } from '@apollo/client';
import { ApolloProvider } from '@apollo/client/react';
import type { MockLink } from '@apollo/client/testing';
import { Observable } from '@apollo/client/utilities';
import { toastAtom } from '@gemini-hlsw/lucuma-common-ui';
import { fakeJwt, standardUser } from '@gemini-hlsw/lucuma-common-ui/testing';
import { createStore, Provider as JotaiProvider, type Store } from 'jotai';
import type { ToastMessage } from 'primereact/toast';
import { type JSX, type ReactNode, StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-react';

import NightPage from '@/app/pages/NightPage';
import { isLoggedInAtom, odbTokenAtom, sessionCheckedAtom, sessionStatusAtom, setToken } from '@/components/atoms/auth';
import { Layout } from '@/components/layout/Layout';
import { Navbar } from '@/components/layout/Navbar';
import { ToastOutlet } from '@/components/ui/ToastOutlet';
import { liveLink } from '@/gql/ApolloConfigs';
import { usePublishedSemesters } from '@/gql/hooks';
import { nightSchedule } from '@/test/fixtures/night';
import { publishedSemester, publishedSemesters } from '@/test/fixtures/semester';
import { fakeTimeouts, openAppMenu, textsOf } from '@/test/helpers';
import { captureHeader, captureOperations, createLinkClient, respondWith } from '@/test/linkClient';
import { renderInShell, type RenderResultWithRoute, renderWithRoute } from '@/test/render';
import { answerRefresh, ssoCall, ssoCalls, ssoLogout, ssoRefreshes, stubSso } from '@/test/sso';

import { AuthSession } from './AuthSession';
import {
  pendingRefresh,
  SESSION_CHANNEL,
  SESSION_TIMINGS,
  type SessionTimings,
  SIGNED_OUT_MESSAGE,
  signOut,
  startSession,
} from './session';
import {
  LOGOUT_UNREACHABLE,
  SESSION_ENDED,
  SessionNoticesContainer,
  SIGNED_OUT_ELSEWHERE,
} from './SessionNoticesContainer';

function SemesterCount({ testId = 'semesters' }: { testId?: string }): JSX.Element {
  const { semesters, loading } = usePublishedSemesters();
  return <p data-testid={testId}>{loading ? 'loading' : `${String(semesters.length)} semesters`}</p>;
}

const ONE_SEMESTER = { publishedSemesters: [publishedSemester({ site: 'GS', semester: '2025B' })] };

let store: Store;

const RENEWAL_MARKER = gql`
  query RenewalMarker {
    __typename
  }
`;

const onSecondRequest = (outcome: ApolloLink.Result | Error): ApolloLink => {
  let requests = 0;
  return new ApolloLink((operation, forward) => {
    requests += 1;
    return requests === 2 ? respondWith(outcome) : forward(operation);
  });
};

const SHELL_ROUTE = '/night?site=GS&night=2025-11-14';
const NO_SEMESTERS = publishedSemesters();
const EMPTY_NIGHT = nightSchedule({ site: 'GS', night: '2025-11-14' });

const MARKED: MockLink.MockedResponse = {
  request: { query: RENEWAL_MARKER },
  result: { data: { __typename: 'Query' } },
};

const capturingApollo = (after?: ApolloLink) => {
  const { link, sent: authorizations } = captureHeader('Authorization');
  return {
    client: createLinkClient(liveLink(store, after === undefined ? link : ApolloLink.from([link, after])), [
      NO_SEMESTERS,
      EMPTY_NIGHT,
      MARKED,
    ]),
    authorizations,
  };
};

const renderInSession = (client: ApolloClient, children: ReactNode) =>
  render(
    <StrictMode>
      <JotaiProvider store={store}>
        <ApolloProvider client={client}>
          <AuthSession>{children}</AuthSession>
        </ApolloProvider>
      </JotaiProvider>
    </StrictMode>,
  );

const renderAuthSession = async (children: ReactNode = null, after?: ApolloLink) => {
  const { client, authorizations } = capturingApollo(after);
  const screen = await renderInSession(client, children);
  return { screen, client, authorizations };
};

const survivingSsoCall = () => ssoCalls().find((made) => !made.signal?.aborted);

const signIn = (expiresInSeconds?: number): string => {
  const token = fakeJwt(standardUser('staff'), expiresInSeconds);
  store.set(odbTokenAtom, token);
  store.set(sessionCheckedAtom, true);
  return token;
};

const NIGHT_LOADING = 'Loading the night…';

/** Stands in for a Resource service that denies an anonymous caller, answering with an error and no data. */
const deniesAnonymous = new ApolloLink((operation, forward) => {
  const headers = (operation.getContext().headers ?? {}) as Record<string, string>;
  return Object.hasOwn(headers, 'Authorization')
    ? forward(operation)
    : respondWith({ errors: [{ message: 'Access denied.' }] });
});

const renderShell = async ({
  token = null,
  after,
  timings = SESSION_TIMINGS,
}: {
  token?: string | null;
  after?: ApolloLink;
  timings?: SessionTimings;
} = {}) => {
  const { link: logOperation, names: operations } = captureOperations();
  const { client, authorizations } = capturingApollo(
    after === undefined ? logOperation : ApolloLink.from([logOperation, after]),
  );
  setToken(store, token);
  store.set(sessionCheckedAtom, token !== null);
  const screen = await renderInShell(<NightPage />, {
    route: SHELL_ROUTE,
    store,
    shell: (
      <ApolloProvider client={client}>
        <AuthSession timings={timings}>
          <Layout />
          <ToastOutlet />
        </AuthSession>
      </ApolloProvider>
    ),
  });
  return Object.assign(screen, { client, authorizations, operations });
};

const sentOnce = (operations: readonly string[]): boolean => new Set(operations).size === operations.length;

/** A page the reader opens beside the shell, on the shell's client, and may leave and come back to. */
const openSemesters = (client: ApolloClient) =>
  render(
    <ApolloProvider client={client}>
      <SemesterCount />
    </ApolloProvider>,
  );

const pressLogout = async (): Promise<void> => {
  const signedOut = signOut(store);
  ssoLogout().answer({ status: 200 });
  await signedOut;
};

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

const refuseRefresh = async (): Promise<void> => {
  await expect.poll(() => ssoRefreshes().length).toBe(1);
  await answerRefresh(0, { status: 403 });
};

/** A function, so each token's `exp` counts from the moment the test asks for it. */
const staffToken = () => fakeJwt(standardUser('staff'));

/** The masthead under the real session keeper, so a logout, SSO's answers and other tabs' messages all reach the notices. */
const renderMasthead = async (token: string | null = staffToken(), timings?: SessionTimings, checked = true) => {
  setToken(store, token);
  store.set(sessionCheckedAtom, checked);
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
const FLUSH = { severity: 'info', summary: 'Flushed' } as const satisfies ToastMessage;

const logOutFromMenu = async () => {
  const screen = await renderMasthead();
  await openAppMenu(screen);
  await page.getByRole('menuitem', { name: 'Logout' }).click();
  return screen;
};

const toastNamed = (summary: string) => page.getByRole('alert').filter({ hasText: summary });

/** A closing toast stays in the DOM through PrimeReact's exit transition, marked by this class. */
async function expectShowing(summary: string): Promise<void> {
  await expect.element(toastNamed(summary)).toBeVisible();
  await expect.element(toastNamed(summary)).not.toHaveClass('p-toast-message-exit');
}

/** Toasts still on screen, leaving out those closing and the one `afterPendingWork` flushes with. */
const noticesShowing = (): string[] =>
  page
    .getByRole('alert')
    .elements()
    .filter((toast) => !toast.classList.contains('p-toast-message-exit'))
    .map((toast) => toast.textContent)
    .filter((text) => text !== FLUSH.summary);

/** Once this toast renders, so has every update queued before it, including a show from a promise already settled, whose callbacks run before React renders. */
async function afterPendingWork(): Promise<void> {
  const toast = store.get(toastAtom)!;
  toast.show(FLUSH);
  await expect.element(toastNamed(FLUSH.summary)).toBeInTheDocument();
  toast.remove(FLUSH);
}

/** Logs out without polling for the menu, so it does not mix polling with fake timers. */
const logOutAtOnce = async (screen: RenderResultWithRoute): Promise<void> => {
  await screen.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('menuitem', { name: 'Logout' }).click();
};

beforeEach(() => {
  store = createStore();
  stubSso();
});

afterEach(() => {
  vi.useRealTimers();
});

describe(AuthSession, () => {
  it('should settle into one signed-in controller, not counting the aborted bootstrap, when StrictMode mounts twice', async () => {
    await renderAuthSession();

    await expect.poll(() => ssoCalls().length).toBe(2);
    const surviving = ssoCalls().filter((made) => !made.signal?.aborted);
    expect(surviving).toHaveLength(1);

    const token = fakeJwt(standardUser('staff'));
    surviving[0]?.answer({ body: token });
    await pendingRefresh();

    expect(store.get(odbTokenAtom)).toBe(token);
    expect(store.get(isLoggedInAtom)).toBe(true);
    expect(store.get(sessionCheckedAtom)).toBe(true);
  });

  it('should send a query mounted beside the session once, with the bearer, when the bootstrap signs the reader in', async () => {
    const { client, authorizations } = capturingApollo();

    const screen = await render(
      <StrictMode>
        <JotaiProvider store={store}>
          <ApolloProvider client={client}>
            <AuthSession>{null}</AuthSession>
            <SemesterCount />
          </ApolloProvider>
        </JotaiProvider>
      </StrictMode>,
    );

    await expect.poll(() => ssoCalls().length).toBe(2);
    await expect.element(screen.getByTestId('semesters')).toHaveTextContent('loading');
    expect(authorizations).toEqual([]);

    const token = fakeJwt(standardUser('staff'));
    survivingSsoCall()?.answer({ body: token });
    await pendingRefresh();

    await expect.element(screen.getByTestId('semesters')).not.toHaveTextContent('loading');
    expect(authorizations).toEqual([`Bearer ${token}`]);
  });

  it.each([
    ['the bootstrap is rejected', () => survivingSsoCall()?.answer({ status: 403 })],
    ['SSO proves unreachable', () => survivingSsoCall()?.fail()],
  ])('should render the app at once and send its query signed out when %s', async (_, settle) => {
    const { screen, authorizations } = await renderAuthSession(<SemesterCount />);

    await expect.poll(() => ssoCalls().length).toBe(2);
    await expect.element(screen.getByTestId('semesters')).toHaveTextContent('loading');
    expect(authorizations).toEqual([]);

    settle();
    await pendingRefresh();

    await expect.element(screen.getByTestId('semesters')).not.toHaveTextContent('loading');
    expect(store.get(sessionStatusAtom)).toBe('signed-out');
    expect(authorizations).toEqual([null]);
  });

  it('should not refetch when the token is renewed', async () => {
    const token = signIn();
    const { screen, client, authorizations } = await renderAuthSession(<SemesterCount />);
    await expect.element(screen.getByTestId('semesters')).not.toHaveTextContent('loading');

    const renewed = fakeJwt(standardUser('staff'), 7200);
    store.set(odbTokenAtom, renewed);
    await client.query({ query: RENEWAL_MARKER, fetchPolicy: 'network-only' });

    expect(authorizations).toEqual([`Bearer ${token}`, `Bearer ${renewed}`]);
    expect(ssoCalls()).toHaveLength(0);
  });

  it('should refetch and bring the new answer to the page when the reader signs in', async () => {
    store.set(sessionCheckedAtom, true);
    const { screen, authorizations } = await renderAuthSession(
      <SemesterCount />,
      onSecondRequest({ data: ONE_SEMESTER }),
    );
    await expect.element(screen.getByTestId('semesters')).toHaveTextContent('0 semesters');
    expect(authorizations).toEqual([null]);

    const token = fakeJwt(standardUser('staff'));
    store.set(odbTokenAtom, token);

    await expect.poll(() => authorizations).toEqual([null, `Bearer ${token}`]);
    await expect.element(screen.getByTestId('semesters')).toHaveTextContent('1 semesters');
  });

  it('should refetch, and the new answer reach the page, when the reader signs out', async () => {
    const token = signIn();
    const { screen, authorizations } = await renderAuthSession(
      <SemesterCount />,
      onSecondRequest({ data: ONE_SEMESTER }),
    );
    await expect.element(screen.getByTestId('semesters')).not.toHaveTextContent('loading');
    await expect.element(screen.getByTestId('semesters')).not.toHaveTextContent('1 semesters');
    expect(authorizations).toEqual([`Bearer ${token}`]);

    store.set(odbTokenAtom, null);

    await expect.poll(() => authorizations).toEqual([`Bearer ${token}`, null]);
    await expect.element(screen.getByTestId('semesters')).toHaveTextContent('1 semesters');
  });

  it('should keep the page up when the refetch fails', async () => {
    const token = signIn();
    const { screen, authorizations } = await renderAuthSession(<SemesterCount />, onSecondRequest(new Error('down')));
    await expect.element(screen.getByTestId('semesters')).not.toHaveTextContent('loading');

    store.set(odbTokenAtom, null);

    await expect.poll(() => authorizations).toEqual([`Bearer ${token}`, null]);
    await expect.element(screen.getByTestId('semesters')).toBeInTheDocument();
  });

  it('should drop the refetch subscription, leaving a query still open on its client alone, when it unmounts', async () => {
    const token = signIn();
    const stranded = capturingApollo();
    const probe = await render(
      <ApolloProvider client={stranded.client}>
        <SemesterCount testId="stranded" />
      </ApolloProvider>,
    );
    const session = await renderInSession(stranded.client, null);
    await expect.element(probe.getByTestId('stranded')).not.toHaveTextContent('loading');
    expect(stranded.authorizations).toEqual([`Bearer ${token}`]);
    await session.unmount();

    const { screen, authorizations } = await renderAuthSession(<SemesterCount />);
    await expect.element(screen.getByTestId('semesters')).not.toHaveTextContent('loading');

    store.set(odbTokenAtom, null);

    await expect.poll(() => authorizations).toEqual([`Bearer ${token}`, null]);
    expect(stranded.authorizations).toEqual([`Bearer ${token}`]);
  });

  it('should stop the controller, so no refresh timer survives, when it unmounts', async () => {
    fakeTimeouts();
    signIn(120);

    const { screen } = await renderAuthSession();
    await screen.unmount();

    vi.advanceTimersByTime(200_000);
    expect(ssoCalls()).toHaveLength(0);
  });

  it('should draw the shell at once and send nothing before the check settles, then each page query once with the bearer it found, when the page loads', async () => {
    const screen = await renderShell();

    await expect.element(screen.getByTestId('account-control')).toHaveTextContent('Checking sign-in');
    await expect.element(screen.getByRole('navigation', { name: 'Primary navigation' }).first()).toBeVisible();
    await expect.element(screen.getByRole('heading', { level: 1, name: 'Night of 2025-11-14' })).toBeVisible();
    await expect.element(screen.getByText(NIGHT_LOADING)).toBeVisible();
    expect(screen.operations).toEqual([]);

    const token = fakeJwt(standardUser('staff'));
    await answerRefresh(0, { body: token });

    await expect.element(screen.getByTestId('account-control')).toHaveTextContent('Ada Lovelace');
    await expect.element(screen.getByText(NIGHT_LOADING)).not.toBeInTheDocument();
    expect(screen.operations).toEqual(['NightSchedule']);
    expect(screen.authorizations).toEqual([`Bearer ${token}`]);
  });

  it('should show no live-server failure when requests wait on the check', async () => {
    const screen = await renderShell({ after: deniesAnonymous });
    await expect.element(screen.getByText(NIGHT_LOADING)).toBeVisible();

    await answerRefresh(0, { body: fakeJwt(standardUser('staff')) });
    await expect.element(screen.getByText(NIGHT_LOADING)).not.toBeInTheDocument();

    expect(store.get(toastAtom)).not.toBeNull();
    expect(document.querySelector('.p-toast-message')).toBeNull();
  });

  it('should send each request once, at once, with the bearer when a tab returns with a token', async () => {
    const token = fakeJwt(standardUser('staff'));
    const screen = await renderShell({ token });

    await expect.element(screen.getByText(NIGHT_LOADING)).not.toBeInTheDocument();
    await screen.client.query({ query: RENEWAL_MARKER, fetchPolicy: 'network-only' });

    expect(screen.operations.length).toBeGreaterThan(1);
    expect(sentOnce(screen.operations)).toBe(true);
    expect(screen.authorizations.every((authorization) => authorization === `Bearer ${token}`)).toBe(true);
    expect(ssoCalls()).toHaveLength(0);
  });

  it('should hold the data for the full 10 s when the first refresh goes unanswered', async () => {
    fakeTimeouts();
    const screen = await renderShell();

    await vi.advanceTimersByTimeAsync(9_999);

    await expect.element(screen.getByTestId('account-control')).toHaveTextContent('Checking sign-in');
    expect(screen.getByText(NIGHT_LOADING).element()).toBeVisible();
    expect(screen.operations).toEqual([]);
  });

  it('should send the data without a bearer when the first refresh goes unanswered past the bound', async () => {
    const screen = await renderShell({ timings: { ...SESSION_TIMINGS, refreshTimeoutMs: 20 } });

    await expect.element(screen.getByTestId('account-control')).toHaveTextContent('Not signed in');
    await expect.element(screen.getByText(NIGHT_LOADING)).not.toBeInTheDocument();
    expect(screen.operations).toEqual(['NightSchedule']);
    expect(screen.authorizations).toEqual([null]);
  });

  it('should never draw "Not signed in" on the way to signing in when SSO answers at 9 s', async () => {
    fakeTimeouts();
    const drawn: string[] = [];
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        drawn.push(record.target.textContent ?? '');
        record.addedNodes.forEach((node) => drawn.push(node.textContent ?? ''));
      }
    });
    observer.observe(document.body, { subtree: true, childList: true, characterData: true });
    try {
      const screen = await renderShell();
      expect(screen.getByTestId('account-control').element()).toHaveTextContent('Checking sign-in');

      await vi.advanceTimersByTimeAsync(9_000);

      await answerRefresh(0, { body: fakeJwt(standardUser('staff')) });

      await vi.advanceTimersByTimeAsync(60_000);

      expect(screen.getByTestId('account-control').element()).toHaveTextContent('Ada Lovelace');
    } finally {
      observer.disconnect();
    }

    expect(drawn.some((text) => text.includes('Checking sign-in'))).toBe(true);
    expect(drawn.filter((text) => text.includes('Not signed in'))).toEqual([]);
    expect(ssoRefreshes()).toHaveLength(1);
  });

  it('should answer a sign-in from the wire with the new bearer, never from the old cache, when it comes straight after a sign-out', async () => {
    const token = signIn();
    const { screen, authorizations } = await renderAuthSession(
      <SemesterCount />,
      onSecondRequest({ data: ONE_SEMESTER }),
    );
    await expect.element(screen.getByTestId('semesters')).toHaveTextContent('0 semesters');

    const fresh = fakeJwt(standardUser('staff'), 7200);
    store.set(odbTokenAtom, null);
    store.set(odbTokenAtom, fresh);

    await expect.element(screen.getByTestId('semesters')).toHaveTextContent('1 semesters');
    expect(authorizations).toEqual([`Bearer ${token}`, `Bearer ${fresh}`]);
    expect(document.querySelector('[role="alert"]')).toBeNull();
  });

  it('should show the reader no error when the session ends while a page is still loading', async () => {
    let held = 0;
    const holdFirst = new ApolloLink((operation, forward) => {
      held += 1;
      return held === 1 ? new Observable<ApolloLink.Result>(() => undefined) : forward(operation);
    });
    const screen = await renderShell({ token: fakeJwt(standardUser('staff')), after: holdFirst });
    await expect.element(screen.getByText(NIGHT_LOADING)).toBeVisible();

    await pressLogout();

    await expect.element(screen.getByTestId('account-control')).toHaveTextContent('Not signed in');
    await expect.element(screen.getByText(NIGHT_LOADING)).not.toBeInTheDocument();
    expect(screen.getByText('Could not load the night', { exact: false }).query()).toBeNull();
    expect(textsOf('.p-toast-summary')).toEqual([]);
  });

  describe('after the session ends', () => {
    it.each([
      ['a pressed Logout', 3600, pressLogout],
      ['a sign-out in another tab', 3600, announceFromOtherTab],
      ['a refused refresh', 20, refuseRefresh],
      ['expiry', 1.5, () => Promise.resolve()],
    ])(
      'should fetch a page afresh, not read it from the cache, when the reader comes back to it after a session ended by %s and a fresh sign-in',
      async (_, expiresInSeconds, end) => {
        const screen = await renderShell({ token: fakeJwt(standardUser('staff'), expiresInSeconds) });
        await expect.element(screen.getByText(NIGHT_LOADING)).not.toBeInTheDocument();
        const page = await openSemesters(screen.client);
        await expect.element(page.getByTestId('semesters')).toHaveTextContent('0 semesters');
        await page.unmount();

        await end();
        await expect
          .element(screen.getByTestId('account-control'), { timeout: 3_000 })
          .toHaveTextContent('Not signed in');

        setToken(store, fakeJwt(standardUser('staff')));
        await expect.element(screen.getByTestId('account-control')).toHaveTextContent('Ada Lovelace');
        const again = await openSemesters(screen.client);
        await expect.element(again.getByTestId('semesters')).toHaveTextContent('0 semesters');

        expect(screen.operations.filter((name) => name === 'PublishedSemesters')).toHaveLength(2);
      },
    );
  });

  describe(SessionNoticesContainer, () => {
    it('should warn in a toast until the next sign-in when the logout never reached SSO', async () => {
      const screen = await logOutFromMenu();
      await expect.element(screen.getByRole('status')).toHaveTextContent('Logged out');

      ssoCall(0).fail();

      await expectShowing(LOGOUT_UNREACHABLE);
      await expect
        .element(toastNamed(LOGOUT_UNREACHABLE).getByText('Close the browser to end the session.'))
        .toBeVisible();
      expect(screen.getByRole('status').element().textContent).toBe('Logged out');

      setToken(store, staffToken());

      await expect.element(toastNamed(LOGOUT_UNREACHABLE)).not.toBeInTheDocument();
    });

    it('should sign out before SSO answers, hand focus back to the menu button, and announce again after a fresh sign-in, when the reader logs out from the menu', async () => {
      const screen = await logOutFromMenu();
      await expect.element(screen.getByTestId('account-control')).toHaveTextContent('Not signed in');
      await expect.element(screen.getByRole('status')).toHaveTextContent('Logged out');
      const menuButton = screen.getByRole('button', { name: 'Menu' }).element();
      await expect.poll(() => document.activeElement).toBe(menuButton);

      setToken(store, staffToken());
      await expect.element(screen.getByTestId('account-control')).toHaveTextContent('Ada Lovelace');
      await expect.element(screen.getByRole('status')).toHaveTextContent('');

      await openAppMenu(screen);
      await expect.element(page.getByRole('menuitem', { name: 'Logout' })).toBeVisible();
      await page.getByRole('menuitem', { name: 'Logout' }).click();

      await expect.element(screen.getByTestId('account-control')).toHaveTextContent('Not signed in');
      await expect.element(screen.getByRole('status')).toHaveTextContent('Logged out');
    });

    it('should show a notice when SSO refuses to renew the session', async () => {
      await renderMasthead(fakeJwt(standardUser('staff'), 60), RENEW_AT_ONCE);

      await expect.poll(() => ssoRefreshes()).toHaveLength(1);
      ssoRefreshes()[0]?.answer({ status: 403 });

      await expectShowing(SESSION_ENDED);
      await expect
        .element(
          toastNamed(SESSION_ENDED).getByText('Choose "Login with ORCID" from the menu to sign in again.', {
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
        await expectShowing(SIGNED_OUT_ELSEWHERE);
      } finally {
        otherTab.close();
      }

      expect(noticesShowing()).toEqual([expect.stringContaining(SIGNED_OUT_ELSEWHERE)]);

      setToken(store, fakeJwt(standardUser('staff'), 60));
      await expect.element(toastNamed(SIGNED_OUT_ELSEWHERE)).not.toBeInTheDocument();

      const stop = startSession(store, RENEW_AT_ONCE);
      try {
        await expect.poll(() => ssoRefreshes()).toHaveLength(1);
        ssoRefreshes()[0]?.answer({ status: 403 });
        await expectShowing(SESSION_ENDED);
      } finally {
        stop();
      }
      expect(noticesShowing()).toEqual([expect.stringContaining(SESSION_ENDED)]);
    });

    it.each([
      ['from the first render', true],
      ['once the first check settles', false],
    ])('should show no session-ended notice when a visitor is signed out %s', async (_when, checked) => {
      const screen = await renderMasthead(null, undefined, checked);

      store.set(sessionCheckedAtom, true);

      await expect.element(screen.getByTestId('account-control')).toHaveTextContent('Not signed in');
      expect(noticesShowing()).toEqual([]);
    });

    it.each([
      [SESSION_ENDED, () => setToken(store, null)],
      [
        LOGOUT_UNREACHABLE,
        async (screen: RenderResultWithRoute) => {
          await logOutAtOnce(screen);
          ssoCall(0).fail();
          await vi.advanceTimersByTimeAsync(0);
        },
      ],
    ])('should keep "%s" on screen when ten minutes pass', async (summary, end) => {
      fakeTimeouts();
      const screen = await renderMasthead();

      await end(screen);
      await expect.poll(noticesShowing).toContainEqual(expect.stringContaining(summary));
      await vi.advanceTimersByTimeAsync(TEN_MINUTES);

      await expect.poll(noticesShowing).toContainEqual(expect.stringContaining(summary));
    });

    it(`should keep "${SIGNED_OUT_ELSEWHERE}" on screen when ten minutes pass`, async () => {
      fakeTimeouts();
      await renderMasthead();
      const otherTab = new BroadcastChannel(SESSION_CHANNEL);
      // A channel delivers to its listeners in the order they opened, so this one hears the message after the session keeper has.
      const listener = new BroadcastChannel(SESSION_CHANNEL);
      const delivered = new Promise((resolve) => {
        listener.addEventListener('message', resolve, { once: true });
      });

      try {
        otherTab.postMessage(SIGNED_OUT_MESSAGE);
        await delivered;
        await expect.poll(noticesShowing).toContainEqual(expect.stringContaining(SIGNED_OUT_ELSEWHERE));
        await vi.advanceTimersByTimeAsync(TEN_MINUTES);

        expect(noticesShowing()).toContainEqual(expect.stringContaining(SIGNED_OUT_ELSEWHERE));
      } finally {
        otherTab.close();
        listener.close();
      }
    });

    it.each([
      ['SSO confirms it', 'Logged out', () => ssoCall(0).answer({ status: 200 })],
      [
        'SSO fails only after the reader signed in again',
        '',
        () => {
          setToken(store, staffToken());
          ssoCall(0).fail();
        },
      ],
    ])('should show no notice when the reader logs out and %s', async (_when, announcement, settle) => {
      fakeTimeouts();
      const screen = await renderMasthead();

      await logOutAtOnce(screen);
      settle();
      await vi.advanceTimersByTimeAsync(0);

      await expect.element(screen.getByRole('status')).toHaveTextContent(announcement);
      expect(noticesShowing()).toEqual([]);
    });

    it('should remove the session-ended notice once the reader signs in, and show one when the next session ends', async () => {
      await renderMasthead();
      setToken(store, null);
      await expectShowing(SESSION_ENDED);

      setToken(store, staffToken());
      await expect.element(toastNamed(SESSION_ENDED)).not.toBeInTheDocument();

      setToken(store, null);
      await expectShowing(SESSION_ENDED);
      await afterPendingWork();

      expect(noticesShowing().filter((text) => text.startsWith(SESSION_ENDED))).toHaveLength(1);
    });

    it('should show the session-ended notice above the open About dialog, without taking focus from it, when the session ends under it', async () => {
      const screen = await renderMasthead();
      await openAppMenu(screen);
      await page.getByRole('menuitem', { name: 'About Resource' }).click();
      const dialog = page.getByTestId('about-resource');
      await expect.element(dialog).toBeVisible();
      const copy = dialog.getByRole('button', { name: 'Copy version' }).element() as HTMLElement;
      copy.focus();

      setToken(store, null);
      await expectShowing(SESSION_ENDED);

      expect(document.activeElement).toBe(copy);
      await toastNamed(SESSION_ENDED).getByRole('button', { name: 'Close' }).click();
      await expect.element(toastNamed(SESSION_ENDED)).not.toBeInTheDocument();
      await expect.element(dialog).toBeVisible();
    });
  });
});

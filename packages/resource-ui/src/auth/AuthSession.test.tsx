import { type ApolloClient, ApolloLink, gql } from '@apollo/client';
import { ApolloProvider } from '@apollo/client/react';
import type { MockLink } from '@apollo/client/testing';
import { Observable } from '@apollo/client/utilities';
import { toastAtom } from '@gemini-hlsw/lucuma-common-ui';
import { fakeJwt, standardUser } from '@gemini-hlsw/lucuma-common-ui/testing';
import { createStore, Provider as JotaiProvider, type Store } from 'jotai';
import { type JSX, type ReactNode, StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';

import NightPage from '@/app/pages/NightPage';
import { isLoggedInAtom, odbTokenAtom, sessionCheckedAtom, sessionStatusAtom, setToken } from '@/components/atoms/auth';
import { Layout } from '@/components/layout/Layout';
import { ToastOutlet } from '@/components/ui/ToastOutlet';
import { liveLink } from '@/gql/ApolloConfigs';
import { usePublishedSemesters } from '@/gql/hooks';
import { nightSchedule } from '@/test/fixtures/night';
import { publishedSemester, publishedSemesters } from '@/test/fixtures/semester';
import { afterPendingWork, fakeTimeouts, toastsShowing } from '@/test/helpers';
import { captureHeader, captureOperations, createLinkClient, respondWith } from '@/test/linkClient';
import { renderInShell, renderWithRoute } from '@/test/render';
import { announceFromOtherTab, staffToken } from '@/test/session';
import { answerRefresh, failRefresh, ssoCalls, ssoLogout, ssoRefreshes, stubSso } from '@/test/sso';

import { AuthSession } from './AuthSession';
import { pendingRefresh, SESSION_TIMINGS, type SessionTimings, signOut } from './session';
import { SessionGateContainer } from './SessionGateContainer';
import { REFRESH_TIMEOUT_MS } from './ssoClient';

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

const ROUTE = '/night?site=GS&night=2025-11-14';
const NIGHT_LOADING = 'Loading the night…';
const GATE_LOADING = 'Loading Resource…';
const SPLASH_HEADING = { level: 1, name: 'Sign in to read the schedule' };

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
          <SessionGateContainer>
            <Layout />
          </SessionGateContainer>
          <ToastOutlet />
        </AuthSession>
      </ApolloProvider>
    ),
  });
  return Object.assign(screen, { client, authorizations, operations });
};

/** The tree `main.tsx` mounts, with `app` for the router, so the session, the gate and the link chain meet as they do there. */
const renderGated = async ({
  token = null,
  checked = false,
  app = <SemesterCount />,
  after,
}: { token?: string | null; checked?: boolean; app?: ReactNode; after?: ApolloLink } = {}) => {
  const { link: logOperation, names: operations } = captureOperations();
  const { client, authorizations } = capturingApollo(
    after === undefined ? logOperation : ApolloLink.from([logOperation, after]),
  );
  setToken(store, token);
  store.set(sessionCheckedAtom, checked);
  const screen = await renderWithRoute(
    <ApolloProvider client={client}>
      <AuthSession>
        <SessionGateContainer>{app}</SessionGateContainer>
        <ToastOutlet />
      </AuthSession>
    </ApolloProvider>,
    { route: ROUTE, store },
  );
  return Object.assign(screen, { authorizations, operations });
};

/** A page the reader opens beside the session, on its client, and may leave and come back to. */
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

/** Every text added to the document, so a test sees what was drawn on the way even if it is gone by the end. */
const recordDrawn = (): { texts: string[]; stop: () => void } => {
  const texts: string[] = [];
  const observer = new MutationObserver((records) => {
    for (const record of records) record.addedNodes.forEach((node) => texts.push(node.textContent ?? ''));
  });
  observer.observe(document.body, { subtree: true, childList: true });
  return { texts, stop: () => observer.disconnect() };
};

beforeEach(() => {
  store = createStore();
  stubSso();
});

afterEach(() => {
  vi.useRealTimers();
});

describe(AuthSession, () => {
  it('settles into one signed-in controller after the StrictMode double-mount, the aborted bootstrap uncounted', async () => {
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

  it('holds a query mounted beside the session until the bootstrap signs the reader in, then sends it once with the bearer', async () => {
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
  ])('renders the app at once, holding its query until %s, then sends it signed out', async (_, settle) => {
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

  it('does not refetch on a token renewal', async () => {
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

  it('should keep the page up when the sign-in refetch fails', async () => {
    store.set(sessionCheckedAtom, true);
    const { screen, authorizations } = await renderAuthSession(<SemesterCount />, onSecondRequest(new Error('down')));
    await expect.element(screen.getByTestId('semesters')).toHaveTextContent('0 semesters');

    const token = fakeJwt(standardUser('staff'));
    store.set(odbTokenAtom, token);

    await expect.poll(() => authorizations).toEqual([null, `Bearer ${token}`]);
    await expect.element(screen.getByTestId('semesters')).toBeInTheDocument();
  });

  it('should drop the refetch subscription, leaving a query still open on its client alone, when it unmounts', async () => {
    store.set(sessionCheckedAtom, true);
    const stranded = capturingApollo();
    const probe = await render(
      <ApolloProvider client={stranded.client}>
        <SemesterCount testId="stranded" />
      </ApolloProvider>,
    );
    const session = await renderInSession(stranded.client, null);
    await expect.element(probe.getByTestId('stranded')).not.toHaveTextContent('loading');
    expect(stranded.authorizations).toEqual([null]);
    await session.unmount();

    const { screen, authorizations } = await renderAuthSession(<SemesterCount />);
    await expect.element(screen.getByTestId('semesters')).not.toHaveTextContent('loading');

    const token = fakeJwt(standardUser('staff'));
    store.set(odbTokenAtom, token);

    await expect.poll(() => authorizations).toEqual([null, `Bearer ${token}`]);
    expect(stranded.authorizations).toEqual([null]);
  });

  it('stops the controller on unmount, so no refresh timer survives it', async () => {
    fakeTimeouts();
    signIn(120);

    const { screen } = await renderAuthSession();
    await screen.unmount();

    vi.advanceTimersByTime(200_000);
    expect(ssoCalls()).toHaveLength(0);
  });

  it('should show no live-server failure when requests wait on the check', async () => {
    const screen = await renderShell({ after: deniesAnonymous });
    await expect.element(screen.getByText(GATE_LOADING)).toBeVisible();

    await answerRefresh(0, { body: fakeJwt(standardUser('staff')) });
    await expect.element(screen.getByText(GATE_LOADING)).not.toBeInTheDocument();
    await expect.element(screen.getByText(NIGHT_LOADING)).not.toBeInTheDocument();

    expect(store.get(toastAtom)).not.toBeNull();
    expect(document.querySelector('.p-toast-message')).toBeNull();
  });

  it('should hold the data for the full 10 s when the first refresh goes unanswered', async () => {
    fakeTimeouts();
    const screen = await renderShell();

    await vi.advanceTimersByTimeAsync(9_999);

    expect(screen.getByText(GATE_LOADING).element()).toBeVisible();
    expect(screen.operations).toEqual([]);
  });

  it('should fetch a page afresh, not read it from the cache, when the reader comes back to it after the session ended and a fresh sign-in', async () => {
    const first = signIn();
    const { client, authorizations } = await renderAuthSession();
    const page = await openSemesters(client);
    await expect.element(page.getByTestId('semesters')).toHaveTextContent('0 semesters');
    await page.unmount();

    await pressLogout();
    const second = signIn();
    const again = await openSemesters(client);

    await expect.element(again.getByTestId('semesters')).toHaveTextContent('0 semesters');
    expect(authorizations).toEqual([`Bearer ${first}`, `Bearer ${second}`]);
  });

  describe(SessionGateContainer, () => {
    it('should show the splash when an unanswered check passes the refresh timeout', async () => {
      fakeTimeouts();
      const screen = await renderGated();

      await vi.advanceTimersByTimeAsync(REFRESH_TIMEOUT_MS - 1);
      expect(ssoRefreshes()[0]?.signal?.aborted).toBe(false);
      expect(screen.getByRole('heading', SPLASH_HEADING).query()).toBeNull();
      expect(screen.getByText(GATE_LOADING).element()).toBeVisible();
      expect(screen.operations).toEqual([]);

      await vi.advanceTimersByTimeAsync(1);

      await expect.element(screen.getByRole('heading', SPLASH_HEADING)).toBeVisible();
      expect(screen.getByText(GATE_LOADING).query()).toBeNull();
    });

    it.each([
      ['no token stored', () => null],
      ['a token stored', staffToken],
    ])(
      'should draw only the loading mark and send nothing until SSO answers, then the page, never the splash, with each query sent once with the fresh bearer, when the page loads with %s',
      async (_, stored) => {
        const drawn = recordDrawn();
        try {
          const screen = await renderGated({ token: stored() });

          await expect.element(screen.getByText(GATE_LOADING)).toBeVisible();
          expect(screen.getByTestId('semesters').query()).toBeNull();
          await expect.poll(() => ssoRefreshes()).toHaveLength(1);
          expect(screen.operations).toEqual([]);

          const fresh = fakeJwt(standardUser('staff'), 7200);
          await answerRefresh(0, { body: fresh });

          await expect.element(screen.getByTestId('semesters')).toHaveTextContent('0 semesters');
          expect(screen.operations).toEqual(['PublishedSemesters']);
          expect(screen.authorizations).toEqual([`Bearer ${fresh}`]);
          expect(ssoRefreshes()).toHaveLength(1);
        } finally {
          drawn.stop();
        }
        expect(drawn.texts.some((text) => text.includes(GATE_LOADING))).toBe(true);
        expect(drawn.texts.filter((text) => text.includes(SPLASH_HEADING.name))).toEqual([]);
      },
    );

    it('should ask SSO before showing anything but the loading mark, then show the splash with no notice, when SSO refuses a stored token', async () => {
      const screen = await renderGated({ token: staffToken() });

      await expect.element(screen.getByText(GATE_LOADING)).toBeVisible();
      expect(screen.getByTestId('semesters').query()).toBeNull();
      await expect.poll(() => ssoRefreshes()).toHaveLength(1);
      expect(screen.operations).toEqual([]);

      await answerRefresh(0, { status: 403 });

      await expect.element(screen.getByRole('heading', SPLASH_HEADING)).toBeVisible();
      expect(screen.getByTestId('semesters').query()).toBeNull();
      await afterPendingWork(store);
      expect(toastsShowing()).toEqual([]);
      expect(screen.operations).toEqual([]);
    });

    it.each([
      ['a network failure', () => failRefresh(0)],
      ['the refresh timeout', () => vi.advanceTimersByTimeAsync(REFRESH_TIMEOUT_MS)],
    ])('should keep a stored token and open the page on it when %s proves SSO unreachable', async (_, unreachable) => {
      fakeTimeouts();
      const token = staffToken();
      const screen = await renderGated({ token });
      await expect.element(screen.getByText(GATE_LOADING)).toBeVisible();
      await expect.poll(() => ssoRefreshes()).toHaveLength(1);

      await unreachable();

      await expect.element(screen.getByTestId('semesters')).toHaveTextContent('0 semesters');
      expect(screen.getByRole('heading', SPLASH_HEADING).query()).toBeNull();
      await afterPendingWork(store);
      expect(toastsShowing()).toEqual([]);
      expect(screen.operations).toEqual(['PublishedSemesters']);
      expect(screen.authorizations).toEqual([`Bearer ${token}`]);
    });

    it('should send nothing, so no request leaves without the bearer, when the session ends', async () => {
      const screen = await renderGated({ token: staffToken(), checked: true });
      await expect.element(screen.getByTestId('semesters')).toHaveTextContent('0 semesters');

      await announceFromOtherTab();

      await expect.element(screen.getByRole('heading', SPLASH_HEADING)).toBeVisible();
      await expect.element(screen.getByRole('button', { name: 'Continue as Guest' })).toBeEnabled();
      expect(screen.operations).toEqual(['PublishedSemesters']);
    });

    it('should show the reader no error when the session ends while the page is still loading', async () => {
      let held = 0;
      const holdFirst = new ApolloLink((operation, forward) => {
        held += 1;
        return held === 1 ? new Observable<ApolloLink.Result>(() => undefined) : forward(operation);
      });
      const drawn = recordDrawn();
      try {
        const screen = await renderGated({ token: staffToken(), checked: true, app: <NightPage />, after: holdFirst });
        await expect.element(screen.getByText(NIGHT_LOADING)).toBeVisible();

        await pressLogout();

        await expect.element(screen.getByRole('heading', SPLASH_HEADING)).toBeVisible();
        await expect.element(screen.getByRole('status')).toHaveTextContent('Logged out');
        await afterPendingWork(store);
        expect(toastsShowing()).toEqual([]);
        expect(screen.operations).toEqual(['NightSchedule']);
      } finally {
        drawn.stop();
      }
      expect(drawn.texts.filter((text) => text.includes('Could not load'))).toEqual([]);
    });
  });
});

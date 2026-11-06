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
import Layout from '@/components/layout/Layout';
import { ToastOutlet } from '@/components/ui/ToastOutlet';
import { liveLink } from '@/gql/ApolloConfigs';
import { usePublishedSemesters } from '@/gql/hooks';
import { nightSchedule } from '@/test/fixtures/night';
import { publishedSemester, publishedSemesters } from '@/test/fixtures/semester';
import { fakeTimeouts, textsOf } from '@/test/helpers';
import { captureHeader, captureOperations, createLinkClient, respondWith } from '@/test/linkClient';
import { renderInShell } from '@/test/render';
import { answerRefresh, ssoCalls, ssoLogout, ssoRefreshes, stubSso } from '@/test/sso';

import { AuthSession } from './AuthSession';
import {
  pendingRefresh,
  SESSION_CHANNEL,
  SESSION_TIMINGS,
  type SessionTimings,
  SIGNED_OUT_MESSAGE,
  signOut,
} from './session';

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

  it('refetches when the reader signs out, and the new answer reaches the page', async () => {
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

  it('keeps the page up when the refetch fails', async () => {
    const token = signIn();
    const { screen, authorizations } = await renderAuthSession(<SemesterCount />, onSecondRequest(new Error('down')));
    await expect.element(screen.getByTestId('semesters')).not.toHaveTextContent('loading');

    store.set(odbTokenAtom, null);

    await expect.poll(() => authorizations).toEqual([`Bearer ${token}`, null]);
    await expect.element(screen.getByTestId('semesters')).toBeInTheDocument();
  });

  it('drops the refetch subscription on unmount, leaving a query still open on its client alone', async () => {
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

  it('stops the controller on unmount, so no refresh timer survives it', async () => {
    fakeTimeouts();
    signIn(120);

    const { screen } = await renderAuthSession();
    await screen.unmount();

    vi.advanceTimersByTime(200_000);
    expect(ssoCalls()).toHaveLength(0);
  });

  it('draws the shell at once and sends nothing before the check settles, then each page query once with the bearer it found', async () => {
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

  it('shows no live-server failure while requests wait on the check', async () => {
    const screen = await renderShell({ after: deniesAnonymous });
    await expect.element(screen.getByText(NIGHT_LOADING)).toBeVisible();

    await answerRefresh(0, { body: fakeJwt(standardUser('staff')) });
    await expect.element(screen.getByText(NIGHT_LOADING)).not.toBeInTheDocument();

    expect(store.get(toastAtom)).not.toBeNull();
    expect(document.querySelector('.p-toast-message')).toBeNull();
  });

  it('sends a returning tab its requests at once with the bearer, each once', async () => {
    const token = fakeJwt(standardUser('staff'));
    const screen = await renderShell({ token });

    await expect.element(screen.getByText(NIGHT_LOADING)).not.toBeInTheDocument();
    await screen.client.query({ query: RENEWAL_MARKER, fetchPolicy: 'network-only' });

    expect(screen.operations.length).toBeGreaterThan(1);
    expect(sentOnce(screen.operations)).toBe(true);
    expect(screen.authorizations.every((authorization) => authorization === `Bearer ${token}`)).toBe(true);
    expect(ssoCalls()).toHaveLength(0);
  });

  it('holds the data for the full 10 s while the first refresh goes unanswered', async () => {
    fakeTimeouts();
    const screen = await renderShell();

    await vi.advanceTimersByTimeAsync(9_999);

    await expect.element(screen.getByTestId('account-control')).toHaveTextContent('Checking sign-in');
    expect(screen.getByText(NIGHT_LOADING).element()).toBeVisible();
    expect(screen.operations).toEqual([]);
  });

  it('sends the data without a bearer once the first refresh goes unanswered past the bound', async () => {
    const screen = await renderShell({ timings: { ...SESSION_TIMINGS, refreshTimeoutMs: 20 } });

    await expect.element(screen.getByTestId('account-control')).toHaveTextContent('Not signed in');
    await expect.element(screen.getByText(NIGHT_LOADING)).not.toBeInTheDocument();
    expect(screen.operations).toEqual(['NightSchedule']);
    expect(screen.authorizations).toEqual([null]);
  });

  it('never draws "Not signed in" on the way to signing in from an answer at 9 s', async () => {
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
});

import { type ApolloClient, ApolloLink, gql } from '@apollo/client';
import { ApolloProvider } from '@apollo/client/react';
import { Observable } from '@apollo/client/utilities';
import type { PublishedSemestersQuery } from '@gql/gen/graphql';
import { Provider as JotaiProvider } from 'jotai';
import { type JSX, type ReactNode, StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';

import NightPage from '@/app/pages/NightPage';
import { isLoggedInAtom, odbTokenAtom, sessionCheckedAtom, sessionStatusAtom } from '@/components/atoms/auth';
import { store } from '@/components/atoms/store';
import { toastAtom } from '@/components/atoms/toast';
import Layout from '@/components/layout/Layout';
import { ToastOutlet } from '@/components/ui/ToastOutlet';
import { liveLink } from '@/gql/ApolloConfigs';
import { usePublishedSemesters } from '@/gql/hooks';
import { fakeJwt, standardUser } from '@/test/factories';
import { act } from '@/test/helpers';
import { captureHeader, createMockApollo } from '@/test/mockClient';
import { renderApp } from '@/test/renderApp';
import { ssoCalls, ssoRefreshes, stubSso } from '@/test/sso';

import { AuthSession } from './AuthSession';
import { pendingRefresh, SESSION_TIMINGS, type SessionTimings } from './session';

function SemesterCount({ testId = 'semesters' }: { testId?: string }): JSX.Element {
  const { semesters, loading } = usePublishedSemesters();
  return <p data-testid={testId}>{loading ? 'loading' : `${String(semesters.length)} semesters`}</p>;
}

const ONE_SEMESTER: PublishedSemestersQuery = {
  publishedSemesters: [
    {
      __typename: 'PublishedSemester',
      site: 'GS',
      semester: '2025B',
      title: 'Gemini South Semester 2025B',
      version: null,
      demo: false,
      holidays: [],
      nights: { __typename: 'DateInterval', start: '2025-08-02', end: '2026-02-02' },
      moonEvents: [],
    },
  ],
};

const RENEWAL_MARKER = gql`
  query RenewalMarker {
    __typename
  }
`;

const onSecondRequest = (outcome: ApolloLink.Result | Error): ApolloLink => {
  let requests = 0;
  return new ApolloLink((operation, forward) => {
    requests += 1;
    if (requests !== 2) return forward(operation);
    return new Observable<ApolloLink.Result>((observer) => {
      if (outcome instanceof Error) {
        observer.error(outcome);
      } else {
        observer.next(outcome);
        observer.complete();
      }
    });
  });
};

const capturingApollo = (after?: ApolloLink) => {
  const { link, sent: authorizations } = captureHeader('Authorization');
  return {
    mock: createMockApollo(liveLink(after === undefined ? link : ApolloLink.from([link, after]))),
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
  const { mock, authorizations } = capturingApollo(after);
  const screen = await renderInSession(mock.client, children);
  return { screen, mock, authorizations };
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
  if (Object.hasOwn(headers, 'Authorization')) {
    return forward(operation);
  }
  return new Observable<ApolloLink.Result>((observer) => {
    observer.next({ errors: [{ message: 'Access denied.' }] });
    observer.complete();
  });
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
  const operations: string[] = [];
  const logOperation = new ApolloLink((operation, forward) => {
    operations.push(operation.operationName ?? '');
    return forward(operation);
  });
  const { mock, authorizations } = capturingApollo(
    after === undefined ? logOperation : ApolloLink.from([logOperation, after]),
  );
  const screen = await renderApp({
    route: '/night?site=GS&night=2025-11-14',
    path: '/',
    element: (
      <AuthSession timings={timings}>
        <Layout />
        <ToastOutlet />
      </AuthSession>
    ),
    childRoutes: [{ path: 'night', element: <NightPage /> }],
    mock,
    token,
    sessionChecked: token !== null,
  });
  return Object.assign(screen, { authorizations, operations });
};

const sentOnce = (operations: readonly string[]): boolean => new Set(operations).size === operations.length;

const fakeTimeouts = (): void => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
};

beforeEach(() => {
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
    const { mock, authorizations } = capturingApollo();

    const screen = await render(
      <StrictMode>
        <JotaiProvider store={store}>
          <ApolloProvider client={mock.client}>
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
    const { screen, mock, authorizations } = await renderAuthSession(<SemesterCount />);
    await expect.element(screen.getByTestId('semesters')).not.toHaveTextContent('loading');

    const renewed = fakeJwt(standardUser('staff'), 7200);
    store.set(odbTokenAtom, renewed);
    await mock.client.query({ query: RENEWAL_MARKER, fetchPolicy: 'network-only' });

    expect(authorizations).toEqual([`Bearer ${token}`, `Bearer ${renewed}`]);
    expect(ssoCalls()).toHaveLength(0);
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
      <ApolloProvider client={stranded.mock.client}>
        <SemesterCount testId="stranded" />
      </ApolloProvider>,
    );
    const session = await renderInSession(stranded.mock.client, null);
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
    const settled = pendingRefresh();
    ssoRefreshes()[0]?.answer({ body: token });
    await settled;

    await expect.element(screen.getByTestId('account-control')).toHaveTextContent('Ada Lovelace');
    await expect.element(screen.getByText(NIGHT_LOADING)).not.toBeInTheDocument();
    expect(screen.operations.toSorted()).toEqual(['NightSchedule', 'PublishedSemesters']);
    expect(screen.authorizations).toEqual([`Bearer ${token}`, `Bearer ${token}`]);
  });

  it('shows no live-server failure while requests wait on the check', async () => {
    const screen = await renderShell({ after: deniesAnonymous });
    await expect.element(screen.getByText(NIGHT_LOADING)).toBeVisible();

    const settled = pendingRefresh();
    ssoRefreshes()[0]?.answer({ body: fakeJwt(standardUser('staff')) });
    await settled;
    await expect.element(screen.getByText(NIGHT_LOADING)).not.toBeInTheDocument();

    expect(store.get(toastAtom)).not.toBeNull();
    expect(document.querySelector('.p-toast-message')).toBeNull();
  });

  it('sends a returning tab its requests at once with the bearer, each once', async () => {
    const token = fakeJwt(standardUser('staff'));
    const screen = await renderShell({ token });

    await expect.element(screen.getByText(NIGHT_LOADING)).not.toBeInTheDocument();
    await screen.mock.client.query({ query: RENEWAL_MARKER, fetchPolicy: 'network-only' });

    expect(screen.operations.length).toBeGreaterThan(1);
    expect(sentOnce(screen.operations)).toBe(true);
    expect(screen.authorizations.every((authorization) => authorization === `Bearer ${token}`)).toBe(true);
    expect(ssoCalls()).toHaveLength(0);
  });

  it('holds the data for the full 10 s while the first refresh goes unanswered', async () => {
    fakeTimeouts();
    const screen = await renderShell();

    await act(() => vi.advanceTimersByTimeAsync(9_999));

    expect(screen.getByTestId('account-control').element()).toHaveTextContent('Checking sign-in');
    expect(screen.getByText(NIGHT_LOADING).element()).toBeVisible();
    expect(screen.operations).toEqual([]);
  });

  it('sends the data without a bearer once the first refresh goes unanswered past the bound', async () => {
    const screen = await renderShell({ timings: { ...SESSION_TIMINGS, refreshTimeoutMs: 20 } });

    await expect.element(screen.getByTestId('account-control')).toHaveTextContent('Not signed in');
    await expect.element(screen.getByText(NIGHT_LOADING)).not.toBeInTheDocument();
    expect(screen.operations.toSorted()).toEqual(['NightSchedule', 'PublishedSemesters']);
    expect(screen.authorizations).toEqual([null, null]);
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

      await act(() => vi.advanceTimersByTimeAsync(9_000));
      await act(() => {
        const settled = pendingRefresh();
        ssoRefreshes()[0]?.answer({ body: fakeJwt(standardUser('staff')) });
        return settled;
      });
      await act(() => vi.advanceTimersByTimeAsync(60_000));

      expect(screen.getByTestId('account-control').element()).toHaveTextContent('Ada Lovelace');
    } finally {
      observer.disconnect();
    }

    expect(drawn.some((text) => text.includes('Checking sign-in'))).toBe(true);
    expect(drawn.filter((text) => text.includes('Not signed in'))).toEqual([]);
    expect(ssoRefreshes()).toHaveLength(1);
  });
});

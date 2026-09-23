import { type ApolloClient, ApolloLink, gql } from '@apollo/client';
import { ApolloProvider } from '@apollo/client/react';
import { Observable } from '@apollo/client/utilities';
import type { PublishedSemestersQuery } from '@gql/gen/graphql';
import { Provider as JotaiProvider } from 'jotai';
import { type JSX, type ReactNode, StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';

import { isLoggedInAtom, odbTokenAtom, sessionCheckedAtom } from '@/components/atoms/auth';
import { store } from '@/components/atoms/store';
import { authLink } from '@/gql/ApolloConfigs';
import { usePublishedSemesters } from '@/gql/hooks';
import { fakeJwt, standardUser } from '@/test/factories';
import { createMockApollo } from '@/test/mockClient';
import { ssoCalls, stubSso } from '@/test/sso';

import { AuthSession } from './AuthSession';
import { pendingRefresh } from './session';

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
  const authorizations: (string | null)[] = [];
  const capture = new ApolloLink((operation, forward) => {
    const headers = (operation.getContext().headers ?? {}) as Record<string, string>;
    authorizations.push(headers.Authorization ?? null);
    return forward(operation);
  });
  const links = after === undefined ? [authLink(), capture] : [authLink(), capture, after];
  return { mock: createMockApollo(ApolloLink.from(links)), authorizations };
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
  return { screen, authorizations };
};

const survivingSsoCall = () => ssoCalls().find((made) => !made.signal?.aborted);

const signIn = (expiresInSeconds?: number): string => {
  const token = fakeJwt(standardUser('staff'), expiresInSeconds);
  store.set(odbTokenAtom, token);
  store.set(sessionCheckedAtom, true);
  return token;
};

beforeEach(() => {
  stubSso();
});

afterEach(() => {
  vi.unstubAllGlobals();
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

  it('asks Resource again with the bearer once the bootstrap signs the reader in', async () => {
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

    await expect.element(screen.getByTestId('semesters')).not.toHaveTextContent('loading');
    await expect.poll(() => ssoCalls().length).toBe(2);
    expect(authorizations).toEqual([null]);

    const token = fakeJwt(standardUser('staff'));
    survivingSsoCall()?.answer({ body: token });
    await pendingRefresh();

    await expect.poll(() => authorizations.at(-1)).toBe(`Bearer ${token}`);
  });

  it('renders nothing until the session check settles, then the app with the bearer already in hand', async () => {
    const { screen, authorizations } = await renderAuthSession(<SemesterCount />);

    await expect.poll(() => ssoCalls().length).toBe(2);
    await expect.element(screen.getByTestId('semesters')).not.toBeInTheDocument();
    expect(authorizations).toEqual([]);

    const token = fakeJwt(standardUser('staff'));
    survivingSsoCall()?.answer({ body: token });
    await pendingRefresh();

    await expect.element(screen.getByTestId('semesters')).not.toHaveTextContent('loading');
    expect(authorizations.length).toBeGreaterThan(0);
    expect(authorizations.every((authorization) => authorization === `Bearer ${token}`)).toBe(true);
  });

  it('renders the app signed out when the bootstrap is rejected', async () => {
    const { screen, authorizations } = await renderAuthSession(<SemesterCount />);

    await expect.poll(() => ssoCalls().length).toBe(2);
    await expect.element(screen.getByTestId('semesters')).not.toBeInTheDocument();

    survivingSsoCall()?.answer({ status: 403 });
    await pendingRefresh();

    await expect.element(screen.getByTestId('semesters')).not.toHaveTextContent('loading');
    expect(authorizations).toEqual([null]);
  });

  it('renders the app signed out when SSO is unreachable', async () => {
    const { screen, authorizations } = await renderAuthSession(<SemesterCount />);

    await expect.poll(() => ssoCalls().length).toBe(2);
    await expect.element(screen.getByTestId('semesters')).not.toBeInTheDocument();

    survivingSsoCall()?.fail();
    await pendingRefresh();

    await expect.element(screen.getByTestId('semesters')).not.toHaveTextContent('loading');
    expect(authorizations).toEqual([null]);
  });

  it('does not refetch on a token renewal', async () => {
    const token = signIn();
    const { mock, authorizations } = capturingApollo();
    const screen = await renderInSession(mock.client, <SemesterCount />);
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
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      signIn(120);

      const { screen } = await renderAuthSession();
      await screen.unmount();

      vi.advanceTimersByTime(200_000);
      expect(ssoCalls()).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });
});

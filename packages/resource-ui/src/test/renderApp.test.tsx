import { ApolloLink } from '@apollo/client';
import { beforeEach, describe, expect, it } from 'vitest';

import { signOut } from '@/auth/session';
import { odbTokenAtom, useSessionStatus } from '@/components/atoms/auth';
import { store } from '@/components/atoms/store';
import { authLink } from '@/gql/ApolloConfigs';
import { PUBLISHED_SEMESTERS_QUERY } from '@/gql/resource';
import { fakeJwt, standardUser } from '@/test/factories';
import { Probe } from '@/test/probe';
import { ssoCalls, stubSso } from '@/test/sso';

import { createMockApollo } from './mockClient';
import { renderApp } from './renderApp';

beforeEach(() => {
  stubSso();
});

const signedInProbe = (token: string, mock?: ReturnType<typeof createMockApollo>) =>
  renderApp({
    route: '/',
    token,
    mock,
    element: <Probe use={() => useSessionStatus()} readout={(status) => ({ status })} />,
  });

describe(renderApp, () => {
  it('signs the rendered tree in on the module store that authLink and signOut read', async () => {
    const token = fakeJwt(standardUser('staff'));
    const screen = await signedInProbe(token);

    await expect.element(screen.getByTestId('probe-status')).toHaveTextContent('signed-in');
    expect(store.get(odbTokenAtom)).toBe(token);
  });

  it('lets authLink send the renderApp token as a bearer', async () => {
    const token = fakeJwt(standardUser('staff'));
    let capturedHeaders: Record<string, string> = {};
    const capture = new ApolloLink((operation, forward) => {
      capturedHeaders = (operation.getContext().headers ?? {}) as Record<string, string>;
      return forward(operation);
    });
    const mock = createMockApollo(ApolloLink.from([authLink(), capture]));

    await signedInProbe(token, mock);
    await mock.client.query({ query: PUBLISHED_SEMESTERS_QUERY });

    expect(capturedHeaders).toHaveProperty('Authorization', `Bearer ${token}`);
  });

  it('is signed out by a real signOut', async () => {
    const token = fakeJwt(standardUser('staff'));
    const screen = await signedInProbe(token);
    await expect.element(screen.getByTestId('probe-status')).toHaveTextContent('signed-in');

    const signedOut = signOut();
    ssoCalls()
      .find((made) => made.url.includes('/api/v1/logout'))
      ?.answer({ status: 200 });
    expect(await signedOut).toEqual({ reachedSso: true });

    await expect.element(screen.getByTestId('probe-status')).toHaveTextContent('signed-out');
  });
});

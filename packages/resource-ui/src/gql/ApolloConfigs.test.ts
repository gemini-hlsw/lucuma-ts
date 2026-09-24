import { ApolloLink, gql } from '@apollo/client';
import { beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';

import { odbTokenAtom } from '@/components/atoms/auth';
import { store } from '@/components/atoms/store';
import { fakeJwt, standardUser } from '@/test/factories';
import { captureHeader, createMockApollo } from '@/test/mockClient';

import { authLink, client } from './ApolloConfigs';

const QUERY = gql`
  query AuthHeaderProbe {
    publishedSemesters {
      site
    }
  }
`;

const TOKEN = fakeJwt(standardUser('staff'));
const UNDECODABLE_TOKEN = 'header.payload.signature';

const headerSent = async (name: string, context?: ApolloLink.OperationContext): Promise<string | null | undefined> => {
  const capture = captureHeader(name);
  const mock = createMockApollo(ApolloLink.from([authLink(), capture.link]));
  await mock.client.query({ query: QUERY, context });
  return capture.sent[0];
};

describe(authLink, () => {
  it('sends the signed-in user token as a bearer', async () => {
    store.set(odbTokenAtom, TOKEN);

    expect(await headerSent('Authorization')).toBe(`Bearer ${TOKEN}`);
  });

  it('sends no Authorization header at all when signed out', async () => {
    expect(await headerSent('Authorization')).toBeNull();
  });

  it('leaves headers the operation already set alone', async () => {
    store.set(odbTokenAtom, TOKEN);

    expect(await headerSent('X-Probe', { headers: { 'X-Probe': 'kept' } })).toBe('kept');
  });

  it('omits the header rather than sending empty credentials for an empty stored token', async () => {
    store.set(odbTokenAtom, '');

    expect(await headerSent('Authorization')).toBeNull();
  });

  it('sends no header for a token it cannot decode', async () => {
    store.set(odbTokenAtom, UNDECODABLE_TOKEN);

    expect(await headerSent('Authorization')).toBeNull();
  });

  it('sends no Authorization header once the held token has expired', async () => {
    store.set(odbTokenAtom, fakeJwt(standardUser('staff'), -60));

    expect(await headerSent('Authorization')).toBeNull();
  });
});

describe("the live client's request chain", () => {
  let fetchSpy: MockInstance<typeof fetch>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(window, 'fetch').mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ data: { publishedSemesters: [] } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );
  });

  const authorizationSent = async (): Promise<string | null> => {
    await client.query({ query: QUERY, fetchPolicy: 'no-cache' });
    const lastCall = fetchSpy.mock.lastCall;
    expect(lastCall, 'the query must reach the stubbed fetch').toBeDefined();
    const [uri, init] = lastCall ?? [];
    expect(uri instanceof Request ? uri.url : String(uri)).toContain('/resource/graphql');
    return new Headers(init?.headers).get('Authorization');
  };

  it('sends no Authorization header over the wire when nobody is signed in', async () => {
    expect(await authorizationSent()).toBeNull();
  });

  it('carries a sign-in on the very next request, with no client rebuild', async () => {
    expect(await authorizationSent()).toBeNull();

    store.set(odbTokenAtom, TOKEN);

    expect(await authorizationSent()).toBe(`Bearer ${TOKEN}`);
  });
});

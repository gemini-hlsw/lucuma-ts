import { ApolloClient, ApolloLink, gql } from '@apollo/client';
import { Observable } from '@apollo/client/utilities';
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';

import { odbTokenAtom } from '@/components/atoms/auth';
import { store } from '@/components/atoms/store';

import { authLink, client } from './ApolloConfigs';
import { buildCache } from './cache';

// A real operation, because @graphql-eslint validates documents against the schema.
const QUERY = gql`
  query AuthHeaderProbe {
    publishedSemesters {
      site
    }
  }
`;

const TOKEN = 'header.payload.signature';

const headersSent = async (context?: ApolloLink.OperationContext): Promise<Record<string, string>> => {
  let headers: Record<string, string> = {};
  const capture = new ApolloLink((operation) => {
    headers = (operation.getContext().headers ?? {}) as Record<string, string>;
    return new Observable<ApolloLink.Result>((observer) => {
      observer.next({ data: { publishedSemesters: [] } });
      observer.complete();
    });
  });
  const isolatedClient = new ApolloClient({ link: ApolloLink.empty(), cache: buildCache() });

  await new Promise<void>((resolve, reject) => {
    ApolloLink.execute(
      ApolloLink.from([authLink(), capture]),
      { query: QUERY, context },
      { client: isolatedClient },
    ).subscribe({
      complete: resolve,
      error: reject,
    });
  });
  return headers;
};

describe(authLink, () => {
  beforeEach(() => {
    // odbTokenAtom is sessionStorage-backed, so one test's token would otherwise sign the next one in.
    window.sessionStorage.clear();
    store.set(odbTokenAtom, null);
  });

  it('sends the signed-in user token as a bearer', async () => {
    store.set(odbTokenAtom, TOKEN);

    expect(await headersSent()).toHaveProperty('Authorization', `Bearer ${TOKEN}`);
  });

  it('sends no Authorization header at all when signed out', async () => {
    expect(await headersSent()).not.toHaveProperty('Authorization');
  });

  it('leaves headers the operation already set alone', async () => {
    store.set(odbTokenAtom, TOKEN);

    expect(await headersSent({ headers: { 'X-Probe': 'kept' } })).toHaveProperty('X-Probe', 'kept');
  });

  it('omits the header rather than sending empty credentials for an empty stored token', async () => {
    store.set(odbTokenAtom, '');

    expect(await headersSent()).not.toHaveProperty('Authorization');
  });
});

/**
 * The chain the real client sends through, with the network swapped for a capturing fetch.
 * `authLink` in isolation cannot show that the client's chain includes it, nor that the token
 * is read per request - the client is built once at module load, before anyone signs in, so a
 * token captured at build time would never be sent at all and every isolation test would
 * still pass.
 */
describe("the real client's request chain", () => {
  let fetchSpy: MockInstance<typeof fetch>;

  beforeEach(() => {
    window.sessionStorage.clear();
    store.set(odbTokenAtom, null);
    // A fresh Response per call: a body reads once, and one test sends two requests.
    fetchSpy = vi.spyOn(window, 'fetch').mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ data: { publishedSemesters: [] } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    window.sessionStorage.clear();
    store.set(odbTokenAtom, null);
  });

  const authorizationSent = async (): Promise<string | null> => {
    await client.query({ query: QUERY, fetchPolicy: 'no-cache' });
    const call = fetchSpy.mock.lastCall;
    expect(call, 'the query must reach the stubbed fetch').toBeDefined();
    const [uri, init] = call!;
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

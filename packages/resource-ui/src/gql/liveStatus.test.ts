/**
 * The live-failure store, and the link that keeps it honest.
 *
 * There is one backend, so what this pins is what the banner is allowed to
 * say: the last failure while one is standing, and nothing once the server
 * answers again.
 */
import { ApolloClient, ApolloLink, gql } from '@apollo/client';
import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { Observable } from '@apollo/client/utilities';
import { beforeEach, describe, expect, it } from 'vitest';
import { renderHook } from 'vitest-browser-react';

import { clearOnSuccessLink, liveFailureMessage } from './ApolloConfigs';
import { buildCache } from './cache';
import { clearLiveFailure, reportLiveFailure, useLiveFailure } from './liveStatus';

describe('the live-failure store', () => {
  beforeEach(() => {
    clearLiveFailure();
  });

  it('delivers the last failure to the hook the banner reads', async () => {
    const hook = await renderHook(() => useLiveFailure());

    await hook.act(() => {
      reportLiveFailure('the server went away');
    });

    expect(hook.result.current).toBe('the server went away');
  });

  it('forgets the failure when cleared, so the banner names a situation and not a memory', async () => {
    const hook = await renderHook(() => useLiveFailure());
    await hook.act(() => {
      reportLiveFailure('the server went away');
    });

    await hook.act(() => {
      clearLiveFailure();
    });

    expect(hook.result.current).toBeNull();
  });
});

/**
 * `clearOnSuccessLink`, composed over a stub link the way `liveLink` composes
 * it over HTTP.
 *
 * Without it one transient failure - a restarting deployment, a dropped
 * connection - pinned the amber banner for the rest of the session while every
 * query behind it succeeded, which is a banner reporting the worst moment of
 * the session rather than the situation.
 */
describe(clearOnSuccessLink.name, () => {
  // A real operation, because @graphql-eslint validates documents in this
  // package against the schema. It never reaches a server: the stub below
  // answers it.
  const QUERY = gql`
    query LiveFailureProbe {
      publishedSemesters {
        site
      }
    }
  `;

  /** Runs one operation through the link, over a stub that answers `result`. */
  const answerWith = async (result: ApolloLink.Result): Promise<void> => {
    const stub = new ApolloLink(
      () =>
        new Observable<ApolloLink.Result>((observer) => {
          observer.next(result);
          observer.complete();
        }),
    );
    const client = new ApolloClient({ link: ApolloLink.empty(), cache: buildCache() });

    await new Promise<void>((resolve, reject) => {
      ApolloLink.execute(ApolloLink.from([clearOnSuccessLink(), stub]), { query: QUERY }, { client }).subscribe({
        complete: resolve,
        error: reject,
      });
    });
  };

  beforeEach(() => {
    clearLiveFailure();
  });

  it('clears a standing failure when an answer carries no error', async () => {
    const hook = await renderHook(() => useLiveFailure());
    await hook.act(() => {
      reportLiveFailure('the server went away');
    });

    await hook.act(async () => {
      await answerWith({ data: { publishedSemesters: [] } });
    });

    expect(hook.result.current).toBeNull();
  });

  it('leaves a failure standing when the answer carries GraphQL errors', async () => {
    // `ErrorLink` is the one that speaks for those, and it is about to report
    // this very result - clearing here would race it and blank the banner.
    const hook = await renderHook(() => useLiveFailure());
    await hook.act(() => {
      reportLiveFailure('the server does not serve this API');
    });

    await hook.act(async () => {
      await answerWith({ data: null, errors: [{ message: 'Cannot query field "publishedSemesters"' }] });
    });

    expect(hook.result.current).toBe('the server does not serve this API');
  });
});

describe(liveFailureMessage.name, () => {
  it('says the server does not serve this API when it answered with GraphQL errors', () => {
    const error = new CombinedGraphQLErrors({ errors: [{ message: 'Cannot query field "publishedSemesters"' }] });

    expect(liveFailureMessage(error)).toBe(
      'The live server answered, but it does not serve this version of the Resource API yet.',
    );
  });

  it('says the server could not be reached for a network failure, with the detail', () => {
    expect(liveFailureMessage(new Error('Failed to fetch'))).toBe(
      'The live server could not be reached (Failed to fetch).',
    );
  });

  it('stays whole when the error carries no message', () => {
    expect(liveFailureMessage('boom')).toBe('The live server could not be reached.');
  });
});

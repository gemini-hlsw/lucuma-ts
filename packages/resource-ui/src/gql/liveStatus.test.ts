/** What the banner is allowed to say: the last failure while one stands, nothing once it answers. */
import { ApolloClient, ApolloLink, gql } from '@apollo/client';
import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { ErrorLink } from '@apollo/client/link/error';
import { Observable } from '@apollo/client/utilities';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from 'vitest-browser-react';

import { clearOnSuccessLink, liveFailureMessage } from './ApolloConfigs';
import { buildCache } from './cache';
import { clearLiveFailure, reportLiveFailure, useLiveFailure } from './liveStatus';

// A real operation, because @graphql-eslint validates documents against the schema.
const QUERY = gql`
  query LiveFailureProbe {
    publishedSemesters {
      site
    }
  }
`;

/** Runs one operation through `links`, over a stub terminal that answers `result`. */
const answerThrough = async (links: readonly ApolloLink[], result: ApolloLink.Result): Promise<void> => {
  const stub = new ApolloLink(
    () =>
      new Observable<ApolloLink.Result>((observer) => {
        observer.next(result);
        observer.complete();
      }),
  );
  const client = new ApolloClient({ link: ApolloLink.empty(), cache: buildCache() });

  await new Promise<void>((resolve, reject) => {
    ApolloLink.execute(ApolloLink.from([...links, stub]), { query: QUERY }, { client }).subscribe({
      complete: resolve,
      error: reject,
    });
  });
};

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

/** Without it one transient failure pins the banner for the session while every query succeeds. */
describe(clearOnSuccessLink, () => {
  beforeEach(() => {
    clearLiveFailure();
  });

  it('clears a standing failure when an answer carries no error', async () => {
    const hook = await renderHook(() => useLiveFailure());
    await hook.act(() => {
      reportLiveFailure('the server went away');
    });

    await hook.act(async () => {
      await answerThrough([clearOnSuccessLink()], { data: { publishedSemesters: [] } });
    });

    expect(hook.result.current).toBeNull();
  });

  it('leaves a failure standing when the answer carries GraphQL errors', async () => {
    // `ErrorLink` speaks for those and is about to report this result; clearing here would race it.
    const hook = await renderHook(() => useLiveFailure());
    await hook.act(() => {
      reportLiveFailure('the server does not serve this API');
    });

    await hook.act(async () => {
      await answerThrough([clearOnSuccessLink()], {
        data: null,
        errors: [{ message: 'Cannot query field "publishedSemesters"' }],
      });
    });

    expect(hook.result.current).toBe('the server does not serve this API');
  });
});

/** The pair wired together, which the lone-link suite never exercises: one answer moves exactly one of them. */
describe('clearOnSuccessLink composed with the ErrorLink', () => {
  const noApiMessage = 'The live server answered, but it does not serve this version of the Resource API yet.';

  /**
   * `liveLink` in ApolloConfigs.ts owns this composition; it is not exported, and its terminal
   * HttpLink would hit the network, so the pair is rebuilt here.
   * `report` stands where `reportLiveFailure` stands in the real ErrorLink callback.
   */
  const composedLinks = (report: (message: string) => void): readonly ApolloLink[] => [
    clearOnSuccessLink(),
    new ErrorLink(({ error }) => {
      report(liveFailureMessage(error));
    }),
  ];

  beforeEach(() => {
    clearLiveFailure();
  });

  it('clears a standing failure on an error-free answer without reporting a new one', async () => {
    const report = vi.fn(reportLiveFailure);
    const hook = await renderHook(() => useLiveFailure());
    await hook.act(() => {
      reportLiveFailure('the server went away');
    });

    await hook.act(async () => {
      await answerThrough(composedLinks(report), { data: { publishedSemesters: [] } });
    });

    expect(hook.result.current).toBeNull();
    expect(report).not.toHaveBeenCalled();
  });

  it('ends a GraphQL-error answer with the failure reported and standing, never cleared', async () => {
    const report = vi.fn(reportLiveFailure);
    const hook = await renderHook(() => useLiveFailure());

    await hook.act(async () => {
      await answerThrough(composedLinks(report), {
        data: null,
        errors: [{ message: 'Cannot query field "publishedSemesters"' }],
      });
    });

    expect(report).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledWith(noApiMessage);
    expect(hook.result.current).toBe(noApiMessage);
  });
});

describe(liveFailureMessage, () => {
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

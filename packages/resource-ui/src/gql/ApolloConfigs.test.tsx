import { ApolloClient, ApolloLink, gql } from '@apollo/client';
import { Observable } from '@apollo/client/utilities';
import { Provider as JotaiProvider } from 'jotai';
import { PrimeReactProvider } from 'primereact/api';
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-react';

import { odbTokenAtom, sessionCheckedAtom } from '@/components/atoms/auth';
import { store } from '@/components/atoms/store';
import { toastAtom } from '@/components/atoms/toast';
import { ToastOutlet } from '@/components/ui/ToastOutlet';
import { fakeJwt, standardUser } from '@/test/factories';
import { act } from '@/test/helpers';
import { captureHeader, createMockApollo } from '@/test/mockClient';

import { authLink, client, liveLink, sessionHoldLink } from './ApolloConfigs';
import { buildCache } from './cache';

const QUERY = gql`
  query AuthHeaderProbe {
    publishedSemesters {
      site
    }
  }
`;

const FOLLOW_UP = gql`
  query FollowUp {
    __typename
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

describe(sessionHoldLink, () => {
  const heldApollo = () => {
    const entered: string[] = [];
    const enter = new ApolloLink((operation, forward) => {
      entered.push(operation.operationName ?? '');
      return forward(operation);
    });
    const capture = captureHeader('Authorization');
    const mock = createMockApollo(ApolloLink.from([enter, sessionHoldLink(), authLink(), capture.link]));
    return { mock, sent: capture.sent, entered };
  };

  it('holds a request until the session check settles, then sends it with the bearer the check found', async () => {
    const { mock, sent, entered } = heldApollo();

    const answered = mock.client.query({ query: QUERY });
    await expect.poll(() => entered).toEqual(['AuthHeaderProbe']);
    expect(sent).toEqual([]);

    store.set(odbTokenAtom, TOKEN);
    store.set(sessionCheckedAtom, true);

    await answered;
    expect(sent).toEqual([`Bearer ${TOKEN}`]);
  });

  it('sends nothing for a request dropped while it was held', async () => {
    const { mock, sent, entered } = heldApollo();
    const subscription = mock.client.watchQuery({ query: QUERY }).subscribe(() => undefined);
    await expect.poll(() => entered).toEqual(['AuthHeaderProbe']);
    subscription.unsubscribe();

    store.set(sessionCheckedAtom, true);
    await mock.client.query({ query: FOLLOW_UP, fetchPolicy: 'network-only' });

    expect(entered).toEqual(['AuthHeaderProbe', 'FollowUp']);
    expect(sent).toEqual([null]);
  });
});

describe("the live client's request chain", () => {
  let fetchSpy: MockInstance<typeof fetch>;

  beforeEach(() => {
    store.set(sessionCheckedAtom, true);
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

describe(liveLink, () => {
  type Answer = (observer: {
    next: (result: ApolloLink.Result) => void;
    error: (error: unknown) => void;
    complete: () => void;
  }) => void;

  const answering =
    (result: ApolloLink.Result): Answer =>
    (observer) => {
      observer.next(result);
      observer.complete();
    };
  const served = answering({ data: { publishedSemesters: [] } });
  const unreachable: Answer = (observer) => {
    observer.error(new Error('Failed to fetch'));
  };
  const notServed = answering({ data: null, errors: [{ message: 'Cannot query field "publishedSemesters"' }] });
  const refused = answering({ data: null, errors: [{ message: 'Access denied.' }] });

  let answer: Answer = served;
  const liveClient = new ApolloClient({
    link: liveLink(new ApolloLink(() => new Observable<ApolloLink.Result>((observer) => answer(observer)))),
    cache: buildCache(),
  });

  const ask = async (next: Answer): Promise<void> => {
    answer = next;
    await liveClient.query({ query: QUERY, fetchPolicy: 'no-cache' }).catch(() => undefined);
  };

  const summaries = (): (string | null)[] =>
    [...document.querySelectorAll('.p-toast-summary')].map((summary) => summary.textContent);

  beforeEach(async () => {
    store.set(sessionCheckedAtom, true);
    await render(
      <PrimeReactProvider>
        <JotaiProvider store={store}>
          <ToastOutlet />
        </JotaiProvider>
      </PrimeReactProvider>,
    );
    await expect.poll(() => store.get(toastAtom)).not.toBeNull();
    await ask(served);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    { cause: 'no answer', next: unreachable, summary: 'The live server could not be reached.' },
    {
      cause: 'a schema without the v1 fields',
      next: notServed,
      summary: 'The live server does not serve this version of the Resource API yet.',
    },
    { cause: 'a refused bearer', next: refused, summary: 'The live server could not verify your sign-in.' },
  ])('shows a warning for $cause', async ({ next, summary }) => {
    await ask(next);

    await expect.poll(summaries).toEqual([summary]);
    expect(document.querySelector('.p-toast-message-warn')).not.toBeNull();
  });

  it('withdraws the warning on the next answer without errors', async () => {
    await ask(unreachable);
    await expect.poll(summaries).toEqual(['The live server could not be reached.']);

    await ask(served);

    await expect.poll(summaries).toEqual([]);
  });

  it('keeps the warning up past the default toast life', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    await act(() => ask(unreachable));
    expect(summaries()).toEqual(['The live server could not be reached.']);

    // A timed removal takes two timers, each with its own commit: the life's end, then the exit transition.
    await act(() => vi.advanceTimersByTimeAsync(10_000));
    await act(() => vi.advanceTimersByTimeAsync(10_000));

    expect(summaries()).toEqual(['The live server could not be reached.']);
  });

  it('leaves the one warning standing while the failure repeats, keeps it closed once closed, and shows it for a failure after a success', async () => {
    await ask(unreachable);
    await expect.poll(summaries).toEqual(['The live server could not be reached.']);
    const warning = document.querySelector('.p-toast-message');

    await act(() => ask(unreachable));
    expect(summaries()).toEqual(['The live server could not be reached.']);
    expect(warning?.isConnected).toBe(true);

    await page.getByRole('button', { name: 'Close' }).click();
    await expect.poll(summaries).toEqual([]);

    await act(() => ask(unreachable));
    expect(summaries()).toEqual([]);

    await ask(served);
    await ask(unreachable);
    await expect.poll(summaries).toEqual(['The live server could not be reached.']);
  });

  it('replaces the standing warning when a different failure arrives', async () => {
    await ask(unreachable);
    await expect.poll(summaries).toEqual(['The live server could not be reached.']);

    await ask(refused);

    await expect.poll(summaries).toEqual(['The live server could not verify your sign-in.']);
  });
});

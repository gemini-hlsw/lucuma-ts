import { ApolloClient, ApolloLink, gql, InMemoryCache } from '@apollo/client';
import { toastAtom } from '@gemini-hlsw/lucuma-common-ui';
import { fakeJwt, standardUser } from '@gemini-hlsw/lucuma-common-ui/testing';
import { createStore, type Store } from 'jotai';
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';
import { page } from 'vitest/browser';

import { odbTokenAtom, sessionCheckedAtom } from '@/components/atoms/auth';
import { ToastOutlet } from '@/components/ui/ToastOutlet';
import { fakeTimeouts, UNDECODABLE_TOKEN } from '@/test/helpers';
import { captureHeader, captureOperations, createLinkClient, respondWith } from '@/test/linkClient';
import { renderWithContext } from '@/test/render';

import { authLink, createClient, liveLink, sessionHoldLink } from './ApolloConfigs';

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

const ANSWERS = [
  { request: { query: QUERY }, result: { data: { publishedSemesters: [] } } },
  { request: { query: FOLLOW_UP }, result: { data: { __typename: 'Query' } } },
];

const TOKEN = fakeJwt(standardUser('staff'));

let store: Store;

beforeEach(() => {
  store = createStore();
});

afterEach(() => {
  vi.useRealTimers();
});

const headerSent = async (name: string, context?: ApolloLink.OperationContext): Promise<string | null | undefined> => {
  const capture = captureHeader(name);
  const linkClient = createLinkClient(ApolloLink.from([authLink(store), capture.link]), ANSWERS);
  await linkClient.query({ query: QUERY, context });
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

describe('two link chains on two stores', () => {
  it('should send no bearer through a chain built on another store when a token is set on the first', async () => {
    const first = createStore();
    const other = createStore();
    first.set(odbTokenAtom, TOKEN);
    const capture = captureHeader('Authorization');
    const linkClient = createLinkClient(ApolloLink.from([authLink(other), capture.link]), ANSWERS);

    await linkClient.query({ query: QUERY });

    expect(capture.sent).toEqual([null]);
  });
});

describe(sessionHoldLink, () => {
  const heldApollo = () => {
    const { link: enter, names: entered } = captureOperations();
    const capture = captureHeader('Authorization');
    const linkClient = createLinkClient(
      ApolloLink.from([enter, sessionHoldLink(store), authLink(store), capture.link]),
      ANSWERS,
    );
    return { linkClient, sent: capture.sent, entered };
  };

  it('holds a request until the session check settles, then sends it with the bearer the check found', async () => {
    const { linkClient, sent, entered } = heldApollo();

    const answered = linkClient.query({ query: QUERY });
    await expect.poll(() => entered).toEqual(['AuthHeaderProbe']);
    expect(sent).toEqual([]);

    store.set(odbTokenAtom, TOKEN);
    store.set(sessionCheckedAtom, true);

    await answered;
    expect(sent).toEqual([`Bearer ${TOKEN}`]);
  });

  it('sends nothing for a request dropped while it was held', async () => {
    const { linkClient, sent, entered } = heldApollo();
    const subscription = linkClient.watchQuery({ query: QUERY }).subscribe(() => undefined);
    await expect.poll(() => entered).toEqual(['AuthHeaderProbe']);
    subscription.unsubscribe();

    store.set(sessionCheckedAtom, true);
    await linkClient.query({ query: FOLLOW_UP, fetchPolicy: 'network-only' });

    expect(entered).toEqual(['AuthHeaderProbe', 'FollowUp']);
    expect(sent).toEqual([null]);
  });
});

describe("the live client's request chain", () => {
  let fetchSpy: MockInstance<typeof fetch>;
  let client: ApolloClient;

  beforeEach(() => {
    store.set(sessionCheckedAtom, true);
    client = createClient(store);
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

type Outcome = ApolloLink.Result | Error;

const served: Outcome = { data: { publishedSemesters: [] } };
const unreachable: Outcome = new Error('Failed to fetch');
const failed: Outcome = { data: null, errors: [{ message: 'Cannot query field "publishedSemesters"' }] };
const unauthenticated: Outcome = {
  data: null,
  errors: [{ message: "Field 'publishedSemesters' requires authentication." }],
};
const refused: Outcome = { data: null, errors: [{ message: 'Access denied.' }] };

interface LiveChain {
  readonly ask: (next: Outcome) => Promise<void>;
  readonly summaries: () => (string | null)[];
}

/** The live chain over a scripted answer, with its toast outlet mounted; MockLink cannot change its answer between calls. */
const liveChain = async (chainStore: Store): Promise<LiveChain> => {
  chainStore.set(sessionCheckedAtom, true);
  let answer: Outcome = served;
  const client = new ApolloClient({
    link: liveLink(chainStore, new ApolloLink(() => respondWith(answer))),
    cache: new InMemoryCache(),
  });
  const screen = await renderWithContext(<ToastOutlet />, { store: chainStore });
  await expect.poll(() => chainStore.get(toastAtom)).not.toBeNull();
  return {
    ask: async (next) => {
      answer = next;
      await client.query({ query: QUERY, fetchPolicy: 'no-cache' }).catch(() => undefined);
    },
    summaries: () => [...screen.container.querySelectorAll('.p-toast-summary')].map((summary) => summary.textContent),
  };
};

describe(liveLink, () => {
  let ask: LiveChain['ask'];
  let summaries: LiveChain['summaries'];

  beforeEach(async () => {
    ({ ask, summaries } = await liveChain(store));
    await ask(served);
  });

  it.each([
    { cause: 'no answer', next: unreachable, summary: 'The live server could not be reached.' },
    { cause: 'any other server error', next: failed, summary: 'The live server answered with an error.' },
    { cause: 'a missing sign-in', next: unauthenticated, summary: 'The live server could not verify your sign-in.' },
    { cause: 'a refused bearer', next: refused, summary: 'The live server could not verify your sign-in.' },
  ])('shows a warning for $cause', async ({ next, summary }) => {
    await ask(next);

    await expect.poll(summaries).toEqual([summary]);
    expect(document.querySelector('.p-toast-message-warn')).not.toBeNull();
  });

  it.each([
    { cause: 'no answer', next: unreachable, summary: 'The live server could not be reached.' },
    { cause: 'a server error', next: failed, summary: 'The live server answered with an error.' },
    { cause: 'a missing sign-in', next: unauthenticated, summary: 'The live server could not verify your sign-in.' },
  ])('withdraws the warning for $cause on the next answer without errors', async ({ next, summary }) => {
    await ask(next);
    await expect.poll(summaries).toEqual([summary]);

    await ask(served);

    await expect.poll(summaries).toEqual([]);
  });

  it('keeps the warning up past the default toast life', async () => {
    fakeTimeouts();
    await ask(unreachable);
    await expect.poll(summaries).toEqual(['The live server could not be reached.']);

    // A timed removal takes two timers, each with its own commit: the life's end, then the exit transition.
    await vi.advanceTimersByTimeAsync(10_000);
    await vi.advanceTimersByTimeAsync(10_000);

    expect(summaries()).toEqual(['The live server could not be reached.']);
  });

  it('leaves the one warning standing while the failure repeats, keeps it closed once closed, and shows it for a failure after a success', async () => {
    await ask(unreachable);
    await expect.poll(summaries).toEqual(['The live server could not be reached.']);
    const warning = document.querySelector('.p-toast-message');

    await ask(unreachable);
    await expect.poll(summaries).toEqual(['The live server could not be reached.']);
    expect(warning?.isConnected).toBe(true);

    await page.getByRole('button', { name: 'Close' }).click();
    await expect.poll(summaries).toEqual([]);

    await ask(unreachable);
    await expect.poll(summaries).toEqual([]);

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

describe('two live chains on two stores', () => {
  it("should keep the first store's standing warning when the second store's chain succeeds", async () => {
    const first = await liveChain(createStore());
    const other = await liveChain(createStore());
    await first.ask(unreachable);
    await expect.poll(first.summaries).toEqual(['The live server could not be reached.']);

    await other.ask(served);
    await first.ask(failed);

    await expect.poll(first.summaries).toEqual(['The live server answered with an error.']);
    expect(other.summaries()).toEqual([]);
  });
});

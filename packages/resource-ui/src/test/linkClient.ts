import { ApolloClient, ApolloLink, InMemoryCache } from '@apollo/client';
import { MockLink } from '@apollo/client/testing';
import { Observable } from '@apollo/client/utilities';

/** Runs `links` ahead of canned answers, each reusable, so a test drives the real link chain without a schema. */
export const createLinkClient = (links: ApolloLink, answers: readonly MockLink.MockedResponse[]): ApolloClient =>
  new ApolloClient({
    link: ApolloLink.from([
      links,
      new MockLink(answers.map((answer) => ({ maxUsageCount: Number.POSITIVE_INFINITY, ...answer }))),
    ]),
    cache: new InMemoryCache(),
  });

/** Records the named header on each operation that reaches it, `null` where the operation does not set it. */
export const captureHeader = (name: string): { link: ApolloLink; sent: (string | null | undefined)[] } => {
  const sent: (string | null | undefined)[] = [];
  const link = new ApolloLink((operation, forward) => {
    const headers = (operation.getContext().headers ?? {}) as Record<string, string>;
    sent.push(Object.hasOwn(headers, name) ? headers[name] : null);
    return forward(operation);
  });
  return { link, sent };
};

/** Records each operation's name as it passes, then forwards it. */
export const captureOperations = (): { link: ApolloLink; names: string[] } => {
  const names: string[] = [];
  const link = new ApolloLink((operation, forward) => {
    names.push(operation.operationName ?? '');
    return forward(operation);
  });
  return { link, names };
};

/** A terminal answer: the result then completion, or the error alone. */
export const respondWith = (outcome: ApolloLink.Result | Error): Observable<ApolloLink.Result> =>
  new Observable<ApolloLink.Result>((observer) => {
    if (outcome instanceof Error) {
      observer.error(outcome);
    } else {
      observer.next(outcome);
      observer.complete();
    }
  });

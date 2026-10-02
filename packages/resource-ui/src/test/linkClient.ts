import { ApolloClient, ApolloLink } from '@apollo/client';
import { MockLink } from '@apollo/client/testing';

import { buildCache } from '@/gql/cache';

/** Runs `links` ahead of canned answers, each reusable, so a test drives the real link chain without a schema. */
export const createLinkClient = (links: ApolloLink, answers: readonly MockLink.MockedResponse[]): ApolloClient =>
  new ApolloClient({
    link: ApolloLink.from([
      links,
      new MockLink(answers.map((answer) => ({ maxUsageCount: Number.POSITIVE_INFINITY, ...answer }))),
    ]),
    cache: buildCache(),
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

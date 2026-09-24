import { ApolloClient, ApolloLink, HttpLink } from '@apollo/client';
import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { SetContextLink } from '@apollo/client/link/context';
import { ErrorLink } from '@apollo/client/link/error';
import { Observable } from '@apollo/client/utilities';
import { isNotNullish, withAbsoluteUri } from '@gemini-hlsw/lucuma-common-ui';

import { liveGraphqlEndpoint } from '@/app/environment';
import { odbTokenAtom, tokenExpAtom } from '@/components/atoms/auth';
import { store } from '@/components/atoms/store';

import { buildCache } from './cache';
import { clearLiveFailure, reportLiveFailure } from './liveStatus';

/** GraphQL errors mean the server answered, refusing the bearer or not serving this API; anything else is no answer at all. */
export const liveFailureMessage = (error: unknown): string => {
  if (CombinedGraphQLErrors.is(error)) {
    // The message is the only signal: the 403 is lost to the graphql-response+json content type and the body carries no extensions.
    return error.errors.filter(isNotNullish).some((graphqlError) => graphqlError.message === 'Access denied.')
      ? 'The live server refused this session. Sign in again.'
      : 'The live server answered, but it does not serve this version of the Resource API yet.';
  }
  const detail = error instanceof Error && error.message !== '' ? ` (${error.message})` : '';
  return `The live server could not be reached${detail}.`;
};

export const authLink = (): ApolloLink =>
  new SetContextLink((prevContext) => {
    const token = store.get(odbTokenAtom);
    const exp = store.get(tokenExpAtom);
    const signedIn = token !== null && exp !== null && exp.getTime() > Date.now();
    const prevHeaders = (prevContext.headers ?? {}) as Record<string, string>;
    return { headers: signedIn ? { ...prevHeaders, Authorization: `Bearer ${token}` } : prevHeaders };
  });

/** Without it one transient failure pins the banner for good while every query behind it succeeds. */
export const clearOnSuccessLink = (): ApolloLink =>
  new ApolloLink(
    (operation, forward) =>
      new Observable<ApolloLink.Result>((observer) =>
        forward(operation).subscribe({
          next: (result) => {
            if (result.errors === undefined || result.errors.length === 0) {
              clearLiveFailure();
            }
            observer.next(result);
          },
          error: (error: unknown) => {
            observer.error(error);
          },
          complete: () => {
            observer.complete();
          },
        }),
      ),
  );

const liveLink = (): ApolloLink =>
  ApolloLink.from([
    authLink(),
    clearOnSuccessLink(),
    new ErrorLink(({ error }) => {
      reportLiveFailure(liveFailureMessage(error));
    }),
    new HttpLink({ uri: withAbsoluteUri(liveGraphqlEndpoint) }),
  ]);

export const client = new ApolloClient({
  clientAwareness: {
    name: 'resource-ui',
    version: import.meta.env.FRONTEND_VERSION,
  },
  link: liveLink(),
  cache: buildCache(),
});

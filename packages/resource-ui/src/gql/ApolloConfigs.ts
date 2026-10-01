import { ApolloClient, ApolloLink, HttpLink } from '@apollo/client';
import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { SetContextLink } from '@apollo/client/link/context';
import { ErrorLink } from '@apollo/client/link/error';
import { Observable } from '@apollo/client/utilities';
import { isNotNullish, withAbsoluteUri } from '@gemini-hlsw/lucuma-common-ui';
import type { ToastMessage } from 'primereact/toast';

import { liveGraphqlEndpoint } from '@/app/environment';
import { odbTokenAtom, sessionCheckedAtom, tokenExpAtom } from '@/components/atoms/auth';
import { store } from '@/components/atoms/store';
import { toastAtom } from '@/components/atoms/toast';

import { buildCache } from './cache';

const UNREACHABLE = {
  severity: 'warn',
  summary: 'The live server could not be reached.',
  sticky: true,
} satisfies ToastMessage;
const NOT_SERVED = {
  severity: 'warn',
  summary: 'The live server does not serve this version of the Resource API yet.',
  sticky: true,
} satisfies ToastMessage;
const REFUSED = {
  severity: 'warn',
  summary: 'The live server could not verify your sign-in.',
  sticky: true,
} satisfies ToastMessage;

/** GraphQL errors mean the server answered, refusing the bearer or not serving this API; anything else is no answer at all. */
const liveFailureToast = (error: unknown): ToastMessage => {
  if (CombinedGraphQLErrors.is(error)) {
    // The message is the only signal: the 403 is lost to the graphql-response+json content type and the body carries no extensions.
    return error.errors.filter(isNotNullish).some((graphqlError) => graphqlError.message === 'Access denied.')
      ? REFUSED
      : NOT_SERVED;
  }
  return UNREACHABLE;
};

/** Stays set after the reader closes the toast, so a failure that persists does not reopen it. */
let standingFailure: ToastMessage | null = null;

const showLiveFailure = (failure: ToastMessage): void => {
  const toast = store.get(toastAtom);
  if (toast === null || failure === standingFailure) {
    return;
  }
  if (standingFailure !== null) {
    toast.remove(standingFailure);
  }
  toast.show(failure);
  standingFailure = failure;
};

const clearLiveFailure = (): void => {
  if (standingFailure !== null) {
    store.get(toastAtom)?.remove(standingFailure);
    standingFailure = null;
  }
};

/** Holds each request until the first session check settles, so none goes out before the bearer is known. */
export const sessionHoldLink = (): ApolloLink =>
  new ApolloLink(
    (operation, forward) =>
      new Observable<ApolloLink.Result>((observer) => {
        let forwarded: { unsubscribe: () => void } | undefined;
        let unsubscribe: (() => void) | undefined;
        const release = (): void => {
          if (forwarded !== undefined || !store.get(sessionCheckedAtom)) {
            return;
          }
          unsubscribe?.();
          forwarded = forward(operation).subscribe(observer);
        };
        release();
        if (forwarded === undefined) {
          unsubscribe = store.sub(sessionCheckedAtom, release);
        }
        return () => {
          unsubscribe?.();
          forwarded?.unsubscribe();
        };
      }),
  );

export const authLink = (): ApolloLink =>
  new SetContextLink((prevContext) => {
    const token = store.get(odbTokenAtom);
    const exp = store.get(tokenExpAtom);
    const signedIn = token !== null && exp !== null && exp.getTime() > Date.now();
    const prevHeaders = (prevContext.headers ?? {}) as Record<string, string>;
    return { headers: signedIn ? { ...prevHeaders, Authorization: `Bearer ${token}` } : prevHeaders };
  });

/** Without it one transient failure pins its toast for good while every query behind it succeeds. */
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

/** The live client's chain in front of `transport`, which is the HttpLink everywhere but a test. */
export const liveLink = (transport: ApolloLink): ApolloLink =>
  ApolloLink.from([
    sessionHoldLink(),
    authLink(),
    clearOnSuccessLink(),
    new ErrorLink(({ error }) => {
      showLiveFailure(liveFailureToast(error));
    }),
    transport,
  ]);

export const client = new ApolloClient({
  clientAwareness: {
    name: 'resource-ui',
    version: import.meta.env.FRONTEND_VERSION,
  },
  link: liveLink(new HttpLink({ uri: withAbsoluteUri(liveGraphqlEndpoint) })),
  cache: buildCache(),
});

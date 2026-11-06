import { ApolloClient, ApolloLink, HttpLink, InMemoryCache } from '@apollo/client';
import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { SetContextLink } from '@apollo/client/link/context';
import { ErrorLink } from '@apollo/client/link/error';
import { Observable } from '@apollo/client/utilities';
import { isNotNullish, toastAtom, withAbsoluteUri } from '@gemini-hlsw/lucuma-common-ui';
import { atom, type Store } from 'jotai';
import type { ToastMessage } from 'primereact/toast';

import { liveGraphqlEndpoint } from '@/app/environment';
import { odbTokenAtom, sessionCheckedAtom, tokenExpAtom } from '@/components/atoms/auth';

const UNREACHABLE = {
  severity: 'warn',
  summary: 'The live server could not be reached.',
  sticky: true,
} as const satisfies ToastMessage;
const FAILED = {
  severity: 'warn',
  summary: 'The live server answered with an error.',
  sticky: true,
} as const satisfies ToastMessage;
const REFUSED = {
  severity: 'warn',
  summary: 'The live server could not verify your sign-in.',
  sticky: true,
} as const satisfies ToastMessage;

const isSignInError = (message: string): boolean =>
  message === 'Access denied.' || message.endsWith(' requires authentication.');

/** GraphQL errors mean the server answered, missing or refusing the bearer or failing otherwise; anything else is no answer at all. */
const liveFailureToast = (error: unknown): ToastMessage => {
  if (CombinedGraphQLErrors.is(error)) {
    // The message is the only signal: the 403 is lost to the graphql-response+json content type and the body carries no extensions.
    return error.errors.filter(isNotNullish).some((graphqlError) => isSignInError(graphqlError.message))
      ? REFUSED
      : FAILED;
  }
  return UNREACHABLE;
};

/** Stays set after the reader closes the toast, so a failure that persists does not reopen it. */
const standingFailureAtom = atom<ToastMessage | null>(null);

const showLiveFailure = (store: Store, failure: ToastMessage): void => {
  const toast = store.get(toastAtom);
  const standing = store.get(standingFailureAtom);
  if (toast === null || failure === standing) {
    return;
  }
  if (standing !== null) {
    toast.remove(standing);
  }
  toast.show(failure);
  store.set(standingFailureAtom, failure);
};

const clearLiveFailure = (store: Store): void => {
  const standing = store.get(standingFailureAtom);
  if (standing !== null) {
    store.get(toastAtom)?.remove(standing);
    store.set(standingFailureAtom, null);
  }
};

/** Holds each request until the first session check settles, so none goes out before the bearer is known. */
export const sessionHoldLink = (store: Store): ApolloLink =>
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

export const authLink = (store: Store): ApolloLink =>
  new SetContextLink((prevContext) => {
    const token = store.get(odbTokenAtom);
    const exp = store.get(tokenExpAtom);
    const signedIn = token !== null && exp !== null && exp.getTime() > Date.now();
    const prevHeaders = (prevContext.headers ?? {}) as Record<string, string>;
    return { headers: signedIn ? { ...prevHeaders, Authorization: `Bearer ${token}` } : prevHeaders };
  });

/** Without it one transient failure pins its toast for good while every query behind it succeeds. */
export const clearOnSuccessLink = (store: Store): ApolloLink =>
  new ApolloLink(
    (operation, forward) =>
      new Observable<ApolloLink.Result>((observer) =>
        forward(operation).subscribe({
          next: (result) => {
            if (result.errors === undefined || result.errors.length === 0) {
              clearLiveFailure(store);
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
export const liveLink = (store: Store, transport: ApolloLink): ApolloLink =>
  ApolloLink.from([
    sessionHoldLink(store),
    authLink(store),
    clearOnSuccessLink(store),
    new ErrorLink(({ error }) => {
      showLiveFailure(store, liveFailureToast(error));
    }),
    transport,
  ]);

export const createClient = (store: Store): ApolloClient =>
  new ApolloClient({
    clientAwareness: {
      name: 'resource-ui',
      version: import.meta.env.FRONTEND_VERSION,
    },
    link: liveLink(store, new HttpLink({ uri: withAbsoluteUri(liveGraphqlEndpoint) })),
    cache: new InMemoryCache(),
  });

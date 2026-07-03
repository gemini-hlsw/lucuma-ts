// Apollo
import {
  ApolloClient,
  ApolloLink,
  CombinedGraphQLErrors,
  defaultDataIdFromObject,
  HttpLink,
  InMemoryCache,
  ServerError,
} from '@apollo/client';
import { SetContextLink } from '@apollo/client/link/context';
import { ErrorLink } from '@apollo/client/link/error';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { withAbsoluteUri } from '@gemini-hlsw/lucuma-common-ui';
import { SERVER_CONFIGURATION } from '@gql/server/ServerConfiguration';
import { OperationTypeNode } from 'graphql/language';
import { createClient as createWsClient } from 'graphql-ws';

import { odbTokenAtom } from '@/components/atoms/auth';
import { wsIsConnectedAtom } from '@/components/atoms/connection';
import { store } from '@/components/atoms/store';
import { toastAtom } from '@/Helpers/toast';

const navigateServerURI = withAbsoluteUri('/navigate/graphql');
const navigateServerWsURI = withAbsoluteUri('/navigate/ws', true);
const navigateConfigsURI = withAbsoluteUri('/db');

// Log errors to the console and show a toast
const errorLink = new ErrorLink(({ error, result, operation }) => {
  const ctx = operation.getContext();

  const combinedErrors = CombinedGraphQLErrors.is(error) ? new CombinedGraphQLErrors(result!, error.errors) : undefined;

  const errorMessage = (ctx.error?.detail ?? combinedErrors?.message ?? error.message)?.trim();

  if (errorMessage) {
    store.get(toastAtom)?.show({
      severity: 'error',
      contentClassName: 'graphql-error-toast',
      summary: ctx.error?.summary ?? 'GraphQL error',
      detail: errorMessage,
      life: 10000,
    });
  }

  if (combinedErrors) {
    combinedErrors.errors.forEach(({ message, locations, path }) =>
      console.warn(`[GraphQL error]: Message: ${message}, Location:`, locations, `Path:`, path),
    );
  } else if (ServerError.is(error)) {
    console.error(`Server error: ${error.message}`);
  } else if (error) {
    console.error(`Other error: ${error.message}`);
  }
});

function createClient() {
  const cache = makeCache();

  const navigateCommandServer = new HttpLink({ uri: navigateServerURI });

  const navigateConfigs = new HttpLink({ uri: navigateConfigsURI });

  const odbAuthLink = new SetContextLink(({ headers }) => {
    const token = store.get(odbTokenAtom);
    if (!token) {
      store.get(toastAtom)?.show({
        severity: 'warn',
        summary: 'Login required',
        detail: 'Login before querying ODB',
      });
    }

    const prevHeaders = headers ?? {};
    return {
      headers: token ? { ...prevHeaders, Authorization: `Bearer ${token}` } : prevHeaders,
    };
  });

  const odbLink = new HttpLink({
    uri: () => cache.readQuery({ query: SERVER_CONFIGURATION })?.serverConfiguration?.odbUri ?? '',
  });

  const subscriptionClient = createWsClient({
    url: navigateServerWsURI,
    shouldRetry: () => true,
  });

  // How long to wait until we assume the websocket is disconnected
  const disconnectTimeoutMs = 250;
  let wsIsConnectedTimer: NodeJS.Timeout | undefined;

  const setWebSocketConnected = () => {
    clearTimeout(wsIsConnectedTimer);
    store.set(wsIsConnectedAtom, true);
  };
  const setWebsocketDisconnected = () => {
    clearTimeout(wsIsConnectedTimer);
    wsIsConnectedTimer = setTimeout(() => store.set(wsIsConnectedAtom, false), disconnectTimeoutMs);
  };
  subscriptionClient.on('connected', setWebSocketConnected);
  subscriptionClient.on('closed', setWebsocketDisconnected);

  const wsLink = new GraphQLWsLink(subscriptionClient);

  return new ApolloClient({
    clientAwareness: {
      name: 'navigate-ui',
      version: import.meta.env.FRONTEND_VERSION,
    },
    link: ApolloLink.from([
      errorLink,
      ApolloLink.split(
        (operation) => operation.getContext().clientName === 'odb',
        odbAuthLink.concat(odbLink),
        ApolloLink.split(
          (operation) => operation.getContext().clientName === 'navigateConfigs',
          navigateConfigs,
          ApolloLink.split(
            ({ operationType }) => operationType === OperationTypeNode.SUBSCRIPTION,
            wsLink,
            navigateCommandServer,
          ),
        ),
      ),
    ]),
    cache,
  });
}

export const client = createClient();

export function makeCache() {
  return new InMemoryCache({
    dataIdFromObject(responseObject) {
      // Configure primary-key fields for cache normalization to use 'pk' field
      if (
        !('id' in responseObject && responseObject.id !== null) &&
        'pk' in responseObject &&
        (typeof responseObject.pk === 'string' || typeof responseObject.pk === 'number') &&
        responseObject.__typename
      ) {
        return `${responseObject.__typename}:pk:${responseObject.pk}`;
      } else {
        return defaultDataIdFromObject(responseObject);
      }
    },
    // Configure primary-key fields for cache normalization
    typePolicies: {
      GuideAlarm: {
        keyFields: ['wfs'],
      },
      Observation: {
        fields: {
          targetEnvironment: {
            merge: true,
          },
        },
      },
    },
  });
}

import type { ApolloClient } from '@apollo/client';
import { useApolloClient } from '@apollo/client/react';
import { type Session, sessionPerStore } from '@gemini-hlsw/lucuma-common-ui';
import { SERVER_CONFIGURATION } from '@gql/server/ServerConfiguration';
import { useStore } from 'jotai';

import type { StandardRole } from './user';

/*
 * Navigate's binding of the shared SSO session keeper (common-ui session.ts).
 * Reads the SSO origin from the Apollo cache on each call. The app renders after that query answers.
 * Switches a user to the staff role when they hold one.
 */

export const NAVIGATE_ROLES = ['staff'] as const satisfies readonly StandardRole['type'][];

function configuredSsoUri(client: ApolloClient): string {
  const ssoUri = client.readQuery({ query: SERVER_CONFIGURATION })?.serverConfiguration.ssoUri;
  if (!ssoUri) throw new Error('The server configuration, and so the SSO origin, has not loaded yet.');
  return ssoUri;
}

/** One keeper per store; it reads the SSO origin through the first `client` it is given. */
const sessionFor = sessionPerStore((client: ApolloClient) => ({
  ssoUri: () => configuredSsoUri(client),
  channelName: 'navigate-session',
  preferRoles: NAVIGATE_ROLES,
}));

/** The keeper for the Jotai store and Apollo client in context. */
export const useSession = (): Session => sessionFor(useStore(), useApolloClient());

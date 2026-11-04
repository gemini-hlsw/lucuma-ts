import { useApolloClient } from '@apollo/client/react';
import { type SessionTimings, useSessionKeeper } from '@gemini-hlsw/lucuma-common-ui';
import type { ReactNode } from 'react';

import { session } from './session';

/** Keeps the SSO session alive. Refetches the page's queries on sign-in and sign-out. */
export function AuthSession({ children, timings }: { children: ReactNode; timings?: SessionTimings }): ReactNode {
  useSessionKeeper(session, { client: useApolloClient(), timings });
  return children;
}

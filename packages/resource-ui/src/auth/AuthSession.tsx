import { useApolloClient } from '@apollo/client/react';
import { atom, useStore } from 'jotai';
import { type ReactNode, useEffect } from 'react';

import { odbTokenAtom } from '@/components/atoms/auth';

import { type SessionTimings, startSession } from './session';
import { SessionNoticesContainer } from './SessionNoticesContainer';

const hasTokenAtom = atom((get) => get(odbTokenAtom) !== null);

interface AuthSessionProps {
  children: ReactNode;
  timings?: SessionTimings;
}

export function AuthSession({ children, timings }: AuthSessionProps): ReactNode {
  const client = useApolloClient();
  const store = useStore();

  useEffect(() => startSession(store, timings), [store, timings]);

  useEffect(
    () =>
      store.sub(hasTokenAtom, () => {
        // Each query's failure already reaches its component and the toast through the link chain.
        (store.get(hasTokenAtom) ? client.refetchObservableQueries() : client.resetStore()).catch(() => undefined);
      }),
    [client, store],
  );

  return (
    <>
      {children}
      <SessionNoticesContainer />
    </>
  );
}

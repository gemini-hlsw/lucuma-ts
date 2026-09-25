import { useApolloClient } from '@apollo/client/react';
import { atom } from 'jotai';
import { type ReactNode, useEffect } from 'react';

import { odbTokenAtom } from '@/components/atoms/auth';
import { store } from '@/components/atoms/store';

import { type SessionTimings, startSession } from './session';

const hasTokenAtom = atom((get) => get(odbTokenAtom) !== null);

export function AuthSession({ children, timings }: { children: ReactNode; timings?: SessionTimings }): ReactNode {
  const client = useApolloClient();

  useEffect(() => startSession(timings), [timings]);

  useEffect(
    () =>
      store.sub(hasTokenAtom, () => {
        // Each query's failure already reaches its component and the toast through the link chain.
        client.refetchObservableQueries().catch(() => undefined);
      }),
    [client],
  );

  return children;
}

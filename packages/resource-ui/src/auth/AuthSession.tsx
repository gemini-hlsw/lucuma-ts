import { useApolloClient } from '@apollo/client/react';
import { atom } from 'jotai';
import { type ReactNode, useEffect } from 'react';

import { odbTokenAtom, useSessionStatus } from '@/components/atoms/auth';
import { store } from '@/components/atoms/store';

import { startSession } from './session';

const hasTokenAtom = atom((get) => get(odbTokenAtom) !== null);

export function AuthSession({ children }: { children: ReactNode }): ReactNode {
  const client = useApolloClient();
  const status = useSessionStatus();

  useEffect(() => startSession(), []);

  useEffect(
    () =>
      store.sub(hasTokenAtom, () => {
        // Each query's failure already reaches its component and the banner through the link chain.
        client.refetchObservableQueries().catch(() => undefined);
      }),
    [client],
  );

  return status === 'checking' ? null : children;
}

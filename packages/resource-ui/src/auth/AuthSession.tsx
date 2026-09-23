import { useApolloClient } from '@apollo/client/react';
import { type ReactNode, useEffect } from 'react';

import { odbTokenAtom, useSessionStatus } from '@/components/atoms/auth';
import { store } from '@/components/atoms/store';

import { startSession } from './session';

export function AuthSession({ children }: { children: ReactNode }): ReactNode {
  const client = useApolloClient();
  const status = useSessionStatus();

  useEffect(() => startSession(), []);

  useEffect(() => {
    let previous = store.get(odbTokenAtom);
    return store.sub(odbTokenAtom, () => {
      const next = store.get(odbTokenAtom);
      const flipped = (previous === null) !== (next === null);
      previous = next;
      if (flipped) {
        // Each query's failure already reaches its component and the banner through the link chain.
        client.refetchObservableQueries().catch(() => undefined);
      }
    });
  }, [client]);

  return status === 'checking' ? null : children;
}

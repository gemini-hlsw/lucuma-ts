import type { ApolloClient } from '@apollo/client';
import { atom } from 'jotai';
import { useEffect, useEffectEvent } from 'react';

import { userAtom } from './atoms.ts';
import type { RoleSwitchOutcome, Session, SessionTimings } from './session.ts';

/** The token's identity: the user, and the active role for standard users.
 *  A renewal keeps it. Sign-in, sign-out and role switches change it. */
const identityAtom = atom((get) => {
  const user = get(userAtom);
  if (user === null) return null;
  return user.type === 'standard' ? `${user.id} ${user.role.id}` : user.id;
});

export interface SessionKeeperOptions {
  readonly timings?: SessionTimings | undefined;
  /** Refetch observable queries on sign-in, sign-out or role switch, so no answer shows
   *  the old identity. Renewals do not refetch. */
  readonly client?: Pick<ApolloClient, 'refetchObservableQueries'> | undefined;
  /** Receives the outcome of each automatic role switch. The latest callback is used. */
  readonly onRoleSwitch?: ((outcome: RoleSwitchOutcome) => void) | undefined;
}

/** Keep `session` running while the calling component is mounted. */
export function useSessionKeeper(session: Session, { timings, client, onRoleSwitch }: SessionKeeperOptions = {}): void {
  const reportRoleSwitch = useEffectEvent((outcome: RoleSwitchOutcome) => onRoleSwitch?.(outcome));

  useEffect(() => session.start({ timings, onRoleSwitch: (outcome) => reportRoleSwitch(outcome) }), [session, timings]);

  useEffect(() => {
    if (client === undefined) return;
    return session.store.sub(identityAtom, () => {
      // Errors reach each component through the link chain, so ignore them here.
      client.refetchObservableQueries().catch(() => undefined);
    });
  }, [session, client]);
}

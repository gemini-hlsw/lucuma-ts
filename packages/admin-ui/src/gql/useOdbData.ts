import type { TypedDocumentNode } from '@apollo/client';
import { useApolloClient } from '@apollo/client/react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { odbTokenAtom } from '@/components/atoms/auth';
import { store } from '@/components/atoms/store';

/** State of a live ODB query, as the view-header status badge presents it. */
export type DataStatus = 'loading' | 'ready' | 'error' | 'no-token';

/** True when a token is available right now, so views can attempt queries. */
export const hasOdbToken = (): boolean => store.get(odbTokenAtom) !== null;

export interface OdbData<T> {
  /** Mapped rows from the ODB; the empty value until ready. */
  readonly data: T;
  readonly status: DataStatus;
  /** Present when the query failed (expired token, access denied, …). */
  readonly error?: string;
  /** Re-run the query — call after a mutation lands so the view shows what the
   *  ODB actually stored, not an optimistic guess. */
  readonly refetch: () => void;
}

/**
 * Run a live ODB query and map the response to the view's shape:
 *   - no token            → status 'no-token' (the auth gate handles sign-in)
 *   - query in flight     → 'loading'
 *   - success             → 'ready' with whatever the token can see (may be empty)
 *   - failure             → 'error' with a short message
 *
 * `empty` is the empty value of T (e.g. []), shown before data arrives. While
 * a refetch is in flight the previous data stays visible (status 'loading').
 */
export function useOdbData<TData, T>(
  query: TypedDocumentNode<TData, Record<string, never>>,
  map: (raw: TData) => T,
  empty: T,
): OdbData<T> {
  const apollo = useApolloClient();
  const [fetchCount, setFetchCount] = useState(0);
  const [state, setState] = useState<Omit<OdbData<T>, 'refetch'>>({
    data: empty,
    status: hasOdbToken() ? 'loading' : 'no-token',
  });

  const refetch = useCallback(() => {
    setState((s) => ({ ...s, status: hasOdbToken() ? 'loading' : 'no-token' }));
    setFetchCount((n) => n + 1);
  }, []);

  // map/empty are pure per-view values; read through refs so an inline arrow
  // or literal at a call site can't re-trigger the fetch effect. Synced in an
  // effect (declared first, so it runs before the fetch effect each commit).
  const mapRef = useRef(map);
  const emptyRef = useRef(empty);
  useEffect(() => {
    mapRef.current = map;
    emptyRef.current = empty;
  });

  useEffect(() => {
    if (!hasOdbToken()) return;

    let cancelled = false;
    apollo
      .query({ query, fetchPolicy: 'network-only' })
      .then((res) => {
        if (cancelled) return;
        if (res.data === undefined) {
          setState({ data: emptyRef.current, status: 'error', error: 'Query returned no data.' });
        } else {
          setState({ data: mapRef.current(res.data), status: 'ready' });
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setState({ data: emptyRef.current, status: 'error', error: friendlyError(err) });
      });

    return () => {
      cancelled = true;
    };
  }, [apollo, query, fetchCount]);

  return { ...state, refetch };
}

/**
 * Run an ODB mutation. Returns an async runner that resolves with the payload
 * on success and rejects with a short human-readable Error on failure —
 * callers own their busy/toast handling and should `refetch()` the backing
 * query afterwards.
 */
export function useOdbMutation(): <TData, TVars extends Record<string, unknown>>(
  mutation: TypedDocumentNode<TData, TVars>,
  variables: TVars,
) => Promise<TData> {
  const apollo = useApolloClient();
  return useCallback(
    async (mutation, variables) => {
      try {
        const res = await apollo.mutate({ mutation, variables });
        if (res.data === undefined) throw new Error('Mutation returned no data.');
        return res.data;
      } catch (err) {
        throw new Error(friendlyError(err));
      }
    },
    [apollo],
  );
}

const EMPTY_BY_ID_RESULT: OdbData<ReadonlyMap<string, never>> = {
  data: new Map<string, never>(),
  status: 'ready',
  refetch: () => undefined,
};

/**
 * Run a follow-up query for IDs gathered from a first `useOdbData` result
 * (e.g. ConfigurationRequest.applicableObservations), batched into a single
 * round-trip rather than one request per row. `query` takes the ids as its
 * `$ids` variable. Re-fetches whenever the id set changes. An empty id list
 * is 'ready' with an empty map — there's nothing to fetch and that's not an
 * error.
 */
export function useOdbDataByIds<TData, T>(
  ids: readonly string[],
  query: TypedDocumentNode<TData, { ids: string[] }>,
  map: (raw: TData) => ReadonlyMap<string, T>,
): OdbData<ReadonlyMap<string, T>> {
  const apollo = useApolloClient();
  const [fetchCount, setFetchCount] = useState(0);
  const [state, setState] = useState<Omit<OdbData<ReadonlyMap<string, T>>, 'refetch'>>({
    data: new Map<string, T>(),
    status: hasOdbToken() ? 'loading' : 'no-token',
  });

  const refetch = useCallback(() => {
    setState((s) => ({ ...s, status: hasOdbToken() ? 'loading' : 'no-token' }));
    setFetchCount((n) => n + 1);
  }, []);

  // `key` is the real dependency: a stable serialization of the id set. The
  // other inputs are read through refs so per-render array/function identities
  // can't re-trigger the fetch effect.
  const key = [...ids].sort().join(',');
  const idsRef = useRef(ids);
  const mapRef = useRef(map);
  useEffect(() => {
    idsRef.current = ids;
    mapRef.current = map;
  });

  useEffect(() => {
    // An empty id set is handled synchronously below; no fetch, no setState.
    if (!hasOdbToken() || key === '') return;

    let cancelled = false;
    apollo
      .query({ query, fetchPolicy: 'network-only', variables: { ids: [...idsRef.current] } })
      .then((res) => {
        if (cancelled) return;
        if (res.data === undefined) {
          setState({ data: new Map<string, T>(), status: 'error', error: 'Query returned no data.' });
        } else {
          setState({ data: mapRef.current(res.data), status: 'ready' });
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setState({ data: new Map<string, T>(), status: 'error', error: friendlyError(err) });
      });

    return () => {
      cancelled = true;
    };
  }, [apollo, query, key, fetchCount]);

  if (ids.length === 0 && hasOdbToken()) return EMPTY_BY_ID_RESULT;
  return { ...state, refetch };
}

/** Turn an Apollo/network error into a short, human message. */
function friendlyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/access denied/i.test(msg)) return 'Access denied for this token’s role.';
  if (/jwt|expired|signature|401|unauthor/i.test(msg)) return 'Token expired or invalid — sign in again.';
  if (/failed to fetch|networkerror|econnrefused/i.test(msg)) return 'The ODB is unreachable.';
  return `Query failed: ${msg.slice(0, 100)}`;
}

import type { OperationVariables } from '@apollo/client';
import { useQuery } from '@apollo/client/react';
import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import { useEffect } from 'react';

import { useStale } from '@/Helpers/hooks';

export interface QueryAndSubscriptionOptions {
  /**
   * If true, the returned `setStale` can be used to set stale (loading) to true after a mutation. New data in the subscription will set stale to false.
   *
   * Default: true
   */
  useStale: boolean;
}

/**
 * Combines the results of a query and a subscription into a single object.
 *
 * Subscription data is preferred over query data. Until the subscription data is received, the query data is used.
 */
export function useQueryAndSubscription<
  TResult,
  TVariables extends OperationVariables,
  TResultSub,
  TVariablesSub extends OperationVariables,
  K extends keyof Omit<TResult | TResultSub, '__typename'>,
>(
  queryNode: TypedDocumentNode<TResult, TVariables>,
  subscriptionNode: TypedDocumentNode<TResultSub, TVariablesSub>,
  key: K,
  options: QueryAndSubscriptionOptions = { useStale: true },
) {
  const [stale, setStale] = useStale();

  // eslint-disable-next-line @typescript-eslint/no-deprecated
  const { subscribeToMore, data, ...query } = useQuery<TResult | TResultSub>(queryNode, {
    nextFetchPolicy: 'cache-only',
  });

  useEffect(
    () =>
      subscribeToMore({
        document: subscriptionNode,
        updateQuery: (prev, { subscriptionData }) => subscriptionData.data ?? (prev as TResult),
      }),
    [subscribeToMore, subscriptionNode],
  );

  useEffect(() => {
    if (options.useStale) setStale(false);
  }, [data, setStale, options.useStale]);

  return {
    ...query,
    data: data?.[key],
    loading: query.loading || data === undefined || (options.useStale && stale),
    setStale,
  };
}

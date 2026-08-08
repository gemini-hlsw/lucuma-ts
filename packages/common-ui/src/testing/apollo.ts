import type { DocumentNode, OperationVariables } from '@apollo/client';
import type { MockLink } from '@apollo/client/testing';
import type { ResultOf, VariablesOf } from '@graphql-typed-document-node/core';

/**
 * A MockedResponse whose variables and result are typed by the operation
 * document, so adding a field to a query turns every stale mock into a compile
 * error rather than a silent runtime mismatch.
 */
export type MockedResponseOf<T extends DocumentNode> =
  VariablesOf<T> extends OperationVariables ? MockLink.MockedResponse<ResultOf<T>, VariablesOf<T>> : never;

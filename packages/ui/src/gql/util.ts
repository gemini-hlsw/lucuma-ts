import type { DocumentNode, OperationVariables } from '@apollo/client';
import type { SkipToken, useQuery } from '@apollo/client/react';
import type { MockLink } from '@apollo/client/testing';
import { isNullish } from '@gemini-hlsw/lucuma-common-ui';
import type { ResultOf, VariablesOf } from '@graphql-typed-document-node/core';

import type { TargetType } from '@/types';

/**
 * Options for useQuery hook.
 */
export type OptionsOf<T extends DocumentNode> =
  VariablesOf<T> extends OperationVariables
    ? SkipToken | Omit<useQuery.Options<ResultOf<T>, VariablesOf<T>>, 'context'>
    : never;

export function isBaseTarget(target: Pick<TargetType, 'type'> | undefined | null) {
  if (isNullish(target)) return false;
  else return ['SCIENCE', 'BLINDOFFSET', 'FIXED'].includes(target.type);
}
export function isOiTarget(target: Pick<TargetType, 'type'> | undefined) {
  return target?.type === 'OIWFS';
}
export function isP1Target(target: Pick<TargetType, 'type'> | undefined) {
  return target?.type === 'PWFS1';
}
export function isP2Target(target: Pick<TargetType, 'type'> | undefined) {
  return target?.type === 'PWFS2';
}

export type MockedResponseOf<T extends DocumentNode> =
  VariablesOf<T> extends OperationVariables ? MockLink.MockedResponse<ResultOf<T>, VariablesOf<T>> : never;

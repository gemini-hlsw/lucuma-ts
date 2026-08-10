import type { DocumentNode, OperationVariables } from '@apollo/client';
import type { SkipToken, useQuery } from '@apollo/client/react';
import { isNullish } from '@gemini-hlsw/lucuma-common-ui';
import type { ResultOf, VariablesOf } from '@graphql-typed-document-node/core';

import type { Target } from '@/types';

// The typed-mock helper now lives in common-ui so all apps share it; re-exported
// here to keep the `@gql/util` import path stable across navigate's tests.
export type { MockedResponseOf } from '@gemini-hlsw/lucuma-common-ui/testing';

/**
 * Options for useQuery hook.
 */
export type OptionsOf<T extends DocumentNode> =
  VariablesOf<T> extends OperationVariables
    ? SkipToken | Omit<useQuery.Options<ResultOf<T>, VariablesOf<T>>, 'context'>
    : never;

export function isBaseTarget(target: Pick<Target, 'type'> | undefined | null) {
  if (isNullish(target)) return false;
  else return ['SCIENCE', 'BLINDOFFSET', 'FIXED'].includes(target.type);
}
export function isOiTarget(target: Pick<Target, 'type'> | undefined) {
  return target?.type === 'OIWFS';
}
export function isP1Target(target: Pick<Target, 'type'> | undefined) {
  return target?.type === 'PWFS1';
}
export function isP2Target(target: Pick<Target, 'type'> | undefined) {
  return target?.type === 'PWFS2';
}

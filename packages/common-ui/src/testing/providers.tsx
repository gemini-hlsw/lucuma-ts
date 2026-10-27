import type { ApolloCache } from '@apollo/client';
import type { MockLink } from '@apollo/client/testing';
import { MockedProvider } from '@apollo/client/testing/react';
import type { Store, WritableAtom } from 'jotai';
import { createStore, Provider as JotaiProvider } from 'jotai';
import { useHydrateAtoms } from 'jotai/utils';
import type { PropsWithChildren } from 'react';

/**
 * A Jotai store paired with an Apollo `MockedProvider`, the wrapper every app's
 * test render helper needs at its core. Apps add their own outer providers
 * (router, PrimeReact, toasts, …) around this and call `render` themselves.
 *
 * Pass a `store` to inspect atoms after rendering; otherwise a fresh one is
 * created for this render. `initialValues` hydrates atoms before the first
 * render. Each value is type-checked against its atom.
 *
 * Each mock answers once unless it sets `maxUsageCount`, so a repeated request fails.
 * Pass `cache` to start from pre-written data.
 */
export function AtomsAndApollo<T extends AtomTuples>({
  children,
  // Created once per render; pass an explicit store to read atoms back in a test.
  store = createStore(),
  initialValues = [] as InferAtomTuples<T>,
  mocks = [],
  cache,
}: PropsWithChildren<{
  store?: Store;
  initialValues?: InferAtomTuples<T>;
  mocks?: readonly MockLink.MockedResponse[];
  cache?: ApolloCache;
}>) {
  return (
    <JotaiProvider store={store}>
      <HydrateAtoms initialValues={initialValues}>
        <MockedProvider {...(cache ? { cache } : {})} mocks={[...mocks]}>
          {children}
        </MockedProvider>
      </HydrateAtoms>
    </JotaiProvider>
  );
}

function HydrateAtoms<T extends AtomTuples>({
  initialValues,
  children,
}: PropsWithChildren<{ initialValues: InferAtomTuples<T> }>) {
  useHydrateAtoms(initialValues);
  return children;
}

// A writable atom paired with the value to hydrate it to, as `useHydrateAtoms`
// expects. Copied from Jotai's own internal typing so callers get a type-safe
// `initialValues` array.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyWritableAtom = WritableAtom<unknown, any[], unknown>;
export type AtomTuples = (readonly [AnyWritableAtom, ...unknown[]])[];

/** Checks each `[atom, ...args]` tuple's arguments against what its atom's setter accepts. */
export type InferAtomTuples<T> = {
  [K in keyof T]: T[K] extends readonly [infer A, ...infer Rest]
    ? A extends WritableAtom<unknown, infer Args, unknown>
      ? Rest extends Args
        ? readonly [A, ...Rest]
        : never
      : T[K]
    : never;
};

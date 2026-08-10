import type { MockLink } from '@apollo/client/testing';
import { MockedProvider } from '@apollo/client/testing/react';
import type { WritableAtom } from 'jotai';
import { createStore, Provider as JotaiProvider } from 'jotai';
import { useHydrateAtoms } from 'jotai/utils';
import type { Store } from 'jotai/vanilla/store';
import type { PropsWithChildren } from 'react';

/**
 * A Jotai store paired with an Apollo `MockedProvider`, the wrapper every app's
 * test render helper needs at its core. Apps add their own outer providers
 * (router, PrimeReact, toasts, …) around this and call `render` themselves.
 *
 * Pass a `store` to inspect atoms after rendering; otherwise a fresh one is
 * created for this render. `initialValues` hydrates atoms before the first
 * render.
 */
export function AtomsAndApollo({
  children,
  // Created once per render; pass an explicit store to read atoms back in a test.
  store = createStore(),
  initialValues = [],
  mocks = [],
}: PropsWithChildren<{
  store?: Store;
  initialValues?: AtomTuples;
  mocks?: readonly MockLink.MockedResponse[];
}>) {
  return (
    <JotaiProvider store={store}>
      <HydrateAtoms initialValues={initialValues}>
        <MockedProvider mocks={[...mocks]}>{children}</MockedProvider>
      </HydrateAtoms>
    </JotaiProvider>
  );
}

function HydrateAtoms({ initialValues, children }: PropsWithChildren<{ initialValues: AtomTuples }>) {
  useHydrateAtoms(initialValues);
  return children;
}

// A writable atom paired with the value to hydrate it to, as `useHydrateAtoms`
// expects. Copied from Jotai's own internal typing so callers get a type-safe
// `initialValues` array.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyWritableAtom = WritableAtom<unknown, any[], unknown>;
export type AtomTuples = (readonly [AnyWritableAtom, ...unknown[]])[];

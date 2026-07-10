import { createStore } from 'jotai';

// A single shared store (the packages/ui pattern) so non-React code — the
// Apollo auth link — can read the token via store.get.
export const store = createStore();

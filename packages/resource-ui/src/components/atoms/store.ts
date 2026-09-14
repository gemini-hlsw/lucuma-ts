import { createStore } from 'jotai';

// One explicit store rather than Jotai's implicit default, so non-React code can
// read the same atoms the components do, through `store.get`.
export const store = createStore();

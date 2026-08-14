import { useState } from 'react';

import { isNotNullish } from './functions.ts';

/**
 * Local state that follows an incoming (eg. server) value, but keeps local edits until the incoming value changes.
 *
 * Comparing the incoming value against the current state instead would undo every local edit on the next render,
 * so we compare it against the previous incoming value. Nullish incoming values are ignored.
 */
export function useSyncedState<T>(incoming: T | null | undefined, initial: T) {
  const [value, setValue] = useState(isNotNullish(incoming) ? incoming : initial);
  const [prevIncoming, setPrevIncoming] = useState(incoming);

  if (incoming !== prevIncoming) {
    setPrevIncoming(incoming);
    if (isNotNullish(incoming)) setValue(incoming);
  }

  return [value, setValue] as const;
}

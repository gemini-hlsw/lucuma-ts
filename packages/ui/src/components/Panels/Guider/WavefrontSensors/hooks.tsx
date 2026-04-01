import { isNotNullish, isNullish, when } from '@gemini-hlsw/lucuma-common-ui';
import { useState } from 'react';

const findLabel = <T,>(options: { value: T; label: string }[], value: T | undefined) =>
  options.find((o) => o.value === value)?.label;

export function useMovingLabel<T>(loading: boolean, state: T | undefined, options: { value: T; label: string }[]) {
  const [requestedState, setRequestedState] = useState<T | null>(null);

  if (!loading && requestedState === state && isNotNullish(state)) {
    setRequestedState(null);
  }

  // Moving if:
  // - query has loaded (after mounting component)
  // - state is nullish or different to requested state
  const isMoving = !loading && isNotNullish(requestedState) && (isNullish(state) || requestedState !== state);

  return [
    when(
      isMoving,
      () => `${findLabel(options, state) ?? 'moving'} ➡️ ${findLabel(options, requestedState) ?? 'unknown'}`,
    ),
    setRequestedState,
  ] as const;
}

import { useSyncExternalStore } from 'react';

let liveFailure: string | null = null;
const listeners = new Set<() => void>();

const setLiveFailure = (failure: string | null): void => {
  if (liveFailure === failure) {
    return;
  }
  liveFailure = failure;
  for (const listener of listeners) {
    listener();
  }
};

export const reportLiveFailure = (message: string): void => {
  setLiveFailure(message);
};

/** So the banner names a situation the app is still in rather than one it recovered from. */
export const clearLiveFailure = (): void => {
  setLiveFailure(null);
};

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** The live link's last failure, or null while everything answers. */
export const useLiveFailure = (): string | null => useSyncExternalStore(subscribe, () => liveFailure);

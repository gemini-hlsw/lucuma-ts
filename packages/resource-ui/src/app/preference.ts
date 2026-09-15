import { useSyncExternalStore } from 'react';

type Listener = () => void;

/**
 * A reading habit the browser remembers: not in the URL, because a shared link must open on the
 * recipient's own habit rather than the sender's.
 *
 * `useSyncExternalStore` rather than component state, so every reader re-renders when any one of
 * them writes - the masthead and the charts read the same choice from different trees.
 */
export function createPreference<T extends string>(
  key: string,
  allowed: readonly T[],
  fallback: T,
): readonly [() => T, (value: T) => void] {
  const listeners = new Set<Listener>();

  /** What this session chose, whether or not storage accepted it. Null means storage is the truth. */
  let current: T | null = null;

  const stored = (): T | null => {
    try {
      const raw = localStorage.getItem(key);
      return allowed.find((value) => value === raw) ?? null;
    } catch {
      // Storage can be denied outright (private mode, blocked cookies); a habit is not worth a crash.
      return null;
    }
  };

  const getSnapshot = (): T => current ?? stored() ?? fallback;

  const notify = (): void => {
    for (const listener of listeners) {
      listener();
    }
  };

  // `null` is the clear-everything event, which this preference does not survive either.
  const onStorage = (event: StorageEvent): void => {
    if (event.key === key || event.key === null) {
      // The event only fires where storage works, so another tab's write outranks this session's.
      current = null;
      notify();
    }
  };

  // Registered for the preference's life, not per subscriber: with nobody mounted there is still a
  // session choice to invalidate, and a preference lives as long as the page does.
  window.addEventListener('storage', onStorage);

  const subscribe = (listener: Listener): (() => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  function usePreference(): T {
    return useSyncExternalStore(subscribe, getSnapshot);
  }

  const set = (value: T): void => {
    // Assigned before the write, so a control the reader pressed never silently does nothing.
    current = value;
    try {
      localStorage.setItem(key, value);
    } catch {
      // Denied storage costs the choice its persistence, not its effect on this session.
    }
    notify();
  };

  return [usePreference, set] as const;
}

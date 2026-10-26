import { atom, useAtomValue, useStore } from 'jotai';
import type { Toast, ToastMessage } from 'primereact/toast';
import { type ReactNode, useMemo } from 'react';

/** Toast handle of the mounted outlet, or null. */
export const toastAtom = atom<Toast | null>(null);

/**
 * PrimeReact Toast handle, or null while no outlet is mounted.
 *
 * Use it only for `show` options that `useToastApi` lacks (`sticky`, `closable`), or for `clear`
 * and `replace`. Prefer `useToastApi` otherwise.
 */
export function useToast(): Toast | null {
  return useAtomValue(toastAtom);
}

type Severity = Extract<ToastMessage['severity'], 'success' | 'info' | 'warn' | 'error'>;

/**
 * One method per severity.
 *
 * Each method returns a cleanup function that removes the toast.
 */
export type ToastApi = Record<Severity, (summary: ReactNode, detail?: ReactNode) => () => void>;

const SHORT_LIFE_MS = 3000;
const LONG_LIFE_MS = 5000;

/**
 * Default way to show a toast from a component or hook.
 *
 * @example
 * ```ts
 * const toast = useToastApi();
 *
 * // Removes the toast when the effect cleans up
 * useEffect(() => toast.success('Saved'), [toast]);
 * useEffect(() => error('Save failed', 'Please try again later'), [toast]);
 * ```
 */
export function useToastApi(): ToastApi {
  const store = useStore();
  return useMemo<ToastApi>(() => {
    const show = (severity: Severity, life: number) => (summary: ReactNode, detail?: ReactNode) => {
      const toast = store.get(toastAtom);
      const message: ToastMessage = { severity, summary, detail, life };
      toast?.show(message);
      return () => toast?.remove(message);
    };
    return {
      success: show('success', SHORT_LIFE_MS),
      info: show('info', SHORT_LIFE_MS),
      warn: show('warn', LONG_LIFE_MS),
      error: show('error', LONG_LIFE_MS),
    };
  }, [store]);
}

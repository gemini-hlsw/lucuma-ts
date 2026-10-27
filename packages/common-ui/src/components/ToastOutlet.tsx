import { useSetAtom } from 'jotai';
import { Toast, type ToastProps } from 'primereact/toast';
import { type JSX, useLayoutEffect, useRef } from 'react';

import { toastAtom } from '../toast.ts';

/** Renders a Toast and publishes its handle to `toastAtom`. */
export function ToastOutlet(props: ToastProps): JSX.Element {
  const ref = useRef<Toast>(null);
  const setToast = useSetAtom(toastAtom);

  // Toast creates a new handle on each render. The first handle stays live, so the atom keeps it.
  // Layout effects run before passive effects, so a toast shown on mount reaches the outlet.
  useLayoutEffect(() => {
    setToast(ref.current);
    return () => setToast(null);
  }, [setToast]);

  return <Toast {...props} ref={ref} />;
}

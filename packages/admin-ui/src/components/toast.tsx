import { Toast } from 'primereact/toast';
import { type JSX, type ReactNode, useMemo, useRef } from 'react';

import { type ToastApi, ToastContext } from './toastContext';

/** Provides the app-wide toast API (see toastContext.ts) over one PrimeReact
 *  Toast outlet. */
export function ToastProvider({ children }: { children: ReactNode }): JSX.Element {
  const ref = useRef<Toast>(null);

  const api = useMemo<ToastApi>(
    () => ({
      success: (summary, detail) => ref.current?.show({ severity: 'success', summary, detail, life: 3000 }),
      info: (summary, detail) => ref.current?.show({ severity: 'info', summary, detail, life: 3000 }),
      error: (summary, detail) => ref.current?.show({ severity: 'error', summary, detail, life: 5000 }),
    }),
    [],
  );

  return (
    <ToastContext.Provider value={api}>
      <Toast ref={ref} position="bottom-right" />
      {children}
    </ToastContext.Provider>
  );
}

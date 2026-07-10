import { createContext, useContext } from 'react';

/**
 * App-wide toast notifications — how a Save / Approve / role change reports
 * its outcome. Mount <ToastProvider> (toast.tsx) once at the app root; call
 * useToast() anywhere below it. Context and hook live here, apart from the
 * provider component, so react-refresh can hot-swap the component file.
 */
export interface ToastApi {
  success: (summary: string, detail?: string) => void;
  info: (summary: string, detail?: string) => void;
  error: (summary: string, detail?: string) => void;
}

export const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}

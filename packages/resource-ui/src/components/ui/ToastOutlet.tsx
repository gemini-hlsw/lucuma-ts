import { useSetAtom } from 'jotai';
import { Toast } from 'primereact/toast';
import { type JSX, useEffect, useRef } from 'react';

import { toastAtom } from '@/components/atoms/toast';

export function ToastOutlet(): JSX.Element {
  const ref = useRef<Toast>(null);
  const setToast = useSetAtom(toastAtom);

  // Toast rebuilds its handle every render, so the atom keeps the first one, whose methods stay live.
  useEffect(() => {
    setToast(ref.current);
    return () => setToast(null);
  }, [setToast]);

  // PrimeReact's inline style pins the corner 20px in; its stylesheet sizes the toast as 100% less --toast-indent.
  return <Toast ref={ref} position="bottom-right" className="[--toast-indent:40px]" />;
}

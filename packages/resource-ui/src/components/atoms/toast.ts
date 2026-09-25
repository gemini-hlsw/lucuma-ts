import { atom, useAtomValue } from 'jotai';
import type { Toast } from 'primereact/toast';

export const toastAtom = atom<Toast | null>(null);

export const useToast = () => useAtomValue(toastAtom);

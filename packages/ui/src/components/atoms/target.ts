import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { atomWithReset } from 'jotai/utils';

import type { Target } from '@/types';

interface TargetEdit {
  isVisible: boolean;
  target: Target | null;
}

export const targetEditAtom = atomWithReset<TargetEdit>({
  isVisible: false,
  target: null,
});

export const useTargetEdit = () => useAtom(targetEditAtom);
export const useTargetEditValue = () => useAtomValue(targetEditAtom);
export const useSetTargetEdit = () => useSetAtom(targetEditAtom);

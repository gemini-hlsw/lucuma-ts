import { atom, useAtom, useAtomValue } from 'jotai';

import type { ThemeType } from '@/types';

import { atomWithToggle } from './atomWithToggle';

const themeBoolAtom = atomWithToggle(false);

export const themeAtom = atom(
  (get) => (get(themeBoolAtom) ? 'light' : 'dark'),
  (get, set, nextValue?: ThemeType) => {
    set(themeBoolAtom, nextValue ? nextValue === 'light' : !get(themeBoolAtom));
  },
);

export const useTheme = () => useAtom(themeAtom);
export const useThemeValue = () => useAtomValue(themeAtom);

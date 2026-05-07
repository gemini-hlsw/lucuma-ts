import { atom, useAtom, useAtomValue } from 'jotai';

import { atomWithToggle } from './atomWithToggle';

export type ThemeType = 'light' | 'dark';

const themeBoolAtom = atomWithToggle(false);

export const themeAtom = atom(
  (get): ThemeType => (get(themeBoolAtom) ? 'light' : 'dark'),
  (get, set, nextValue?: ThemeType) => {
    set(themeBoolAtom, nextValue ? nextValue === 'light' : !get(themeBoolAtom));
  },
);

export const useTheme = () => useAtom(themeAtom);
export const useThemeValue = () => useAtomValue(themeAtom);

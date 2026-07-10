import { useCallback, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

/*
 * Theme state, written to `document.body.className` so the Gemini theme's
 * `.light` / `.dark` CSS (loaded in styles/lucuma-ui.scss) takes effect —
 * the same mechanism packages/ui drives from its theme atom.
 */
export function useTheme(initial: Theme = 'dark'): readonly [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(initial);

  useEffect(() => {
    document.body.className = theme;
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  }, []);

  return [theme, toggle];
}

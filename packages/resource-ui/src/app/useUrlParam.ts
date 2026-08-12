/**
 * One page-scoped URL query parameter as state, so every view is linkable.
 *
 * `useSelection` carries the selection every page shares - site, semester,
 * night. This is for the parameters only one page understands:
 * the semester page's view and calendar month, the component finder's filters.
 * Same contract as the shared ones: the URL is the state, so a link reproduces
 * exactly what the sender was looking at, and navigation preserves it.
 *
 * A value equal to the fallback (or empty) is *deleted* from the URL rather
 * than written, so default states keep clean, shareable URLs.
 */
import { useSearchParams } from 'react-router';

export interface UrlParamOptions {
  /**
   * Replace the history entry instead of pushing one. For states that change
   * on every keystroke - a search box - where stepping back through each
   * character would make the back button useless.
   */
  readonly replace?: boolean;
  /**
   * Parameters deleted whenever this one changes: state subordinate to this
   * one, which a new value makes meaningless. The calendar month under the
   * semester view is the standing example - a chart or grid link must carry
   * just the semester, never a month naming a calendar page nobody is on.
   * One update, so the URL never holds the half-changed state.
   */
  readonly clears?: readonly string[];
}

export function useUrlParam(
  key: string,
  fallback: string,
  { replace = false, clears }: UrlParamOptions = {},
): readonly [string, (value: string) => void] {
  const [params, setParams] = useSearchParams();
  const value = params.get(key) ?? fallback;

  const set = (next: string): void => {
    setParams(
      (previous) => {
        const merged = new URLSearchParams(previous);
        if (next === fallback || next === '') {
          merged.delete(key);
        } else {
          merged.set(key, next);
        }
        for (const subordinate of clears ?? []) {
          merged.delete(subordinate);
        }
        return merged;
      },
      { replace },
    );
  };

  return [value, set];
}

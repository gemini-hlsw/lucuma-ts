import { useSearchParams } from 'react-router';

interface UrlParamOptions {
  /** For states that change on every keystroke, where back through each character is useless. */
  readonly replace?: boolean;
  /** Subordinate state a new value makes meaningless, cleared in the same update. */
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

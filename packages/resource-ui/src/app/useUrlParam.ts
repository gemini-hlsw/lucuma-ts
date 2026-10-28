import { useSearchParams } from 'react-router';

interface UrlParamOptions {
  /** For states that change on every keystroke, where back through each character is useless. */
  readonly replace?: boolean;
}

export function useUrlParam(
  key: string,
  fallback: string,
  { replace = false }: UrlParamOptions = {},
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
        return merged;
      },
      { replace },
    );
  };

  return [value, set];
}

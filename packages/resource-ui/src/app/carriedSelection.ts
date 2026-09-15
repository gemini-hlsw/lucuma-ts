import { isNotNullish } from '@gemini-hlsw/lucuma-common-ui';

/** The app-scoped selection: every view reads both, so only these two survive a navigation. */
export const CARRIED_PARAMS = ['site', 'night'] as const;

/** The one answer to what a link carries; page-scoped parameters are dropped at the boundary. */
export function carrySelection(params: URLSearchParams, keys: readonly string[] = CARRIED_PARAMS): URLSearchParams {
  const carried = new URLSearchParams();
  for (const key of keys) {
    const value = params.get(key);
    if (isNotNullish(value)) {
      carried.set(key, value);
    }
  }
  return carried;
}

export function searchString(params: URLSearchParams): string {
  const search = params.toString();
  return search === '' ? '' : `?${search}`;
}

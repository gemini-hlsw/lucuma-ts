import { signedArcSeconds } from '@gemini-hlsw/lucuma-core';
import { formatDate } from 'date-fns';

export function isNotNullish<T>(val: T | undefined | null): val is T {
  return !isNullish(val);
}

export function isNullish(val: unknown): val is undefined | null {
  return val === null || val === undefined;
}

/**
 * When `condition` is not null or undefined, returns the result of calling `trueCase()`, else
 * returns the result of calling `falseCase()` if `falseCase` is defined.
 *
 * This is a convenience wrapper around a ternary expression that makes it a
 * little nicer to write an inline conditional without an else.
 */
export function when<C, T, F = undefined>(
  condition: C | undefined | null | false,
  trueCase: (c: C) => T,
  falseCase?: () => F,
): C extends undefined | null ? F : T {
  return isNullish(condition) || condition === false
    ? (falseCase?.() as C extends undefined | null ? F : T)
    : (trueCase(condition) as C extends undefined | null ? F : T);
}

/**
 * Format unsigned arcseconds of an angle to signed arcseconds, with two decimal places.
 * If the value is nullish, it returns a default value.
 */
export function formatToSignedArcseconds(arcseconds: number | string | undefined | null, defaultValue = 'N/A'): string {
  if (isNullish(arcseconds)) {
    return defaultValue;
  } else {
    const num = typeof arcseconds === 'number' ? arcseconds : parseFloat(arcseconds);
    if (Number.isNaN(num)) {
      return defaultValue;
    }
    return round(signedArcSeconds(num), 2, { useGrouping: false });
  }
}

/**
 * Round a number to a specified number of decimal places
 */
export function round(
  value: number,
  decimals: number,
  options: Omit<Intl.NumberFormatOptions, 'minimumFractionDigits' | 'maximumFractionDigits'> = {},
): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    ...options,
  });
}

/**
 * Get the first element of an array if it has only one element
 */
export function firstIfOnlyOne<T>(arr: T[] | undefined): T | null {
  return arr?.length === 1 ? (arr[0] ?? null) : null;
}

export function groupBy<K extends PropertyKey, T>(arr: T[], criteria: (element: T) => K): Partial<Record<K, T[]>> {
  if (Object.groupBy) return Object.groupBy(arr, criteria);
  else
    return arr.reduce(
      (acc, item) => {
        const key = criteria(item);
        acc[key] ??= [];
        acc[key].push(item);
        return acc;
      },
      // eslint-disable-next-line @typescript-eslint/prefer-reduce-type-parameter
      Object.create(null) as Partial<Record<K, T[]>>,
    );
}

/**
 * Format a date to a string with the format "yyyy-MM-dd HH:mm:ss" or "yyyy-MM-dd HH:mm" if `includeSeconds` is false.
 */
export function formatDateTime(date: Date | string, includeSeconds = true): string {
  return formatDate(new Date(date), includeSeconds ? 'yyyy-MM-dd HH:mm:ss' : 'yyyy-MM-dd HH:mm');
}

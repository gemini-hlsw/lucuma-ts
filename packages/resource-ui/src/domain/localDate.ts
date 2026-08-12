/**
 * Date-only conversions for PrimeReact Calendar inputs, which speak local
 * `Date` objects. ISO observing-night dates must round-trip without a zone
 * shift (a UTC-midnight Date would display as the previous day west of
 * Greenwich), so both directions use the browser's local calendar fields.
 */

/** ISO date -> a local Date for a Calendar control. */
export const isoToLocalDate = (iso: string): Date => {
  const [year = 0, month = 1, day = 1] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
};

/** Local Date -> ISO date (date-only). */
export const localDateToIso = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

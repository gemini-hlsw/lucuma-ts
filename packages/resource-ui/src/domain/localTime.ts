/** No imports on purpose: `mock-server/` reaches this by relative path and cannot resolve `@/`. */
export const SITE_TIME_ZONES = {
  GN: 'Pacific/Honolulu',
  GS: 'America/Santiago',
} as const;

/** Construction is expensive and the label formatters run per block, so cache one per zone. */
export const zoneFormatters = (
  locale: string,
  options: Intl.DateTimeFormatOptions,
): ((timeZone: string) => Intl.DateTimeFormat) => {
  const cache = new Map<string, Intl.DateTimeFormat>();
  return (timeZone) => {
    let formatter = cache.get(timeZone);
    if (formatter === undefined) {
      formatter = new Intl.DateTimeFormat(locale, { ...options, timeZone });
      cache.set(timeZone, formatter);
    }
    return formatter;
  };
};

const offsetParts = zoneFormatters('en-US', {
  hour12: false,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

/** Minutes that `timeZone` is offset from UTC at the given instant. */
export const offsetMinutes = (instant: Date, timeZone: string): number => {
  const parts = offsetParts(timeZone).formatToParts(instant);
  const field = (type: string): number => Number(parts.find((part) => part.type === type)?.value);
  const asUtc = Date.UTC(
    field('year'),
    field('month') - 1,
    field('day'),
    field('hour') % 24,
    field('minute'),
    field('second'),
  );
  return Math.round((asUtc - instant.getTime()) / 60_000);
};

/** Iterated to a fixed point: one pass is an hour out for a local time inside a DST shift. */
export const localDateTimeToUtc = (isoDate: string, hour: number, minute: number, timeZone: string): number => {
  const pad = (value: number): string => value.toString().padStart(2, '0');
  const guess = Date.parse(`${isoDate}T${pad(hour)}:${pad(minute)}:00Z`);
  let instant = guess;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const adjusted = guess - offsetMinutes(new Date(instant), timeZone) * 60_000;
    if (adjusted === instant) {
      return instant;
    }
    instant = adjusted;
  }
  return instant;
};

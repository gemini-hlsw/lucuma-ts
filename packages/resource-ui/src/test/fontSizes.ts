/**
 * Every `fontSize` set anywhere in a Highcharts options tree, for the type-floor tests: DESIGN.md
 * sets chart annotations at Data-small, so a bespoke rem anywhere in the options is a regression.
 */
export const collectFontSizes = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.flatMap(collectFontSizes);
  }
  if (typeof value === 'object' && value !== null) {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, entry]) =>
      key === 'fontSize' && typeof entry === 'string' ? [entry] : collectFontSizes(entry),
    );
  }
  return [];
};

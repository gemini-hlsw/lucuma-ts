/**
 * Filter options that say what choosing them buys.
 *
 * Every filter dropdown in the app carries its counts - "GMOS (12)", "Port 1
 * (2)" - so a reader can see before opening a menu which choice leads
 * somewhere. Three dropdowns wrote that suffix by hand, which is three chances
 * to spell one of them differently.
 *
 * A dropdown offers only what is actually there: an option with a count of zero
 * is a route to an empty table, so the callers filter before they map rather
 * than this rendering "(0)".
 */

/** One dropdown option, in PrimeReact's shape. */
export interface CountedOption<T> {
  readonly label: string;
  readonly value: T;
}

export const countedOption = <T>(value: T, label: string, count: number): CountedOption<T> => ({
  label: `${label} (${String(count)})`,
  value,
});

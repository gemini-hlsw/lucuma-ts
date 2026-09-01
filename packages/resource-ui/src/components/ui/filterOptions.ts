/** One dropdown option, in PrimeReact's shape. */
export interface CountedOption<T> {
  readonly label: string;
  readonly value: T;
}

/** Callers filter zero counts out rather than this rendering "(0)": an option must lead somewhere. */
export const countedOption = <T>(value: T, label: string, count: number): CountedOption<T> => ({
  label: `${label} (${String(count)})`,
  value,
});

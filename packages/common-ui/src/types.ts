/**
 * A labelled value, with a string label and a value of type `T`.
 */
export interface Labelled<T> {
  readonly label: string;
  readonly value: T;
}

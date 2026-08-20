/**
 * A caption bound to the control it names, by id.
 *
 * The mechanism only, with no opinion about pixels: the filter bars and the
 * masthead label their dropdowns identically and lay them out differently, so
 * the layout is a class string each caller supplies and this owns the part
 * that is easy to get subtly wrong.
 *
 * Two things it deliberately does not do, both of which the filter bar used to:
 *
 * - **It does not wrap the control.** Implicit labelling only reaches a
 *   *labelable* element, and most of these controls are PrimeReact Dropdowns,
 *   which render a div plus a hidden input - so a wrapping label named and
 *   focused nothing. Worse, a label's text is everything inside it: wrapping a
 *   Dropdown named it "Instrument All All", the caption plus the control's own
 *   words.
 * - **It does not clone its child to inject the id.** A render prop instead, so
 *   the caller decides which prop carries it - `id` on a native input,
 *   `inputId` on a Dropdown - and the type says the id has to land somewhere.
 *
 * The caption is then the single source of the control's name, and no call site
 * repeats it as an `aria-label`.
 */
import { type JSX, type ReactNode, useId } from 'react';

export interface LabelledControlProps {
  label: string;
  /** Layout for the caption-and-control pair; the caller owns how it reads. */
  className?: string;
  /** Extra classes for the caption itself, where it is styled apart. */
  labelClassName?: string;
  children: (id: string) => ReactNode;
}

export function LabelledControl({ label, className, labelClassName, children }: LabelledControlProps): JSX.Element {
  const id = useId();

  return (
    <div className={className}>
      <label className={labelClassName} htmlFor={id}>
        {label}
      </label>
      {children(id)}
    </div>
  );
}

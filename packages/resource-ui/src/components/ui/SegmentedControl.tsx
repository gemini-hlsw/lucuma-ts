/**
 * Compact segmented control for a single mutually-exclusive choice (GN/GS,
 * Night/Week/Semester, Site/UTC, Full/Partial night, conflict behavior, tile
 * coloring, ...).
 *
 * A thin adapter over PrimeReact `SelectButton`: PrimeReact owns the rendering,
 * selection, keyboard focus roving, and ARIA (role="group" + per-item
 * role="button"/aria-pressed), and the shared theme (styles/shell.css) gives it
 * the dense green look - so there's no custom widget to maintain. The public API
 * is unchanged from the previous hand-rolled control, so call sites don't move.
 *
 * Keyboard: arrow keys move focus between segments; Enter/Space selects the
 * focused one (the standard toolbar pattern SelectButton implements).
 */
import { SelectButton, type SelectButtonChangeEvent } from 'primereact/selectbutton';
import type { JSX } from 'react';

export interface SegmentedOption<T extends string> {
  readonly label: string;
  readonly value: T;
  /** Overrides the accessible name when the visible label is an abbreviation. */
  readonly ariaLabel?: string;
}

interface SegmentedControlProps<T extends string> {
  readonly value: T;
  readonly options: readonly SegmentedOption<T>[];
  readonly onChange: (value: T) => void;
  /** Group label for assistive tech (the control is a single logical choice). */
  readonly ariaLabel: string;
  readonly size?: 'sm' | 'md';
  readonly testId?: string;
}

/** SelectButton item shape: `aria` drives the accessible name (via optionLabel),
 *  while the visible text comes from `label` through the item template - so an
 *  abbreviated label ("GN") can still announce its full name ("Gemini North"). */
interface SegmentedItem<T extends string> {
  readonly label: string;
  readonly value: T;
  readonly aria: string;
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  size = 'md',
  testId,
}: SegmentedControlProps<T>): JSX.Element {
  const items: SegmentedItem<T>[] = options.map((option) => ({
    label: option.label,
    value: option.value,
    aria: option.ariaLabel ?? option.label,
  }));

  return (
    <SelectButton
      value={value}
      options={items}
      optionLabel="aria"
      optionValue="value"
      itemTemplate={(item: SegmentedItem<T>) => item.label}
      // Single, mandatory choice: clicking the selected segment must not clear it.
      allowEmpty={false}
      onChange={(event: SelectButtonChangeEvent) => {
        // allowEmpty={false} keeps a selection, but guard against a null/undefined
        // value defensively rather than forwarding it as a bogus choice.
        if (event.value !== null && event.value !== undefined) {
          onChange(event.value as T);
        }
      }}
      aria-label={ariaLabel}
      data-testid={testId}
      className={size === 'sm' ? 'seg-sm' : undefined}
    />
  );
}

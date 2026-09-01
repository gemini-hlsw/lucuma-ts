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

/** `aria` drives the accessible name, so "GN" can still announce "Gemini North". */
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
        // allowEmpty={false} keeps a selection; guard anyway rather than forward a bogus choice.
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

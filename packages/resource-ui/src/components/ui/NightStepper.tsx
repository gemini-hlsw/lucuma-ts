import { Button } from 'primereact/button';
import { type JSX, useId } from 'react';

import { ChevronLeft, ChevronRight } from './Icons';

interface NightStepperProps {
  /** The ISO date the input shows - a night label, or an evening. */
  readonly value: string;
  /** The date the reader typed, in the same vocabulary `value` is in. */
  readonly onChange: (isoDate: string) => void;
  /** Move by `days` observing nights: negative back, positive forward. */
  readonly onStep: (days: number) => void;
  /** Nights one press of an arrow covers: one on the night view, seven on the week. */
  readonly step: number;
  /** What the input is called for assistive readers, e.g. "Observing night". */
  readonly dateLabel: string;
  /** What one step is called, e.g. "night" - the arrows read "Previous night". */
  readonly stepLabel: string;
  readonly onTonight: () => void;
  /** True when the view already sits on tonight, which disables the button. */
  readonly isTonight: boolean;
}

export function NightStepper({
  value,
  onChange,
  onStep,
  step,
  dateLabel,
  stepLabel,
  onTonight,
  isTonight,
}: NightStepperProps): JSX.Element {
  const dateInputId = useId();

  return (
    // FontAwesome, not `pi pi-x`: this app never loads PrimeIcons, so those render as empty boxes.
    <div className="xp-toolbar">
      <Button size="small" severity="secondary" disabled={isTonight} onClick={onTonight} className="mr-1">
        Tonight
      </Button>
      <Button
        text
        size="small"
        aria-label={`Previous ${stepLabel}`}
        onClick={() => {
          onStep(-step);
        }}
      >
        <ChevronLeft />
      </Button>
      <input
        // `aria-label` is the name, but the field still needs an id or the browser warns.
        id={dateInputId}
        type="date"
        value={value}
        aria-label={dateLabel}
        className="rounded border border-subtle bg-surface px-2 py-1 text-xs text-foreground"
        onChange={(event) => {
          // A cleared input is not a date: the browser reports "" mid-edit.
          if (event.target.value !== '') {
            onChange(event.target.value);
          }
        }}
      />
      <Button
        text
        size="small"
        aria-label={`Next ${stepLabel}`}
        onClick={() => {
          onStep(step);
        }}
      >
        <ChevronRight />
      </Button>
    </div>
  );
}

/**
 * The date toolbar the night and week views share: back to tonight, step, or
 * type a date.
 *
 * The two pages had the same control twice over, differing only in how far a
 * step goes and what the date means. That is the kind of pair that drifts
 * quietly on the parts nobody looks at - the aria labels, the empty-input
 * guard, whether Tonight disables itself - and a reader moving between the two
 * views should not find the same three buttons behaving differently.
 *
 * The stepper owns the chrome and the wiring; the page owns the date
 * vocabulary. The week view shows the evening its first night begins and the
 * night view shows the night's own label, so `value` is whatever the page
 * prints and `onChange` receives exactly that back - the conversion, if any, is
 * the page's, because only the page knows which of the two it is speaking.
 */
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
    // FontAwesome, not PrimeReact's `icon="pi pi-…"`: this app never loads
    // PrimeIcons, so a "pi pi-…" button renders as an empty box.
    <div className="xp-toolbar">
      {/* From a deep link, back to the night in progress without typing a
          date. */}
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
        // The toolbar prints no caption, so `aria-label` is the name - but the
        // field still needs an id, or the browser cannot associate it with
        // anything (and warns about exactly that in the console).
        id={dateInputId}
        type="date"
        value={value}
        aria-label={dateLabel}
        className="rounded border border-subtle bg-surface px-2 py-1 text-xs text-foreground"
        onChange={(event) => {
          // A cleared input is not a date - the browser reports "" mid-edit,
          // and moving the view to it would lose the reader's place.
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

import type { InputNumberProps } from 'primereact/inputnumber';
import { InputNumber } from 'primereact/inputnumber';
import { useRef } from 'react';

/**
 * PrimeReact's `InputNumber`, but `onValueChange` only fires when the value
 * really changed.
 *
 * Since primereact 10.9.8, `InputNumber` echoes every external `value` prop
 * change back through `onValueChange`. Its internal guard compares the DOM
 * input string (`"0.10"`) with the parsed number (`0.1`), so the guard is
 * always true. A component that writes `onValueChange` back to a server then
 * loops: the response updates the `value` prop, the prop echoes back, and the
 * component sends the value again.
 *
 * `InputNumber` also sends the value again on blur when the `value` prop has
 * not caught up yet. A parent that disables the input while it saves hits
 * this: Enter sends the value, Chrome 155+ then blurs the disabled input, and
 * the blur sends the same value a second time.
 *
 * Use this component instead of `InputNumber` everywhere.
 */
export function NumberInput(props: InputNumberProps) {
  // The last value sent to `props.onValueChange`, and the `value` prop at that time.
  const lastSent = useRef<{ value: number | null; propValue: number | null }>(null);

  return (
    <InputNumber
      {...props}
      onValueChange={(e) => {
        const value = e.value ?? null;
        const propValue = props.value ?? null;
        // Drop the echo of the current prop value. A real edit to the same
        // value is also a no-op, so nothing useful is lost.
        if (value === propValue) {
          return;
        }
        // Drop a blur that repeats the value just sent, before the prop caught up.
        if (
          e.originalEvent?.type === 'blur' &&
          lastSent.current?.value === value &&
          lastSent.current.propValue === propValue
        ) {
          return;
        }
        lastSent.current = { value, propValue };
        props.onValueChange?.(e);
      }}
    />
  );
}

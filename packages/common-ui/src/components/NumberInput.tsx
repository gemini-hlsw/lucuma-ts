import type { InputNumberProps } from 'primereact/inputnumber';
import { InputNumber } from 'primereact/inputnumber';

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
 * Use this component instead of `InputNumber` everywhere.
 */
export function NumberInput(props: InputNumberProps) {
  return (
    <InputNumber
      {...props}
      onValueChange={(e) => {
        // Drop the echo of the current prop value. A real edit to the same
        // value is also a no-op, so nothing useful is lost.
        if (e.value === (props.value ?? null)) {
          return;
        }
        props.onValueChange?.(e);
      }}
    />
  );
}

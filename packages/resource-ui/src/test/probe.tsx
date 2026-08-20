/**
 * A probe component for testing the app's URL-state hooks.
 *
 * The hooks in `src/app/` are all about the URL: what a link reproduces, what
 * a control writes, what survives a jump. So the tests drive them the way the
 * app does - a real component inside a real router, real clicks, and the URL
 * itself read back out of the router afterwards - rather than calling the
 * returned functions on a `renderHook` result. The URL is the observable
 * outcome; asserting on a hook's return value would only restate the call.
 *
 * `readout` prints whatever the test wants to assert on, and `actions` renders
 * the buttons that stand in for the app's controls. Both take the hook's own
 * value, so each hook's test says what it drives without a bespoke fixture.
 *
 * **One `Probe` per route.** Two routes rendering this component at the same
 * position let React reuse the fiber across the navigation, so two `use`
 * bodies calling different numbers of hooks is a hook-order violation - it
 * surfaces as a torn-looking error from inside react-router, not as anything
 * that names the cause. Give the second route its own small component.
 */
import type { JSX, ReactNode } from 'react';
import { useLocation } from 'react-router';

export interface ProbeAction {
  /** The button's label, which the test clicks by name. */
  readonly label: string;
  readonly run: () => void;
}

export interface ProbeProps<T> {
  /** The hook under test, called inside the router. */
  readonly use: () => T;
  /** What to print, keyed so a test can wait on one value changing. */
  readonly readout?: (value: T) => Record<string, string>;
  readonly actions?: (value: T) => readonly ProbeAction[];
  readonly children?: ReactNode;
}

/**
 * The URL the router is on, as `pathname?search` - what a copied link would
 * say, which is what these hooks exist to control.
 */
export const PROBE_URL_TESTID = 'probe-url';

export function Probe<T>({ use, readout, actions, children }: ProbeProps<T>): JSX.Element {
  const value = use();
  const location = useLocation();

  return (
    <div>
      <span data-testid={PROBE_URL_TESTID}>{`${location.pathname}${location.search}`}</span>
      {Object.entries(readout?.(value) ?? {}).map(([key, printed]) => (
        <span key={key} data-testid={`probe-${key}`}>
          {printed}
        </span>
      ))}
      {(actions?.(value) ?? []).map((action) => (
        <button key={action.label} type="button" onClick={action.run}>
          {action.label}
        </button>
      ))}
      {children}
    </div>
  );
}

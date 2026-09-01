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

/** `pathname?search` - what a copied link would say, which is what these hooks control. */
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

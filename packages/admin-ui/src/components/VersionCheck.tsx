import { fetchDeployedVersion, isNewerVersion, isNotNullish } from '@gemini-hlsw/lucuma-common-ui';
import { Button } from 'primereact/button';
import { Toast } from 'primereact/toast';
import { type JSX, useEffect, useRef } from 'react';

import { Rotate } from './Icons';

/** How often to ask the server what it is serving. Slower than navigate's
 *  minute: a stale Admin tab is an inconvenience, not an operational risk. */
const POLL_INTERVAL_MS = 5 * 60 * 1000;

/** The commit from a `YYYYMMDD-commit` version, which is what GitHub needs to
 *  show what changed. Admin-specific, so it stays here rather than moving to
 *  common-ui with the rest: this is Explore's version scheme (vite.config.ts),
 *  while navigate and resource stamp `<ref>+YYYYMMDD.commit`, where splitting on
 *  the first `-` would return the whole string. */
function commitOf(version: string): string {
  return version.slice(version.indexOf('-') + 1);
}

interface VersionCheckProps {
  /** The build this tab is running. */
  readonly running?: string;
  /** Reads the version the server is serving; undefined when it can't be read. */
  readonly fetchDeployed?: (signal?: AbortSignal) => Promise<string | undefined>;
  /** Off outside production, where `version.json` isn't emitted and the poll
   *  would read index.html instead. Also keeps the check clear of StrictMode's
   *  dev-only double mount, which would re-announce a dismissed version. */
  readonly enabled?: boolean;
  readonly pollIntervalMs?: number;
}

/** Watches for a newer deployed build and offers to load it (sc-10422).
 *
 *  Its own Toast outlet rather than the app-wide one: this prompt stays until
 *  it is acted on or dismissed, and carries a button, neither of which the
 *  shared fire-and-forget API expresses. */
export function VersionCheck({
  running = import.meta.env.FRONTEND_VERSION,
  fetchDeployed = fetchDeployedVersion,
  enabled = import.meta.env.PROD,
  pollIntervalMs = POLL_INTERVAL_MS,
}: VersionCheckProps = {}): JSX.Element {
  const toast = useRef<Toast>(null);

  useEffect(() => {
    if (!enabled) return;

    const controller = new AbortController();
    const outlet = toast.current;
    // Scoped to this effect run, deliberately, and paired with the `clear` in the
    // cleanup below: the two together mean a run raises at most one prompt and
    // takes it down when it ends. Hoisting this to a ref so a dismissal outlived
    // a re-run would be worse — the cleanup would clear the prompt while the ref
    // suppressed the re-run from raising it again, losing it for good.
    let announced = false;

    async function check(): Promise<void> {
      const deployed = await fetchDeployed(controller.signal);
      // This run is over: the cleanup has already taken its prompt down, so
      // raising one now would resurrect it. `fetchDeployed` is a prop, so the
      // signal alone cannot be relied on — an implementation that ignores it
      // still resolves here long after the abort.
      if (controller.signal.aborted) return;
      // The nullish check is not redundant with isNewerVersion, which returns a
      // plain boolean: commitOf below needs `deployed` narrowed to a string.
      if (announced || !isNotNullish(deployed) || !isNewerVersion(running, deployed)) return;
      announced = true;
      outlet?.show({
        severity: 'info',
        sticky: true,
        detail: (
          <div className="flex flex-col items-end gap-3">
            <span>
              A new version of{' '}
              <a
                href={`https://github.com/gemini-hlsw/lucuma-ts/compare/${commitOf(running)}...${commitOf(deployed)}`}
                target="_blank"
                rel="noreferrer"
                // The toast theme resets anchor decoration, so underline here.
                style={{ textDecoration: 'underline' }}
              >
                Admin
              </a>{' '}
              is available!
            </span>
            <Button
              icon={<Rotate />}
              label="Upgrade"
              onClick={() => {
                window.location.reload();
              }}
            />
          </div>
        ),
      });
    }

    void check();
    const timer = setInterval(() => void check(), pollIntervalMs);
    return () => {
      controller.abort();
      clearInterval(timer);
      // Take the prompt down with the effect that raised it. On unmount React
      // discards the Toast anyway, but when a dependency changes the effect
      // re-runs against the same live outlet, and the new check would stack a
      // second prompt on top of the stale one. `clear` rather than `remove`
      // because this outlet holds nothing else — that is why the component owns
      // one — and `remove` matches by deep equality on the whole message, which
      // a rebuilt element would never satisfy.
      outlet?.clear();
    };
  }, [enabled, running, fetchDeployed, pollIntervalMs]);

  return <Toast ref={toast} position="bottom-right" />;
}

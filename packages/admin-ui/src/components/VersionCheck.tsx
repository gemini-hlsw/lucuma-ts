import { Button } from 'primereact/button';
import { Toast } from 'primereact/toast';
import { type JSX, useEffect, useRef } from 'react';

import { fetchDeployedVersion, isNewerBuild } from '@/lib/version';

import { Rotate } from './Icons';

/** How often to ask the server what it is serving. Slower than navigate's
 *  minute: a stale Admin tab is an inconvenience, not an operational risk. */
const POLL_INTERVAL_MS = 5 * 60 * 1000;

/** `YYYYMMDD-commit`; the commit is what GitHub needs to show what changed. */
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
    let announced = false;

    async function check(): Promise<void> {
      const deployed = await fetchDeployed(controller.signal);
      // Announce once: re-showing on every poll would fight the user's dismissal.
      if (announced || !isNewerBuild(running, deployed)) return;
      announced = true;
      toast.current?.show({
        severity: 'info',
        sticky: true,
        detail: (
          <div className="flex flex-col items-end gap-3">
            <span>
              A new version of{' '}
              <a
                href={`https://github.com/gemini-hlsw/lucuma-ts/compare/${commitOf(running)}...HEAD`}
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
    };
  }, [enabled, running, fetchDeployed, pollIntervalMs]);

  return <Toast ref={toast} position="bottom-right" />;
}

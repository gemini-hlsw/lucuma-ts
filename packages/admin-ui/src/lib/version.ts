/*
 * Detecting that a newer Admin build has been deployed (sc-10422).
 *
 * The running bundle knows its own build as `FRONTEND_VERSION` (vite.config.ts,
 * `YYYYMMDD-commit`). A production build also emits that string to a static
 * `version.json`, so a tab that has been open for a while can compare what it
 * is running against what the server is now serving.
 *
 * Firebase rewrites every unmatched path to `index.html` (see firebase.json),
 * so a missing or not-yet-deployed `version.json` answers 200 with an HTML
 * document rather than a 404. Only a payload that parses to a non-empty version
 * counts as an answer; everything else is treated as "don't know" so the app
 * stays quiet rather than nagging about a version it failed to read.
 */

/** Published by the production build next to index.html. */
const VERSION_URL = `${import.meta.env.BASE_URL}version.json`;

/** The version string from a `version.json` payload (`{ "version": "…" }`),
 *  or undefined if the payload isn't one. */
export function parseDeployedVersion(data: unknown): string | undefined {
  if (data !== null && typeof data === 'object' && 'version' in data) {
    const { version } = data;
    if (typeof version === 'string' && version.length > 0) return version;
  }
  return undefined;
}

/** The version the server is currently serving, or undefined if it can't be
 *  read. Bypasses the HTTP cache so a fresh deploy is seen on the next poll
 *  rather than whenever the CDN entry happens to expire. */
export async function fetchDeployedVersion(signal?: AbortSignal): Promise<string | undefined> {
  try {
    const response = await fetch(VERSION_URL, { cache: 'no-store', signal });
    if (!response.ok) return undefined;
    return parseDeployedVersion(await response.json());
  } catch {
    // Offline, aborted, or the HTML fallback above — all "don't know".
    return undefined;
  }
}

/** Whether `deployed` is a build other than the one running. Equal versions and
 *  an unreadable `deployed` both mean there is nothing to tell the user. */
export function isNewerBuild(running: string, deployed: string | undefined): boolean {
  return deployed !== undefined && deployed !== running;
}

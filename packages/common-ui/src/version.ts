/*
 * Reading the version a deployment is currently serving, shared by every app
 * that wants to notice it is running a build the server has since replaced.
 *
 * Each app's production build stamps its own version into the bundle and emits
 * the same string to a static `version.json` beside `index.html` (see each
 * app's `vite.config.ts`). A long-running tab polls that file and compares.
 * These are the raw reads, with no UI concerns — each app decides how often to
 * poll, what to say, and how the version string is shaped.
 *
 * Static hosting complicates the failure case. Firebase rewrites every
 * unmatched path to `index.html`, so a `version.json` that is missing or not
 * yet deployed answers **200 with an HTML document**, not a 404: `response.ok`
 * is true and the parse is what fails. Only a payload that parses to a
 * non-empty version counts as an answer; a bad status, an unparseable body and
 * a failed request alike mean "don't know", so the app stays quiet rather than
 * nagging about a version it could not read.
 *
 * `VERSION_URL` resolves against the consuming app's own `BASE_URL`, since apps
 * compile this module's source as part of their own bundle.
 */

import { isNotNullish } from './functions.ts';

/** Published by each app's production build next to index.html. */
const VERSION_URL = `${import.meta.env.BASE_URL}version.json`;

/** The version string from a `version.json` payload (`{ "version": "…" }`), or
 *  undefined if the payload isn't one. */
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

/** Whether `deployed` is a build other than `baseline`. A version that could not
 *  be read means there is nothing to tell the user, so it is never "newer".
 *
 *  The baseline is the caller's to choose: an app comparing against the build
 *  baked into the running bundle can announce on the very first read, while one
 *  comparing against the previous poll only announces on a change it observed. */
export function isNewerVersion(baseline: string | null | undefined, deployed: string | null | undefined): boolean {
  return isNotNullish(baseline) && isNotNullish(deployed) && baseline !== deployed;
}

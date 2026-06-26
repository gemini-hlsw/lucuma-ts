// Static file emitted by the build (see `buildVersionFile` in vite.config.ts), served from the app root.
const VERSION_URL = `${import.meta.env.BASE_URL}version.json`;

/**
 * Extracts the UI version string from a parsed `version.json` payload (`{ "version": "v0.1.0+..." }`),
 * returning undefined when the payload is missing or malformed.
 */
export function parseUiVersion(data: unknown): string | undefined {
  if (data && typeof data === 'object' && 'version' in data) {
    const { version } = data;
    if (typeof version === 'string' && version.length > 0) {
      return version;
    }
  }
  return undefined;
}

/**
 * Fetches the UI version published by the current deployment, bypassing the HTTP cache so a freshly
 * deployed build is seen immediately. Returns undefined on any network or parse error.
 */
export async function fetchDeployedUiVersion(signal?: AbortSignal): Promise<string | undefined> {
  try {
    const response = await fetch(VERSION_URL, { cache: 'no-store', signal });
    if (!response.ok) {
      return undefined;
    }
    return parseUiVersion(await response.json());
  } catch {
    return undefined;
  }
}

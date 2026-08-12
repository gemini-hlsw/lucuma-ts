/**
 * The About dialog - the masthead hamburger's "About Resource", mirroring
 * Explore's: the wordmark over the green rule, then the build version with a
 * copy button so a bug report can name the exact build.
 *
 * What it says is about the *running* Resource, locally and hosted alike: the
 * version is baked in at build time (vite.config.ts - git locally, the GitHub
 * ref in CI) and suffixed with the environment the page is actually served
 * from, and the data rows read the live state of the data-source switch.
 */
import { faCheck, faCopy } from '@fortawesome/pro-regular-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Dialog } from 'primereact/dialog';
import { type JSX, useState } from 'react';

import { liveGraphqlEndpoint } from '@/gql/ApolloConfigs';
import { DATA_SOURCE_LABEL, readDataSource } from '@/gql/dataSource';

/**
 * Hostname -> the version-string suffix, matching Explore's scheme. The same
 * hostnames ApolloConfigs maps to endpoints; anything unrecognised - including
 * localhost - is a development serving.
 */
const ENV_SUFFIX = {
  'resource-dev.lucuma.xyz': 'DEV',
  'resource-staging.lucuma.xyz': 'STAGING',
} satisfies Record<string, string>;

const displayVersion = (): string =>
  `${import.meta.env.FRONTEND_VERSION}-${ENV_SUFFIX[window.location.hostname as keyof typeof ENV_SUFFIX] ?? 'DEV'}`;

export function AboutResource({ visible, onHide }: { visible: boolean; onHide: () => void }): JSX.Element {
  const [copied, setCopied] = useState(false);
  const source = readDataSource();
  const version = displayVersion();

  const copyVersion = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(version);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch {
      // Clipboard can be unavailable (permissions, insecure origins); the
      // version stays selectable text either way.
    }
  };

  return (
    <Dialog
      visible={visible}
      onHide={onHide}
      dismissableMask
      resizable={false}
      className="xp-about-dialog w-[26rem] max-w-[92vw]"
      header={<span className="xp-wordmark">Resource</span>}
      data-testid="about-resource"
    >
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 pt-3 text-sm">
        <dt className="text-foreground-muted">Data</dt>
        <dd className="text-foreground-secondary">
          {DATA_SOURCE_LABEL[source]}
          {source === 'DEMO' ? ' - the mock API, executed in the browser' : ''}
        </dd>
        <dt className="text-foreground-muted">{source === 'DEMO' ? 'Populated from' : 'Endpoint'}</dt>
        <dd className="font-mono text-[0.8rem] text-foreground-secondary">
          {source === 'DEMO' ? 'telescope_schedules.xlsx' : liveGraphqlEndpoint}
        </dd>
      </dl>
      <div className="mt-4 flex items-center justify-end gap-2">
        <span className="font-mono text-[0.85rem] text-foreground-muted">Version: {version}</span>
        <button
          type="button"
          className="xp-icon-btn"
          title="Copy the version to the clipboard"
          aria-label="Copy version"
          onClick={() => void copyVersion()}
        >
          <FontAwesomeIcon icon={copied ? faCheck : faCopy} className="text-[0.8rem]" aria-hidden="true" />
        </button>
      </div>
    </Dialog>
  );
}

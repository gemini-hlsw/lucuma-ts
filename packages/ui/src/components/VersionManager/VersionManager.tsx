import { isNotNullish } from '@gemini-hlsw/lucuma-common-ui';
import { useVersion as useConfigsVersion } from '@gql/configs/Version';
import { useVersion as useServerVersion } from '@gql/server/Version';
import { Button } from 'primereact/button';
import type { ToastMessage } from 'primereact/toast';
import { Toast } from 'primereact/toast';
import { useCallback, useEffect, useRef, useState } from 'react';

import { frontendVersion } from '@/Helpers/constants';
import { useToast } from '@/Helpers/toast';
import { fetchDeployedUiVersion } from '@/Helpers/version';

import { RotateRight } from '../Icons';

// 1 minute
const pollInterval = 1000 * 60;

/**
 * Polls the navigate server, configs, and UI versions every minute, showing a toast to reload the page
 * when any of them changes:
 * - the navigate server or configs version changes between polls, or
 * - the deployed UI version (from `version.json`) differs from the running build, meaning a newer UI
 *   has been deployed.
 */
export function VersionManager() {
  const toastRef = useRef<Toast>(null);
  const toast = useToast();

  const server = useServerVersion({ pollInterval });
  const serverVersion = server.data?.serverVersion;
  const prevServerVersion = server.previousData?.serverVersion;

  const configs = useConfigsVersion({ pollInterval });
  const configsVersion = configs.data?.version.serverVersion;
  const prevConfigsVersion = configs.previousData?.version.serverVersion;

  const deployedUiVersion = useDeployedUiVersion();

  const checkAndShowNewVersion = useCallback(
    (prevVersion: string | null | undefined, newVersion: string | null | undefined, serverName: string) => {
      if (isNewVersion(prevVersion, newVersion)) {
        const newVersionAlert: ToastMessage = {
          id: `new-version-${serverName}`,
          severity: 'info',
          summary: `New ${serverName} version`,
          detail: (
            <div>
              <p>
                A new {serverName} version is available ({newVersion}). Please reload the page.
              </p>
              <Button icon={<RotateRight />} label="Reload" onClick={() => window.location.reload()} />
            </div>
          ),
          sticky: true,
        };
        toast?.show(newVersionAlert);
        return () => toast?.remove(newVersionAlert);
      }
      return;
    },
    [toast],
  );

  useEffect(
    () => checkAndShowNewVersion(prevServerVersion, serverVersion, 'server'),
    [serverVersion, prevServerVersion, checkAndShowNewVersion],
  );

  useEffect(
    () => checkAndShowNewVersion(prevConfigsVersion, configsVersion, 'configs server'),
    [prevConfigsVersion, configsVersion, checkAndShowNewVersion],
  );

  useEffect(
    () => checkAndShowNewVersion(frontendVersion, deployedUiVersion, 'UI'),
    [deployedUiVersion, checkAndShowNewVersion],
  );

  return <Toast ref={toastRef} />;
}

/**
 * Polls the deployed UI version from `version.json` and returns it once it differs from the running
 * build. Only runs in production, since the file is emitted by the production build (see vite.config.ts).
 */
function useDeployedUiVersion(): string | undefined {
  const [deployedUiVersion, setDeployedUiVersion] = useState<string>();

  useEffect(() => {
    if (!import.meta.env.PROD) {
      return;
    }
    const controller = new AbortController();
    const check = () =>
      void fetchDeployedUiVersion(controller.signal).then((version) => {
        if (version) setDeployedUiVersion(version);
      });
    check();
    const intervalId = setInterval(check, pollInterval);
    return () => {
      controller.abort('unmounted');
      clearInterval(intervalId);
    };
  }, []);

  return deployedUiVersion;
}

function isNewVersion(prevVersion: string | null | undefined, newVersion: string | null | undefined) {
  return prevVersion !== newVersion && isNotNullish(prevVersion) && isNotNullish(newVersion);
}
